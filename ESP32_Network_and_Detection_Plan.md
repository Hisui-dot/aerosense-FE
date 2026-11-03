# AeroSense ESP32 Node — Network Setup & Vape-Detection Implementation Plan

## Overview

This plan takes a single AeroSense node from a bare ESP32-WROOM-32E board to a working vape-detection device that fires a local alarm and reports to the AeroSense dashboard — then scales it to the multi-node classroom/CR deployment. It is the bridge between the firmware spec (`IoT_Vape_Detection_Manual_Phase1_Revised.docx`) and the existing React + Express + SQLite dashboard in `C:\Capstone_Vape\Vape`.

It directly answers the request to give the ESP32 "its own network" by covering both technical meanings — **SoftAP** (the ESP32 *hosts* its own Wi-Fi) and **Station/STA** (the ESP32 *joins* a dedicated Wi-Fi) — with a clear recommendation for the bench test versus production.

It also upgrades the detection from the inadequate single PM2.5 mass threshold (`PM25_VAPE_THRESHOLD = 35`) to a **fine-particle count rate-of-rise corroborated by a VOC-index delta**, which is what a point sensor mounted ~9 ft up can actually observe for a small puff.

> ### Where to start (quick path)
> If you do nothing else, do these first, in order:
> 1. **Phase 0** — install Arduino IDE 2.x, the Espressif ESP32 board package, the **Adafruit SGP40** library, and the CP210x/CH340 USB driver. (Dashboard deps are already installed.)
> 2. **Phase 1, SoftAP path** — flash the node as its own access point (`AeroSense-Node1`), join it from your phone, open `http://192.168.4.1`, and confirm you can see live readings. Zero infrastructure required.
> 3. **Phase 2** — bring up PMS5003 + SGP40 and the non-blocking detection loop; watch the count bins and VOC index in the serial monitor while someone puffs.
> 4. Only then wire the dashboard (**Phase 3**) and add the second/third node (**Phase 4**).
>
> The very first concrete keystroke: open Arduino IDE → Boards Manager → install "esp32 by Espressif Systems".

---

## Table of Contents

- [Hardware & Wiring Recap](#hardware--wiring-recap)
- [Phase 0 — Prerequisites & Toolchain](#phase-0--prerequisites--toolchain)
- [Phase 1 — Stand Up the Node on Its Own Network](#phase-1--stand-up-the-node-on-its-own-network)
- [Phase 2 — Sensor Read + Small-Puff Detection Firmware](#phase-2--sensor-read--small-puff-detection-firmware)
- [Phase 3 — Dashboard Integration](#phase-3--dashboard-integration)
- [Phase 4 — Multi-Node Deployment](#phase-4--multi-node-deployment)
- [Phase 5 — Test & Validation](#phase-5--test--validation)
- [Realistic Limitations](#realistic-limitations)
- [Appendix — Key File Paths](#appendix--key-file-paths)

---

## Hardware & Wiring Recap

| Subsystem | Pins / Bus | Notes |
|---|---|---|
| PMS5003 (particulate) | `Serial2`: RX2=**GPIO16**, TX2=**GPIO17**, 9600 baud, `SERIAL_8N1` | 32-byte frames starting `0x42 0x4D`; checksum = sum of first 30 bytes |
| SGP40 (VOC) | I2C: SDA=**GPIO21**, SCL=**GPIO22**, addr **0x59** | via `Adafruit_SGP40` library |
| Buzzer (active piezo) | **GPIO25** | through a 220 Ω resistor |
| Red LED | **GPIO26** | through a 220 Ω resistor |
| Debug serial | USB | **115200** baud |

**Power & wiring rules (non-negotiable):**

- **PMS5003 fan runs from 5 V (VIN), never the 3.3 V rail** — 3.3 V browns out the on-board LDO.
- **Common ground** between the ESP32, both sensors, and the actuators.
- Use a solid **≥ 1 A 5 V supply and a short/thick USB cable.** Wi-Fi TX current spikes (300–500 mA peaks) combined with the fan will brown out a weak supply and trigger the "Brownout detector was triggered" reboot loop. This is a Wi-Fi-specific failure mode, not just a sensor one.
- If the I2C bus drops packets / NACKs, add **4.7 kΩ pull-ups** from SDA→3.3 V and SCL→3.3 V.

```
                 +5V (VIN) ──────┬───────────────► PMS5003 VCC (fan)
ESP32-WROOM-32E                  │
  GPIO16 (RX2) ◄──── PMS5003 TX  │
  GPIO17 (TX2) ────► PMS5003 RX  │
  GPIO21 (SDA) ◄───► SGP40 SDA   │   (optional 4.7k pull-ups SDA/SCL → 3.3V)
  GPIO22 (SCL) ◄───► SGP40 SCL   │
  3.3V ────────────► SGP40 VCC   │
  GPIO25 ──[220Ω]──► Buzzer +    │
  GPIO26 ──[220Ω]──► LED +       │
  GND ─────────────┴── common ground (ESP32 + sensors + actuators) ──┘
```

---

## Phase 0 — Prerequisites & Toolchain

> These steps are **firmware-side only**. The dashboard's npm dependencies in `C:\Capstone_Vape\Vape` are already installed — do not reinstall them here.

**Checklist:**

- [ ] Install **Arduino IDE 2.x**.
- [ ] Install the **USB-serial driver** for your board: **CP210x** or **CH340** (depends on which USB-UART chip your DevKitC clone uses). Without it, no COM port appears.
- [ ] In Arduino IDE → **Preferences → Additional boards manager URLs**, add the Espressif ESP32 URL, then **Boards Manager → install "esp32 by Espressif Systems"**.
- [ ] Select board **"ESP32 Dev Module"** and the correct **COM port**.
- [ ] **Library Manager → install "Adafruit SGP40 Sensor"** (this pulls in the Adafruit BusIO / Unified Sensor dependencies). `Wire.h` (I2C) is built in. Compilation fails without the SGP40 library.
- [ ] Confirm a trivial `Blink` sketch on GPIO26 using a `millis()` timer compiles, uploads, and blinks — this validates the whole toolchain + USB-serial + power before any sensor work.

---

## Phase 1 — Stand Up the Node on Its Own Network

"Give the ESP32 its own network" has two distinct meanings. Both are implemented here.

All Wi-Fi APIs are from the **Arduino-ESP32 core** (`WiFi.h`, `WebServer.h`, `ESPmDNS.h`, `HTTPClient.h`). They are non-blocking-friendly: `WiFi.begin()` / `WiFi.softAP()` return immediately and connect in the background, fitting the project's hard rule of `millis()` timers and **never** `delay()`. (Note: `HTTPClient::POST()` itself is a separate, synchronous call — see §1.4 for how to bound its blocking window.)

### 1.1 The two meanings

**(a) SoftAP — the ESP32 *hosts* its own Wi-Fi (`WiFi.softAP`).** The ESP32 becomes the access point, broadcasting its own SSID (e.g. `AeroSense-Node1`). A phone/laptop joins *that* SSID directly; no router involved. The node is reachable at the default gateway IP **`192.168.4.1`** and can serve its own web page. This is "its own network" in the literal sense — the node *is* the network.

**(b) Station (STA) — the ESP32 *joins* an existing Wi-Fi (`WiFi.begin`).** The ESP32 is a client of a router / dedicated IoT VLAN/SSID / phone hotspot, gets a DHCP IP, and can reach other hosts — crucially, the Express backend. This is "its own network" in the *deployment* sense: put all nodes on a dedicated `AeroSense-IoT` SSID/VLAN, isolated from student traffic but sharing one subnet with the dashboard server.

| | SoftAP | STA |
|---|---|---|
| **Best for** | First detection demo — zero infrastructure | Production multi-node + dashboard |
| **Reaches backend?** | No (clients on the AP island only) | Yes |
| **Scales to many nodes?** | No (each node is a separate island) | Yes (one subnet, one view) |
| **Client keeps internet?** | No (phone loses internet on the AP) | Yes |
| **Capacity** | ~4 clients default (up to 10) | n/a (it's a client) |

### 1.2 Recommendation

- **MVP bench test → start SoftAP, then add STA.** Run the node as a pure SoftAP with a tiny built-in page. Flash it, power it, join `AeroSense-Node1`, open `http://192.168.4.1`, and watch readings update live while someone puffs. This proves detection with **zero** network dependencies. Once detection is trusted, switch the same node to STA to prove the telemetry path.
- **Production multi-node → STA on a dedicated `AeroSense-IoT` SSID/VLAN**, POSTing telemetry to the Express backend. One centralized view, scales to 2 classroom + 1 CR nodes, isolates nodes from student devices. Keep SoftAP only as an optional fallback/provisioning/diagnostic mode (see `WIFI_AP_STA` caveat in §1.5).
- **The bench SoftAP build and the production STA build are separate code paths** selected at compile time (a `#define`), **not a runtime flip.** Do not try to switch between a channel-pinned SoftAP and STA on one running node — the single radio cannot serve both on different channels (see §1.5).

### 1.3 SoftAP bring-up (no dashboard needed)

**Connecting steps:**

1. **Pick credentials/channel.** SSID `AeroSense-Node1`; WPA2 password **≥ 8 chars** (anything shorter silently falls back to an *open* AP — see §1.5). For a **pure SoftAP** bench build, pinning a channel (1, 6, or 11) is fine and avoids congestion. Do **not** hardcode this channel in any build that may later run AP_STA (see §1.5).
2. **Start the AP** in `setup()`. `WiFi.softAP()` returns `true` on success; gateway IP defaults to `192.168.4.1`.
3. **(Optional) mDNS hostname** so you can browse `http://aerosense1.local`.
4. **Serve data** via the built-in `WebServer`: a `/` page plus a `/data` JSON endpoint the page polls with `fetch()`.
5. **Connect a client:** on your phone/laptop Wi-Fi list, join `AeroSense-Node1`, enter the password, open `http://192.168.4.1` (or `http://aerosense1.local`).

```cpp
#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>

const char* AP_SSID = "AeroSense-Node1";
const char* AP_PASS = "vape-detect-01";   // >= 8 chars or AP becomes OPEN
WebServer server(80);

// Produced by the detection loop (Phase 2). vocIndex is the SGP40 VOC Index
// (int32, nominal 100 = baseline, range 0-500) — NOT a ppb/ppm concentration.
extern float    pm25, pm03Count;
extern int32_t  vocIndex;
extern bool     vapeIncidentFlag;

void handleData() {
  char json[160];
  snprintf(json, sizeof(json),
    "{\"pm25\":%.1f,\"vocIndex\":%ld,\"pm03\":%.0f,\"alarm\":%s}",
    pm25, (long)vocIndex, pm03Count, vapeIncidentFlag ? "true" : "false");
  server.send(200, "application/json", json);
}

void handleRoot() {
  server.send(200, "text/html",
    "<!doctype html><meta name=viewport content='width=device-width'>"
    "<h2>AeroSense Node 1</h2><pre id=o>loading...</pre>"
    "<script>setInterval(()=>fetch('/data').then(r=>r.json())"
    ".then(d=>o.textContent=JSON.stringify(d,null,2)),1000)</script>");
}

void setupSoftAP() {
  WiFi.mode(WIFI_AP);
  // channel pin (6) is ONLY safe for a pure-AP build — see §1.5
  bool ok = WiFi.softAP(AP_SSID, AP_PASS, /*channel=*/6, /*hidden=*/0, /*maxConn=*/4);
  Serial.printf("SoftAP %s, IP: %s\n", ok ? "up" : "FAILED",
                WiFi.softAPIP().toString().c_str());   // -> 192.168.4.1

  if (MDNS.begin("aerosense1")) MDNS.addService("http", "tcp", 80);  // aerosense1.local
  server.on("/", handleRoot);
  server.on("/data", handleData);
  server.begin();
}

// In loop(): call server.handleClient() EVERY pass — non-blocking, returns
// immediately if no request. It coexists with the millis() sensor/alarm timers.
```

### 1.4 STA mode + POST telemetry to the backend

**Connecting steps:**

1. `WiFi.mode(WIFI_STA)` then `WiFi.begin(ssid, pass)` — returns immediately (async).
2. **Wait non-blockingly:** never spin in `while (WiFi.status()!=WL_CONNECTED) delay(...)`. Poll `WiFi.status()` from a `millis()` timer (or use `WiFi.onEvent()`); only send telemetry once it equals `WL_CONNECTED`. `WiFi.localIP()` gives the DHCP address.
3. **POST JSON** with `HTTPClient` over a `WiFiClient` on your own send interval (e.g. every 5 s, plus an immediate send when the alarm fires).

> **`HTTPClient::POST()` is synchronous and *does* block `loop()`.** Unlike `WiFi.begin()`, a POST over `WiFiClient` blocks until the server responds or the socket times out — by default up to ~5000 ms. If the backend is slow, unreachable, or the TCP handshake stalls, that stall is long enough to **overflow the PMS5003 UART RX buffer and corrupt frames** — the exact failure the non-blocking rule exists to prevent. A synchronous POST therefore has a **bounded but non-zero blocking window**, and must be defended:
> - Set aggressive timeouts: `http.setConnectTimeout(800); http.setTimeout(800);` (caps the stall at ~0.8 s instead of ~5 s).
> - **Drain `Serial2` (call `pmsPoll()`) immediately before and after every POST.**
> - **Never POST from inside `processSample()`** — only from a dedicated `millis()`-driven `netPoll()` in `loop()`, or, better, move all networking to a FreeRTOS task pinned to core 0 (`xTaskCreatePinnedToCore`) fed by a queue, keeping the sensor/parse loop on the app core.

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* STA_SSID  = "AeroSense-IoT";
const char* STA_PASS  = "iot-vlan-pass";
const char* INGEST_URL = "http://192.168.1.50:8001/api/ingest/telemetry"; // backend host:port

unsigned long lastSend = 0;
const unsigned long sendInterval = 5000;   // ms

void setupSTA() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(STA_SSID, STA_PASS);           // async, returns immediately
  WiFi.setAutoReconnect(true);
}

void postTelemetry() {
  if (WiFi.status() != WL_CONNECTED) return;    // guard: don't block

  pmsPoll();                                     // drain UART BEFORE the blocking POST

  WiFiClient client;
  HTTPClient http;
  http.setConnectTimeout(800);                   // cap TCP-connect stall (~0.8s)
  http.setTimeout(800);                          // cap read stall (~0.8s)
  http.begin(client, INGEST_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", "NODE-SHARED-SECRET");   // device key, NOT a user JWT

  // vocIndex is the integer SGP40 VOC Index (~0-500, 100=baseline) — send it as-is.
  char body[200];
  snprintf(body, sizeof(body),
    "{\"deviceId\":\"%s\",\"pm25\":%.1f,\"voc\":%ld,\"vape\":%s}",
    deviceId().c_str(), pm25, (long)vocIndex, vapeIncidentFlag ? "true" : "false");

  int code = http.POST(body);                    // bounded blocking window (<= ~0.8s)
  Serial.printf("POST -> %d\n", code);
  http.end();

  pmsPoll();                                     // drain UART AFTER the POST
}
// Call from loop() on the millis() sendInterval timer, plus immediately on alarm edge.
// Production option: run this inside a core-0 FreeRTOS task fed by a queue instead.
```

> **Backend gap (verified in this repo):** every existing `/api/*` route is gated by a Bearer JWT (`requireAuth`), and the only route that updates a device — `PUT /api/devices/:id` — is `requireAdmin`. **There is no telemetry-ingest endpoint today**, so the ESP32 cannot post to the current API as-is. **Phase 3 adds a key-protected `POST /api/ingest/telemetry` route** so the MCU carries one constant header instead of doing JWT login/refresh. Do not bake admin credentials into firmware.

### 1.5 Networking caveats (APIs kept accurate)

- **Open-AP security.** `WiFi.softAP()` with a password **shorter than 8 characters silently creates an OPEN network.** Always use a ≥ 8-char WPA2 password, even on a bench.
- **Captive portal.** Phones often auto-disconnect from an internet-less SoftAP. For the demo, dismiss the "no internet, stay connected?" prompt and keep the SSID joined. For provisioning you can run a `DNSServer` redirecting all lookups to `192.168.4.1`.
- **Simultaneous `WIFI_AP_STA` and the channel trap.** The ESP32 can run AP + STA at once (handy for a diagnostic page while connected), but it's **one shared radio on a single channel.** When STA associates, the AP is **forced onto the router's channel** — so a SoftAP whose channel you hardcoded to 6 will jump to the router's channel (e.g. 1 or 11) the moment STA connects, briefly disrupting any AP clients. **Therefore: in pure SoftAP bench mode, pinning a channel is fine; in any AP_STA / diagnostic-while-connected mode, do NOT hardcode the SoftAP channel — leave it default so it follows the STA channel.** Treat the pure-AP bench build and the STA/AP_STA build as **separate code paths**, not a runtime channel flip.
- **Non-blocking reconnect.** Wi-Fi will drop. Either register `WiFi.onEvent()` and call `WiFi.reconnect()` on `ARDUINO_EVENT_WIFI_STA_DISCONNECTED` (note: event callbacks run on a **separate FreeRTOS task** — keep them thread-safe; never call `WiFi.onEvent()`/`removeEvent()` from inside one), or from `loop()` on a `millis()` timer call `WiFi.reconnect()` when `WiFi.status() != WL_CONNECTED`. **Detection + buzzer/LED must keep running locally even with Wi-Fi down** — networking is for reporting, not for triggering the local alarm.

---

## Phase 2 — Sensor Read + Small-Puff Detection Firmware

This firmware owns both sensors, maintains rolling baselines, runs the rate-of-rise + VOC-corroboration detection, drives the buzzer/LED, and emits a CSV feature row each cycle for later ML training. Every routine is non-blocking — called repeatedly from `loop()`, gated by `millis()` timers. **There is not a single `delay()` anywhere** — a `delay()` stalls the `Serial2` UART and corrupts PMS5003 frames. (Networking POSTs are bounded with short timeouts and bracketed by `pmsPoll()` per §1.4.)

### 2.1 PMS5003 32-byte frame layout (big-endian, all `uint16_t`)

| Offset | Field | Notes |
|---|---|---|
| 0–1 | Start chars | **`0x42 0x4D`** — fixed |
| 2–3 | Frame length | = **28 (0x001C)** |
| 4–9 | PM1.0/2.5/10 **CF=1 "standard particle"** | µg/m³ — **factory test-chamber reference** (standardized particle density); not the ambient figure |
| 10–15 | PM1.0/2.5/10 **atmospheric environment** | µg/m³ — **corrected for ambient air; use this for real-room readings** (this is dashboard `pm25`) |
| 16–17 | **count ≥0.3 µm** / 0.1 L | **primary fine-particle signal** |
| 18–19 | **count ≥0.5 µm** / 0.1 L | **secondary fine-particle signal** |
| 20–27 | count ≥1.0 / ≥2.5 / ≥5.0 / ≥10 µm / 0.1 L | features |
| 28–29 | Reserved | ignored |
| 30–31 | **Checksum** | = sum of **bytes 0..29** (all 30 preceding bytes incl. start chars) |

> The **CF=1 ("standard particle")** set at bytes 4–9 is the manufacturer's test-chamber reference computed against a standardized particle density; the **"atmospheric environment"** set at bytes 10–15 is corrected for ambient conditions. **Use the atmospheric set for real-room readings** — which the code below does (`pm2_5_atm` → dashboard `pm25`).
>
> Count bins are **cumulative** (`count≥0.3 ≥ count≥0.5 ≥ … ≥ count≥10`). A vape puff is dominated by sub-micron droplets, so the ≥0.3 and ≥0.5 bins move first and most while the mass channels barely budge. The monotonic ordering is an extra corruption sanity-check beyond the checksum.

**Non-blocking parser** — read whatever bytes are available each pass, hunt for the `0x42 0x4D` header, commit a frame only when 32 bytes are present AND checksum + length both validate:

```cpp
static const uint8_t PMS_FRAME_LEN = 32;
uint8_t  pmsBuf[PMS_FRAME_LEN];
uint8_t  pmsIdx = 0;

struct PmsData {
  uint16_t pm1_0_std, pm2_5_std, pm10_std;     // CF=1 "standard particle" (test reference)
  uint16_t pm1_0_atm, pm2_5_atm, pm10_atm;     // atmospheric (ambient-corrected) — use this
  uint16_t cnt_0_3, cnt_0_5, cnt_1_0, cnt_2_5, cnt_5_0, cnt_10;  // counts/0.1L
  bool     valid;
  uint32_t lastFrameMs;
};
PmsData pms = {0};

static inline uint16_t be16(const uint8_t* p) { return (uint16_t(p[0]) << 8) | p[1]; }

// Call EVERY loop() pass — never blocks; drains the UART so it can't overflow.
void pmsPoll() {
  while (Serial2.available() > 0) {
    uint8_t b = (uint8_t)Serial2.read();
    if (pmsIdx == 0) { if (b == 0x42) pmsBuf[pmsIdx++] = b; continue; }
    if (pmsIdx == 1) {
      if (b == 0x4D) pmsBuf[pmsIdx++] = b;
      else { pmsIdx = (b == 0x42) ? 1 : 0; if (b == 0x42) pmsBuf[0] = 0x42; }
      continue;
    }
    pmsBuf[pmsIdx++] = b;
    if (pmsIdx < PMS_FRAME_LEN) continue;

    uint16_t sum = 0;
    for (uint8_t i = 0; i < 30; i++) sum += pmsBuf[i];
    if (sum == be16(&pmsBuf[30]) && be16(&pmsBuf[2]) == 28) {
      pms.pm1_0_std = be16(&pmsBuf[4]);  pms.pm2_5_std = be16(&pmsBuf[6]);
      pms.pm10_std  = be16(&pmsBuf[8]);
      pms.pm1_0_atm = be16(&pmsBuf[10]); pms.pm2_5_atm = be16(&pmsBuf[12]);
      pms.pm10_atm  = be16(&pmsBuf[14]);
      pms.cnt_0_3 = be16(&pmsBuf[16]);   pms.cnt_0_5 = be16(&pmsBuf[18]);
      pms.cnt_1_0 = be16(&pmsBuf[20]);   pms.cnt_2_5 = be16(&pmsBuf[22]);
      pms.cnt_5_0 = be16(&pmsBuf[24]);   pms.cnt_10  = be16(&pmsBuf[26]);
      pms.valid = true; pms.lastFrameMs = millis();
    }
    pmsIdx = 0;   // reset/re-sync either way
  }
}
// setup(): Serial2.begin(9600, SERIAL_8N1, /*RX2=*/16, /*TX2=*/17);
```

### 2.2 SGP40 VOC read (Adafruit_SGP40, I2C 0x59)

`Adafruit_SGP40` runs Sensirion's auto-baselining **VOC Index** algorithm internally. Two values:

- **`raw`** — `sgp.measureRaw(tempC, rh)` → raw MOx ticks (`uint16_t`); diagnostics/logging only.
- **`vocIndex`** — `sgp.measureVocIndex(tempC, rh)` → `int32_t`, nominal **100 = current baseline**, range 0–500, rising with VOC. **This is the detection-relevant channel** (and the value sent in the dashboard `voc` field — see the units note below). It is an **index, not a ppb/ppm concentration.**

With no on-node T/RH sensor, use the compensation defaults `25.0 °C` / `50.0 %RH`.

```cpp
#include <Adafruit_SGP40.h>
Adafruit_SGP40 sgp;
float ambTempC = 25.0f, ambRH = 50.0f;   // replace if a T/RH sensor is added

struct SgpData { int32_t vocIndex; uint16_t raw; bool ready; bool i2cFault; uint32_t lastMs; };
SgpData sgpd = {0};

void sgpSetup() {
  Wire.begin(21, 22);                 // SDA=GPIO21, SCL=GPIO22
  sgpd.i2cFault = !sgp.begin();       // flag I2C fault; do NOT block
}
void sgpRead() {                      // fast I2C txn — call on the poll tick
  if (sgpd.i2cFault) return;
  sgpd.raw      = sgp.measureRaw(ambTempC, ambRH);
  sgpd.vocIndex = sgp.measureVocIndex(ambTempC, ambRH);
  sgpd.ready = true; sgpd.lastMs = millis();
}
```

**VOC warmup / baselining — single policy used everywhere (§2.5 and §5.2):**
- The SGP40 hotplate stabilizes in seconds, but the **VOC Index gas-index baseline needs conditioning on the order of minutes**, and Index values are only fully trustworthy after a long run.
- **Policy (applied consistently): arm detection only after the warmup window has elapsed (default `VOC_WARMUP_MS = 180000`, i.e. 3 min; do not run validation puff tests until ≥ 3–10 min of warmup), and treat the first ~1 hr of Index values as low-confidence.** §5.2 uses the same ≥ 3–10 min figure — there is no separate warmup number.
- The algorithm **auto-rebaselines in hardware**: a vaper standing under the node for minutes is eventually "learned" as normal and the index decays back toward 100 — this cannot be tuned away (see §2.4 and Realistic Limitations). **Therefore VOC is used as a rising-edge / onset corroborator via a short-term *delta* against our own rolling baseline — never as an absolute threshold, and never as the hold/clear signal.**

### 2.3 Why the 35 µg/m³ mass threshold is insufficient

1. **Mass is the wrong quantity.** E-cig aerosol is overwhelmingly sub-micron droplets (~0.1–0.5 µm). Mass scales with diameter cubed, so a huge *number* of tiny droplets adds almost nothing to mass — the ≥0.3/≥0.5 count bins light up while `pm2_5_atm` rises only a few µg/m³, well under 35.
2. **9 ft ceiling dilution.** A puff exhaled at ~1.5 m rises and disperses ~1.3 m further before reaching the sensor, mixing into a large air volume. Peak concentration at the sensor is a fraction of what it was at the mouth.
3. **Absolute thresholds ignore the room's baseline.** Chalk dust, HVAC cycling, infiltration, and humidity all shift absolute PM/VOC. A fixed number is simultaneously too sensitive in clean air and too insensitive in a dusty room.

**The fix: detect the transient** — a fast rise in the fine-count bins above the room's own rolling baseline, corroborated by a VOC-index bump on the rising edge. The mass channels are kept only as logged features and coarse secondary confirmation.

### 2.4 Detection: rolling baseline + rate-of-rise + VOC corroboration

For each fine-count channel (≥0.3 and ≥0.5):
- **Baseline EMA (slow):** `base = (1 − α)·base + α·x`, small α so it tracks ambient drift over minutes but ignores a brief puff.
- **Short-term level (fast):** mean of the last N samples = "now."
- **Rate-of-rise condition:** `shortTerm > base × RISE_MULT` **AND** `shortTerm − base > MIN_ABS_RISE` (the absolute floor prevents huge multiplicative triggers when `base ≈ 0` in clean air).

VOC corroboration (rising edge only): `vocDelta = vocIndex − vocBaseEMA`; require `vocDelta > VOC_DELTA_MIN`.

```
hot = warmupComplete
   && ( (cnt0_3_short > cnt0_3_base*RISE_MULT && cnt0_3_short-cnt0_3_base > MIN_ABS_RISE_03)
     || (cnt0_5_short > cnt0_5_base*RISE_MULT && cnt0_5_short-cnt0_5_base > MIN_ABS_RISE_05) )
   && (vocDelta > VOC_DELTA_MIN);
```

Counts give speed/sensitivity; the VOC AND-gate suppresses dust-only events (particles up, VOC flat) **at puff onset**.

**VOC is an onset corroborator, not a hold/clear signal.** Because the SGP40's internal VOC Index algorithm auto-rebaselines, a vaper lingering under the node sees the Index itself decay back toward 100 within minutes even though VOC is still elevated — so `vocDelta` collapses on sustained exposure. If the AND-gate depended on VOC to *stay* asserted, the alarm would clear prematurely. **Therefore VOC gates only the rising edge (asserting an incident); the particle-count channel alone governs hold and clear.** This SGP40 self-cancellation of sustained sources is a known limitation, not something tunable away (see Realistic Limitations).

**Critical baseline-freeze rule:** while an incident is active (and during a cooldown after), **stop updating the count/VOC EMAs** — otherwise the baseline chases the puff upward and blinds the detector. (Note: the freeze protects *our* EMA only; it cannot stop Sensirion's internal rebaselining of the raw Index — another reason hold/clear leans on counts.) Resume EMA updates only when the **count** channel returns near baseline.

**Debounce / hysteresis (counts-driven for hold/clear):**
- **Confirm-up:** require `CONFIRM_SAMPLES` consecutive `hot` samples before asserting `vape_incident_flag`.
- **Minimum hold:** keep the alarm on for at least `ALARM_HOLD_MS` once asserted (lengthened so a lingering source isn't dropped while VOC self-cancels).
- **Confirm-down:** clear only after `CLEAR_SAMPLES` consecutive samples in which the **count** channel has returned to baseline **and** the hold has elapsed (clearing is stickier than firing, and keyed on counts, not VOC).

### 2.5 Non-blocking firmware skeleton

```cpp
#include <Wire.h>
#include <Adafruit_SGP40.h>

// ---- PINS ----
const uint8_t PIN_BUZZER = 25;   // active piezo (through 220Ω)
const uint8_t PIN_LED    = 26;   // red LED (through 220Ω)
// PMS5003: RX2=16, TX2=17  |  SGP40: SDA=21, SCL=22

// ---- TUNABLES (bench starting values) ----
const uint32_t SENSOR_POLL_INTERVAL  = 1000;    // ms (~1 Hz PMS frame)
const uint32_t ALERT_TOGGLE_INTERVAL = 250;     // ms blink half-period
const uint32_t VOC_WARMUP_MS         = 180000;  // 3 min min warmup before armed (see §2.2)
const uint8_t  BASELINE_SEED_FRAMES  = 8;       // avg first N clean frames for baseline
const float    COUNT_EMA_ALPHA = 0.02f;         // slow baseline
const uint8_t  SHORT_WIN       = 3;             // short-term mean window
const float    RISE_MULT        = 1.8f;
const uint16_t MIN_ABS_RISE_03  = 800;          // counts/0.1L floor, >=0.3um
const uint16_t MIN_ABS_RISE_05  = 300;          // counts/0.1L floor, >=0.5um
const int32_t  VOC_DELTA_MIN    = 15;
const uint8_t  CONFIRM_SAMPLES  = 2;
const uint8_t  CLEAR_SAMPLES    = 5;
const uint32_t ALARM_HOLD_MS    = 20000;        // min 20 s on (longer: VOC self-cancels)

// ---- STATE ----
uint32_t lastSensorMs = 0, lastToggleMs = 0, alarmStartMs = 0, bootMs = 0;
bool alertOutputOn = false, vape_incident_flag = false;
bool baselineSeeded = false, warmupComplete = false;
uint8_t hotStreak = 0, clearStreak = 0;
uint8_t seedCount = 0;
double  cnt0_3_seedSum = 0, cnt0_5_seedSum = 0, voc_seedSum = 0;
float cnt0_3_base = 0, cnt0_5_base = 0, vocBaseEMA = 100.0f;
uint16_t shortBuf0_3[SHORT_WIN], shortBuf0_5[SHORT_WIN];
uint8_t shortPos = 0; bool shortFilled = false;
Adafruit_SGP40 sgp;

float meanU16(const uint16_t* a, uint8_t n){uint32_t s=0;for(uint8_t i=0;i<n;i++)s+=a[i];return (float)s/n;}

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, 16, 17);
  Wire.begin(21, 22);
  sgpd.i2cFault = !sgp.begin();      // check return; flag fault, do NOT block (see §2.2)
  pinMode(PIN_BUZZER, OUTPUT); pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW); digitalWrite(PIN_LED, LOW);
  bootMs = millis();
  // setupSoftAP();  // Phase 1 bench path (separate build)
  // setupSTA();     // Phase 1 integration path (separate build)
  Serial.println(F("ms,iso_ts,cnt0_3,cnt0_5,cnt1_0,cnt2_5,cnt5_0,cnt10,"
                   "pm1_atm,pm2_5_atm,pm10_atm,pm1_std,pm2_5_std,pm10_std,"
                   "voc_raw,voc_index,cnt0_3_base,cnt0_5_base,voc_base,"
                   "cnt0_3_delta,cnt0_5_delta,voc_delta,incident,label"));
}

void loop() {
  uint32_t now = millis();
  pmsPoll();                         // EVERY pass — drains UART, never blocks
  // server.handleClient();          // if SoftAP web page is enabled

  if (now - lastSensorMs >= SENSOR_POLL_INTERVAL) {
    lastSensorMs = now;
    sgpRead();
    if (pms.valid) { processSample(now); pms.valid = false; }
  }

  if (vape_incident_flag) {
    if (now - lastToggleMs >= ALERT_TOGGLE_INTERVAL) {
      lastToggleMs = now; alertOutputOn = !alertOutputOn;
      digitalWrite(PIN_BUZZER, alertOutputOn); digitalWrite(PIN_LED, alertOutputOn);
    }
  } else if (alertOutputOn) {
    alertOutputOn = false; digitalWrite(PIN_BUZZER, LOW); digitalWrite(PIN_LED, LOW);
  }

  // if (millis()-lastSend >= sendInterval) { lastSend=millis(); postTelemetry(); } // Phase 3
}

void processSample(uint32_t now) {
  // --- Baseline seeding: average the first N clean frames during warmup, do NOT
  //     freeze on a single (possibly transient) first frame. Prefill the short
  //     window with the seed so early n=1 means cannot spuriously fire. ---
  if (!baselineSeeded) {
    cnt0_3_seedSum += pms.cnt_0_3; cnt0_5_seedSum += pms.cnt_0_5;
    voc_seedSum    += sgpd.vocIndex; seedCount++;
    if (seedCount >= BASELINE_SEED_FRAMES) {
      cnt0_3_base = cnt0_3_seedSum / seedCount;
      cnt0_5_base = cnt0_5_seedSum / seedCount;
      vocBaseEMA  = voc_seedSum    / seedCount;
      for (uint8_t i = 0; i < SHORT_WIN; i++) {     // prefill short window with seed
        shortBuf0_3[i] = (uint16_t)cnt0_3_base;
        shortBuf0_5[i] = (uint16_t)cnt0_5_base;
      }
      shortFilled = true; baselineSeeded = true;
    }
    logFeatureRow(now, cnt0_3_base, cnt0_5_base, 0, 0, 0);  // log during seeding too
    return;                                                 // not armed yet
  }

  // Arm only after BOTH the seed completed AND the warmup window elapsed.
  warmupComplete = baselineSeeded && ((now - bootMs) >= VOC_WARMUP_MS);

  shortBuf0_3[shortPos] = pms.cnt_0_3; shortBuf0_5[shortPos] = pms.cnt_0_5;
  shortPos = (shortPos + 1) % SHORT_WIN; if (shortPos == 0) shortFilled = true;
  uint8_t n = shortFilled ? SHORT_WIN : (shortPos ? shortPos : 1);
  float st0_3 = meanU16(shortBuf0_3, n), st0_5 = meanU16(shortBuf0_5, n);
  float d0_3 = st0_3 - cnt0_3_base, d0_5 = st0_5 - cnt0_5_base;
  int32_t vocDelta = sgpd.vocIndex - (int32_t)vocBaseEMA;

  bool fineHot = (st0_3 > cnt0_3_base*RISE_MULT && d0_3 > MIN_ABS_RISE_03) ||
                 (st0_5 > cnt0_5_base*RISE_MULT && d0_5 > MIN_ABS_RISE_05);
  // VOC gates the RISING EDGE only; hold/clear below is driven by counts (fineHot).
  bool hot = warmupComplete && fineHot && (vocDelta > VOC_DELTA_MIN);

  if (hot) { hotStreak++; clearStreak = 0; } else { clearStreak++; hotStreak = 0; }

  if (!vape_incident_flag && hotStreak >= CONFIRM_SAMPLES) {
    vape_incident_flag = true; alarmStartMs = now;
    sendIncidentToNetwork(true);     // Phase 3 hook — must NOT block (see §1.4)
  } else if (vape_incident_flag) {
    bool held = (now - alarmStartMs) >= ALARM_HOLD_MS;
    // CLEAR keyed on the COUNT channel returning to baseline, NOT on VOC.
    if (held && !fineHot && clearStreak >= CLEAR_SAMPLES) {
      vape_incident_flag = false; sendIncidentToNetwork(false);
    }
  }

  // FREEZE baselines while hot/alarming; resume only when counts are near baseline.
  if (!fineHot && !vape_incident_flag) {
    cnt0_3_base += COUNT_EMA_ALPHA * (pms.cnt_0_3 - cnt0_3_base);
    cnt0_5_base += COUNT_EMA_ALPHA * (pms.cnt_0_5 - cnt0_5_base);
    vocBaseEMA  += COUNT_EMA_ALPHA * (sgpd.vocIndex - vocBaseEMA);
  }
  logFeatureRow(now, st0_3, st0_5, d0_3, d0_5, vocDelta);   // §2.6
}
```

**`sendIncidentToNetwork(bool active)`** is the single integration point for networking. It must **not block** — fire-and-forget, or enqueue and flush from a `millis()`-driven `netPoll()` (or a core-0 FreeRTOS task), with the short-timeout + `pmsPoll()`-bracketing discipline from §1.4. Never `delay()` waiting for an HTTP response, and never POST from inside `processSample()`. The MVP can also push periodic telemetry from the sensor tick, not only on incidents.

| Tunable | Start | Tune by |
|---|---|---|
| `SENSOR_POLL_INTERVAL` | 1000 ms | matches ~1 Hz PMS frame |
| `VOC_WARMUP_MS` | 180000 (3 min) | min arm time; watch index settle to ~100 (≥3–10 min) |
| `BASELINE_SEED_FRAMES` | 8 | raise if the first seconds are noisy |
| `COUNT_EMA_ALPHA` | 0.02 | lower = steadier baseline |
| `SHORT_WIN` | 3 | larger = smoother, slower to fire |
| `RISE_MULT` | 1.8× | raise if dusty room false-fires |
| `MIN_ABS_RISE_03 / _05` | 800 / 300 | set just above clean-air jitter |
| `VOC_DELTA_MIN` | 15 | raise if VOC noise trips it (onset gate only) |
| `CONFIRM_SAMPLES` | 2 | raise to reject brief spikes |
| `CLEAR_SAMPLES` | 5 | raise for stickier clear |
| `ALARM_HOLD_MS` | 20000 (20 s) | longer so VOC self-cancel doesn't drop a lingering source |

**First-test calibration recipe:** boot in a normal room, let it warm up and seed the baseline (first `BASELINE_SEED_FRAMES` clean frames + ≥ 3–10 min), then run ~5 min watching the CSV/serial to learn clean-air baseline and jitter of `cnt0_3`/`cnt0_5`/`voc_index`. Set `MIN_ABS_RISE_*` to ~2–3× observed clean-air jitter. Then vape near the node and back off `RISE_MULT`/`VOC_DELTA_MIN` until a normal puff fires reliably without dust false-positives.

### 2.6 CSV feature vector for ML (Random Forest / KNN)

Emit one row per sample over the debug serial (115200, non-blocking write to the TX FIFO). Capture via the IDE Serial Monitor logging or a Pi gateway. Columns include raw signals, engineered deltas/baselines, and a **`label`** column for supervised training.

```cpp
char isoTs[24] = "";       // from RTC/NTP if available, else ""
uint8_t manualLabel = 0;   // toggle via 1-char serial cmd / GPIO button during labeled runs

void logFeatureRow(uint32_t now, float st0_3, float st0_5,
                   float d0_3, float d0_5, int32_t vocDelta) {
  char line[256];
  snprintf(line, sizeof(line),
    "%lu,%s,%u,%u,%u,%u,%u,%u,%u,%u,%u,%u,%u,%u,%u,%ld,%.1f,%.1f,%.1f,%.1f,%.1f,%ld,%u,%u",
    (unsigned long)now, isoTs,
    pms.cnt_0_3, pms.cnt_0_5, pms.cnt_1_0, pms.cnt_2_5, pms.cnt_5_0, pms.cnt_10,
    pms.pm1_0_atm, pms.pm2_5_atm, pms.pm10_atm, pms.pm1_0_std, pms.pm2_5_std, pms.pm10_std,
    sgpd.raw, (long)sgpd.vocIndex, cnt0_3_base, cnt0_5_base, vocBaseEMA,
    d0_3, d0_5, (long)vocDelta, (unsigned)vape_incident_flag, manualLabel);
  Serial.println(line);
}
```

The count bins are **firmware/CSV-only**; only scalar `pm25` (= `pms.pm2_5_atm`) and `voc` (= `sgpd.vocIndex`, the integer VOC Index) land in the dashboard DB — correct for the MVP. The engineered delta/baseline columns are exactly the inputs that make the small-puff signal separable, and the `incident` column lets you later measure an RF/KNN model's lift over the heuristic.

---

## Phase 3 — Dashboard Integration

The dashboard is **pull-based** (no WebSocket/SSE). The ESP32 writes to SQLite via a new ingest route; the React pages poll and surface the change.

> ### ⚠️ VOC field semantics — make firmware, payloads, and UI agree (do this before testing)
> The firmware sends the **SGP40 VOC Index** in the `voc` field: an **integer, nominally 100 = baseline, range ~0–500**. The existing dashboard was scaffolded assuming `voc` was a tiny ppb/ppm concentration (seed values 0.3–2.8; `AdminDashboard.tsx` colors VOC "high" when `voc > 0.60`; `AdminDevices.tsx` renders `{latestVOC} ppb`; `AdminSettings.tsx` labels it "VOC Threshold (ppm)"). If a real Index (e.g. 150) is POSTed as-is, it renders as "150 ppb" and trips every "high VOC" rule.
>
> **The decision for this plan: standardize on the VOC Index everywhere.** That requires the following dashboard edits (one-time), so the wire field, the DB, and the UI are consistent end to end:
> - **`src/app/pages/admin/AdminDashboard.tsx`** — change the VOC "high" condition from `voc > 0.60` to an Index-scale threshold, e.g. **`voc > 200`**.
> - **`src/app/pages/admin/AdminDevices.tsx`** — drop the `ppb` unit suffix; render the VOC Index as a unitless number (e.g. `VOC Index {latestVOC}`).
> - **`src/app/pages/admin/AdminSettings.tsx`** — relabel "VOC Threshold (ppm)" → **"VOC Index Threshold"** and default it to an Index-scale value (e.g. 200).
> - **`backend/db/seed.js`** — change seeded `voc` values from the 0.3–2.8 range to Index-scale values (e.g. baseline ~100, with a couple of elevated rows ~180–260).
>
> (Alternative if you must preserve the legacy field: add a separate numeric `vocIndex` column to `devices` and leave `voc` untouched. This plan does **not** take that path — it sends the Index in `voc` and fixes the four files above. Either way, **do not** ship payloads carrying `0.31`/`1.40` — those were the wrong scale.)

### 3.1 Add a key-protected ingest route (do NOT reuse the JWT routes)

Reusing the existing API would force the MCU to ship admin credentials, call `POST /api/auth/login`, parse and store a JWT, watch for expiry, and re-login on 401 — brittle and a security liability. Instead, add **one** route authenticated by a shared **device key** header (`x-device-key`), giving least privilege (push telemetry/alerts only, never the admin device/user API).

Per the project's own boundary-validation rule (validate at system boundaries; never trust external data), this handler **validates and clamps every numeric field, whitelists `status`, and rejects non-finite numbers** before writing — the prose rule and the code agree.

**New file: `C:\Capstone_Vape\Vape\backend\routes\ingest.js`** (CommonJS + the generic store, mirroring existing route style):

```js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const store = require('../db/store');
const router = express.Router();

const ALLOWED_STATUS = ['online', 'offline', 'warning'];

function requireDeviceKey(req, res, next) {
  const key = req.headers['x-device-key'];
  if (!key || key !== process.env.DEVICE_API_KEY)
    return res.status(401).json({ message: 'Invalid device key' });
  next();
}

// Coerce to a finite number and clamp to [min,max]; returns undefined if absent
// (so store.serialize() leaves the column untouched) or 400-worthy if invalid.
function clampNum(v, min, max) {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return NaN;          // signal invalid
  return Math.min(max, Math.max(min, n));
}

// POST /api/ingest/telemetry
router.post('/telemetry', requireDeviceKey, (req, res) => {
  const { deviceId, status, vape, floor, location } = req.body;
  if (!deviceId) return res.status(400).json({ message: 'deviceId is required' });

  // --- validate / clamp numeric fields; reject non-finite values ---
  const pm25           = clampNum(req.body.pm25, 0, 1000);
  const voc            = clampNum(req.body.voc, 0, 500);   // SGP40 VOC Index scale
  const temperature    = clampNum(req.body.temperature, -40, 85);
  const humidity       = clampNum(req.body.humidity, 0, 100);
  const signalStrength = clampNum(req.body.signalStrength, 0, 100);
  const battery        = clampNum(req.body.battery, 0, 100);
  if ([pm25, voc, temperature, humidity, signalStrength, battery].some(Number.isNaN))
    return res.status(400).json({ message: 'Non-finite numeric field in payload' });

  // --- whitelist status (default 'online'); reject anything else ---
  let nextStatus = status === undefined ? 'online' : status;
  if (!ALLOWED_STATUS.includes(nextStatus))
    return res.status(400).json({ message: `status must be one of ${ALLOWED_STATUS.join('|')}` });

  const device = store.findById('devices', deviceId);
  if (!device) return res.status(404).json({ message: 'Unknown deviceId' });
  // (If you prefer auto-provisioning instead of 404, see §4.2 — insert here, key-gated.)

  const now = new Date();
  const updated = store.update('devices', deviceId, {
    pm25, voc, temperature, humidity,         // undefined fields are dropped by serialize()
    status: nextStatus,
    signalStrength, battery,
    lastSeen: 'Just now',
    lastUpdate: now.toISOString(),
    networkSignal: 'Strong',
    issue: vape ? 'Vape detected' : null,
  });

  let alert = null;
  if (vape) {
    alert = store.insert('alerts', {
      id: uuidv4(),
      floor: floor || device.floor,
      location: location || device.location,
      detectedAt: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      sensorId: deviceId, status: 'ACTIVE',
      respondedBy: null, resolvedAt: null, photoUrl: null,
      createdAt: now.toISOString(),
    });
    store.insert('logs', {
      id: uuidv4(), type: 'detection',
      title: `AeroSense Detection — ${location || device.location}`,
      description: 'Vape detected (PM count + VOC corroboration)',
      timestamp: now.toISOString(), status: 'active',
      location: location || device.location, deviceId, user: null,
      severity: 'high', metadata: JSON.stringify({ pm25, voc }),
    });
  }
  res.status(201).json({ device: updated, alert });
});

module.exports = router;
```

`store.serialize()` drops `undefined` fields, so partial payloads only update what was sent; `metadata` JSON is auto-serialized. **No DB schema change is required** — `devices` and `alerts` already have every column used.

**Register in `C:\Capstone_Vape\Vape\backend\server.js`** (alongside the other `require`/`app.use` lines):
```js
const ingestRoutes = require('./routes/ingest');
app.use('/api/ingest', ingestRoutes);   // NOT wrapped in requireAuth — uses requireDeviceKey per-route
```

**Add the key to `C:\Capstone_Vape\Vape\backend\.env`** (gitignored, same file as `JWT_SECRET`; `server.js` already calls `dotenv.config()`):
```
DEVICE_API_KEY=<long-random-string>
```
The same string is the `x-device-key` constant in firmware (§1.4).

### 3.2 Payloads the ESP32 sends

Header `x-device-key: <DEVICE_API_KEY>`, `Content-Type: application/json`, to `POST /api/ingest/telemetry`. The node stores its own `floor`/`location` as config constants. **`voc` carries the integer SGP40 VOC Index (≈0–500, 100 = baseline) — never a ppb/ppm concentration** (see the §3 units note). `deviceId` must match a seeded `devices` row (see §4.2 provisioning).

**(a) Routine reading (no alert):**
```json
{ "deviceId": "S001", "pm25": 12.4, "voc": 98, "temperature": 22.5,
  "humidity": 45, "status": "online", "signalStrength": 88, "battery": 87, "vape": false }
```

**(b) Vape detection (raise an alert):**
```json
{ "deviceId": "S001", "pm25": 58.2, "voc": 240, "status": "warning",
  "signalStrength": 84, "battery": 86, "vape": true,
  "floor": "2nd Floor", "location": "CR – Boys Restroom" }
```
`status` must be one of `'online' | 'offline' | 'warning'` — the ingest handler enforces this server-side (rejects anything else with 400). The example `voc` values (98 routine, 240 detected) are on the VOC Index scale, consistent with the firmware in §1.4/§2.

### 3.3 How the update reaches the React UI

After the POST writes to SQLite:
- **Device row** → read via `devicesApi.getAll()`/`getById()` (`GET /api/devices`). The Admin Devices view shows new `pm25`, `voc` (VOC Index), `status`, `lastSeen`.
- **Alert row** → read via `alertsApi.getAll()` (`GET /api/alerts`, sorted by `createdAt` desc), so a fresh `ACTIVE` alert appears at the top of the Security Alerts page.

To see it without a manual refresh, the consuming page must poll (the seed even declares `dataRefreshRate: '5'` seconds):
```ts
useEffect(() => {
  const id = setInterval(() => { alertsApi.getAll().then(setAlerts); }, 5000);
  return () => clearInterval(id);
}, []);
```

**End-to-end first-test flow:** vape near node → firmware sets `vape_incident_flag` → ESP32 POSTs `{vape:true,...}` with `x-device-key` → handler validates/clamps the payload, updates the `devices` row + inserts `alerts` (+`logs`) row in `vape.db` → the dashboard's 5 s poll surfaces the new `ACTIVE` alert and flips the device to `warning` with elevated `pm25`/`voc`. **Buzzer + LED fire locally regardless of network state** — detection is never blocked by Wi-Fi/dashboard availability.

> Add the new endpoint to the typed client in `C:\Capstone_Vape\Vape\src\app\services\api.ts` if you ever want a frontend test harness to POST it; the ESP32 itself calls it directly over HTTP.

---

## Phase 4 — Multi-Node Deployment (2 classroom + 1 CR)

### 4.1 Placement

- **Standard classroom (~7 m × 9 m): 2 nodes** at the **1/4 and 3/4 points along the room length**, centered on width, near return/exhaust vents, **away from AC supply diffusers** (supply air dilutes plumes and depresses detection).
- **Comfort room / restroom: 1 node** near the exhaust fan.
- Mount **~9 ft on the ceiling** like a smoke detector — visible is acceptable; the high mount reduces tamper reach.
- Multiple nodes give **coverage + redundancy, not extended range** (see Realistic Limitations).

### 4.2 Stable device identity + provisioning workflow

Derive each node's ID at boot from its factory MAC so IDs are permanent with no per-unit config:

```cpp
String deviceId() {
  uint64_t mac = ESP.getEfuseMac();
  char id[18];
  snprintf(id, sizeof(id), "AERO-%04X%08X", (uint16_t)(mac >> 32), (uint32_t)mac);
  return String(id);   // stable per physical board
}
```

> **Provisioning chicken-and-egg — call this out explicitly.** The ingest route (§3.1) **rejects any `deviceId` not already present in the `devices` table** (404 "Unknown deviceId"), but a MAC-derived ID is only known **after** the node first boots. So the order is mandatory and not optional:
> 1. **Flash** the node.
> 2. **Read** the `AERO-<mac>` string it prints over serial at boot.
> 3. **Seed a `devices` row with that exact `id`** (friendly `name`/`location`/`floor`) *before* telemetry will be accepted.
>
> **Two supported options — pick one and be consistent:**
> - **(A) MAC-derived IDs (`AERO-…`)** — permanent per board, but require the boot-read-then-seed step above for each unit. Best when boards may be swapped without re-labeling.
> - **(B) Short manual IDs (`S001`…`S007`)** — matches the existing seed scheme and the §3.2 examples; set the ID as a per-node config constant in firmware (skip `deviceId()`), and the row already exists from seeding. Simpler for a 3-node MVP. **The §3.2 examples use `S001` (option B).**
> - **(C) Auto-provision** — alternatively, change the ingest handler to *insert* an unknown (key-authenticated) device row instead of 404'ing, so a freshly flashed node self-registers on its first POST. Gate strictly behind the device key.
>
> Do not mix schemes silently — the §3.2 payloads and the seeded rows must use the same ID convention.

- **All three nodes** join the dedicated `AeroSense-IoT` SSID (STA) and POST to the **same** `INGEST_URL`. They are distinguished purely by `deviceId` in the payload — **not by IP** (DHCP IPs can change).
- **Dashboard mapping:** seed the device rows with friendly `name`/`location`/`floor`, e.g. `"Room 101 – Front" (1/4 length)`, `"Room 101 – Rear" (3/4 length)`, `"CR – Exhaust"`. Because identity travels in the payload, swapping a physical node only requires re-pointing the label (option B) or re-seeding the new MAC-derived row (option A).
- Optionally set a unique mDNS hostname per node (`aerosense1`/`2`/`cr`) if you also expose local diagnostic pages.

---

## Phase 5 — Test & Validation

Keep the firmware non-blocking throughout; keep the serial monitor open at **115200** the whole time. **The numbers below are characterization targets to measure and tune toward — not pre-verified guarantees** (see §5.4).

### 5.1 Bench bring-up (modular — do not advance until each PASS)

| Unit | Flash | Under test | PASS check |
|---|---|---|---|
| **U1 — Power/Compute** | `Blink` on GPIO26 via `millis()` | USB power, driver, COM port, board `ESP32 Dev Module` | Compiles/uploads cleanly; 3.3 V rail stable; LED blinks at 1 Hz; serial heartbeat. |
| **U2 — PMS5003** | Frame-parse sketch on `Serial2` printing all fields | **Fan on 5 V VIN**, common ground | Valid frames ~1 Hz, checksum passes every frame; clean-air PM2.5 low, 0.3/0.5 µm counts nonzero/stable; wave a hand → counts rise. |
| **U3 — SGP40** | `Adafruit_SGP40` sketch printing raw + VOC Index | I2C 0x59; add 4.7 kΩ pull-ups if NACKs | `begin()` succeeds (return checked); VOC Index settles toward ~100 after warmup; breathe near it → index rises then recovers. |
| **U4 — Actuators** | `millis()`-toggle buzzer+LED ~5 s | Buzzer GPIO25 + LED GPIO26, each through 220 Ω | Both fire together in the pattern; both fully off when flag clears. |
| **Integrated** | Full Phase 2 firmware (+ optional Wi-Fi) | Assembled node | Boots clean; both sensors stream; clean air → flag false/silent; deliberate puff → flag true, buzzer+LED fire; clears after air returns. Wi-Fi wired → dashboard alert appears. |

> If U2 or U3 fail, fix wiring/power **before** touching detection logic — a bad frame or un-warmed VOC index makes the integrated test lie.

### 5.2 Single-person detection protocol

Run **twice**: first at **bench distance** (sensor on desk), then at the **real 9 ft ceiling mount** (the run that matters).

**Preconditions:** SGP40 warmed up per the §2.2 policy (**≥ 3–10 min**, and the baseline-seed completed); HVAC in normal running state; one vaper + one operator logging; clocks synced so time-to-detect is measurable.

- **Step A — Clean-air baseline (mandatory first):** nobody vaping, log **10 min** (min 5). Record rolling mean/variance of PM2.5 mass, the 0.3/0.5 µm count bins, and VOC Index. **If the baseline drifts/is noisy, stop and fix airflow/warmup before puff tests.**
- **Step B — Controlled puffs matrix:** 5 reps per cell, **≥ 60 s return-to-baseline between puffs**:

| Factor | Levels |
|---|---|
| Distance subject→node | 0.3 m, 1 m, 2 m (bench); plus directly-below and ~2 m-offset-on-floor exhaling up (ceiling) |
| Puff size | small/discreet **and** normal/full exhale |
| Aim (ceiling only) | straight up toward node vs. normal forward angle |

≈ 30 puffs per run minimum. For each puff record: timestamp, distance, size, fired y/n, **time-to-detect**, peak 0.3/0.5 µm counts, peak VOC delta. Expect a distance × size gradient: 0.3 m normal puff is fast/reliable; 2 m small puff at the ceiling is the hardest, *expected* least-reliable case.

### 5.3 Confounder / false-positive tests

Capture a clean baseline, then introduce each confounder at ~1 m, 5 reps each. The node should **not** fire.

| Confounder | Why it's a trap | Expected discriminator |
|---|---|---|
| **Dust** (clap erasers) | Spikes count bins, esp. larger | High PM, **little/no VOC rise** → not vape |
| **Cooking steam / water vapor** | Spikes small counts, mimics aerosol | Different count-bin ratio + low/transient VOC; fast recovery |
| **Aerosol deodorant/spray** | Spikes PM **and** VOC — hardest | Count-bin **ratio** + VOC/PM relationship, not magnitude |
| **Perfume/body spray** | Strong VOC, low particulate | High VOC, **low PM counts** → wrong ratio |

These four are exactly the negative classes the RF/KNN classifier needs. A confounder tripping the single-threshold logic is a **finding**, not a test failure — it justifies the multi-feature model.

### 5.4 Characterization targets & milestone gate

> **These are characterization targets, not advance guarantees.** The detector is an unbuilt, untuned heuristic on a point sensor at 9 ft; sensitivity and latency cannot be promised before measurement. **Measure and report** sensitivity and time-to-detect across the full distance × puff-size matrix, then **tune thresholds toward the best achievable.** The percentage/seconds figures below are provisional planning targets to validate empirically — treat them as goals to characterize against, not binding pass/fail contracts.
>
> **Latency floor (inherent, not tunable away):** with `SENSOR_POLL_INTERVAL = 1000 ms`, `CONFIRM_SAMPLES = 2`, and `SHORT_WIN = 3`, the detector needs ~2 consecutive hot samples *after* the short-window mean has risen — realistically a **~2–4 s algorithmic latency floor** before it can even assert, on top of the PMS5003's own multi-second internal integration. Sub-2 s detection is not physically available at a 1 Hz poll.

**"Detected" (functional definition) =**
- **Local:** `vape_incident_flag` goes true and buzzer + LED fire together for a deliberate normal puff at close range, and both stop after air returns to baseline. (Time-to-detect is **measured and reported**, expected ≳ 2–4 s given the latency floor.)
- **Dashboard (integrated milestone):** after the local trigger, a new `ACTIVE` alert row appears via the Phase 3 `POST /api/ingest/telemetry` → `GET /api/alerts` poll (latency dominated by the 5 s UI poll + send interval; **measure it**).

**Milestone gate (must hold to call the integrated build "working"):**
- U1–U4 + the integrated bring-up checks all pass.
- A deliberate normal puff at close range reliably fires the local alarm, and the dashboard reflects it within the poll window.
- No confounder trips the alarm in the run (record the actual count — with only a single PM threshold this may not hold, which is itself the finding that justifies the RF/KNN upgrade).

**Provisional characterization targets (validate empirically; tune toward, do not treat as pre-met):**
- **Sensitivity:** aim for a high detection fraction of normal-puff events at ≤ 1 m within the measured latency window; report the achieved fraction per matrix cell rather than asserting a fixed % up front.
- **Latency:** report median local time-to-detect (expected ~2–4 s floor + integration) and dashboard lag; tune `CONFIRM_SAMPLES`/`SHORT_WIN` to balance latency vs. false-fires.
- **False positives:** target zero confounder trips; where the single-threshold rule fails (aerosol-spray/perfume are the likely offenders), that is the priority signal to move to the multi-feature classifier — **not** a reason to raise thresholds (which would kill small-puff sensitivity).

**Needs-tuning / investigate:** any bring-up check fails; normal-puff detection at ≤ 1 m is unreliable after tuning; aerosol-spray/perfume trip the alarm (priority to move to the multi-feature classifier); or local latency runs well beyond the ~2–4 s floor (e.g. > ~8 s — suggests blocking code or a stalled PMS buffer; hunt for a stray `delay()` or an unbounded POST per §1.4).

Small/discreet puffs at 2 m on the ceiling are **characterization data at the honest edge of the sensor's capability** — measure and report them; they are not a gate.

### 5.5 Data logging for RF/KNN training

Log every run (baseline, puffs, confounders, **both nodes**) to CSV at the ~1 Hz poll rate. CSV schema (one row per sample):

```
timestamp_iso, node_id, sample_seq,
pm1_0_std, pm2_5_std, pm10_std, pm2_5_atm,
cnt_0_3, cnt_0_5, cnt_1_0, cnt_2_5, cnt_5_0, cnt_10,
voc_raw, voc_index,
pm2_5_baseline, pm2_5_delta, cnt_0_3_ror, cnt_0_5_ror, voc_index_delta,
label, distance_m, puff_size, fired_flag, notes
```
- `*_baseline` = rolling-mean baseline; `*_delta`/`*_ror` = value − baseline (the discriminative features).
- `fired_flag` = what the threshold logic *did*, independent of ground-truth `label`.

**Labeling:** operator sets the active label per segment (`clean`, `vape`, `dust`, `steam`, `deodorant`, `perfume`) via keypress/button — never inferred after the fact. Mark a few seconds pre/post-puff as `clean`/transition so the model learns recovery shape.

**Targets:** ≥ **1,000 labeled samples per class** to start (~5,000–8,000 rows per node), captured on **both nodes** so the model generalizes across units. Deliberately over-collect the hard boundaries (`vape`, `deodorant`, `perfume`). Hold out per-class validation; do not split a single continuous puff event across train and test.

---

## Realistic Limitations

State these plainly — do not over-promise.

- **A point sensor only senses air that reaches it.** Two ceiling nodes give coverage and redundancy, **not range**. A small puff exhaled low and far from both nodes, against HVAC airflow, can genuinely be missed. This is physics, not a bug. Never promise "catches any puff anywhere."
- **Dilution at 9 ft is real.** A small puff's PM2.5 *mass* barely moves at ceiling height — which is exactly why detection keys on the 0.3/0.5 µm **counts + rate-of-rise** corroborated by a **VOC-index delta**, not the 35 µg/m³ mass threshold. Even so, the 2 m small-puff case is at the honest edge of what the sensor can observe.
- **Detection timing has a floor.** At a 1 Hz poll with a 2-sample confirm and a 3-sample short window, the algorithm cannot assert in under ~2–4 s, and the PMS5003 adds its own multi-second integration. Sensitivity/latency are **characterized empirically**, not guaranteed in advance.
- **SGP40 drift / auto-rebaselining (cannot be tuned away).** The VOC Index self-baselines: it needs warmup (minutes, ideally a long conditioning run) and will "learn" a sustained vaper as normal, decaying back toward 100. This is why VOC is used only as a **rising-edge corroborating delta** and never as the hold/clear signal — and why the count channel governs how long the alarm stays on. It is a known sensor limitation, not a bug.
- **ML needs labeled data.** The RF/KNN classifier that separates spray/perfume from vape only exists once the Phase 5 labeled dataset is collected on both nodes. Until then the hand-tuned rule runs, and aerosol-spray/perfume are its known weak spots. Do not raise thresholds to suppress them — that kills small-puff sensitivity; collect data and move to the classifier instead.
- **Power is a Wi-Fi failure mode too.** Wi-Fi TX spikes plus the PMS5003 fan can brown out a weak supply and reboot-loop the ESP32. Use a solid ≥ 1 A 5 V source, keep the fan on VIN, share ground.
- **A telemetry POST has a bounded blocking window.** `HTTPClient::POST()` is synchronous; even with short timeouts it can stall `loop()` for up to its timeout. It is bounded (≤ ~0.8 s with the §1.4 timeouts) and bracketed by `pmsPoll()` so it cannot quietly corrupt PMS frames — but it is not truly zero-blocking unless moved to a separate FreeRTOS core/task.

---

## Appendix — Key File Paths

**Backend (dashboard):**
- `C:\Capstone_Vape\Vape\backend\routes\ingest.js` — **new** ingest route with input validation/clamping (Phase 3)
- `C:\Capstone_Vape\Vape\backend\server.js` — mount `app.use('/api/ingest', ...)`
- `C:\Capstone_Vape\Vape\backend\.env` — `DEVICE_API_KEY` (gitignored)
- `C:\Capstone_Vape\Vape\backend\db\store.js` — generic `findById`/`update`/`insert`; `devices`/`alerts`/`logs` tables
- `C:\Capstone_Vape\Vape\backend\db\seed.js` — seed the device rows; **update `voc` seed values to VOC Index scale**; `dataRefreshRate` default
- `C:\Capstone_Vape\Vape\backend\routes\devices.js`, `routes\alerts.js` — existing read paths the UI polls
- `C:\Capstone_Vape\Vape\backend\middleware\auth.js` — `requireAuth`/`requireAdmin` (why ingest uses a device key instead)

**Frontend (VOC Index alignment — see the §3 units note):**
- `C:\Capstone_Vape\Vape\src\app\services\api.ts` — typed clients (`devicesApi`, `alertsApi`); add the polling `setInterval`
- `C:\Capstone_Vape\Vape\src\app\pages\admin\AdminDashboard.tsx` — change VOC "high" condition `voc > 0.60` → Index-scale (e.g. `voc > 200`)
- `C:\Capstone_Vape\Vape\src\app\pages\admin\AdminDevices.tsx` — drop the `ppb` suffix; render VOC Index as unitless
- `C:\Capstone_Vape\Vape\src\app\pages\admin\AdminSettings.tsx` — relabel "VOC Threshold (ppm)" → "VOC Index Threshold"; default ~200

**Firmware (to be authored in Arduino IDE 2.x):** PMS5003 parser, SGP40 read, detection loop, networking (SoftAP **or** STA as separate build paths), CSV logger — per Phases 1, 2, and the spec in `IoT_Vape_Detection_Manual_Phase1_Revised.docx`.
