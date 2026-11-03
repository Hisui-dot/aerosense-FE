/*
  ============================================================================
  AeroSense - ESP8266 Sensor Test (NO Wi-Fi)  -  wiring bring-up sketch
  ============================================================================

  WHAT THIS SKETCH DOES
  ---------------------
  This is the "does my wiring work?" sketch for the ESP8266 build of AeroSense.
  It reads BOTH air-quality sensors and prints them to the Serial Monitor about
  once per second. There is NO Wi-Fi here on purpose - get the sensors proven
  first, THEN move on to the Cloud sketch that uploads to the dashboard.

      * PMS5003  -> PM2.5 (atmospheric) in micrograms/m3, plus particle counts
      * SGP40    -> VOC Index (0..500, ~100 = "normal" baseline for your room)

  TARGET BOARD
  ------------
    ESP8266 "NodeMCU 1.0 (ESP-12E)" (the common dev board with the CH340 USB
    chip). The pin LABELS below (D5, D6, D1, D2, D7, D0) are the silkscreen
    names printed on the board, so they are easy to follow.

    USING A WEMOS / LOLIN D1 mini INSTEAD? Good news: the D1 mini uses the SAME
    D-label -> GPIO mapping (D5=GPIO14, D6=GPIO12, D1=GPIO5, D2=GPIO4,
    D7=GPIO13, D0=GPIO16). So this sketch runs UNCHANGED on a D1 mini. The only
    thing that ever changes between these boards is the pin labels, and these
    labels already match both.

  WHY A SoftwareSerial FOR THE PMS5003?
  -------------------------------------
  The ESP8266 has only ONE hardware UART, and it is already used by the USB
  connection / Serial Monitor (115200 baud). The PMS5003 also speaks UART
  (9600 baud), so we give it its OWN software-emulated serial port using the
  EspSoftwareSerial library (bundled with the ESP8266 board package - no extra
  install). We read it on pin D5.

  THE GOLDEN RULE: NO delay()
  ---------------------------
  The PMS5003 streams a fresh 32-byte packet about once per second on its own.
  If we ever call delay() in loop(), we stop reading the serial port during that
  pause, the SoftwareSerial receive buffer overflows, and frames get chopped in
  half -> garbage. So this sketch NEVER calls delay() in loop(). It drains the
  PMS serial buffer on EVERY loop pass and uses a millis() timer for the slower
  SGP40 read + Serial printout.

  WIRING / PIN MAP  (NodeMCU 1.0 ESP-12E)
  ---------------------------------------
    PMS5003 (particulate, UART @ 9600 8N1):
        PMS TX  -> D5 (GPIO14)  = SoftwareSerial RX  [data FROM sensor INTO ESP]
        PMS RX  -> D6 (GPIO12)  = SoftwareSerial TX  [usually optional]
        PMS VCC -> 5V / VIN     (the fan needs 5V; 3.3V browns it out!)
        PMS GND -> GND
    SGP40 (VOC, I2C, address 0x59):
        SGP SDA -> D2 (GPIO4)
        SGP SCL -> D1 (GPIO5)
        SGP VCC -> 3.3V         (the SGP40 is a 3.3V part, NOT 5V)
        SGP GND -> GND
        (If I2C is flaky, add 4.7k pull-ups: SDA->3.3V and SCL->3.3V)
    Actuators (reserved here so the wiring matches the full project; this test
    sketch does NOT drive them):
        Buzzer + -> 220 ohm -> D7 (GPIO13),  Buzzer - -> GND
        LED anode -> 220 ohm -> D0 (GPIO16), LED cathode -> GND

    COMMON GROUND: the ESP8266, both sensors, and the 5V supply must all share
    the same GND, or the readings will be nonsense.

  ARDUINO IDE SETUP (one time)
  ----------------------------
    1. File -> Preferences -> "Additional Boards Manager URLs", add:
         http://arduino.esp8266.com/stable/package_esp8266com_index.json
    2. Tools -> Board -> Boards Manager -> install "esp8266 by ESP8266 Community".
    3. Tools -> Board -> select "NodeMCU 1.0 (ESP-12E)".
    4. Tools -> Manage Libraries -> install "Adafruit SGP40 Sensor"
       (this also pulls in "Adafruit BusIO"). SoftwareSerial + Wire are built in.
    5. Tools -> Port -> pick the COM port that appears when you plug in the board
       (install the CH340 USB driver first if no port shows up).
    6. Set the Serial Monitor to 115200 baud.

  HOW TO CONFIRM IT IS WORKING
  ----------------------------
    Open the Serial Monitor @115200. Within a few seconds you should see lines
    like:
        [12s] PM2.5 = 7 ug/m3 | >0.3um=420 | >0.5um=120 | VOC Index=103
    Breathe some vapor/spray near the sensors and the numbers should jump. If
    PM2.5 stays "(no PMS frames yet)", recheck the 5V power and the D5 wiring.
    If VOC Index says "(SGP40 not found)", recheck SDA=D2 / SCL=D1 / 3.3V.
  ============================================================================
*/

#include <SoftwareSerial.h>   // EspSoftwareSerial - bundled with the ESP8266 core
#include <Wire.h>             // Built-in I2C library (for the SGP40 bus)
#include <Adafruit_SGP40.h>   // SGP40 VOC sensor driver (install via Library Manager)

// ---------------------------------------------------------------------------
// PIN ASSIGNMENTS  (D-labels are the silkscreen names on the NodeMCU board)
// ---------------------------------------------------------------------------
const uint8_t PMS_RX_PIN  = D5;  // GPIO14 - SoftwareSerial RX  <- PMS5003 TX
const uint8_t PMS_TX_PIN  = D6;  // GPIO12 - SoftwareSerial TX  -> PMS5003 RX (optional)
const uint8_t SGP_SDA_PIN = D2;  // GPIO4  - I2C SDA
const uint8_t SGP_SCL_PIN = D1;  // GPIO5  - I2C SCL
const uint8_t BUZZER_PIN  = D7;  // GPIO13 - reserved (not driven in this test)
const uint8_t LED_PIN     = D0;  // GPIO16 - reserved (not driven in this test)

// ---------------------------------------------------------------------------
// PMS5003 PROTOCOL CONSTANTS
//   Every frame is exactly 32 bytes and starts with 0x42 0x4D ('B' 'M').
//   Values are big-endian 16-bit:  value = (highByte << 8) | lowByte
//     bytes 2..3   : frame length field (== 28 for a valid frame)
//     bytes 12..13 : PM2.5 atmospheric (ug/m3)   <- what we report
//     bytes 16..17 : count of particles >= 0.3um per 0.1 L
//     bytes 18..19 : count of particles >= 0.5um per 0.1 L
//     bytes 30..31 : checksum = sum of bytes 0..29
// ---------------------------------------------------------------------------
const uint8_t PMS_START_BYTE_1 = 0x42;
const uint8_t PMS_START_BYTE_2 = 0x4D;
const uint8_t PMS_FRAME_LENGTH = 32;

// ---------------------------------------------------------------------------
// SoftwareSerial port wired to the PMS5003 (RX on D5, TX on D6).
//   We drain this on EVERY loop() pass. The default RX buffer easily holds a
//   32-byte frame, and we never let it sit, so it never overflows.
// ---------------------------------------------------------------------------
SoftwareSerial pmsSerial(PMS_RX_PIN, PMS_TX_PIN);  // (RX, TX)

// ---------------------------------------------------------------------------
// SGP40 VOC sensor
// ---------------------------------------------------------------------------
Adafruit_SGP40 sgp;
bool sgpReady = false;

// The SGP40's algorithm compensates for temperature + humidity. We have no
// T/RH sensor wired, so we feed typical indoor defaults. This is fine for a
// bring-up test and still gives a useful relative VOC signal.
const float NOMINAL_TEMP_C = 25.0f;
const float NOMINAL_RH_PCT = 50.0f;

// ---------------------------------------------------------------------------
// NON-BLOCKING TIMERS (millis-based, all in milliseconds)
// ---------------------------------------------------------------------------
const unsigned long VOC_READ_INTERVAL_MS = 1000;   // sample the SGP40 ~1x/sec
const unsigned long PRINT_INTERVAL_MS    = 1000;   // print a summary ~1x/sec
unsigned long lastVocReadMs = 0;
unsigned long lastPrintMs   = 0;

// ---------------------------------------------------------------------------
// PMS5003 FRAME-ASSEMBLY STATE + latest decoded values
// ---------------------------------------------------------------------------
uint8_t pmsBuffer[PMS_FRAME_LENGTH];  // holds the frame as we build it byte by byte
uint8_t frameIndex = 0;               // how many bytes of the frame we have so far

int      latestPm25    = 0;   // PM2.5 atmospheric (ug/m3)
uint16_t latestCount03 = 0;   // particles >= 0.3um per 0.1 L
uint16_t latestCount05 = 0;   // particles >= 0.5um per 0.1 L
int32_t  latestVocIndex = 0;  // SGP40 VOC Index (0..500, 100 = baseline)
bool     pmsHasData = false;  // becomes true after the first valid frame
unsigned long pmsLastFrameMs = 0;  // millis() when the last good frame arrived

// Helper: combine two bytes into one big-endian 16-bit value.
static inline uint16_t be16(const uint8_t *p) {
  return ((uint16_t)p[0] << 8) | (uint16_t)p[1];
}

// ===========================================================================
// setup() - runs once at power-up / reset
// ===========================================================================
void setup() {
  // --- USB debug serial. Set the Serial Monitor to 115200 to read this. ---
  Serial.begin(115200);
  delay(200);  // ONE-TIME boot pause, only here in setup() (never in loop), so
               // the USB serial is ready before we print the banner. Nothing is
               // being parsed yet, so this cannot corrupt a PMS frame.
  Serial.println();
  Serial.println(F("================================================"));
  Serial.println(F("  AeroSense ESP8266 - Sensor Test (no Wi-Fi)"));
  Serial.println(F("================================================"));

  // --- Reserve the actuator pins (kept LOW; this test does not alarm). ---
  pinMode(BUZZER_PIN, OUTPUT); digitalWrite(BUZZER_PIN, LOW);
  pinMode(LED_PIN,    OUTPUT); digitalWrite(LED_PIN,    LOW);

  // --- Start the SoftwareSerial port to the PMS5003 (9600 8N1). ---
  pmsSerial.begin(9600);
  Serial.println(F("[PMS5003] SoftwareSerial started @9600 (RX=D5/GPIO14)"));

  // --- Start I2C and find the SGP40. If missing, keep running with PM2.5. ---
  Wire.begin(SGP_SDA_PIN, SGP_SCL_PIN);   // (SDA=D2, SCL=D1)
  sgpReady = sgp.begin();
  if (sgpReady) {
    Serial.println(F("[SGP40]   Found on I2C (addr 0x59). VOC warmup takes a bit."));
  } else {
    Serial.println(F("[SGP40]   NOT found! Check SDA=D2, SCL=D1, VCC=3.3V, GND."));
  }

  Serial.println(F("------------------------------------------------"));
  Serial.println(F("Waiting for sensor data (about 1 reading/second)..."));
  Serial.println(F("------------------------------------------------"));
}

// ===========================================================================
// loop() - runs forever, very fast. NO delay() in here!
// ===========================================================================
void loop() {
  // (A) Drain the PMS5003 serial buffer EVERY pass. Most important line for
  //     non-blocking behavior - it keeps incoming frames from overflowing.
  readPmsSerial();

  // (B) Read the SGP40 on its own 1-second timer.
  readVocOnInterval();

  // (C) Print a combined summary line on a 1-second timer.
  printSummaryOnInterval();
}

// ---------------------------------------------------------------------------
// (A) readPmsSerial()
// Non-blocking PMS5003 reader. Processes whatever bytes are sitting in the
// SoftwareSerial buffer right now, assembles a 32-byte frame, validates the
// checksum, and (if good) decodes the values we care about.
// ---------------------------------------------------------------------------
void readPmsSerial() {
  while (pmsSerial.available() > 0) {
    uint8_t incomingByte = (uint8_t)pmsSerial.read();

    // --- Sync on the 2-byte start signature 0x42 0x4D ---
    if (frameIndex == 0) {
      if (incomingByte == PMS_START_BYTE_1) {   // looking for first start byte
        pmsBuffer[0] = incomingByte;
        frameIndex = 1;
      }
      continue;                                 // otherwise keep hunting
    }
    if (frameIndex == 1) {
      if (incomingByte == PMS_START_BYTE_2) {   // looking for second start byte
        pmsBuffer[1] = incomingByte;
        frameIndex = 2;                         // header locked; collect body next
      } else if (incomingByte == PMS_START_BYTE_1) {
        pmsBuffer[0] = incomingByte;            // this byte might start a new frame
        frameIndex = 1;
      } else {
        frameIndex = 0;                         // not a header, start over
      }
      continue;
    }

    // --- Inside the body of the frame (indices 2..31) ---
    pmsBuffer[frameIndex++] = incomingByte;
    if (frameIndex >= PMS_FRAME_LENGTH) {
      processPmsFrame();   // we have all 32 bytes - validate + decode
      frameIndex = 0;      // reset to hunt for the next frame's header
    }
  }
}

// ---------------------------------------------------------------------------
// processPmsFrame() - verify checksum, and if valid, decode the fields.
// ---------------------------------------------------------------------------
void processPmsFrame() {
  // Checksum = sum of bytes 0..29, stored big-endian in bytes 30..31.
  uint16_t computed = 0;
  for (uint8_t i = 0; i < PMS_FRAME_LENGTH - 2; i++) computed += pmsBuffer[i];
  uint16_t frameChecksum = be16(&pmsBuffer[30]);
  uint16_t frameLen      = be16(&pmsBuffer[2]);   // should be 28

  if (computed != frameChecksum || frameLen != 28) {
    // Corrupted frame (noise, a loose wire, or a stray delay() somewhere).
    // Skip it - do NOT use bad data. We will re-sync on the next header.
    return;
  }

  latestPm25    = (int)be16(&pmsBuffer[12]);  // PM2.5 atmospheric (ug/m3)
  latestCount03 = be16(&pmsBuffer[16]);       // particles >= 0.3um
  latestCount05 = be16(&pmsBuffer[18]);       // particles >= 0.5um
  pmsHasData = true;
  pmsLastFrameMs = millis();
}

// ---------------------------------------------------------------------------
// (B) readVocOnInterval() - sample the SGP40 about once per second.
// measureVocIndex() returns the calibrated 0..500 VOC Index (100 = baseline).
// ---------------------------------------------------------------------------
void readVocOnInterval() {
  if (!sgpReady) return;
  unsigned long now = millis();
  if (now - lastVocReadMs < VOC_READ_INTERVAL_MS) return;
  lastVocReadMs = now;
  latestVocIndex = sgp.measureVocIndex(NOMINAL_TEMP_C, NOMINAL_RH_PCT);
}

// ---------------------------------------------------------------------------
// (C) printSummaryOnInterval() - one tidy line per second to the Serial Monitor.
// ---------------------------------------------------------------------------
void printSummaryOnInterval() {
  unsigned long now = millis();
  if (now - lastPrintMs < PRINT_INTERVAL_MS) return;
  lastPrintMs = now;

  bool pmsFresh = pmsHasData && (now - pmsLastFrameMs < 5000);

  Serial.print(F("["));
  Serial.print(now / 1000);
  Serial.print(F("s] "));

  if (pmsFresh) {
    Serial.print(F("PM2.5 = "));
    Serial.print(latestPm25);
    Serial.print(F(" ug/m3 | >0.3um="));
    Serial.print(latestCount03);
    Serial.print(F(" | >0.5um="));
    Serial.print(latestCount05);
  } else {
    Serial.print(F("PM2.5 = (no PMS frames yet - check 5V power + D5 wiring)"));
  }

  Serial.print(F(" | VOC Index="));
  if (sgpReady) Serial.print(latestVocIndex);
  else          Serial.print(F("(SGP40 not found)"));

  Serial.println();
}
