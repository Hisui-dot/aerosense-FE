# Task 6 Report — Detection Service (Threshold + Debounce)

## Status
COMPLETE

## Commit
`8aed742` on branch `feat/iot-loop`
Files committed: `backend/services/detection.js`, `backend/services/detection.test.js`

## Test Output
```
✔ triggers when pm25 over threshold (0.7386ms)
✔ triggers when voc over threshold (0.0986ms)
✔ does not trigger when both under (0.09ms)
✔ requireBothSensors needs both over threshold (0.1004ms)
✔ debounce when an alert is already open (0.1294ms)
✔ debounce within cooldown window (0.0854ms)
✔ no debounce after cooldown with no open alerts (0.1056ms)
✔ resolveThresholds prefers device override (0.1471ms)
ℹ tests 8
ℹ pass 8
ℹ fail 0
ℹ duration_ms 69.165
```

## Summary
8/8 tests pass. Pure functions: `evaluateThreshold`, `shouldDebounce`, `resolveThresholds` — all stateless, no I/O, no DB.

## Concerns
None. All three exported functions are pure and covered. `resolveThresholds` correctly coerces string settings values (from DB) and gives device-level overrides precedence over global settings.
