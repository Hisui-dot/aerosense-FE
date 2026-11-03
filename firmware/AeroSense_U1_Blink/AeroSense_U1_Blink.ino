/*
 * ============================================================================
 *  AeroSense  |  Unit U1 - Power / Compute Smoke Test
 *  File: 01_U1_blink_smoketest.ino
 * ============================================================================
 *
 *  WHAT THIS SKETCH DOES (in plain English)
 *  ----------------------------------------
 *  This is the FIRST program you flash to a brand-new ESP32 board for the
 *  AeroSense vape-detection node. It does NOT touch any sensors yet. Its only
 *  job is to prove the boring-but-critical foundation works:
 *
 *     1. The Arduino IDE can compile code for your ESP32.
 *     2. The USB cable + driver can upload that code to the board.
 *     3. The board powers up and runs (the 3.3 V rail is stable).
 *     4. You can see text from the board in the Serial Monitor.
 *     5. A GPIO pin can actually drive an LED.
 *
 *  It blinks the red LED on GPIO26 at 1 Hz (on 0.5 s, off 0.5 s) and prints
 *  "Blink alive" to the Serial Monitor once every second.
 *
 *  If THIS works, your whole toolchain + power + wiring foundation is solid,
 *  and you can move on to the PMS5003, SGP40, and buzzer with confidence. If
 *  something is broken, it is far easier to debug here than after you have
 *  added five other components.
 *
 *  WHY millis() INSTEAD OF delay()
 *  -------------------------------
 *  A blink can be done with delay(500). But on this project we build a habit:
 *  the final firmware reads a PMS5003 air-quality sensor over a serial port
 *  (UART). If the code ever sits inside delay(), it stops reading that port,
 *  the sensor's buffer overflows, and the data frames get CORRUPTED. So even
 *  though this demo has no sensor yet, we use the SAME non-blocking millis()
 *  timing pattern you will use everywhere else. Learn it here while it is
 *  simple. We use NO delay() anywhere in this sketch.
 *
 *  HOW millis() TIMING WORKS
 *  -------------------------
 *  millis() returns the number of milliseconds since the board powered on. The
 *  pattern is always the same:
 *      if (now - lastTime >= interval) {   // has enough time passed?
 *          lastTime = now;                 // remember "now" for next time
 *          ...do the thing...              // runs once per interval
 *      }
 *  loop() keeps spinning at full speed; the "if" only fires when the interval
 *  has elapsed. Nothing is ever blocked.
 *
 *  Note on the ~49.7-day "rollover": millis() is a 32-bit unsigned counter, so
 *  it wraps back to 0 after about 49.7 days of uptime. Because we keep all of
 *  now/lastBlinkMs/lastHeartbeatMs as uint32_t and compare with the
 *  (now - lastTime) subtraction, the unsigned math wraps correctly and the
 *  timing keeps working right through the rollover. (Do NOT rewrite this as
 *  now >= lastTime + interval -- that form breaks at the rollover.)
 *
 *  ARDUINO IDE SETTINGS (do this before uploading)
 *  -----------------------------------------------
 *    - Install the "esp32 by Espressif Systems" board package (Boards Manager).
 *    - Tools > Board:  "ESP32 Dev Module"
 *    - Tools > Port:   the COM port that appears when you plug in the board
 *                      (Windows). If no port appears, install the CP210x or
 *                      CH340 USB-serial driver for your board.
 *    - Tools > Upload Speed: 115200 (a safe default if uploads fail)
 *    - Open Tools > Serial Monitor and set the baud dropdown to 115200.
 *
 *  WIRING FOR THIS TEST (only the LED is needed)
 *  ---------------------------------------------
 *    GPIO26 ---[ 220 ohm resistor ]---> LED long leg (anode, +)
 *    LED short leg (cathode, -) -------> GND
 *  The resistor protects the LED and the ESP32 pin. Polarity matters: if the
 *  LED never lights, try flipping it around.
 *
 *  REFERENCE PIN MAP FOR THE FULL AeroSense NODE (for later units; not wired
 *  or used in this smoke test, listed here so the file is self-documenting):
 *    - PMS5003 (PM2.5): UART Serial2, RX2 = GPIO16, TX2 = GPIO17, 9600 baud,
 *                       SERIAL_8N1. VCC from 5V / VIN (NOT 3.3 V).
 *    - SGP40 (VOC):     I2C, SDA = GPIO21, SCL = GPIO22, address 0x59, VCC 3.3V.
 *    - Buzzer (active): GPIO25 through a 220 ohm resistor.
 *    - Red LED:         GPIO26 through a 220 ohm resistor.
 *    - Debug serial:    115200 baud (used below).
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// PIN ASSIGNMENTS
// ---------------------------------------------------------------------------
// "const" means this value never changes while the program runs. Using a named
// constant (instead of typing 26 everywhere) makes the code readable and means
// you only change the number in ONE place if the wiring ever changes.
const uint8_t LED_PIN = 26;   // Red LED, on GPIO26 (through a 220 ohm resistor)

// ---------------------------------------------------------------------------
// TIMING SETTINGS
// ---------------------------------------------------------------------------
// We want a 1 Hz blink: one full on+off cycle per second. That means we toggle
// the LED every 500 ms (half a second on, half a second off = 1000 ms total).
const uint32_t BLINK_INTERVAL_MS = 500;      // toggle the LED every 500 ms
const uint32_t HEARTBEAT_INTERVAL_MS = 1000; // print "Blink alive" every 1000 ms

// ---------------------------------------------------------------------------
// STATE VARIABLES
// ---------------------------------------------------------------------------
// These remember information BETWEEN passes through loop(). They are declared
// here (outside any function) so their values survive from one loop() call to
// the next. A variable declared inside loop() would reset every pass.

// Records the millis() value the last time we toggled the LED.
uint32_t lastBlinkMs = 0;

// Records the millis() value the last time we printed the heartbeat message.
uint32_t lastHeartbeatMs = 0;

// Tracks whether the LED is currently ON (true) or OFF (false) so we can flip
// it each interval. "bool" holds only true/false.
bool ledIsOn = false;

// ---------------------------------------------------------------------------
// setup() - runs ONCE when the board powers on or is reset
// ---------------------------------------------------------------------------
void setup() {
  // Start the USB serial link so we can print messages to the Serial Monitor.
  // 115200 is the baud rate (speed). The Serial Monitor must be set to the SAME
  // number or you will see garbage characters.
  // (We intentionally do NOT use `while (!Serial)`: this board talks to the PC
  //  through a CP210x/CH340 UART bridge, so Serial is always "ready" and such a
  //  wait would just hang the board whenever no monitor is open.)
  Serial.begin(115200);

  // Tell the ESP32 that GPIO26 is an OUTPUT (we are driving it, not reading it).
  pinMode(LED_PIN, OUTPUT);

  // Start with the LED OFF in a known state. LOW = 0 volts = off.
  digitalWrite(LED_PIN, LOW);
  ledIsOn = false;

  // A few friendly startup lines so you know the board booted and which sketch
  // is running. These print only once, right after power-up.
  Serial.println();
  Serial.println(F("============================================"));
  Serial.println(F("AeroSense U1 - Blink Smoke Test"));
  Serial.println(F("Red LED on GPIO26 should blink at 1 Hz."));
  Serial.println(F("You should see 'Blink alive' once per second."));
  Serial.println(F("============================================"));

  // NOTE: F("...") stores the text in flash (program) memory instead of RAM.
  // It is a tiny optimization that is good practice on microcontrollers.
}

// ---------------------------------------------------------------------------
// loop() - runs OVER AND OVER, forever, as fast as the chip can
// ---------------------------------------------------------------------------
// The whole sketch is non-blocking: loop() never waits. It just checks the
// clock and acts when the right amount of time has passed.
void loop() {
  // Read the clock ONCE at the top of the loop. Using one snapshot for all the
  // checks below keeps the timing consistent within this pass.
  uint32_t now = millis();

  // -------------------------------------------------------------------------
  // TASK 1: Toggle the LED every BLINK_INTERVAL_MS (500 ms) -> 1 Hz blink.
  // -------------------------------------------------------------------------
  if (now - lastBlinkMs >= BLINK_INTERVAL_MS) {
    // Remember the moment we toggled so the next toggle is timed from here.
    lastBlinkMs = now;

    // Flip the LED state: if it was on, turn it off, and vice versa.
    ledIsOn = !ledIsOn;                          // "!" means "not" (invert)
    digitalWrite(LED_PIN, ledIsOn ? HIGH : LOW); // HIGH = 3.3 V (on), LOW = off
  }

  // -------------------------------------------------------------------------
  // TASK 2: Print the heartbeat every HEARTBEAT_INTERVAL_MS (1000 ms).
  // -------------------------------------------------------------------------
  // This is a SEPARATE timer from the blink. Notice both tasks live in the same
  // loop() and neither blocks the other - exactly how the full firmware will
  // run the sensor poll, the alert toggle, and the network send side by side.
  if (now - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatMs = now;

    // Print the required heartbeat line. We also print the uptime in seconds so
    // you can watch the number climb and confirm the board is alive and timing.
    Serial.print(F("Blink alive  |  uptime: "));
    Serial.print(now / 1000);   // milliseconds -> whole seconds
    Serial.println(F(" s"));
  }

  // loop() ends here and immediately starts again. There is no delay(): the
  // chip spins through this function thousands of times per second, and the two
  // "if" blocks above only do their work when their interval has elapsed.
}