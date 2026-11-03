# Task 2 Report — store.js Migration Wiring

## Date
2026-06-19

## Commit
`1f50078` on branch `feat/iot-loop`

## Boot Verification Output

```
booted, devices: 7
readings query ok: true
(node:21788) ExperimentalWarning: SQLite is an experimental feature and might change at any time
```

## Changes Applied

### Edit A — `getDb()` wired to run migrations and create indexes
- `runMigrations(db)` called after `createSchema()`
- Three `CREATE INDEX IF NOT EXISTS` statements added for `alerts(createdAt)`, `logs(deviceId)`, `logs(timestamp)`

### Edit B — `update()` auto-stamps `updatedAt` for `devices` table
- `TABLES_WITH_UPDATED_AT` set guards the stamp to avoid touching unrelated tables
- Immutable spread pattern used (`{ ...changes, updatedAt: ... }`)

### Edit C — `recentReadings(deviceId, limit)` added and exported
- Queries `sensor_readings` table ordered by `recordedAt DESC`
- Returns deserialized rows; table may not exist yet (migration will create it)
- Exported in `module.exports`

## Verification Summary
Node booted cleanly, `findAll('devices')` returned 7 rows, `recentReadings('S001')` returned an array without error. Only `backend/db/store.js` was staged and committed. `vape.db.bak` and `src/app/pages/Login.tsx` were not touched.
