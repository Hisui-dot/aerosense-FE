# Final Fixes Report — feat/iot-loop

**Date:** 2026-06-19
**Branch:** feat/iot-loop
**Commit:** ca75d30

---

## Backend Test Results

All 17 tests pass, 0 failures.

```
✔ creates sensor_readings table
✔ adds new columns to devices and alerts  (now includes notes assertion)
✔ is idempotent (running twice does not throw)
✔ triggers when pm25 over threshold
✔ triggers when voc over threshold
✔ does not trigger when both under
✔ requireBothSensors needs both over threshold
✔ debounce when an alert is already open
✔ debounce within cooldown window
✔ no debounce after cooldown with no open alerts
✔ resolveThresholds prefers device override
✔ generates a prefixed key
✔ generates unique keys
✔ accepts a valid reading
✔ rejects negative pm25
✔ rejects missing voc
✔ accepts optional recordedAt ISO string

tests 17 | pass 17 | fail 0
```

---

## Fresh Seed Verification

### Matching deviceId count
```
alerts with matching deviceId: 5 / 5
```

### Notes round-trip
```
notes round-trip ok: true
```

---

## Frontend Build

```
✓ 2352 modules transformed.
✓ built in 5.47s
```

Build succeeded. (Pre-existing chunk size warning for bundle >500 kB is not a build error.)

---

## AdminReports Math.random Grep

```
grep -n "Math.random" src/app/pages/admin/AdminReports.tsx
```

No output — zero occurrences of `Math.random` remain.

---

## Summary of 3 Fixes

1. **Fix 1 — alerts.notes column**: Added `ensureColumn(db, 'alerts', 'notes', 'TEXT')` to `migrations.js` and the corresponding assertion to `migrations.test.js`. The `POST /api/alerts/:id/notes` route can now persist notes arrays via the existing JSON serialization in `store.js`.

2. **Fix 2 — seed alert/device id alignment**: Updated all 5 seeded alerts in `seed.js` to use real device ids (S001–S005) for both `sensorId` and new `deviceId` field, with matching `location` and `floor` from the devices array. Updated the alert INSERT statement to include `deviceId` in the column list and values.

3. **Fix 3 — AdminReports fake data removed**: Replaced both `Math.random()` expressions in `AdminReports.tsx` with values derived from fetched data — per-device detection counts now use `alerts.filter(a => a.deviceId === d.id || a.sensorId === d.id).length`, and per-user handled/resolved counts use `alerts.filter(a => a.respondedBy === u.name)`.

---

## Concerns

None. All staged files were exactly the 4 specified targets. `Login.tsx` was not staged. `backend/db/vape.db.bak` (untracked) was not staged. Build, tests, and seed verification all passed cleanly.
