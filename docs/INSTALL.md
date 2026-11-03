# AeroSense — Installation & Setup Guide (Windows)

A friendly, step-by-step guide to getting the **AeroSense** vape-detection system running on a Windows PC — from zero to a live sensor reporting into the dashboard. No prior experience assumed.

---

## How the system fits together (read this first)

AeroSense has **two halves that talk to each other over Wi-Fi**:

1. **The sensor node** — a small microcontroller board (an **ESP8266** "NodeMCU", or an ESP32) wired to two air-quality sensors. You write/flash its program ("firmware") using the **Arduino IDE**. The node reads the air ~once a second and, every 5 seconds, sends the latest numbers over Wi-Fi.
2. **The dashboard** — a web app (a **Node.js** backend + a **React** website) that runs on your PC. It receives the sensor's readings, stores them, shows them live, and raises an **alert** when a reading crosses a threshold. You'll run it from a terminal (VS Code is handy but optional).

The node is the **data source**; the dashboard is the **consumer**. They find each other because they're on the **same Wi-Fi network** and the node knows your PC's IP address.

```
   SENSOR NODE  (the "edge" device)                 YOUR PC  (the dashboard)
 +-------------------------------+               +-------------------------------------+
 |  ESP8266 NodeMCU (or ESP32)   |               |  Backend  : Node + SQLite           |
 |   + PMS5003  -> PM2.5         |   Wi-Fi       |             listens on  :8001        |
 |   + SGP40    -> VOC Index     |  =========>   |             POST /api/ingest/readings|
 |                               |  HTTP POST    |               ^                      |
 |  flashed via Arduino IDE      |  { pm25,voc } |               | (Vite proxies /api)  |
 |                               |  + device key |  Frontend : React site in browser   |
 +-------------------------------+               +-------------------------------------+
        (same Wi-Fi network)                       admin / security log in here
```

Once both halves are up, an over-threshold reading from the node automatically creates an **alert** you can see on the dashboard.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Get the project](#2-get-the-project)
3. [Run the dashboard (two terminals)](#3-run-the-dashboard-two-terminals)
4. [Set up the ESP8266 firmware in Arduino IDE 2.x](#4-set-up-the-esp8266-firmware-in-arduino-ide-2x)
5. [Connect the ESP8266 to the dashboard (end-to-end)](#5-connect-the-esp8266-to-the-dashboard-end-to-end)
6. [Troubleshooting (all-in-one)](#6-troubleshooting-all-in-one)

---

## 1. Prerequisites

Install these before anything else.

| What | Why you need it | Where |
|------|-----------------|-------|
| **Node.js 22.5 or newer** | The dashboard backend uses Node's built-in `node:sqlite` database, which **only exists in Node 22.5+**. Older Node crashes the backend on startup. | <https://nodejs.org> — download the **LTS** installer (22.x or newer) and click through with defaults. |
| **VS Code** (optional, recommended) | A friendly place to open the project folder and run the two terminals. | <https://code.visualstudio.com> |
| **Arduino IDE 2.x** | The program you use to write the sensor firmware and flash it onto the board. | <https://www.arduino.cc/en/software> |
| **CH340 USB driver** (only if needed) | Lets Windows see the NodeMCU board as a COM port. Most NodeMCU/ESP8266 boards use the CH340 chip. Install this **only if no COM port appears** when you plug the board in (see [Section 4](#4-set-up-the-esp8266-firmware-in-arduino-ide-2x)). | Search "CH340 driver Windows" (WCH official) or your board vendor's page. |

### Check your Node version

Open **PowerShell** (press <kbd>Win</kbd>, type `PowerShell`, hit Enter) and run:

```powershell
node -v
```

> **What this does:** prints your installed Node version, e.g. `v22.11.0`.

You want **v22.5.0 or higher**. If you see something lower (like `v18` or `v20`), or a "command not found" error, install/upgrade Node from <https://nodejs.org> and run `node -v` again in a **new** terminal.

> ### Troubleshooting — Prerequisites
> - **`node -v` says "not recognized"** → Node isn't installed, or the terminal was open before you installed it. Close and reopen PowerShell, or restart your PC, then try again.
> - **`node -v` shows v20 or lower** → You must upgrade. Download the latest LTS from nodejs.org and reinstall.
> - **Arduino IDE won't open / looks blank** → Make sure you downloaded **version 2.x** (not the old 1.8 "Legacy"), and allow it through any Windows SmartScreen prompt.

---

## 2. Get the project

The project already lives at:

```
C:\Capstone_Vape
```

If you're starting from a Git repository instead, clone it first (in PowerShell):

```powershell
cd C:\
git clone <your-repo-url> Capstone_Vape
cd C:\Capstone_Vape
```

### Project layout (what's where)

```
C:\Capstone_Vape\
├─ backend\     # the dashboard's server (Node + Express + SQLite). Run it from here.
├─ frontend\    # the dashboard's website (React + Vite). Run it from here.
├─ firmware\    # the Arduino sketches for the sensor node (ESP8266 + ESP32).
└─ docs\        # documentation (you're reading docs\INSTALL.md right now).
```

> **Tip:** If using VS Code, open the whole folder once: **File → Open Folder… → `C:\Capstone_Vape` → Select Folder**. Then open terminals with **Terminal → New Terminal** (<kbd>Ctrl</kbd>+<kbd>`</kbd>).

---

## 3. Run the dashboard (two terminals)

The dashboard is two programs — the **backend** (API + database) and the **frontend** (the website). They run **at the same time, in two separate terminals**. Keep both open while you work.

### 3a. Terminal #1 — the backend (API on `http://localhost:8001`)

```powershell
cd C:\Capstone_Vape\backend
npm install
```

> **What this does:** downloads the backend's dependencies into `backend\node_modules`. Run it once (and again only if dependencies change).

Now create the backend's secret-config file. Make a new file named exactly **`.env`** inside `C:\Capstone_Vape\backend\` with these two lines:

```
JWT_SECRET=replace-this-with-any-long-random-string-1234567890
JWT_EXPIRES_IN=1d
```

> **What this does:** `JWT_SECRET` is the private key used to sign login tokens — make it long and random (any gibberish is fine for local dev). `JWT_EXPIRES_IN=1d` means a login stays valid for 1 day. You do **not** need to set `PORT`; the server always uses **8001** to match the frontend.

To create `.env` quickly from PowerShell:

```powershell
cd C:\Capstone_Vape\backend
@"
JWT_SECRET=replace-this-with-any-long-random-string-1234567890
JWT_EXPIRES_IN=1d
"@ | Out-File -FilePath .env -Encoding ascii
```

Then start the backend:

```powershell
npm run dev
```

> **What this does:** starts the API on **http://localhost:8001** and auto-restarts when files change. On the **very first run** it automatically creates and seeds the SQLite database (`backend\db\vape.db`) — including the demo login accounts. You should see a line like `Backend running on http://localhost:8001`. **Leave this terminal running.**

### 3b. Terminal #2 — the frontend (the website)

Open a **second** terminal (in VS Code: **Terminal → New Terminal**; or another PowerShell window):

```powershell
cd C:\Capstone_Vape\frontend
npm install
```

> **What this does:** downloads the website's dependencies. The folder has an `.npmrc` file with `legacy-peer-deps=true` — **keep that file**; it lets the install succeed despite some packages' strict version requirements. Just run `npm install` normally; don't add flags that override it.

Start the dev server:

```powershell
npm run dev
```

> **What this does:** starts Vite and prints a local URL, usually **http://localhost:5173**. Vite automatically forwards any `/api` request to the backend on port 8001, so the two halves connect with no extra config.

**Open the printed URL in your browser.** You'll land on the AeroSense login page.

### 3c. Log in (demo accounts)

The seeded database ships with two local dev accounts:

| Username | Password | Role | Lands on |
|----------|----------|------|----------|
| `admin` | `admin123` | Admin | `/admin` console — Devices, Users, Settings, Analytics… |
| `security` | `security123` | Security (guard) | `/` console — Dashboard, Alerts, Sensors, Logs… |

> Use **`admin` / `admin123`** for this guide — you need the admin console to add a device in [Section 5](#5-connect-the-esp8266-to-the-dashboard-end-to-end).

### 3d. (Optional) Production build

For a single combined app instead of two dev servers:

```powershell
cd C:\Capstone_Vape\frontend
npm run build
```

> **What this does:** compiles the website into `frontend\dist\`. The backend is set up to serve that folder directly. After building, just run the backend and open it in one place:

```powershell
cd C:\Capstone_Vape\backend
npm start
```

Then open **http://localhost:8001** — the backend serves both the website and the API on the same port. (For day-to-day development, the two-terminal dev flow above is easier because it hot-reloads.)

> ### Troubleshooting — Dashboard
> - **Backend exits immediately / `node:sqlite` error** → Your Node is older than 22.5. Run `node -v` and upgrade (see [Section 1](#1-prerequisites)).
> - **Website loads but login fails / "Network error"** → The backend terminal isn't running, or it's not on port 8001. Check Terminal #1 is still showing `Backend running on http://localhost:8001`. Visit <http://localhost:8001/api/health> — it should return `{"status":"ok"}`.
> - **`npm install` fails in `frontend\`** → Make sure the `.npmrc` file (with `legacy-peer-deps=true`) is still present in `frontend\`. Don't delete it.
> - **Port already in use (`EADDRINUSE`)** → Something else is on 8001 (maybe an old backend). Close the other process or restart your PC, then `npm run dev` again.
> - **Forgot the demo password** → It's seeded fresh; the accounts are `admin`/`admin123` and `security`/`security123`.

---

## 4. Set up the ESP8266 firmware in Arduino IDE 2.x

Now the sensor node. We'll first prove the wiring with a **test sketch** (no Wi-Fi), then in [Section 5](#5-connect-the-esp8266-to-the-dashboard-end-to-end) flash the **cloud sketch** that uploads to the dashboard.

> The ESP8266 is our **primary** board for this walkthrough. There's also an ESP32 path — see the [ESP32 note](#esp32-note) at the end of this section.

### 4a. Add the ESP8266 board package

1. Open **Arduino IDE 2.x**.
2. Go to **File → Preferences**.
3. In the **"Additional boards manager URLs"** box, paste this URL:

   ```
   http://arduino.esp8266.com/stable/package_esp8266com_index.json
   ```

   > **What this does:** tells Arduino IDE where to download ESP8266 support. (If the box already has other URLs, click the small icon to add this on a new line.)
4. Click **OK**.

### 4b. Install the board support

1. Open **Tools → Board → Boards Manager…** (or click the boards icon in the left sidebar).
2. Search **`esp8266`**.
3. Install **"esp8266 by ESP8266 Community"**. (This downloads a fair bit — give it a minute.)

### 4c. Select your board and port

1. Plug the NodeMCU into your PC with a USB cable. (Use a **data** cable, not a charge-only one.)
2. **Tools → Board → ESP8266 →** select **"NodeMCU 1.0 (ESP-12E Module)"**.
   - Using a **Wemos / LOLIN D1 mini**? Select that instead — the sketches use the same `D5/D6/D1/D2/D7/D0` labels and run unchanged on it.
3. **Tools → Port →** pick the **COM** port that appeared when you plugged in the board (e.g. `COM5`).
   - **No COM port?** Install the **CH340 driver** (see [Section 1](#1-prerequisites)), unplug/replug the board, and check again.

### 4d. Install the sensor library

1. Open **Tools → Manage Libraries…** (the books icon).
2. Search **`Adafruit SGP40`**.
3. Install **"Adafruit SGP40 Sensor"**. When it asks to install dependencies, click **Install all** — it pulls in **Adafruit BusIO** too.

> **What this does:** the SGP40 VOC sensor needs this driver to compile. `SoftwareSerial` (for the PMS5003) and `Wire` (I2C) are already built into the ESP8266 package — no separate install.

### 4e. (One-time) Clean-flash a board with unknown firmware

If this board has been used before or behaves oddly, do a one-time full erase so old firmware/Wi-Fi junk doesn't interfere:

1. **Tools → Erase Flash → "All Flash Contents"**.
2. Upload any sketch once (an empty one is fine) — this writes a clean slate.
3. **Tools → Erase Flash →** set it **back to "Only Sketch"** so future uploads are fast and keep your settings.

> Skip this if the board is brand new and the test sketch (next step) works first try.

### 4f. Upload the sensor test sketch

1. **File → Open…** and open:

   ```
   C:\Capstone_Vape\firmware\AeroSense_ESP8266_SensorTest\AeroSense_ESP8266_SensorTest.ino
   ```
2. Click the **Upload** button (the right-arrow ➜ in the top-left). Wait for **"Done uploading."**
3. Open the **Serial Monitor**: **Tools → Serial Monitor** (or the magnifying-glass icon).
4. Set the Serial Monitor baud rate (bottom-right dropdown) to **115200**.

> **What this does:** this sketch reads both sensors and prints a line about once per second, like:
> ```
> [12s] PM2.5 = 7 ug/m3 | >0.3um=420 | >0.5um=120 | VOC Index=103
> ```
> **Before you've wired the sensors**, it's completely normal to see `PM2.5 = (no PMS frames yet...)` and `VOC Index=(SGP40 not found)`. Those messages just mean "no sensor connected yet" — the board itself is working. Once wired, the numbers appear and jump when you breathe vapor/spray near the sensors.

### 4g. Wiring (NodeMCU 1.0 / ESP-12E)

Wire it up with the board **unplugged**, then plug back in. The pin labels (D5, D6, …) are printed on the NodeMCU silkscreen.

| Sensor / part | Pin on the part | → Connect to NodeMCU | Notes |
|---------------|-----------------|----------------------|-------|
| **PMS5003** (PM2.5) | **TX** | **D5** | data **from** sensor into the ESP |
| | **RX** | **D6** | usually optional |
| | **VCC** | **5V / VIN** | the fan needs **5 V** — 3.3 V browns it out |
| | **GND** | **GND** | |
| **SGP40** (VOC) | **SDA** | **D2** | I2C data |
| | **SCL** | **D1** | I2C clock |
| | **VCC** | **3.3V** | the SGP40 is a **3.3 V** part — **not** 5 V |
| | **GND** | **GND** | |
| **Buzzer** | **+** (via 220 Ω) | **D7** | reserved (test sketch doesn't sound it) |
| **LED** | **anode** (via 220 Ω) | **D0** | reserved (test sketch doesn't light it) |

> **Critical:** the ESP8266, **both** sensors, and the 5 V supply must all share a **common GND**, or readings will be nonsense. If I2C/VOC is flaky, add 4.7 kΩ pull-up resistors from SDA→3.3 V and SCL→3.3 V.

<a id="esp32-note"></a>
> **ESP32 alternative (brief):** If you're using an **ESP32 DevKitC** instead of the ESP8266, the repo also has ESP32 sketches under `firmware\AeroSense_*` (e.g. `AeroSense_U3_SGP40_I2C`, `AeroSense_U4_PMS5003`, `AeroSense_Node1_WiFi_Demo`). Setup is the same idea but with the ESP32 board package and these pins: **PMS5003** RX2=**GPIO16**, TX2=**GPIO17**; **SGP40** SDA=**GPIO21**, SCL=**GPIO22**; **buzzer**=**GPIO25**; **LED**=**GPIO26**; debug serial @115200. The rest of this guide uses the **ESP8266** since that's the board in use.

> ### Troubleshooting — Arduino / firmware
> - **No COM port in Tools → Port** → Install the **CH340 driver**, use a **data** USB cable, replug the board.
> - **Upload stuck on "Connecting…"** → Hold the **FLASH** (or **BOOT**) button on the board while the upload starts; release after it begins. You can also lower **Tools → Upload Speed** to **115200**.
> - **Compile error: `Adafruit_SGP40.h: No such file`** → You skipped [4d](#4d-install-the-sensor-library). Install "Adafruit SGP40 Sensor" (with dependencies) and re-upload.
> - **Serial Monitor shows gibberish** → Set the baud rate to **115200** (bottom-right of the Serial Monitor).
> - **`(no PMS frames yet)` / `(SGP40 not found)` after wiring** → Recheck the wiring table above: PMS on **5 V** (not 3.3 V), PMS **TX→D5**, SGP40 on **3.3 V**, **SDA→D2 / SCL→D1**, and a **common GND**.

---

## 5. Connect the ESP8266 to the dashboard (end-to-end)

This is the payoff: get the node to send live readings into the running dashboard. **Keep both dashboard terminals from [Section 3](#3-run-the-dashboard-two-terminals) running.**

### 5a. Add the device in the dashboard and copy its API key

1. In your browser, log in as **`admin` / `admin123`**.
2. Go to **Admin → Devices** and click **Add device** (a.k.a. the add/new-device button).
3. Give it a **name** (e.g. "Lab Node 1"), optionally a location/floor.
4. **Set this device's VOC threshold to about `200`** in the add-device form.

   > **Why ~200 (important):** the firmware sends the SGP40's **VOC Index (0–500, ~100 = normal clean air)**. The dashboard's *default* VOC threshold is `0.6`, which is on a totally different scale — a baseline of ~100 would trip it instantly and alarm forever. A per-device threshold of **~200** keeps normal air quiet and only fires on a real VOC spike. (You can also set/adjust this later via **Devices → open the device → tune-thresholds** sliders.) PM2.5 is already in µg/m³ on both sides, so it needs no special threshold.
5. Save. The dashboard shows a **one-time API key** (a long string, e.g. `ak_…`). **Copy it now** — you'll paste it into the firmware. (If you lose it, you can rotate/regenerate the key later from the device.)

### 5b. Find your PC's LAN IP address

The node needs your PC's address on the Wi-Fi network. In PowerShell:

```powershell
ipconfig
```

> **What this does:** lists your network adapters. Find the active **Wi-Fi** adapter and read its **IPv4 Address** — something like `192.168.1.50`. That's your `SERVER_IP`.

**Both the PC and the ESP8266 must be on the same Wi-Fi network.**

### 5c. Allow port 8001 through Windows Firewall

The backend already listens on all interfaces (`0.0.0.0:8001`), but Windows Firewall may block incoming connections the first time. The simplest path:

- When you first started the backend, Windows may have popped up a **"Windows Defender Firewall"** dialog — click **Allow access** (tick **Private networks**).
- If you dismissed it, you can add a rule from an **Administrator** PowerShell:

```powershell
New-NetFirewallRule -DisplayName "AeroSense backend 8001" -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow
```

> **What this does:** lets the ESP8266 reach your PC's backend on TCP port **8001** over the local network. (Only needed once.)

### 5d. Configure and flash the cloud sketch

1. In Arduino IDE, **File → Open…**:

   ```
   C:\Capstone_Vape\firmware\AeroSense_ESP8266_Cloud\AeroSense_ESP8266_Cloud.ino
   ```
2. Near the top of the file, edit the **config block** with your details:

   ```cpp
   const char*    WIFI_SSID    = "YOUR_WIFI_NAME";       // your Wi-Fi network name
   const char*    WIFI_PASS    = "YOUR_WIFI_PASSWORD";   // your Wi-Fi password
   const char*    SERVER_IP    = "192.168.1.50";         // your PC's IPv4 from `ipconfig`
   const uint16_t SERVER_PORT  = 8001;                   // leave as 8001
   const char*    DEVICE_KEY   = "ak_xxxxxxxx";          // the API key you copied in 5a
   ```

   > **What this does:** tells the node which Wi-Fi to join, where your PC is, and which device key to authenticate with. The node will `POST` to `http://<SERVER_IP>:8001/api/ingest/readings` with an `X-Device-Key` header.
3. Make sure the right **board** and **COM port** are still selected ([Section 4c](#4c-select-your-board-and-port)), then click **Upload**.

### 5e. Watch it come alive

1. Open the **Serial Monitor** at **115200** baud.
2. You should see, within a few seconds:

   ```
   [WiFi]    Connected. IP = 192.168.1.77
   [POST]    pm25=7.0 voc=103 -> HTTP 200
   ```

   > **`HTTP 200` means success** — the dashboard accepted the reading. The sketch prints a new `[POST]` line every 5 seconds.
3. Switch to the dashboard in your browser:
   - On the **Devices** page, your device flips to **online** with "last seen: Just now".
   - The **Dashboard** live feed shows the readings updating.
   - Breathe some vapor/spray near the sensors so VOC/PM2.5 climbs past the threshold — an **alert is auto-created** and appears under **Alerts**.

**Serial Monitor status codes (cheat sheet):**

| Code | Meaning | Fix |
|------|---------|-----|
| `200` | Success — reading accepted | 🎉 nothing to do |
| `401` | Bad/missing `DEVICE_KEY` | Re-copy the API key from the device and re-flash |
| `400` | Malformed body | Shouldn't happen with this sketch |
| `-1` (negative) | Can't reach the server | Check `SERVER_IP`, same Wi-Fi, backend running on 8001, firewall rule |

> ### Troubleshooting — Connecting node ↔ dashboard
> - **`[WiFi]` never says "Connected"** → Double-check `WIFI_SSID`/`WIFI_PASS` (case-sensitive). The ESP8266 only joins **2.4 GHz** networks, not 5 GHz-only ones.
> - **`HTTP -1` (cannot reach server)** → PC and node must be on the **same Wi-Fi**; confirm `SERVER_IP` matches the PC's current `ipconfig` IPv4; make sure the backend terminal is running; add the firewall rule in [5c](#5c-allow-port-8001-through-windows-firewall).
> - **`HTTP 401`** → The `DEVICE_KEY` is wrong. Re-copy it (or rotate the key on the device) and re-flash.
> - **Device shows online but VOC alarms constantly** → Set that device's **VOC threshold to ~200** (see [5a](#5a-add-the-device-in-the-dashboard-and-copy-its-api-key)). The default `0.6` is the wrong scale for the 0–500 VOC Index.
> - **PM2.5 reads garbage / wildly jumps** → A stray `delay()` in firmware, a loose **5 V** wire to the PMS5003, or PMS **TX** not on **D5**. The PMS5003 fan needs steady 5 V and a solid common ground.

---

## 6. Troubleshooting (all-in-one)

A quick index of the most common snags, grouped by where they happen.

**Setup / Node**
- `node -v` not recognized or shows < v22.5 → Install the latest LTS from <https://nodejs.org>, reopen the terminal.

**Dashboard backend**
- Crashes at startup / `node:sqlite` error → Node older than 22.5. Upgrade.
- `EADDRINUSE` on 8001 → Another process holds the port; close it or restart, then `npm run dev`.
- Health check: <http://localhost:8001/api/health> should return `{"status":"ok"}`.

**Dashboard frontend**
- `npm install` fails → Keep the `.npmrc` (`legacy-peer-deps=true`) in `frontend\`.
- Login/network error → The backend terminal isn't running, or not on port 8001.

**Arduino / board**
- No COM port → Install the **CH340 driver**; use a data USB cable; replug.
- Upload stuck on "Connecting…" → Hold **FLASH/BOOT** during upload; lower upload speed to **115200**.
- `Adafruit_SGP40.h not found` → Install the **Adafruit SGP40** library (with dependencies).
- Serial Monitor gibberish → Set baud to **115200**.

**Node ↔ dashboard link**
- ESP8266 can't reach the PC → Same Wi-Fi (2.4 GHz), correct `SERVER_IP`, firewall allows inbound **8001**.
- `HTTP 401` → Wrong/missing `DEVICE_KEY`; re-copy and re-flash.
- VOC always alarms → Set the per-device **VOC threshold to ~200**.
- PMS reads garbage → Stray `delay()`, loose **5 V**, or wrong PMS **TX→D5** pin.

---

### You're done 🎉

When everything's working you have: the **backend** running on `:8001`, the **frontend** open in your browser, and an **ESP8266** posting `HTTP 200` readings every 5 seconds that show up live — with alerts firing when the air crosses a threshold. From here, add more devices (each gets its own API key), tune thresholds per device, and explore the admin/security consoles.

For deeper architecture notes, see [`README.md`](../README.md) and [`CLAUDE.md`](../CLAUDE.md) in the repo root.
