/*
  ============================================================================
  AeroSense - ESP32 Actuator Self-Test
  ============================================================================
  WHAT THIS SKETCH DOES
  ---------------------------------------------------------------------------
  This is a simple "do the alarm outputs even work?" test for the AeroSense
  vape-detection node. It does NOT read any sensors. Its only job is to prove
  that the two alarm outputs are wired correctly and that your code can drive
  them:

      * Active piezo BUZZER on GPIO25  -> should beep when turned ON
      * Red LED            on GPIO26  -> should light up when turned ON

  The buzzer and LED turn ON together and OFF together in a slow, repeating
  pattern (ON for a moment, then OFF for a moment, forever). At the same time
  we print the current state ("ON" / "OFF") to the Serial Monitor so you can
  watch the timing in text even if you cannot hear or see the hardware clearly.

  WHY "NON-BLOCKING" (millis) INSTEAD OF delay()
  ---------------------------------------------------------------------------
  The full AeroSense firmware also reads a PMS5003 particulate sensor over a
  serial port (UART). If you use delay() in that firmware, the CPU "freezes"
  during the delay and the incoming PMS5003 data piles up and gets corrupted.
  So the AeroSense rule is: NEVER use delay() in any loop that reads sensors.

  This self-test does not read sensors, so a delay() would technically be safe
  here. But we deliberately use the millis() interval-timer pattern anyway, so
  you learn the correct habit from the very first sketch. The loop() never
  blocks: on every pass it just asks "has enough time passed yet?".

  HARDWARE / WIRING (this sketch only drives the buzzer + LED)
  ---------------------------------------------------------------------------
      Active piezo buzzer:  (+) leg --> 220 ohm resistor --> GPIO25
                            (-) leg --> GND
      Red LED:              anode (long leg) --> 220 ohm resistor --> GPIO26
                            cathode (short leg) --> GND

  "Active" buzzer means it has its own tone generator inside: just give it
  power (HIGH) and it beeps. You do NOT need to send a frequency. (A "passive"
  buzzer would need a tone() signal instead.)

  FULL AEROSENSE PIN MAP (for reference - most pins are unused in this test)
  ---------------------------------------------------------------------------
      PMS5003 particulate (UART, Serial2, 9600 baud, SERIAL_8N1):
          RX2 = GPIO16, TX2 = GPIO17, VCC = 5V/VIN, GND = GND
      SGP40 VOC sensor (I2C, address 0x59, 3.3V):
          SDA = GPIO21, SCL = GPIO22
      Buzzer (active piezo): GPIO25 through 220 ohm   <-- USED HERE
      Red LED:               GPIO26 through 220 ohm   <-- USED HERE
      Debug serial:          115200 baud              <-- USED HERE

  BOARD SETTINGS IN ARDUINO IDE 2.x
  ---------------------------------------------------------------------------
      Tools -> Board    : "ESP32 Dev Module"  (ESP32-WROOM-32E DevKitC, 38-pin)
      Tools -> Port     : the COM/tty port that appears when you plug in USB
      Tools -> Upload Speed : 115200 (default is fine)
      No external libraries are required for this self-test.
  ============================================================================
*/

// ---------------------------------------------------------------------------
// PIN DEFINITIONS
// Using named constants (instead of raw numbers like 25) makes the code easier
// to read and means you only change a pin in ONE place if your wiring changes.
// 'const' = these values never change while the program runs.
// ---------------------------------------------------------------------------
const int BUZZER_PIN = 25;   // active piezo buzzer (through 220 ohm) -> GPIO25
const int LED_PIN    = 26;   // red LED (through 220 ohm) -> GPIO26

// ---------------------------------------------------------------------------
// TIMING SETTINGS for the slow ON/OFF pattern.
// 'unsigned long' is the correct type for time values because millis() returns
// an unsigned long (milliseconds since the board powered on). 1000 ms = 1 sec.
// Tweak these to make the beep/blink faster or slower.
// ---------------------------------------------------------------------------
const unsigned long ALERT_TOGGLE_INTERVAL = 800;  // switch ON<->OFF every 800 ms

// ---------------------------------------------------------------------------
// STATE VARIABLES (these change while the program runs).
//   alertOn               -> is the alarm currently ON (true) or OFF (false)?
//   lastToggleTime        -> the millis() timestamp of the last ON/OFF switch.
// We compare "now" against lastToggleTime to decide when to switch again.
// ---------------------------------------------------------------------------
bool          alertOn        = false;  // start with everything OFF
unsigned long lastToggleTime = 0;      // no toggle has happened yet

// ===========================================================================
// setup() runs ONCE when the board powers on or is reset.
// Use it to configure pins and start the Serial Monitor connection.
// ===========================================================================
void setup() {
  // Start the USB serial link so we can print messages to the Serial Monitor.
  // The number 115200 is the "baud rate" (speed). It MUST match the speed you
  // pick in the Serial Monitor dropdown, or you will see garbage characters.
  Serial.begin(115200);

  // Tell the ESP32 that these two pins are OUTPUTS (we will drive them HIGH/LOW
  // to turn the buzzer and LED on and off). Pins default to inputs otherwise.
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);

  // Make absolutely sure both outputs start OFF (LOW = 0 volts = off).
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  // A few friendly startup messages. An empty println() just prints a blank
  // line for spacing.
  Serial.println();
  Serial.println("=============================================");
  Serial.println("AeroSense Actuator Self-Test starting...");
  Serial.println("Buzzer on GPIO25, LED on GPIO26");
  Serial.println("They should beep + blink together, ~every 0.8s");
  Serial.println("=============================================");
}

// ===========================================================================
// loop() runs OVER AND OVER, forever, as fast as the CPU can go.
// We do NOT use delay() here. Instead we use the millis() interval pattern:
// every pass we check whether enough time has elapsed; if so, we act.
// ===========================================================================
void loop() {
  // millis() returns how many milliseconds have passed since power-on.
  // We grab it once at the top of the loop and reuse it ("now").
  unsigned long now = millis();

  // THE NON-BLOCKING TIMER CHECK:
  // "Has at least ALERT_TOGGLE_INTERVAL passed since the last toggle?"
  // Subtracting the two unsigned longs is the safe, standard way to measure
  // elapsed time (it even survives the ~49-day millis() rollover correctly).
  if (now - lastToggleTime >= ALERT_TOGGLE_INTERVAL) {

    // Remember THIS moment as the new "last toggle" time, so the next switch
    // happens one full interval from now.
    lastToggleTime = now;

    // Flip the state: if it was ON, make it OFF; if it was OFF, make it ON.
    // The '!' means "not" / "the opposite of".
    alertOn = !alertOn;

    // Drive BOTH outputs to match the new state.
    // HIGH = on (3.3 V), LOW = off (0 V). We use an explicit ternary
    // (alertOn ? HIGH : LOW) so the intent is crystal clear and portable:
    // when alertOn is true we write HIGH, otherwise we write LOW.
    digitalWrite(BUZZER_PIN, alertOn ? HIGH : LOW);
    digitalWrite(LED_PIN,    alertOn ? HIGH : LOW);

    // Print the new state so you can follow along in the Serial Monitor.
    if (alertOn) {
      Serial.println("[ALARM] ON  -> buzzer beeping, LED lit");
    } else {
      Serial.println("[ALARM] OFF -> buzzer silent, LED dark");
    }
  }

  // ---------------------------------------------------------------------------
  // Because we never called delay(), the loop keeps spinning freely. In the
  // real AeroSense firmware this is exactly where PMS5003 UART reads and SGP40
  // I2C reads would live - they would run every pass without being blocked by
  // the alarm timing above. That is the whole point of the millis() pattern.
  // ---------------------------------------------------------------------------
}
