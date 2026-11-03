/*
  ============================================================================
  AeroSense Node 1 - Wi-Fi Demo (SoftAP + Live Web Page)
  ============================================================================

  WHAT THIS SKETCH DOES (the MVP demo):
    1. The ESP32 creates ITS OWN Wi-Fi network (a "SoftAP" = software access
       point). You join it from your phone or laptop like any other Wi-Fi.
         SSID (network name):  AeroSense-Node1
         Password:             aerosense   (9 chars -> WPA2-protected, NOT open)
    2. It runs a tiny web server on port 80.
    3. It reads TWO air-quality sensors continuously, WITHOUT ever using
       delay():
         - PMS5003  -> PM2.5 mass + particle counts (over Serial2 / UART)
         - SGP40    -> VOC Index (over I2C)
    4. It serves a simple HTML page that auto-refreshes every 2 seconds and
       shows the latest PM2.5, the >0.3um particle count, and the SGP40 VOC
       Index.

  HOW TO SEE IT WORK:
    - Flash this sketch, open the Serial Monitor at 115200 baud.
    - On your phone/laptop, join the Wi-Fi "AeroSense-Node1" (pass: aerosense).
    - Your phone may warn "no internet" - choose "stay connected".
    - Open a browser to:   http://192.168.4.1
    - You should see live readings updating every 2 seconds.

  WHY NON-BLOCKING MATTERS (read this!):
    The PMS5003 streams a 32-byte frame about once per second over the serial
    port. The ESP32's serial receive buffer is small. If we ever call delay()
    in the main loop, incoming bytes pile up, overflow, and the frames get
    corrupted (bad checksums). So this code uses millis() timers instead of
    delay() everywhere, and it drains the serial port on EVERY loop pass.

  BOARD / IDE SETTINGS:
    - Board:  "ESP32 Dev Module"  (ESP32-WROOM-32E DevKitC, 38-pin)
    - Upload speed: 921600 (or 115200 if uploads fail)
    - Library needed: "Adafruit SGP40 Sensor" (install via Library Manager).
      Wire.h, WiFi.h and WebServer.h ship with the ESP32 board package.

  WIRING (must match these pins EXACTLY):
    PMS5003 (particulate, UART):
        PMS TX  -> ESP32 GPIO16 (RX2)     [data FROM sensor INTO esp32]
        PMS RX  -> ESP32 GPIO17 (TX2)     [usually optional]
        PMS VCC -> 5V / VIN  (the fan needs 5V; 3.3V browns out the board!)
        PMS GND -> GND
    SGP40 (VOC, I2C, address 0x59):
        SGP SDA -> ESP32 GPIO21
        SGP SCL -> ESP32 GPIO22
        SGP VCC -> 3.3V
        SGP GND -> GND
        (If I2C is flaky, add 4.7k pull-up resistors SDA->3.3V and SCL->3.3V)
    Actuators (not used by THIS demo, but pins are reserved so wiring matches
    the full firmware):
        Buzzer + -> 220 ohm -> GPIO25,  Buzzer - -> GND
        LED anode -> 220 ohm -> GPIO26, LED cathode -> GND
    Common ground: ESP32, both sensors, and actuators must share GND.
  ============================================================================
*/

#include <WiFi.h>          // ESP32 Wi-Fi (SoftAP)             - built into core
#include <WebServer.h>     // simple HTTP server on port 80    - built into core
#include <Wire.h>          // I2C bus for the SGP40            - built into core
#include <Adafruit_SGP40.h> // SGP40 driver - INSTALL VIA LIBRARY MANAGER

// ---------------------------------------------------------------------------
// SECTION 1: Pin and Wi-Fi configuration (change names/passwords here)
// ---------------------------------------------------------------------------

// --- Pins ---
const uint8_t PMS_RX_PIN = 16;   // ESP32 RX2 <- PMS5003 TX
const uint8_t PMS_TX_PIN = 17;   // ESP32 TX2 -> PMS5003 RX
const uint8_t SGP_SDA_PIN = 21;  // I2C data
const uint8_t SGP_SCL_PIN = 22;  // I2C clock
const uint8_t PIN_BUZZER  = 25;  // reserved (not driven in this demo)
const uint8_t PIN_LED     = 26;  // reserved (not driven in this demo)

// --- Wi-Fi SoftAP credentials ---
// IMPORTANT: the password MUST be at least 8 characters. If it is shorter,
// WiFi.softAP() silently creates an OPEN (unsecured) network instead. "aerosense"
// is exactly 9 characters, so the network is WPA2-protected.
const char* AP_SSID = "AeroSense-Node1";
const char* AP_PASS = "aerosense";   // >= 8 chars -> WPA2, NOT open

// ---------------------------------------------------------------------------
// SECTION 2: Timers (this is how we stay non-blocking)
//   Each "task" remembers the last time it ran (a millis() timestamp). On every
//   loop pass we check "has enough time passed?" instead of calling delay().
// ---------------------------------------------------------------------------
const uint32_t SENSOR_POLL_INTERVAL = 1000;  // read SGP40 + print summary ~1x/sec
const uint32_t SERIAL_PRINT_INTERVAL = 2000; // human-readable serial summary

uint32_t lastSensorMs = 0;   // when we last polled the SGP40
uint32_t lastPrintMs  = 0;   // when we last printed a summary to Serial

// ---------------------------------------------------------------------------
// SECTION 3: Globals that hold the most recent readings
//   The web page and the serial printout both read from these. They are the
//   single source of truth for "the latest values."
// ---------------------------------------------------------------------------
WebServer server(80);        // HTTP server listening on port 80
Adafruit_SGP40 sgp;          // the VOC sensor driver object

// Latest particulate values (from the PMS5003)
float    pm25_atm   = 0.0f;  // PM2.5 atmospheric (ug/m3) - the real-room figure
uint16_t count_0_3  = 0;     // particles >= 0.3um per 0.1 L of air
uint16_t count_0_5  = 0;     // particles >= 0.5um per 0.1 L of air
bool     pmsHasData = false; // becomes true after the first valid PMS frame
uint32_t pmsLastFrameMs = 0; // millis() when the last good frame arrived

// Latest VOC value (from the SGP40)
int32_t  vocIndex   = 0;     // SGP40 VOC Index: ~0..500, 100 = baseline
uint16_t vocRaw     = 0;     // raw MOx ticks (diagnostic only)
bool     sgpOk      = false; // false if the SGP40 did not initialize
// The SGP40 needs T/RH for compensation. With no T/RH sensor we use defaults.
const float AMBIENT_TEMP_C = 25.0f;
const float AMBIENT_RH_PCT = 50.0f;

// ---------------------------------------------------------------------------
// SECTION 4: PMS5003 non-blocking frame parser
//   The PMS5003 sends 32-byte frames that start with the two bytes 0x42 0x4D.
//   We read whatever bytes are available each loop, hunt for that header, and
//   only accept a frame when all 32 bytes are present AND the checksum matches.
//   Frame layout (big-endian 16-bit values):
//     bytes 0..1   : start chars 0x42 0x4D
//     bytes 2..3   : frame length (== 28)
//     bytes 12..13 : PM2.5 atmospheric (ug/m3)   <- we use this
//     bytes 16..17 : count >= 0.3um              <- we use this
//     bytes 18..19 : count >= 0.5um              <- we use this
//     bytes 30..31 : checksum = sum of bytes 0..29
// ---------------------------------------------------------------------------
static const uint8_t PMS_FRAME_LEN = 32;
uint8_t pmsBuf[PMS_FRAME_LEN];   // holds the frame as we collect it
uint8_t pmsIdx = 0;              // how many bytes of the frame we have so far

// Helper: read a big-endian 16-bit value from two bytes.
static inline uint16_t be16(const uint8_t* p) {
  return (uint16_t(p[0]) << 8) | p[1];
}

// Call this on EVERY loop() pass. It never blocks: it only processes the bytes
// that are already sitting in the serial buffer, then returns immediately.
void pmsPoll() {
  while (Serial2.available() > 0) {
    uint8_t b = (uint8_t)Serial2.read();

    // State: looking for the first start byte (0x42)
    if (pmsIdx == 0) {
      if (b == 0x42) pmsBuf[pmsIdx++] = b;   // got start byte 1, keep it
      continue;                              // otherwise ignore and keep hunting
    }

    // State: looking for the second start byte (0x4D)
    if (pmsIdx == 1) {
      if (b == 0x4D) {
        pmsBuf[pmsIdx++] = b;                // got the full header 0x42 0x4D
      } else if (b == 0x42) {
        pmsBuf[0] = 0x42; pmsIdx = 1;        // this byte might be a new header start
      } else {
        pmsIdx = 0;                          // not a header, start over
      }
      continue;
    }

    // State: collecting the remaining bytes of the frame
    pmsBuf[pmsIdx++] = b;
    if (pmsIdx < PMS_FRAME_LEN) continue;    // frame not complete yet

    // We now have a full 32-byte frame. Validate it.
    uint16_t sum = 0;
    for (uint8_t i = 0; i < 30; i++) sum += pmsBuf[i];   // checksum = sum of first 30 bytes
    uint16_t frameLen = be16(&pmsBuf[2]);               // should be 28

    if (sum == be16(&pmsBuf[30]) && frameLen == 28) {
      // Good frame -> pull out the fields we care about.
      pm25_atm  = (float)be16(&pmsBuf[12]);  // PM2.5 atmospheric (ug/m3)
      count_0_3 = be16(&pmsBuf[16]);         // particles >= 0.3um
      count_0_5 = be16(&pmsBuf[18]);         // particles >= 0.5um
      pmsHasData = true;
      pmsLastFrameMs = millis();
    }
    // Whether the frame was good or bad, reset so we re-sync on the next header.
    pmsIdx = 0;
  }
}

// ---------------------------------------------------------------------------
// SECTION 5: SGP40 read (fast I2C transaction, safe to call on a timer)
// ---------------------------------------------------------------------------
void sgpRead() {
  if (!sgpOk) return;   // sensor missing -> skip, do not block
  // measureVocIndex runs Sensirion's auto-baselining algorithm and returns an
  // index (100 = baseline). measureRaw gives diagnostic ticks.
  vocRaw   = sgp.measureRaw(AMBIENT_TEMP_C, AMBIENT_RH_PCT);
  vocIndex = sgp.measureVocIndex(AMBIENT_TEMP_C, AMBIENT_RH_PCT);
}

// ---------------------------------------------------------------------------
// SECTION 6: The web page
//   handleData()  -> returns the latest values as JSON (handy for debugging)
//   handleRoot()  -> returns an HTML page with <meta refresh> every 2 seconds
//   handleNotFound() -> friendly 404
// The HTML page intentionally uses a <meta http-equiv="refresh" content="2">
// tag: the browser reloads the whole page every 2 seconds, so the numbers stay
// current with zero JavaScript. Simple and beginner-friendly.
// ---------------------------------------------------------------------------
void handleRoot() {
  // Is the PMS data fresh? (a frame within the last 5 seconds)
  bool pmsFresh = pmsHasData && (millis() - pmsLastFrameMs < 5000);

  // Build the HTML into a buffer. snprintf is safe: it never overruns the size.
  char html[1200];
  snprintf(html, sizeof(html),
    "<!doctype html><html><head>"
    "<meta charset='utf-8'>"
    "<meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<meta http-equiv='refresh' content='2'>"            // <-- auto-refresh every 2s
    "<title>AeroSense Node 1</title>"
    "<style>"
    "body{font-family:system-ui,Arial,sans-serif;background:#0f172a;color:#e2e8f0;"
    "margin:0;padding:24px}"
    "h1{font-size:20px;margin:0 0 4px}"
    ".sub{color:#94a3b8;font-size:13px;margin-bottom:20px}"
    ".card{background:#1e293b;border-radius:12px;padding:18px 20px;margin:12px 0;"
    "max-width:420px}"
    ".label{color:#94a3b8;font-size:13px}"
    ".value{font-size:34px;font-weight:700;margin-top:2px}"
    ".unit{font-size:14px;color:#94a3b8;font-weight:400}"
    ".stale{color:#f87171}"
    "</style></head><body>"
    "<h1>AeroSense Node 1</h1>"
    "<div class='sub'>Live air quality &middot; page refreshes every 2s</div>"
    "<div class='card'><div class='label'>PM2.5 (atmospheric)</div>"
    "<div class='value'>%.1f <span class='unit'>&micro;g/m&sup3;</span></div></div>"
    "<div class='card'><div class='label'>Particles &ge; 0.3&micro;m</div>"
    "<div class='value'>%u <span class='unit'>/ 0.1L</span></div></div>"
    "<div class='card'><div class='label'>SGP40 VOC Index</div>"
    "<div class='value'>%ld <span class='unit'>(100 = baseline)</span></div></div>"
    "<div class='sub %s'>%s</div>"
    "</body></html>",
    pm25_atm,
    (unsigned)count_0_3,
    (long)vocIndex,
    pmsFresh ? "" : "stale",
    pmsFresh ? "PMS5003 OK" : "Waiting for PMS5003 data... (check 5V power + GPIO16 wiring)"
  );

  server.send(200, "text/html", html);
}

void handleData() {
  // A small JSON endpoint, useful for testing with a browser or curl:
  //   http://192.168.4.1/data
  char json[160];
  snprintf(json, sizeof(json),
    "{\"pm25\":%.1f,\"count_0_3\":%u,\"count_0_5\":%u,\"vocIndex\":%ld,\"vocRaw\":%u}",
    pm25_atm, (unsigned)count_0_3, (unsigned)count_0_5, (long)vocIndex, (unsigned)vocRaw);
  server.send(200, "application/json", json);
}

void handleNotFound() {
  server.send(404, "text/plain", "Not found. Try http://192.168.4.1/");
}

// ---------------------------------------------------------------------------
// SECTION 7: setup() - runs once at boot
// ---------------------------------------------------------------------------
void setup() {
  // --- Debug serial (USB) at 115200 baud. Open the Serial Monitor at 115200. ---
  Serial.begin(115200);
  delay(200);  // tiny one-time pause so the USB serial is ready to print the
               // boot banner. This is BEFORE the sensor loop starts, so it does
               // not affect PMS frame parsing. The loop() below has NO delays.
  Serial.println();
  Serial.println(F("=============================================="));
  Serial.println(F(" AeroSense Node 1 - Wi-Fi Demo booting..."));
  Serial.println(F("=============================================="));

  // --- Reserve the actuator pins (kept LOW; this demo does not alarm). ---
  pinMode(PIN_BUZZER, OUTPUT); digitalWrite(PIN_BUZZER, LOW);
  pinMode(PIN_LED,    OUTPUT); digitalWrite(PIN_LED,    LOW);

  // --- Start the PMS5003 UART on Serial2 (9600 baud, 8 data bits, no parity,
  //     1 stop bit). We tell it which pins are RX2 and TX2. ---
  Serial2.begin(9600, SERIAL_8N1, PMS_RX_PIN, PMS_TX_PIN);
  Serial.println(F("[PMS5003] Serial2 started @9600 (RX=GPIO16, TX=GPIO17)"));

  // --- Start I2C and the SGP40. If it is missing, we flag it and keep going so
  //     the rest of the demo (Wi-Fi + PMS) still works. ---
  Wire.begin(SGP_SDA_PIN, SGP_SCL_PIN);
  sgpOk = sgp.begin();
  if (sgpOk) Serial.println(F("[SGP40]  Found on I2C (addr 0x59)."));
  else       Serial.println(F("[SGP40]  NOT found! Check SDA=GPIO21, SCL=GPIO22, 3.3V, GND."));

  // --- Bring up the SoftAP (the ESP32's own Wi-Fi). ---
  WiFi.mode(WIFI_AP);                       // access-point only mode
  bool apOk = WiFi.softAP(AP_SSID, AP_PASS);
  IPAddress ip = WiFi.softAPIP();           // defaults to 192.168.4.1
  if (apOk) {
    Serial.print(F("[WiFi]   SoftAP up. SSID: ")); Serial.println(AP_SSID);
    Serial.print(F("[WiFi]   Password: "));        Serial.println(AP_PASS);
    Serial.print(F("[WiFi]   Open this in a browser: http://"));
    Serial.println(ip);                     // -> http://192.168.4.1
  } else {
    Serial.println(F("[WiFi]   SoftAP FAILED to start."));
  }

  // --- Wire up the web routes and start the server. ---
  server.on("/",     handleRoot);
  server.on("/data", handleData);
  server.onNotFound(handleNotFound);
  server.begin();
  Serial.println(F("[HTTP]   Web server started on port 80."));
  Serial.println(F("Boot complete. Join the Wi-Fi, then browse to 192.168.4.1"));
  Serial.println(F("----------------------------------------------"));
}

// ---------------------------------------------------------------------------
// SECTION 8: loop() - runs forever, NEVER calls delay()
//   Order matters: we drain the PMS UART and service web clients on EVERY pass
//   so neither one starves. The slower work (SGP40 read, serial printout) is
//   gated behind millis() timers.
// ---------------------------------------------------------------------------
void loop() {
  uint32_t now = millis();

  // 1) Drain the PMS5003 serial buffer EVERY pass. This is the most important
  //    line for non-blocking behavior - it keeps frames from overflowing.
  pmsPoll();

  // 2) Service any waiting web request EVERY pass. Returns immediately if there
  //    is nothing to do, so it is safe to call in a tight loop.
  server.handleClient();

  // 3) About once per second: take an SGP40 reading.
  if (now - lastSensorMs >= SENSOR_POLL_INTERVAL) {
    lastSensorMs = now;
    sgpRead();
  }

  // 4) Every 2 seconds: print a human-readable summary to the Serial Monitor.
  if (now - lastPrintMs >= SERIAL_PRINT_INTERVAL) {
    lastPrintMs = now;
    bool pmsFresh = pmsHasData && (now - pmsLastFrameMs < 5000);
    Serial.printf(
      "[%lus] PM2.5=%.1f ug/m3 | >0.3um=%u | >0.5um=%u | VOC Index=%ld %s | clients=%d\n",
      (unsigned long)(now / 1000),
      pm25_atm, (unsigned)count_0_3, (unsigned)count_0_5, (long)vocIndex,
      pmsFresh ? "" : "(PMS stale - check 5V/wiring)",
      WiFi.softAPgetStationNum());   // how many devices are joined to our Wi-Fi
  }

  // NOTE: there is deliberately NO delay() in this loop. All pacing is done with
  // the millis() checks above so the PMS UART and the web server stay responsive.
}