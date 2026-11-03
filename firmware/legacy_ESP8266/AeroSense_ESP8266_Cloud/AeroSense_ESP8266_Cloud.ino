/*
  ============================================================================
  AeroSense - ESP8266 Cloud Node  -  uploads live readings to the dashboard
  ============================================================================

  WHAT THIS SKETCH DOES
  ---------------------
  This is the "real" AeroSense edge node for the ESP8266 build. It:
    1. Joins your Wi-Fi network (STA = "station" mode, like a phone joining
       Wi-Fi - this is NOT the hotspot/SoftAP demo).
    2. Reads BOTH air-quality sensors continuously, WITHOUT ever using delay():
         * PMS5003 -> PM2.5 (atmospheric) in micrograms/m3   (UART, 9600 baud)
         * SGP40   -> VOC Index 0..500 (100 = baseline)       (I2C)
    3. Every ~5 seconds, POSTs the latest reading as JSON to the AeroSense
       dashboard backend. The device then shows up "live" on the dashboard.

  Run the AeroSense_ESP8266_SensorTest sketch FIRST to prove your wiring. Once
  that prints good numbers, flash THIS sketch to put the device online.

  TARGET BOARD
  ------------
    ESP8266 "NodeMCU 1.0 (ESP-12E)" (CH340 USB). The D-labels below (D5, D6,
    D1, D2, D7, D0) are the silkscreen names on the board. A Wemos/LOLIN D1
    mini uses the SAME D-label -> GPIO mapping, so this sketch runs UNCHANGED
    on a D1 mini - the only thing that ever differs between the two boards is
    the pin labels, and these already match both.

  ----------------------------------------------------------------------------
  *** EDIT THIS BLOCK BEFORE FLASHING ***  (your Wi-Fi + dashboard details)
  ----------------------------------------------------------------------------
*/
const char*    WIFI_SSID    = "YOUR_WIFI_NAME";       // your Wi-Fi network name
const char*    WIFI_PASS    = "YOUR_WIFI_PASSWORD";   // your Wi-Fi password
const char*    SERVER_IP    = "192.168.1.50";         // your PC's LAN IPv4 address
                                                      //   -> run `ipconfig` on the PC and copy the IPv4 address.
                                                      //   The PC (running the backend) and this ESP8266 MUST be
                                                      //   on the SAME Wi-Fi network.
const uint16_t SERVER_PORT  = 8001;                   // the AeroSense backend port (do not change unless you moved it)
const char*    DEVICE_KEY   = "ak_xxxxxxxx";          // one-time key from the dashboard's "Add device" wizard
/* --------------------------------------------------------------------------
   *** VOC THRESHOLD - IMPORTANT, PLEASE READ ***
   We post the SGP40's RAW VOC Index (0..500, where ~100 = normal clean-air
   baseline) as the "voc" value - honest and lossless. BUT the dashboard's
   GLOBAL default VOC threshold is 0.6, which a baseline of ~100 would trip
   instantly and alarm forever. So you MUST give THIS device its own VOC
   threshold of about 200:
       - In the "Add device" wizard, set the "VOC threshold" field to 200, OR
       - Later: Devices -> open this device -> tune-thresholds (the sliders
         dialog) -> set VOC to ~200.
   With a ~200 threshold, normal air (~100) stays quiet and a real VOC spike
   (vapor/spray pushing the index well above 200) triggers an alert.
   PM2.5 is already in ug/m3 on both sides, so it needs no special threshold.
   ------------------------------------------------------------------------- */

/*
  WHY A SoftwareSerial FOR THE PMS5003?
  -------------------------------------
  The ESP8266 has only ONE hardware UART, and it is used by USB / the Serial
  Monitor. The PMS5003 also talks UART, so we give it its own software serial
  port (EspSoftwareSerial, bundled with the ESP8266 core) on pin D5.

  THE GOLDEN RULE: NO delay() IN loop()
  -------------------------------------
  The PMS5003 streams a 32-byte frame ~1x/second on its own. If loop() ever
  blocks (delay), the SoftwareSerial buffer overflows and frames corrupt. So we
  drain the PMS buffer on EVERY loop pass and pace everything else with millis()
  timers. The one unavoidable blocking call is the HTTP POST itself (it waits
  for the server to reply). We keep it short (a 4-second timeout) and only do it
  every 5 seconds, and we drain the PMS buffer immediately before AND after it.
  At worst one frame is missed during a POST; the parser simply re-syncs on the
  next header. Wi-Fi join is also handled non-blockingly in loop().

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
    Actuators (reserved here so wiring matches the project; not driven by this
    sketch - alarms are raised on the dashboard, not locally):
        Buzzer + -> 220 ohm -> D7 (GPIO13),  Buzzer - -> GND
        LED anode -> 220 ohm -> D0 (GPIO16), LED cathode -> GND

    COMMON GROUND: ESP8266, both sensors, and the 5V supply must share GND.

  ARDUINO IDE SETUP (one time)
  ----------------------------
    1. File -> Preferences -> "Additional Boards Manager URLs", add:
         http://arduino.esp8266.com/stable/package_esp8266com_index.json
    2. Tools -> Board -> Boards Manager -> install "esp8266 by ESP8266 Community".
    3. Tools -> Board -> select "NodeMCU 1.0 (ESP-12E)".
    4. Tools -> Manage Libraries -> install "Adafruit SGP40 Sensor"
       (also pulls in "Adafruit BusIO"). SoftwareSerial, Wire, ESP8266WiFi and
       ESP8266HTTPClient are all built into the ESP8266 board package.
    5. Tools -> Port -> pick the board's COM port (install the CH340 driver if
       no port appears). Set the Serial Monitor to 115200 baud.

  HOW TO CONFIRM IT IS WORKING
  ----------------------------
    Open the Serial Monitor @115200. You should see:
        [WiFi] Connected. IP = 192.168.1.77
        [POST] pm25=7.0 voc=103 -> HTTP 200
    HTTP 200 means the dashboard accepted the reading. The device then appears
    live on the dashboard (last seen "Just now"). Common status codes:
        200 = success
        401 = bad/missing DEVICE_KEY (re-copy it from the Add-device wizard)
        400 = malformed body (should not happen with this sketch)
        -1  = could not reach the server (check SERVER_IP, same Wi-Fi, backend
              running on port 8001, PC firewall allowing inbound 8001)
  ============================================================================
*/

#include <ESP8266WiFi.h>        // ESP8266 Wi-Fi (STA mode)        - built into the core
#include <ESP8266HTTPClient.h>  // simple HTTP client              - built into the core
#include <WiFiClient.h>         // plain TCP client for HTTPClient - built into the core
#include <SoftwareSerial.h>     // EspSoftwareSerial               - bundled with the core
#include <Wire.h>               // Built-in I2C library (SGP40 bus)
#include <Adafruit_SGP40.h>     // SGP40 VOC sensor driver (install via Library Manager)

// ---------------------------------------------------------------------------
// PIN ASSIGNMENTS  (D-labels are the silkscreen names on the NodeMCU board)
// ---------------------------------------------------------------------------
const uint8_t PMS_RX_PIN  = D5;  // GPIO14 - SoftwareSerial RX  <- PMS5003 TX
const uint8_t PMS_TX_PIN  = D6;  // GPIO12 - SoftwareSerial TX  -> PMS5003 RX (optional)
const uint8_t SGP_SDA_PIN = D2;  // GPIO4  - I2C SDA
const uint8_t SGP_SCL_PIN = D1;  // GPIO5  - I2C SCL
const uint8_t BUZZER_PIN  = D7;  // GPIO13 - reserved (not driven in this sketch)
const uint8_t LED_PIN     = D0;  // GPIO16 - reserved (not driven in this sketch)

// ---------------------------------------------------------------------------
// SEND_TEMP_HUMIDITY
//   This build has no temperature/humidity sensor, so by default we do NOT post
//   temperature/humidity (they are optional in the dashboard contract, and
//   posting fake constant values would be dishonest). If you later add a real
//   T/RH sensor (e.g. SHT31/DHT22), feed its readings into the SGP40 below and
//   flip this to true to include them in the upload.
// ---------------------------------------------------------------------------
const bool  SEND_TEMP_HUMIDITY = false;
const float NOMINAL_TEMP_C = 25.0f;   // assumed indoor temperature (for SGP40 compensation)
const float NOMINAL_RH_PCT = 50.0f;   // assumed indoor relative humidity (%)

// ---------------------------------------------------------------------------
// PMS5003 PROTOCOL CONSTANTS  (same frame format as the ESP32 build)
//   32-byte frames, start bytes 0x42 0x4D, big-endian 16-bit fields:
//     bytes 2..3   : frame length (== 28)
//     bytes 12..13 : PM2.5 atmospheric (ug/m3)   <- what we upload
//     bytes 16..17 : count >= 0.3um per 0.1 L
//     bytes 18..19 : count >= 0.5um per 0.1 L
//     bytes 30..31 : checksum = sum of bytes 0..29
// ---------------------------------------------------------------------------
const uint8_t PMS_START_BYTE_1 = 0x42;
const uint8_t PMS_START_BYTE_2 = 0x4D;
const uint8_t PMS_FRAME_LENGTH = 32;

// ---------------------------------------------------------------------------
// SoftwareSerial port wired to the PMS5003 (RX on D5, TX on D6).
// ---------------------------------------------------------------------------
SoftwareSerial pmsSerial(PMS_RX_PIN, PMS_TX_PIN);  // (RX, TX)

// ---------------------------------------------------------------------------
// SGP40 VOC sensor + TCP client reused for HTTP POSTs.
// ---------------------------------------------------------------------------
Adafruit_SGP40 sgp;
bool sgpReady = false;
WiFiClient wifiClient;

// ---------------------------------------------------------------------------
// NON-BLOCKING TIMERS (millis-based, all in milliseconds)
// ---------------------------------------------------------------------------
const unsigned long VOC_READ_INTERVAL_MS = 1000;   // sample the SGP40 ~1x/sec
const unsigned long POST_INTERVAL_MS     = 5000;   // upload a reading every 5 seconds
unsigned long lastVocReadMs = 0;
unsigned long lastPostMs    = 0;

// HTTP timeout: cap how long a single POST can block while it waits for the
// server. Keeps a slow/unreachable server from stalling the loop for long.
const uint16_t HTTP_TIMEOUT_MS = 4000;

// ---------------------------------------------------------------------------
// PMS5003 FRAME-ASSEMBLY STATE + latest decoded values
// ---------------------------------------------------------------------------
uint8_t pmsBuffer[PMS_FRAME_LENGTH];  // holds the frame as we build it
uint8_t frameIndex = 0;               // how many bytes of the frame we have so far

float    latestPm25     = 0.0f;  // PM2.5 atmospheric (ug/m3)  <- uploaded
int32_t  latestVocIndex = 0;     // SGP40 VOC Index 0..500      <- uploaded
bool     pmsHasData = false;     // becomes true after the first valid frame
unsigned long pmsLastFrameMs = 0;

// Wi-Fi connection tracking (so we print "Connected" exactly once on change).
bool wifiWasConnected = false;

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
  delay(200);  // ONE-TIME boot pause, only here in setup() (never in loop).
  Serial.println();
  Serial.println(F("================================================"));
  Serial.println(F("  AeroSense ESP8266 - Cloud Node"));
  Serial.println(F("================================================"));

  // --- Reserve the actuator pins (kept LOW; alarms happen on the dashboard). ---
  pinMode(BUZZER_PIN, OUTPUT); digitalWrite(BUZZER_PIN, LOW);
  pinMode(LED_PIN,    OUTPUT); digitalWrite(LED_PIN,    LOW);

  // --- Start the SoftwareSerial port to the PMS5003 (9600 8N1). ---
  pmsSerial.begin(9600);
  Serial.println(F("[PMS5003] SoftwareSerial started @9600 (RX=D5/GPIO14)"));

  // --- Start I2C and find the SGP40. If missing, keep running with PM2.5. ---
  Wire.begin(SGP_SDA_PIN, SGP_SCL_PIN);   // (SDA=D2, SCL=D1)
  sgpReady = sgp.begin();
  if (sgpReady) Serial.println(F("[SGP40]   Found on I2C (addr 0x59)."));
  else          Serial.println(F("[SGP40]   NOT found! Check SDA=D2, SCL=D1, 3.3V, GND."));

  // --- Kick off the Wi-Fi join. We do NOT block here waiting for it; loop()
  //     watches the status and prints when it connects. The ESP8266 core will
  //     keep retrying on its own (auto-reconnect). ---
  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);          // don't wear out flash saving credentials each boot
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print(F("[WiFi]    Connecting to \""));
  Serial.print(WIFI_SSID);
  Serial.println(F("\"... (sensors run while we wait)"));

  Serial.println(F("------------------------------------------------"));
}

// ===========================================================================
// loop() - runs forever, very fast. NO delay() in here!
// ===========================================================================
void loop() {
  // (A) Drain the PMS5003 serial buffer EVERY pass - keeps frames healthy.
  readPmsSerial();

  // (B) Read the SGP40 on its own 1-second timer.
  readVocOnInterval();

  // (C) Print Wi-Fi status transitions (connected / lost) without blocking.
  serviceWifiStatus();

  // (D) Every 5 seconds, upload the latest reading to the dashboard.
  unsigned long now = millis();
  if (now - lastPostMs >= POST_INTERVAL_MS) {
    lastPostMs = now;
    postReading();
  }
}

// ---------------------------------------------------------------------------
// (A) readPmsSerial() - non-blocking PMS5003 reader (identical logic to the
// SensorTest sketch). Assembles 32-byte frames and validates the checksum.
// ---------------------------------------------------------------------------
void readPmsSerial() {
  while (pmsSerial.available() > 0) {
    uint8_t incomingByte = (uint8_t)pmsSerial.read();

    // --- Sync on the 2-byte start signature 0x42 0x4D ---
    if (frameIndex == 0) {
      if (incomingByte == PMS_START_BYTE_1) {
        pmsBuffer[0] = incomingByte;
        frameIndex = 1;
      }
      continue;
    }
    if (frameIndex == 1) {
      if (incomingByte == PMS_START_BYTE_2) {
        pmsBuffer[1] = incomingByte;
        frameIndex = 2;
      } else if (incomingByte == PMS_START_BYTE_1) {
        pmsBuffer[0] = incomingByte;
        frameIndex = 1;
      } else {
        frameIndex = 0;
      }
      continue;
    }

    // --- Body of the frame (indices 2..31) ---
    pmsBuffer[frameIndex++] = incomingByte;
    if (frameIndex >= PMS_FRAME_LENGTH) {
      processPmsFrame();
      frameIndex = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// processPmsFrame() - verify checksum, and if valid, decode PM2.5.
// ---------------------------------------------------------------------------
void processPmsFrame() {
  uint16_t computed = 0;
  for (uint8_t i = 0; i < PMS_FRAME_LENGTH - 2; i++) computed += pmsBuffer[i];
  uint16_t frameChecksum = be16(&pmsBuffer[30]);
  uint16_t frameLen      = be16(&pmsBuffer[2]);   // should be 28

  if (computed != frameChecksum || frameLen != 28) {
    return;  // corrupted frame - skip it; we re-sync on the next header
  }

  latestPm25 = (float)be16(&pmsBuffer[12]);  // PM2.5 atmospheric (ug/m3)
  pmsHasData = true;
  pmsLastFrameMs = millis();
}

// ---------------------------------------------------------------------------
// (B) readVocOnInterval() - sample the SGP40 about once per second.
// ---------------------------------------------------------------------------
void readVocOnInterval() {
  if (!sgpReady) return;
  unsigned long now = millis();
  if (now - lastVocReadMs < VOC_READ_INTERVAL_MS) return;
  lastVocReadMs = now;
  latestVocIndex = sgp.measureVocIndex(NOMINAL_TEMP_C, NOMINAL_RH_PCT);
}

// ---------------------------------------------------------------------------
// (C) serviceWifiStatus() - print exactly when the link comes up or drops.
// Non-blocking: just compares the current status to what it was last loop.
// ---------------------------------------------------------------------------
void serviceWifiStatus() {
  bool connected = (WiFi.status() == WL_CONNECTED);
  if (connected && !wifiWasConnected) {
    Serial.print(F("[WiFi]    Connected. IP = "));
    Serial.println(WiFi.localIP());
  } else if (!connected && wifiWasConnected) {
    Serial.println(F("[WiFi]    Connection lost - the core will auto-reconnect."));
  }
  wifiWasConnected = connected;
}

// ---------------------------------------------------------------------------
// (D) postReading() - upload the latest reading to the dashboard as JSON.
//   POST http://<SERVER_IP>:<SERVER_PORT>/api/ingest/readings
//   Header: X-Device-Key: <DEVICE_KEY>
//   Body:   {"pm25": <ug/m3>, "voc": <VOC Index>}   (temp/humidity optional)
// We drain the PMS buffer right before and after, since the POST is the one
// blocking step in the loop.
// ---------------------------------------------------------------------------
void postReading() {
  readPmsSerial();  // top up the parser right before we block on the network

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("[POST]    Skipped - Wi-Fi not connected yet."));
    return;
  }
  if (!pmsHasData) {
    Serial.println(F("[POST]    Skipped - no valid PMS reading yet."));
    return;
  }

  // Build the destination URL: http://SERVER_IP:SERVER_PORT/api/ingest/readings
  char url[96];
  snprintf(url, sizeof(url), "http://%s:%u/api/ingest/readings", SERVER_IP, SERVER_PORT);

  // Build the JSON body. VOC is the raw SGP40 index (integer). Temp/humidity
  // are only included when SEND_TEMP_HUMIDITY is true (no T/RH sensor here).
  char body[160];
  if (SEND_TEMP_HUMIDITY) {
    snprintf(body, sizeof(body),
             "{\"pm25\":%.1f,\"voc\":%ld,\"temperature\":%.1f,\"humidity\":%.1f}",
             latestPm25, (long)latestVocIndex, NOMINAL_TEMP_C, NOMINAL_RH_PCT);
  } else {
    snprintf(body, sizeof(body),
             "{\"pm25\":%.1f,\"voc\":%ld}",
             latestPm25, (long)latestVocIndex);
  }

  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);          // cap how long the POST can block
  http.begin(wifiClient, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);   // the dashboard authenticates on this

  int code = http.POST((uint8_t *)body, strlen(body));

  // Report the outcome. A positive code is the HTTP status from the server; a
  // negative code is a client-side/connection error (e.g. -1 = cannot connect).
  Serial.print(F("[POST]    pm25="));
  Serial.print(latestPm25, 1);
  Serial.print(F(" voc="));
  Serial.print(latestVocIndex);
  Serial.print(F(" -> HTTP "));
  Serial.print(code);
  if (code == 401)      Serial.print(F("  (bad/missing DEVICE_KEY)"));
  else if (code == 400) Serial.print(F("  (malformed body)"));
  else if (code < 0)    Serial.print(F("  (cannot reach server - check SERVER_IP / same Wi-Fi / backend up)"));
  Serial.println();

  http.end();

  readPmsSerial();  // drain anything that arrived while the POST was blocking
}
