/*
  ============================================================================
  AeroSense ESP32 Node - I2C Scanner + SGP40 VOC Index Reader
  ============================================================================

  WHAT THIS SKETCH DOES (two jobs in one program):

    JOB 1 (runs ONCE at startup, inside setup()):
      An I2C "scanner" that probes every address on the I2C bus and prints
      whatever it finds. Use this to CONFIRM the SGP40 sensor is wired
      correctly. A healthy SGP40 should show up at address 0x59.
      If you see "0x59" in the Serial Monitor, your wiring is good.
      If you see "No I2C devices found", recheck SDA/SCL/power/ground.

    JOB 2 (runs FOREVER, inside loop()):
      Reads the SGP40 VOC (Volatile Organic Compound) sensor and prints a
      "VOC Index" number about once per second.

  ----------------------------------------------------------------------------
  ABOUT THE VOC INDEX NUMBER (read this so the output makes sense):

    - The SGP40 does NOT give you a raw gas concentration in ppm.
      It gives a "VOC Index" from 1 to 500, produced by Sensirion's
      algorithm that learns YOUR room's normal air over time.

    - ~100 = the "rebaselined normal" for the current environment.
      The algorithm slowly adapts so that typical clean air sits near 100.

    - HIGHER than 100 = air got worse than normal (e.g. vapor, spray,
      cooking, cleaning chemicals -> VOCs went up).
    - LOWER than 100 = air got cleaner than its learned baseline.

    - WARMUP MATTERS: when first powered on, the sensor needs time to warm
      up and the algorithm needs time to learn. For the first ~10-60 seconds
      you will often see numbers like 0 or values that drift. THIS IS NORMAL.
      Let it settle, then watch how the number JUMPS when you introduce VOCs.

    Bottom line: don't chase an exact value. Watch for the CHANGE above 100.

  ----------------------------------------------------------------------------
  EXACT PIN MAP FOR THE AeroSense NODE (board: "ESP32 Dev Module",
  ESP32-WROOM-32E DevKitC, 38-pin). Only SGP40 is used in THIS sketch,
  but the full map is documented here so the wiring matches the project:

    SGP40 (VOC)  -> I2C
        SDA  = GPIO21
        SCL  = GPIO22
        VCC  = 3.3V   (NOT 5V - the SGP40 is a 3.3V part)
        GND  = GND
        I2C address = 0x59

    PMS5003 (particulate, NOT used in this sketch) -> UART Serial2
        RX2  = GPIO16   (ESP32 receives here; wire to PMS TX)
        TX2  = GPIO17   (ESP32 transmits here; wire to PMS RX)
        9600 baud, SERIAL_8N1
        VCC  = 5V / VIN (the fan/laser need 5V; do NOT use 3.3V)

    Buzzer (active piezo, NOT used here) = GPIO25 through a 220 ohm resistor
    Red LED               (NOT used here) = GPIO26 through a 220 ohm resistor
        (LED anode -> resistor -> GPIO26, cathode -> GND)

    Debug serial (USB to Serial Monitor) = 115200 baud

  IMPORTANT WIRING NOTES:
    - All parts MUST share a common GND with the ESP32.
    - If the I2C bus is flaky / drops packets, add 4.7k pull-up resistors
      from SDA -> 3.3V and from SCL -> 3.3V.

  ----------------------------------------------------------------------------
  LIBRARIES REQUIRED (install in Arduino IDE -> Library Manager BEFORE compiling):
    - "Adafruit SGP40 Sensor"  (this also pulls in Adafruit BusIO)
    - Wire.h is built in (comes with the ESP32 board package, no install)

  ----------------------------------------------------------------------------
  CODING STYLE NOTE (why no delay() in loop()):
    This AeroSense node is non-blocking by design. We use millis() interval
    timers instead of delay(). delay() freezes the whole CPU, which would
    corrupt incoming PMS5003 UART frames in the full firmware. Even though
    this sketch doesn't read the PMS5003, we model the good habit here so
    you can drop this code straight into the bigger project.
  ============================================================================
*/

#include <Wire.h>            // Built-in I2C library (for the bus + scanner)
#include <Adafruit_SGP40.h>  // SGP40 VOC sensor driver (install via Library Manager)

// ---------------------------------------------------------------------------
// PIN DEFINITIONS  (constants, not magic numbers - easy to change in one place)
// ---------------------------------------------------------------------------
const int I2C_SDA_PIN = 21;  // SGP40 SDA
const int I2C_SCL_PIN = 22;  // SGP40 SCL

// Baud rate for the USB Serial Monitor. Set the Serial Monitor to 115200 too,
// or you will only see garbage characters.
const unsigned long DEBUG_BAUD = 115200;

// How often (in milliseconds) we take a VOC reading. 1000 ms = once per second.
const unsigned long VOC_READ_INTERVAL_MS = 1000;

// Nominal compensation values used by measureVocIndex(temperature, humidity).
// The SGP40's raw signal drifts a little with temperature and humidity, so the
// algorithm can compensate if you tell it the conditions. We don't have a
// temp/humidity sensor in THIS sketch, so we pass typical indoor values:
//   25 C and 50 % relative humidity. Good enough for a demo / bring-up test.
const float NOMINAL_TEMPERATURE_C = 25.0f;
const float NOMINAL_HUMIDITY_RH  = 50.0f;

// ---------------------------------------------------------------------------
// GLOBAL OBJECTS / STATE
// ---------------------------------------------------------------------------
Adafruit_SGP40 sgp;  // The SGP40 sensor object from the Adafruit library.

bool sgp40Ready = false;            // Did the sensor start up OK?
unsigned long lastVocReadMs = 0;    // millis() timestamp of our last VOC read.

// ---------------------------------------------------------------------------
// FUNCTION: scanI2CBus()
// Probes every 7-bit I2C address (1..126) and prints any device that ACKs.
// This is the classic Arduino I2C scanner pattern using Wire.beginTransmission
// + Wire.endTransmission. endTransmission() returns 0 when a device answered.
// ---------------------------------------------------------------------------
void scanI2CBus() {
  Serial.println();
  Serial.println(F("================ I2C SCANNER ================"));
  Serial.println(F("Scanning the I2C bus for devices..."));

  byte devicesFound = 0;  // Count how many devices answer.

  // Address 0 and 127 are reserved, so we scan 1..126.
  for (byte address = 1; address < 127; address++) {
    // Start a transmission to this address, then end it. The return code of
    // endTransmission() tells us if a chip is actually there:
    //   0 = success: a device acknowledged (it exists at this address!)
    Wire.beginTransmission(address);
    byte error = Wire.endTransmission();

    if (error == 0) {
      devicesFound++;
      Serial.print(F("  Device FOUND at address 0x"));
      if (address < 16) Serial.print(F("0"));  // pad single hex digit nicely
      Serial.print(address, HEX);

      // Give the user a friendly hint if it's the SGP40 we expect.
      if (address == 0x59) {
        Serial.print(F("   <-- This is the SGP40 VOC sensor (expected!)"));
      }
      Serial.println();
    }
  }

  // Summary line so the result is unmistakable.
  if (devicesFound == 0) {
    Serial.println(F("  No I2C devices found."));
    Serial.println(F("  -> Check: SDA=GPIO21, SCL=GPIO22, VCC=3.3V, GND shared."));
    Serial.println(F("  -> If still nothing, add 4.7k pull-ups SDA->3.3V, SCL->3.3V."));
  } else {
    Serial.print(F("  Scan complete. Total devices found: "));
    Serial.println(devicesFound);
  }
  Serial.println(F("============================================="));
  Serial.println();
}

// ---------------------------------------------------------------------------
// setup() - runs ONCE when the ESP32 powers on or is reset.
// ---------------------------------------------------------------------------
void setup() {
  // 1) Start the debug serial port so we can print to the Serial Monitor.
  Serial.begin(DEBUG_BAUD);

  // Give the USB serial a brief moment to come up. This short delay() is
  // acceptable: we are NOT reading any sensors here yet (no UART frames to
  // corrupt). We deliberately avoid delay() once the main loop is running.
  delay(200);

  Serial.println();
  Serial.println(F("AeroSense ESP32 - SGP40 VOC + I2C Scanner starting up..."));

  // 2) Start the I2C bus on our chosen pins (SDA=21, SCL=22).
  //    On ESP32 you can pass the pins straight into Wire.begin().
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  // 3) JOB 1: scan the bus once so the user can confirm the SGP40 at 0x59.
  scanI2CBus();

  // 4) Initialize the SGP40 sensor itself.
  //    sgp.begin(&Wire) uses the I2C bus we just configured above.
  //    It returns true if the chip responded and is ready.
  if (sgp.begin(&Wire)) {
    sgp40Ready = true;
    Serial.println(F("SGP40 initialized OK. VOC readings will start now."));
    Serial.println(F("REMEMBER: needs warmup. Early values may read ~0 or drift."));
    Serial.println(F("Normal/baseline settles near 100. Higher = more VOCs."));
    Serial.println();
  } else {
    sgp40Ready = false;
    Serial.println(F("ERROR: SGP40 not found / failed to start!"));
    Serial.println(F("  -> Did the scanner above list 0x59? If not, fix wiring first."));
    Serial.println(F("  -> Confirm VCC = 3.3V (NOT 5V) and GND is shared."));
  }
}

// ---------------------------------------------------------------------------
// loop() - runs OVER and OVER, very fast. We use a millis() timer so we only
// actually read the sensor once per VOC_READ_INTERVAL_MS, WITHOUT blocking.
// ---------------------------------------------------------------------------
void loop() {
  // If the sensor never started, there's nothing to read. Bail out early so
  // we don't spam errors. (You could blink the LED here as a fault signal.)
  if (!sgp40Ready) {
    return;
  }

  unsigned long now = millis();  // Current time since boot, in milliseconds.

  // Non-blocking timer: has it been at least 1 second since the last read?
  // (now - lastVocReadMs) handles the millis() rollover (~49 days) correctly
  // because of unsigned arithmetic, so this is safe to run forever.
  if (now - lastVocReadMs >= VOC_READ_INTERVAL_MS) {
    lastVocReadMs = now;  // Remember WHEN we read, for the next interval.

    // Ask the SGP40 for a VOC Index value (1..500), compensated with our
    // nominal 25 C / 50 %RH. (If you later add a real temp/humidity sensor,
    // pass those live values here for better accuracy.)
    int32_t vocIndex = sgp.measureVocIndex(NOMINAL_TEMPERATURE_C,
                                           NOMINAL_HUMIDITY_RH);

    // Print it in a clear, human-readable line.
    Serial.print(F("VOC Index: "));
    Serial.print(vocIndex);

    // Add a tiny plain-English interpretation so beginners get instant feedback.
    if (vocIndex == 0) {
      Serial.println(F("   (warming up / not enough data yet - wait a bit)"));
    } else if (vocIndex < 100) {
      Serial.println(F("   (cleaner than baseline)"));
    } else if (vocIndex <= 130) {
      Serial.println(F("   (around normal baseline ~100)"));
    } else {
      Serial.println(F("   (ABOVE normal - VOCs detected! e.g. vapor/spray)"));
    }
  }

  // NOTE: we do NOT call delay() here. The loop spins freely and the millis()
  // check above paces the readings. This keeps the CPU free for other tasks
  // (like PMS5003 UART parsing in the full AeroSense firmware).
}
