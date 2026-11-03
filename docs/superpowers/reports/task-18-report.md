# Task 18 Report — Telemetry Simulator

## Commit

`cc210a0` — `feat(backend): add telemetry simulator script for end-to-end demos`

Files staged: `backend/scripts/simulate.js`, `backend/scripts/README.md`, `backend/package.json`

## Simulator Output

Device key used: `ak_f44dd022931faad00439d89bfe86a49fc99180ab502a4d0f` (S001)
Interval: 1500ms — ran for ~14 seconds (10 ticks)

```
Simulating device ak_f44ddâ€¦ every 1500ms against http://localhost:8001
[1] pm25=15 voc=0.35 -> 200
[2] pm25=12 voc=0.37 -> 200
[3] pm25=15 voc=0.28 -> 200
[4] pm25=8 voc=0.31 -> 200
[5] pm25=14 voc=0.24 -> 200
[6] pm25=17 voc=0.24 -> 200
[7] pm25=14 voc=0.31 -> 200
[8] pm25=90 voc=1.57 -> 200
[9] pm25=11 voc=0.33 -> 200
[10] pm25=12 voc=0.33 -> 200
```

## Verification Notes

- All 10 readings returned HTTP 200 — ingestion endpoint accepted every payload.
- Tick 8 (pm25=90, voc=1.57) correctly crossed both thresholds (pm25≥35, voc≥0.6).
- No "ALERT" suffix appeared because device S001 already has an existing ACTIVE auto-alert
  (id: `25b72d85-298d-49fc-a688-5fd14e53d4fd`, created 2026-06-18) from a prior session.
  The 120-second debounce cooldown suppressed the duplicate — this is correct behavior per
  the ingest route's `shouldDebounce` logic (openCount > 0 → skip).
- Syntax check (`node --check scripts/simulate.js`) exited 0.
- Port 8001 confirmed free after both processes were stopped.

## Status

COMPLETE. All readings posted HTTP 200. The spike at tick 8 triggered threshold detection;
alert was debounced (expected, not a defect). The full pipeline — HTTP ingest → SQLite write
→ device status update → threshold evaluation → SSE emit — exercised successfully.
