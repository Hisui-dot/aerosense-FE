/*
  ============================================================================
  AeroSense - ESP32 Edge Node (Phase 1: PMS5003 Particulate Reader)
  ============================================================================

  WHAT THIS SKETCH DOES
  ---------------------
  This program runs on an ESP32-WROOM-32E (ESP32 DevKitC, 38-pin). It reads a
  PMS5003 laser particulate sensor over a hardware serial port and, every time
  a complete and valid data packet ("frame") arrives, it prints:

      * PM2.5  (atmospheric)  in micrograms per cubic meter (ug/m3)
      * The count of particles bigger than 0.3 micrometers (per 0.1 L of air)
      * The count of particles bigger than 0.5 micrometers (per 0.1 L of air)

  It also drives a buzzer and a red LED as a simple "vape alarm": when PM2.5
  crosses a threshold, the buzzer and LED blink together until the air clears.

  An SGP40 VOC sensor is wired up and initialized, and its RAW reading is
  printed too, but PM2.5 is what triggers the alarm in this Phase 1 sketch.

  THE GOLDEN RULE: NO delay()
  ---------------------------
  The PMS5003 streams a fresh 32-byte packet roughly once per second, all on
  its own. If we ever call delay() in loop(), the ESP32 stops reading the
  serial port during that pause. The PMS5003's bytes keep arriving, the small
  hardware receive buffer overflows, and frames get chopped in half -> garbage
  readings. So this sketch NEVER uses delay() in the main loop. Instead it uses
  millis() "interval timers": we remember the last time we did something and
  only do it again once enough time has passed. This is the standard Arduino
  way to do several things "at once" without blocking.

  WIRING / PIN MAP  (must match the AeroSense hardware exactly)
  ------------------------------------------------------------
    PMS5003 (particulate, UART):
        PMS TX  -> ESP32 GPIO16 (this is our RX2, ESP32 listens here)
        PMS RX  -> ESP32 GPIO17 (this is our TX2, ESP32 talks here)
        PMS VCC -> 5V / VIN      (the fan needs 5V; the 3.3V rail browns out!)
        PMS GND -> GND           (must share a common ground with the ESP32)
        9600 baud, 8 data bits, no parity, 1 stop bit (SERIAL_8N1)

    SGP40 (VOC, I2C):
        SGP40 SDA -> ESP32 GPIO21
        SGP40 SCL -> ESP32 GPIO22
        SGP40 VCC -> 3.3V         (this sensor is 3.3V, NOT 5V)
        SGP40 GND -> GND
        I2C address 0x59 (the Adafruit library handles this for us)
        (If I2C is flaky, add 4.7k pull-up resistors from SDA->3.3V, SCL->3.3V)

    Buzzer (active piezo):
        GPIO25 -> 220 ohm resistor -> buzzer (+),  buzzer (-) -> GND

    Red LED:
        GPIO26 -> 220 ohm resistor -> LED anode (long leg),
        LED cathode (short leg) -> GND

    Debug USB serial: 115200 baud (open the Serial Monitor at this speed).

  ARDUINO IDE SETUP
  -----------------
    Board:  "ESP32 Dev Module"  (install the Espressif "esp32" board package)
    Library: "Adafruit SGP40 Sensor"  (install via Library Manager FIRST,
             otherwise this sketch will not compile).
    Serial Monitor baud: 115200

  NOTE ON THE SGP40 READING
  -------------------------
  We call sgp.measureRaw(temp, humidity), which returns a uint16_t of RAW
  sensor ticks (typically ~20000-52000) - NOT the 0-500 "VOC Index". If you
  want the calibrated 0-500 index instead, switch to sgp.measureVocIndex(...)
  (returns int32_t) and call it at a steady ~1 Hz (this sketch already does).
  ============================================================================
*/

#include <Wire.h>            // Built-in Arduino library for I2C (the SGP40 bus)
#include "Adafruit_SGP40.h"  // VOC sensor driver (install via Library Manager)

// ---------------------------------------------------------------------------
// PIN ASSIGNMENTS  (named constants so the wiring is obvious and easy to change)
// ---------------------------------------------------------------------------
const int PMS_RX_PIN = 16;   // ESP32 pin that RECEIVES data FROM the PMS5003
const int PMS_TX_PIN = 17;   // ESP32 pin that SENDS data TO the PMS5003
const int SGP_SDA_PIN = 21;  // I2C data line for the SGP40
const int SGP_SCL_PIN = 22;  // I2C clock line for the SGP40
const int BUZZER_PIN  = 25;  // Active piezo buzzer (HIGH = sound)
const int LED_PIN     = 26;  // Red status / alarm LED (HIGH = lit)

// ---------------------------------------------------------------------------
// PMS5003 PROTOCOL CONSTANTS
// ---------------------------------------------------------------------------
// Each PMS5003 frame is exactly 32 bytes. The first two bytes are a fixed
// "start of frame" signature: 0x42 ('B') then 0x4D ('M'). We hunt for those
// two bytes to know where a packet begins.
const uint8_t  PMS_START_BYTE_1 = 0x42;
const uint8_t  PMS_START_BYTE_2 = 0x4D;
const int      PMS_FRAME_LENGTH = 32;   // total bytes in one full frame

// Detection threshold. When PM2.5 (atmospheric) goes at or above this many
// ug/m3, we treat it as a possible vape event and sound the alarm.
const int PM25_VAPE_THRESHOLD = 35;     // micrograms per cubic meter

// ---------------------------------------------------------------------------
// SGP40 VOC SENSOR OBJECT
// ---------------------------------------------------------------------------
Adafruit_SGP40 sgp;            // the VOC sensor driver instance
bool sgpReady = false;         // true once the SGP40 is found on the I2C bus

// ---------------------------------------------------------------------------
// NON-BLOCKING TIMERS (millis-based). All times are in milliseconds.
// ---------------------------------------------------------------------------
// millis() returns how many ms the ESP32 has been running. We compare it to a
// saved timestamp to decide "has enough time passed yet?" without ever pausing.

unsigned long lastVocReadMs = 0;          // when we last read the SGP40
const unsigned long vocReadIntervalMs = 1000;   // read VOC once per second

unsigned long lastAlarmToggleMs = 0;      // when we last flipped the alarm
const unsigned long alarmToggleIntervalMs = 250; // blink/beep every 250 ms

// ---------------------------------------------------------------------------
// PMS5003 FRAME-ASSEMBLY STATE
// ---------------------------------------------------------------------------
// We read serial bytes one at a time as they trickle in (non-blocking). We
// collect them into this buffer until we have a full 32-byte frame, then check
// it. "frameIndex" tracks how many bytes of the current frame we have so far.
uint8_t pmsBuffer[PMS_FRAME_LENGTH];   // holds the frame as we build it
int     frameIndex = 0;                // how many valid bytes collected so far

// Latest decoded sensor values (updated only when a good frame arrives).
int      latestPm25 = 0;               // PM2.5 atmospheric, ug/m3
uint16_t latestCount03 = 0;            // particles > 0.3um per 0.1 L
uint16_t latestCount05 = 0;            // particles > 0.5um per 0.1 L
uint16_t latestVocRaw = 0;             // SGP40 RAW measurement (uint16_t ticks)

// Alarm state.
bool vapeIncidentFlag = false;         // true while PM2.5 is over threshold
bool alarmOutputState = false;         // current on/off state of buzzer+LED

// ===========================================================================
// setup() - runs once at power-up / reset
// ===========================================================================
void setup() {
  // --- 1. Start the debug serial port so we can read messages on the PC ---
  Serial.begin(115200);
  delay(200);  // ONE-TIME pause, only here in setup() (NOT in loop) so the USB
               // serial link has a moment to come up before we print. This is
               // safe: the PMS5003 is not being read yet, so nothing corrupts.
  Serial.println();
  Serial.println(F("================================================"));
  Serial.println(F("  AeroSense ESP32 Node - PMS5003 + SGP40"));
  Serial.println(F("================================================"));

  // --- 2. Set up the actuator pins as outputs and make sure they're OFF ---
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);   // buzzer silent
  digitalWrite(LED_PIN, LOW);      // LED off

  // --- 3. Start Serial2 (the hardware UART wired to the PMS5003) ---------
  // Serial2 is one of the ESP32's three hardware serial ports. We tell it the
  // baud rate (9600), the format (8 data bits, No parity, 1 stop bit), and
  // which pins to use for RX (receive) and TX (transmit).
  Serial2.begin(9600, SERIAL_8N1, PMS_RX_PIN, PMS_TX_PIN);
  Serial.println(F("[OK] Serial2 started for PMS5003 (9600 8N1, RX=16 TX=17)"));

  // --- 4. Start the I2C bus and find the SGP40 VOC sensor ----------------
  Wire.begin(SGP_SDA_PIN, SGP_SCL_PIN);   // SDA=21, SCL=22
  if (sgp.begin()) {                      // begin(TwoWire* = &Wire) -> bool
    sgpReady = true;
    Serial.println(F("[OK] SGP40 VOC sensor found on I2C (addr 0x59)"));
  } else {
    sgpReady = false;
    Serial.println(F("[WARN] SGP40 NOT found - check SDA/SCL/3.3V wiring."));
    Serial.println(F("       The sketch will keep running with PM2.5 only."));
  }

  Serial.println(F("------------------------------------------------"));
  Serial.println(F("Waiting for PMS5003 data (about 1 frame/second)..."));
  Serial.println(F("------------------------------------------------"));
}

// ===========================================================================
// loop() - runs over and over, very fast, forever. NO delay() in here!
// ===========================================================================
void loop() {
  // Each pass through loop() we do three independent jobs, none of which block:
  //   (A) drain any PMS5003 bytes waiting in the serial buffer,
  //   (B) read the VOC sensor on its own slow timer,
  //   (C) update the alarm (blink buzzer/LED) on its own fast timer.

  readPmsSerial();        // (A) keep the UART buffer empty -> healthy frames
  readVocOnInterval();    // (B) sample the SGP40 about once per second
  updateAlarmOnInterval();// (C) blink/beep if a vape incident is active
}

// ---------------------------------------------------------------------------
// (A) readPmsSerial()
// Non-blocking PMS5003 reader. Called every loop. It pulls in however many
// bytes are currently available (could be 0, could be several), assembles them
// into a 32-byte frame, and validates the frame before using it.
// ---------------------------------------------------------------------------
void readPmsSerial() {
  // Process every byte that is sitting in the receive buffer right now, then
  // return. We do NOT wait for more - if there's nothing, we just leave and
  // let loop() come back around. This is the heart of "non-blocking".
  while (Serial2.available() > 0) {
    uint8_t incomingByte = Serial2.read();

    // --- Synchronize on the 2-byte start signature (0x42 0x4D) ----------
    // We only trust a frame if it begins with the magic bytes. While we have
    // not yet locked on, we treat each incoming byte as a candidate header.
    if (frameIndex == 0) {
      // Looking for the FIRST start byte (0x42).
      if (incomingByte == PMS_START_BYTE_1) {
        pmsBuffer[frameIndex] = incomingByte;  // store byte 0
        frameIndex = 1;                        // advance: expect 0x4D next
      }
      // If it's not 0x42, ignore it and keep scanning (stay at index 0).
      continue;
    }

    if (frameIndex == 1) {
      // Looking for the SECOND start byte (0x4D).
      if (incomingByte == PMS_START_BYTE_2) {
        pmsBuffer[frameIndex] = incomingByte;  // store byte 1
        frameIndex = 2;                        // header locked; collect body
      } else {
        // Mismatch. Maybe THIS byte is itself a fresh 0x42 starting a new
        // frame, so re-evaluate from index 0 instead of throwing it away.
        frameIndex = 0;
        if (incomingByte == PMS_START_BYTE_1) {
          pmsBuffer[0] = incomingByte;
          frameIndex = 1;
        }
      }
      continue;
    }

    // --- We are inside the body of the frame (indices 2..31) -------------
    pmsBuffer[frameIndex] = incomingByte;
    frameIndex++;

    // Once we have all 32 bytes, validate and (if good) decode the frame.
    if (frameIndex >= PMS_FRAME_LENGTH) {
      processPmsFrame();
      frameIndex = 0;   // reset to hunt for the next frame's start bytes
    }
  }
}

// ---------------------------------------------------------------------------
// processPmsFrame()
// Called once we have a full 32-byte buffer. Verifies the checksum, and if it
// passes, extracts the values we care about and prints them.
// ---------------------------------------------------------------------------
void processPmsFrame() {
  // --- Checksum: the last two bytes (30 and 31) are the sum of bytes 0..29.
  // Byte 30 is the HIGH byte, byte 31 is the LOW byte of that 16-bit sum.
  uint16_t computedChecksum = 0;
  for (int i = 0; i < PMS_FRAME_LENGTH - 2; i++) {   // i = 0..29
    computedChecksum += pmsBuffer[i];
  }
  uint16_t frameChecksum =
      ((uint16_t)pmsBuffer[30] << 8) | (uint16_t)pmsBuffer[31];

  if (computedChecksum != frameChecksum) {
    // Bad checksum means the frame was corrupted (often from a stray delay()
    // somewhere, electrical noise, or a loose wire). Skip it - do NOT use it.
    Serial.println(F("[PMS] Checksum mismatch - frame discarded."));
    return;
  }

  // --- The frame is valid. Each value is two bytes: HIGH first, then LOW. --
  // Helper-style decode: combine the high byte and low byte into one number.
  //   value = (highByte << 8) | lowByte
  //
  // Byte layout we use (per the PMS5003 datasheet / AeroSense spec):
  //   bytes 12-13 = PM2.5 concentration, atmospheric environment (ug/m3)
  //   bytes 16-17 = number of particles > 0.3 um in 0.1 L of air
  //   bytes 18-19 = number of particles > 0.5 um in 0.1 L of air

  latestPm25 =
      ((int)pmsBuffer[12] << 8) | (int)pmsBuffer[13];
  latestCount03 =
      ((uint16_t)pmsBuffer[16] << 8) | (uint16_t)pmsBuffer[17];
  latestCount05 =
      ((uint16_t)pmsBuffer[18] << 8) | (uint16_t)pmsBuffer[19];

  // --- Update the alarm decision based on the fresh PM2.5 reading ---------
  if (latestPm25 >= PM25_VAPE_THRESHOLD) {
    vapeIncidentFlag = true;    // air is dirty -> alarm should be blinking
  } else {
    vapeIncidentFlag = false;   // air is clean -> alarm off
  }

  // --- Print a clean, human-readable summary for the Serial Monitor -------
  Serial.print(F("[PMS] PM2.5 = "));
  Serial.print(latestPm25);
  Serial.print(F(" ug/m3   | >0.3um = "));
  Serial.print(latestCount03);
  Serial.print(F("   | >0.5um = "));
  Serial.print(latestCount05);

  if (sgpReady) {
    Serial.print(F("   | VOC raw = "));
    Serial.print(latestVocRaw);
  }

  if (vapeIncidentFlag) {
    Serial.print(F("   *** VAPE ALERT (PM2.5 >= "));
    Serial.print(PM25_VAPE_THRESHOLD);
    Serial.print(F(") ***"));
  }
  Serial.println();
}

// ---------------------------------------------------------------------------
// (B) readVocOnInterval()
// Reads the SGP40 about once per second using a millis() timer, so it never
// blocks the PMS5003 reader. The SGP40 needs temperature + humidity to give a
// compensated reading; with no humidity sensor wired, we pass typical indoor
// defaults (25 C, 50% RH). This still gives a useful relative VOC signal.
//
// NOTE: measureRaw(float, float) returns a uint16_t of RAW sensor ticks
// (not the 0-500 VOC Index). To get the calibrated index instead, replace the
// call below with: latestVocIndex = sgp.measureVocIndex(temp, humidity);
// (and change latestVocRaw to an int32_t named latestVocIndex).
// ---------------------------------------------------------------------------
void readVocOnInterval() {
  if (!sgpReady) {
    return;  // no sensor found at startup -> nothing to do
  }

  unsigned long now = millis();
  // "Has at least vocReadIntervalMs passed since the last read?" If not, leave.
  if (now - lastVocReadMs < vocReadIntervalMs) {
    return;
  }
  lastVocReadMs = now;  // remember this moment as the new "last read" time

  float defaultTemperatureC = 25.0;   // assumed room temperature
  float defaultHumidityRH   = 50.0;   // assumed relative humidity (%)
  latestVocRaw = sgp.measureRaw(defaultTemperatureC, defaultHumidityRH);
  // Note: we store the value here and print it alongside the next PMS frame so
  // the Serial Monitor stays tidy (one combined line per particulate reading).
}

// ---------------------------------------------------------------------------
// (C) updateAlarmOnInterval()
// If a vape incident is active, blink the LED and pulse the buzzer together on
// a fast millis() timer. If no incident, force both OFF. No delay() used, so
// the PMS5003 keeps being read smoothly even while the alarm is sounding.
// ---------------------------------------------------------------------------
void updateAlarmOnInterval() {
  if (!vapeIncidentFlag) {
    // Air is clean: make sure outputs are off and reset the toggle state.
    if (alarmOutputState) {
      alarmOutputState = false;
      digitalWrite(BUZZER_PIN, LOW);
      digitalWrite(LED_PIN, LOW);
    }
    return;
  }

  // Incident active: flip the buzzer+LED on/off every alarmToggleIntervalMs.
  unsigned long now = millis();
  if (now - lastAlarmToggleMs < alarmToggleIntervalMs) {
    return;  // not time to flip yet
  }
  lastAlarmToggleMs = now;

  alarmOutputState = !alarmOutputState;          // flip on<->off
  digitalWrite(BUZZER_PIN, alarmOutputState ? HIGH : LOW);
  digitalWrite(LED_PIN,    alarmOutputState ? HIGH : LOW);
}
