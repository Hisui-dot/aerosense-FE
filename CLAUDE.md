# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AeroSense** is a capstone project: an IoT-based environmental monitoring system that detects vaping by sensing airborne particulates and volatile organic compounds (VOCs). It has two halves that share a data model (devices, sensors, alerts):

1. **Firmware / hardware edge node** — an ESP32 reads air-quality sensors, applies a threshold, and triggers a local buzzer/LED alarm. Documented in `IoT_Vape_Detection_Manual_Phase1_Revised.docx` (Phase 1: Proof of Concept / Modular MVP). No firmware source is committed yet; the manual is the spec.
2. **Web dashboard** — a React admin/security console (in `frontend/`) for monitoring devices, viewing alerts, managing users, and analytics. Originally scaffolded with Figma Make.

The dashboard's `devices` model (pm25, voc, battery, firmware, signal, status) mirrors what the firmware node produces. When wiring the two together, the firmware is the data source and the dashboard is the consumer.

---

## Part 1 — Firmware / Hardware (`IoT_Vape_Detection_Manual_Phase1_Revised.docx`)

**Tech stack:**

| Layer | Choice |
|-------|--------|
| MCU / edge compute | ESP32-WROOM-32E (ESP32 DevKitC, 38-pin), dual-core @240 MHz, on-chip Wi-Fi + BLE |
| Gateway (optional) | Raspberry Pi 4 Model B / Pi 5; legacy Pi 2 Model B needs a USB Wi-Fi dongle (MediaTek MT7601 or Realtek RTL8188EUS) |
| Language / framework | C++ (Arduino), built and flashed via **Arduino IDE 2.x** with the Espressif ESP32 board package |
| USB-serial drivers | CP210x or CH340 |
| Particulate sensor | **PMS5003** laser PM2.5 counter — **UART** @ 9600 baud (`Serial2`), 32-byte frames starting `0x42 0x4D` |
| VOC sensor | **SGP40** (Sensirion MOx) — **I2C** @ address `0x59`, via `Adafruit_SGP40` library |
| Actuators | Active piezo buzzer + 5 mm red LED (each through a 220 Ω resistor) |
| Power | 5 V USB in → on-board LDO to 3.3 V; optional 18650 Li-ion **requires a BMS** (2.5 V–4.2 V protection) |

**Pin map (master firmware):** PMS5003 RX2=GPIO16, TX2=GPIO17 · SGP40 SDA=GPIO21, SCL=GPIO22 · buzzer=GPIO25 · LED=GPIO26 · debug serial @115200 baud.

**Arduino library dependencies:** `Wire.h` (built-in I2C) and **`Adafruit SGP40 Sensor`** (install via Library Manager before compiling, or compilation fails).

**Architecture conventions that matter:**
- The integrated firmware is **non-blocking**: it uses `millis()` interval timers (`sensorPollInterval`, `alertToggleInterval`), never `delay()`. A `delay()` stalls UART parsing and overflows the PMS5003 serial buffer — keep new firmware async.
- Detection is a single threshold: `PM25_VAPE_THRESHOLD = 35` µg/m³. Crossing it sets `vape_incident_flag`, which drives the buzzer/LED toggle loop until air clears.
- Power rule: the PMS5003 fan draws from **5 V (VIN)**, never the 3.3 V rail (browns out the LDO). All units must share a common ground.
- If the I2C bus drops packets, add 4.7 kΩ pull-ups from SDA→3.3 V and SCL→3.3 V.

The manual builds up in three modular units (Power/Compute → Sensor array → Actuators) each with its own verification sketch, then merges into the master integrated firmware in Section 4.2.

---

## Part 2 — Web Dashboard (`frontend/`)

A Vite + React 18 + TypeScript SPA with an Express + SQLite backend (`backend/`). Frontend commands run from `frontend/`; the backend runs from `backend/`.

### Tech stack
- **Frontend:** React 18, TypeScript, Vite 6, React Router 7, Tailwind CSS v4 (via `@tailwindcss/vite`), shadcn-style UI built on Radix primitives, MUI, Recharts, `motion`, `sonner` toasts.
- **Backend:** Node.js + Express 4 (CommonJS), JWT auth (`jsonwebtoken` + `bcryptjs`), `multer` for photo uploads.
- **Database:** Node's **built-in `node:sqlite`** (`DatabaseSync`) — see gotcha below. File at `backend/db/vape.db`, auto-created and seeded on first run.

### Commands
```bash
# Frontend — from frontend/
npm install              # uses .npmrc legacy-peer-deps=true; do not drop that flag
npm run dev              # Vite dev server (frontend only)
npm run build            # production build to frontend/dist/ (backend serves it statically)
npm test                 # Vitest unit tests for src/app/lib/* and theme tokens

# Backend — from backend/ (separate terminal)
npm install
npm run dev              # Express API on http://localhost:8001, --watch
```
Run the frontend dev server and the backend in **separate terminals** for a working app. There is **no linter/formatter** configured, and the only automated tests are the Vitest pure-logic units; don't assume `npm run lint` exists.

### Critical gotchas
- **Node version:** `backend/db/store.js` imports `node:sqlite` (`DatabaseSync`), available only in **Node 22.5+**. On older Node the backend crashes at startup. Prefer Node 22 LTS+.
- **Ports / proxy:** Vite proxies `/api` and `/uploads` to `http://127.0.0.1:8001` (`vite.config.ts`). The backend deliberately forces port **8001** even if `PORT=8000` is set (`server.js`). Keep them aligned.
- **Supabase is unused.** `@supabase/supabase-js` is in `backend/package.json` but no code imports it — persistence is local SQLite only. Don't treat Supabase as the datastore.
- **Backend `.env`** (in `backend/`, gitignored) must provide `JWT_SECRET`, `JWT_EXPIRES_IN`, and optionally `PORT`.
- **Source layout:** the app lives under `frontend/src/app/` — `pages/{auth,security,admin}`, `components/{ui,layout,admin}`, plus `services/`, `hooks/`, `lib/`, `context/`, `theme/`.

### Architecture
- **Entry:** `frontend/src/app/App.tsx` wraps `RouterProvider` (`frontend/src/app/routes.tsx`) in `AuthProvider` (`frontend/src/app/context/AuthContext.tsx`).
- **Two role-gated route trees** behind `ProtectedRoute`:
  - `/` → `requiredRole="security"` → `SecurityLayout` (Dashboard, Alerts, Sensors, Assignments, Logs, Analytics…).
  - `/admin` → `requiredRole="admin"` → `AdminLayout` (Dashboard, Alerts, Devices, Analytics, Users, Logs, Settings).
- **API layer:** all frontend↔backend calls go through `frontend/src/app/services/api.ts` — a thin `fetch` wrapper that prefixes `/api`, attaches the JWT from `localStorage`, and exposes typed clients (`authApi`, `alertsApi`, `sensorsApi`, `devicesApi`, `usersApi`, `logsApi`, `settingsApi`, `analyticsApi`). Add new endpoints here, not via raw `fetch` in components.
- **Backend shape:** `server.js` mounts one router per domain under `/api/<name>` (`backend/routes/*.js`). Routes call a **generic data-access layer** in `backend/db/store.js` (`findAll/findById/insert/update/remove` over table names, with JSON columns auto-serialized). Auth is enforced by `requireAuth` / `requireAdmin` middleware (`backend/middleware/auth.js`) checking a Bearer JWT.
- **Domain tables** (created in `store.js`): `users`, `alerts`, `sensors`, `assignments`, `devices`, `logs`, `settings`. Seeded by `backend/db/seed.js`.
- **Auth model:** JWT issued on login/signup, stored in `localStorage`, sent as `Authorization: Bearer`. Signup is forced to `security` role (admins are created only by seeding or by an existing admin). `@` is the Vite alias for `src/`.

### Default seed credentials (local dev only)
`admin` / `admin123` (admin) · `security` / `security123` (security). Defined in `backend/db/seed.js`.

---

## Conventions
- The user's global rules favor **immutability** (no in-place mutation), small focused files, and explicit types on exported/public APIs. The dashboard's `tsconfig.json` has `strict: false`, so type rigor is not enforced by the compiler — apply it by hand on new code.
- Firmware additions must stay non-blocking (`millis()`, never `delay()`) per the manual's concurrency rules.
