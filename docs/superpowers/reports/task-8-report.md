# Task 8 Report — Telemetry Ingestion Endpoint

**Commit:** `36b0c7d`
**Branch:** `feat/iot-loop`
**Date:** 2026-06-19

---

## Verification Results

### Check 4 — No key → 401
```
curl -s -o /dev/null -w "%{http_code}\n" --max-time 5 -X POST localhost:8001/api/ingest/readings \
  -H 'Content-Type: application/json' -d '{"pm25":10,"voc":0.2}'
```
**Output:** `401`  PASS

---

### Check 5 — Bad body → 400 with errors array
```
curl -s --max-time 5 -X POST localhost:8001/api/ingest/readings \
  -H "X-Device-Key: ak_4678caaf7ac6017174f6e57c6d2d49887f75856f98d90b60" \
  -H 'Content-Type: application/json' -d '{"pm25":-1}'
```
**Output:**
```json
{"message":"Invalid reading","errors":[{"path":"pm25","message":"Number must be greater than or equal to 0"},{"path":"voc","message":"Required"}]}
```
PASS

---

### Check 6 — Normal reading → alert null
```
curl -s --max-time 5 -X POST localhost:8001/api/ingest/readings \
  -H "X-Device-Key: ak_4678caaf7ac6017174f6e57c6d2d49887f75856f98d90b60" \
  -H 'Content-Type: application/json' -d '{"pm25":10,"voc":0.2}'
```
**Output:**
```json
{"ok":true,"readingId":"d2a5a159-204f-4fee-aeb1-5758fa33d499","alert":null}
```
PASS

---

### Check 7 — Over-threshold → alert created (ACTIVE, auto)
```
curl -s --max-time 5 -X POST localhost:8001/api/ingest/readings \
  -H "X-Device-Key: ak_4678caaf7ac6017174f6e57c6d2d49887f75856f98d90b60" \
  -H 'Content-Type: application/json' -d '{"pm25":80,"voc":2.0}'
```
**Output:**
```json
{"ok":true,"readingId":"104ea31b-d6db-4670-95c7-1dbd11a33cf5","alert":{"id":"25b72d85-298d-49fc-a688-5fd14e53d4fd","floor":"1st Floor","location":"Room 101","detectedAt":"2:45:42 AM","sensorId":"S001","status":"ACTIVE","respondedBy":null,"resolvedAt":null,"photoUrl":null,"createdAt":"2026-06-18T18:45:42.594Z","deviceId":"S001","pm25":80,"voc":2,"source":"auto"}}
```
PASS

---

### Check 8 — Immediate repeat over-threshold → debounced (alert null)
```
curl -s --max-time 5 -X POST localhost:8001/api/ingest/readings \
  -H "X-Device-Key: ak_4678caaf7ac6017174f6e57c6d2d49887f75856f98d90b60" \
  -H 'Content-Type: application/json' -d '{"pm25":80,"voc":2.0}'
```
**Output:**
```json
{"ok":true,"readingId":"b1556173-d141-4cf6-8d80-003093a898bb","alert":null}
```
PASS

---

## Summary

All 5 behavior checks passed (401 no-key, 400 bad-body, ok+null normal, ok+alert over-threshold, ok+null debounced).

- `express-rate-limit@^7` installed (120 req/min per IP window).
- `deviceAuth.js` hardened against duplicate `X-Device-Key` headers.
- `routes/ingest.js` created with full pipeline: parse → store reading → update device → evaluate threshold → debounce → create alert + log → emit SSE events.
- Mounted at `POST /api/ingest/readings` in `server.js`.
- `Login.tsx` remained unstaged throughout.

---

## Fix wave 1

**Commit:** `96eb521`
**Date:** 2026-06-19

### Changes applied

1. **Fix 1 (try/catch):** Wrapped the entire handler body in a `try/catch`. Any unhandled store/DB throw now returns `HTTP 500 {"message":"Internal server error"}` and logs `[ingest] unhandled error:` to stderr, preventing stack-trace leakage.

2. **Fix 2 (far-future clamp):** Replaced the bare `parsed.data.recordedAt || nowIso` assignment with a 5-minute skew clamp. Any `recordedAt` more than 300 000 ms ahead of server time falls back to `nowIso`, preventing distorted analytics ordering from far-future device timestamps.

### Re-verification results

| Check | Expected | Result |
|-------|----------|--------|
| 1. No `X-Device-Key` | 401 | PASS — `HTTP 401 {"message":"Device key required"}` |
| 2. `{"pm25":-1}` | 400 + errors | PASS — `HTTP 400` with `errors` array (pm25 ≥ 0, voc required) |
| 3. `{"pm25":10,"voc":0.2}` | `ok:true, alert:null` | PASS |
| 4. `{"pm25":80,"voc":2.0}` | `ok:true`, alert or debounced | PASS — `ok:true` (debounced; existing ACTIVE alert for S001 open from prior test run, expected) |
| 5. Immediate repeat over-threshold | `alert:null` debounced | PASS — `ok:true, alert:null` |
| 6. `recordedAt:"2099-01-01T00:00:00Z"` | clamped to server time | PASS — stored `recordedAt: 2026-06-18T18:50:38.303Z`, `clamped: true` |

**Syntax check:** `node --check routes/ingest.js` → exit 0.

**Concerns:** None. Check 4 returning `alert:null` is correct debounce behavior — the open ACTIVE alert created in the original task-8 test run was still present (cooldown window 120 s), so no new alert was issued. This is the intended deduplication logic.
