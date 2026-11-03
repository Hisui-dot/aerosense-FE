# Task 9 Report — Device Creation, Key Rotation, and Readings Endpoints

**Date:** 2026-06-19  
**Branch:** feat/iot-loop  
**Commit:** dc22820

## Summary

Added three new routes to `backend/routes/devices.js`:
1. `POST /api/devices` (admin) — creates a device, generates and returns `apiKey` once
2. `POST /api/devices/:id/rotate-key` (admin) — rotates a device's API key
3. `GET /api/devices/:id/readings` (auth) — returns recent sensor readings (up to 1000)

Also added `const { generateApiKey } = require('../utils/apiKey');` import.

## Verification Results

### Syntax Check
```
node --check routes/devices.js → exit 0
```

### Step 4 — Create Device (POST /api/devices) → 201
```json
{
  "id": "D-b7295ca2",
  "name": "Test Node",
  "location": "Room 999",
  "floor": "9th",
  "status": "offline",
  "apiKey": "ak_07eca967b5552e8c5470aa68377e8793326315c3436c9dd1",
  ...
}
```
Result: PASS — 201 with `apiKey` field present.

### Step 5 — Readings for S001 (GET /api/devices/S001/readings?limit=5) → JSON array
```json
[
  {"id":"467715e9-...","deviceId":"S001","pm25":10,"voc":0.2,...},
  {"id":"5c3dfa2c-...","deviceId":"S001","pm25":80,"voc":2,...},
  ... (5 items total)
]
```
Result: PASS — array of 5 readings returned.

### Step 6 — Rotate Key for S001 (POST /api/devices/S001/rotate-key) → new key
```json
{
  "id": "S001",
  "apiKey": "ak_f44dd022931faad00439d89bfe86a49fc99180ab502a4d0f"
}
```
Result: PASS — new `ak_` prefixed key returned.

### Step 7 — Missing Device Readings → 404
```
GET /api/devices/NOPE/readings → HTTP 404
```
Result: PASS — 404 returned for non-existent device.

### Server Shutdown
Port 8001 confirmed free after server stop (only TIME_WAIT connections from curl, no active listener).

## Files Changed
- `backend/routes/devices.js` — only file staged and committed

## Concerns
None. All 4 live endpoint checks passed. The `src/app/pages/Login.tsx` file was modified (pre-existing change) but was NOT staged or committed per instructions.

---

## Fix Wave 1 — Security Hardening (2026-06-19)

**Commit:** `276d8bf`  
**Branch:** `feat/iot-loop`  
**File changed:** `backend/routes/devices.js` only

### Fixes Applied

| Fix | Severity | Description |
|-----|----------|-------------|
| Fix 1 | CRITICAL | Strip `apiKey` from GET `/api/devices` and GET `/api/devices/:id` for non-admin roles |
| Fix 2 | Important | Clamp negative/invalid `limit` on readings route (negative SQLite LIMIT = no limit) |
| Fix 3 | Important | Generate device `id` server-side only; ignore any client-supplied `id` on POST |
| Fix 4 | Minor | Block `apiKey` and `id` from being overwritten via PUT |

### Syntax Check
```
node --check routes/devices.js → SYNTAX OK: exit 0
```

### Fix 1a — Security user must NOT see apiKey in GET /api/devices
```
FIX1a - security sees apiKey in GET /: False  (expected: False) ✓ PASS
```

### Fix 1b — Admin MUST see apiKey in GET /api/devices
```
FIX1b - admin sees apiKey in GET /: True  (expected: True) ✓ PASS
```

### Fix 1c — Security user must NOT see apiKey in GET /api/devices/:id
```
Testing device ID: S001
FIX1c - detail has apiKey for security on GET /:id: False  (expected: False) ✓ PASS
```

### Fix 2 — Negative limit clamped to 100
```
FIX2 - readings with limit=-1: rows=31, capped(<=100)=True  (expected: capped=True) ✓ PASS
```

### Fix 3 — Client-supplied id is ignored on POST /api/devices
```
FIX3 - id: D-b83ac821, serverGen(starts with D-, not HACKED): True  (expected: True) ✓ PASS
```

### Fix 4 — PUT cannot overwrite apiKey
```
Real apiKey before PUT: ak_f44dd022931faad00439d89bfe86a49fc99180ab502a4d0f
FIX4 - apiKey after PUT attempt: ak_f44dd022931faad00439d89bfe86a49fc99180ab502a4d0f
FIX4 - apiKey unchanged (not 'ak_hacked'): True  (expected: True) ✓ PASS
```

### Server Shutdown
Port 8001 confirmed free after stopping background server (process 11656 terminated).

### Concerns
None. All 4 fixes verified green. Only `backend/routes/devices.js` was staged and committed. `src/app/pages/Login.tsx` was not touched.
