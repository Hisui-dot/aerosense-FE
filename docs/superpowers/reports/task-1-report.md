# Task 1 Report: Migration Runner + sensor_readings Table + New Columns

## Status
DONE_WITH_CONCERNS

## Commit Hash
`604fd1d`

## Test Command Output (Passing Run)

```
(node:8360) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ creates sensor_readings table (2.901ms)
✔ adds new columns to devices and alerts (1.0923ms)
✔ is idempotent (running twice does not throw) (1.9728ms)
ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 82.3008
```

## Test Summary
3/3 pass

## Files Committed
- `backend/db/migrations.js` (new)
- `backend/db/migrations.test.js` (new)

## Deviations from Spec

### One deviation in `migrations.js` (functionally equivalent)

The spec provided `migrations.js` with ALL four `CREATE INDEX` statements inside a single `db.exec()` block:

```javascript
CREATE INDEX IF NOT EXISTS idx_alerts_device ON alerts(deviceId);
CREATE INDEX IF NOT EXISTS idx_alerts_sensor ON alerts(sensorId);
```

These two indexes reference `alerts(deviceId)` and `alerts(sensorId)`. The `alerts` table in the test base schema has `sensorId` already, but NOT `deviceId`. When SQLite processes a multi-statement `exec()`, it validates all statements before executing — so creating an index on a column that doesn't yet exist (before `ensureColumn` adds it) throws `no such column: deviceId`.

**Fix applied:** Moved the two `alerts` indexes into a separate `db.exec()` call placed AFTER the `ensureColumn` calls for `alerts`. The `sensor_readings` indexes remain in the first `exec()` block as specified. All other logic is byte-for-byte identical to the spec.

This deviation was necessary to make the code correct. The spec's original placement would fail on any database where `alerts` table exists but lacks the `deviceId` column (exactly the scenario the tests exercise).

## TDD Cycle

1. Wrote `migrations.test.js` — confirmed FAIL: `Cannot find module './migrations'`
2. Wrote `migrations.js` as specced — confirmed FAIL: `no such column: deviceId` (index ordering issue)
3. Fixed index ordering in `migrations.js` — confirmed PASS: 3/3
4. Committed only the two new files; `src/app/pages/Login.tsx` left unstaged

## Node Version
Node.js v25.2.1 (node:sqlite is flagged ExperimentalWarning but functional)
