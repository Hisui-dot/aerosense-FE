# AeroSense — Closing the IoT Loop (DB → Backend → Frontend)

**Date:** 2026-06-19
**Status:** Approved design (pending user spec review)
**Scope:** Build the real telemetry pipeline so ESP32 firmware data flows into storage, drives alerts automatically, and surfaces live in the dashboard — replacing mock/hardcoded data.

---

## 1. Problem

AeroSense is an IoT vaping-detection system, but the software has a **broken loop**:

- **Database:** `devices` stores only the *latest* reading snapshot. No time-series table, no indexes, no foreign keys, no migrations, no `updatedAt`.
- **Backend:** No telemetry ingestion endpoint — the ESP32 cannot push data. Alerts are created manually. `/api/analytics/*` returns hardcoded mock data.
- **Frontend:** Pages rely on hardcoded fallback arrays (`INITIAL_ALERTS`, `SENSORS`) and a `localStorage['mock_alerts']` merge, poll every 5s, and recompute analytics client-side.

The firmware produces `pm25`/`voc` telemetry and triggers detections (`PM25_VAPE_THRESHOLD = 35`), but none of that reaches the dashboard through a real path.

## 2. Goal

Close the loop end-to-end:

1. Devices POST telemetry to an authenticated ingestion endpoint.
2. Readings are stored in a time-series table.
3. The backend evaluates thresholds and auto-creates alerts (debounced).
4. The dashboard receives readings + alerts live via SSE and renders real data.
5. A simulator script exercises the whole pipeline for demos.

## 3. Decisions (locked)

| Decision | Choice |
|---|---|
| Scope | Close the IoT loop (pipeline + hardening required along the way) |
| Data model strategy | **Additive / non-breaking.** Keep existing tables; `devices` = canonical telemetry node. Defer `devices`/`sensors` unification (documented). |
| Device auth | **Per-device API key** via `X-Device-Key` header |
| Alert generation | **Backend auto-generates** on ingestion using configured thresholds, with debounce |
| Live updates | **Server-Sent Events** (`GET /api/stream`), polling retained as fallback |
| Mock data | **Remove** hardcoded fallbacks + `localStorage` mock-alert merge; add backend **simulator** script |
| Request validation | **zod** (backend dependency) |

## 4. Non-Goals

- Unifying `devices` and `sensors` into one table (risky refactor; deferred and documented).
- WebSockets / two-way streaming (devices push over HTTP; dashboard only receives).
- Firmware source changes — only the **HTTP contract** the firmware must follow is specified here.
- Frontend test framework rollout (tests focus on backend pipeline logic).

---

## 5. Phase 1 — Database

### 5.1 New table: `sensor_readings` (append-only time-series)

```sql
CREATE TABLE IF NOT EXISTS sensor_readings (
  id          TEXT PRIMARY KEY,
  deviceId    TEXT NOT NULL,
  pm25        REAL,
  voc         REAL,
  temperature REAL,
  humidity    REAL,
  recordedAt  TEXT NOT NULL,   -- device-reported time (or server receive time if absent)
  createdAt   TEXT NOT NULL,   -- server receive time
  FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_readings_device_time ON sensor_readings(deviceId, recordedAt DESC);
CREATE INDEX IF NOT EXISTS idx_readings_time        ON sensor_readings(recordedAt DESC);
```

### 5.2 `devices` additions

- `apiKey TEXT` — unique secret, generated on insert (`crypto.randomUUID()` + random bytes), never returned in list endpoints except to admins.
- `pm25Threshold REAL` / `vocThreshold REAL` — optional per-device override; null means fall back to global `settings`.
- `updatedAt TEXT` — auto-stamped on every update.

### 5.3 `alerts` additions

- `deviceId TEXT` — FK → `devices.id` (auto-alerts populate this; existing `sensorId` kept for compatibility).
- `pm25 REAL`, `voc REAL` — sensor values captured at detection time.
- `source TEXT` — `'auto'` (threshold-derived) or `'manual'` (created via dashboard).

### 5.4 Migration runner

- New `schema_migrations(version INTEGER PRIMARY KEY, appliedAt TEXT)` table.
- Ordered, idempotent migration steps in `backend/db/migrations.js`. Helpers: `ensureColumn(table, column, type)`, `ensureIndex(...)`. Run on startup after table creation.
- Rationale: existing `vape.db` files must upgrade safely instead of silently keeping the old schema.

### 5.5 Indexes + timestamps

- Add indexes: `alerts(deviceId)`, `alerts(sensorId)`, `alerts(createdAt)`, `logs(deviceId)`, `logs(timestamp)`.
- `store.update` auto-stamps `updatedAt` when the column exists.

### 5.6 Seed

- Backfill a small amount of historical `sensor_readings` per device so charts render on first run.
- Generate `apiKey` for each seeded device; print keys to console on seed for local dev.

---

## 6. Phase 2 — Backend

### 6.1 Device-auth middleware (`backend/middleware/deviceAuth.js`)

`requireDevice`: reads `X-Device-Key`, resolves device by `apiKey`, attaches `req.device`, returns 401 on missing/unknown key. Constant-time-ish compare; never logs the key.

### 6.2 Ingestion endpoint

`POST /api/ingest/readings` (requireDevice)

- **Body (zod-validated):** `{ pm25: number≥0, voc: number≥0, temperature?: number, humidity?: number, recordedAt?: ISO string }`.
- Inserts a `sensor_readings` row (deviceId from `req.device`).
- Updates the device snapshot: `pm25`, `voc`, `temperature`, `humidity`, `lastSeen`, `lastUpdate`, `status='online'`.
- Runs the detection service (§6.3).
- Emits SSE `reading` event, and `alert` event if one was created.
- **Returns:** `{ ok: true, readingId, alert: <alert | null> }`.

### 6.3 Detection service (`backend/services/detection.js`)

- Resolve effective thresholds: per-device override → else global `settings` (`pm25Threshold`, `vocThreshold`, `requireBothSensors`).
- Evaluate: PM2.5 over threshold, or VOC over threshold; if `requireBothSensors`, require both.
- **Debounce:** do not create a new alert if the device already has an `ACTIVE`/`RESPONDING` alert, or if the last auto-alert for the device was within a cooldown window (`settings.detectionCooldownSec`, default derived from existing `detectionDelay`).
- On fire: create `ACTIVE` alert (`source='auto'`, `deviceId`, `pm25`, `voc`, `floor`/`location` from device), write a `detection` log entry, return the alert.
- Pure, unit-testable: threshold + debounce logic separated from I/O.

### 6.4 SSE stream (`backend/services/events.js` + route)

`GET /api/stream` (requireAuth)

- In-process `EventEmitter`; route writes `text/event-stream`, sends keep-alive comments, cleans up on `close`.
- Event types: `reading`, `alert`. Payload mirrors the REST shapes the frontend already consumes.

### 6.5 Real analytics

Rewrite `/api/analytics/{summary,weekly,reports,qos}` to compute from `sensor_readings` + `alerts` + `devices`:

- `weekly`: detection counts/day from alerts.
- air-quality avg/min/max from readings.
- peak times, per-device performance, high-risk areas from real data.
- Keep response shapes backward-compatible with current frontend consumers where they exist; type them in `api.ts`.

### 6.6 Device key management

- Device creation (`POST /api/devices`, admin) generates and returns `apiKey`.
- `POST /api/devices/:id/rotate-key` (admin) regenerates and returns a new key.
- List/detail endpoints expose `apiKey` to admins only.

### 6.7 Validation + errors

- zod schemas for ingestion + key endpoints; 400 with field details on failure.
- `try/catch` on new endpoints; consistent `{ message }` (and `{ errors }` for validation) envelope. Existing endpoints unchanged to avoid breaking the frontend.

### 6.8 Tests (`node:test`, no new runner dep)

- Detection threshold + debounce (pure logic) — primary coverage target.
- Ingestion happy path + validation failures.
- Device auth (valid/invalid/missing key).
- Migration runner idempotency (run twice → no error, columns present).

---

## 7. Phase 3 — Frontend

### 7.1 API client (`src/app/services/api.ts`)

- Type `analyticsApi` return shapes.
- Add `readingsApi.forDevice(id, range)` → `Reading[]`.
- Add `streamApi.subscribe(handlers)` — `EventSource('/api/stream')` with auth, reconnect/backoff, returns unsubscribe.

### 7.2 Remove mocks, add states

- Delete `INITIAL_ALERTS`, `INITIAL_HISTORY`, hardcoded `SENSORS`, and the `localStorage['mock_alerts']` merge across Dashboard, Alerts, Analytics, AdminDashboard, AdminAlerts, Sensors.
- Add explicit **loading**, **empty**, and **error** states (no silent fallback to fake data).

### 7.3 Live updates

- Dashboard / Alerts / Analytics / AdminDashboard subscribe to SSE for instant updates; retain a slower polling interval as a reconnection fallback.

### 7.4 Readings charts + device UI

- `SensorDetail` / `AdminDeviceDetail`: render real time-series charts (Recharts) from `readingsApi`.
- Admin device view: show API key (masked, copy, rotate) and per-device thresholds.

### 7.5 Simulator (`backend/scripts/simulate.js`)

- Reads a device + its `apiKey`, POSTs realistic readings on an interval, occasionally crossing thresholds to trigger auto-alerts. Documented run command. Replaces the removed in-app mock system for demos.

---

## 8. Firmware HTTP contract (for the ESP32 team)

```
POST /api/ingest/readings
Headers: X-Device-Key: <device apiKey>, Content-Type: application/json
Body: { "pm25": 42.0, "voc": 0.71, "temperature": 24.3, "humidity": 51, "recordedAt": "2026-06-19T10:02:00Z" }
200: { "ok": true, "readingId": "...", "alert": { ... } | null }
401: unknown/missing device key
400: { "message": "...", "errors": [...] }
```

Non-blocking firmware rule still applies: the device posts on the existing `millis()` interval, never blocking the sensor loop.

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Migration corrupts existing `vape.db` | Idempotent steps + `IF NOT EXISTS`; back up DB file before first run; test runner twice. |
| Frontend breaks when mocks removed | Real loading/empty/error states; keep response shapes stable; verify each page. |
| Alert spam from rapid readings | Debounce + cooldown + open-alert suppression. |
| API key leakage | Admin-only exposure, masked in UI, rotatable, never logged. |
| Device clock skew on `recordedAt` | Server stamps `createdAt`; analytics can use either; reject absurd future timestamps. |

## 10. Phasing & verification

1. **DB** — migrations + schema + seed; verify upgrade on a copy of an existing `vape.db`.
2. **Backend** — ingestion + detection + SSE + analytics + key mgmt + tests green.
3. **Frontend** — SSE wiring, mock removal, charts, key UI; manual end-to-end verification via the simulator.

Each phase ends with the relevant reviewer agent (`database-reviewer`, `security-reviewer`, `typescript-reviewer`/`code-reviewer`).
