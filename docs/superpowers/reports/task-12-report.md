# Task 12 Report — API Client Extensions

## Status
COMPLETE

## Commit
`03a730f` on branch `feat/iot-loop`
Only `src/app/services/api.ts` staged and committed.

## Build Result
SUCCESS — `vite build` completed in 5.52s, 2352 modules transformed.
Pre-existing chunk-size warning (1,242 kB JS bundle) is present as expected; no new errors introduced.

## Changes Applied
- **Edit A**: Added `apiKey?`, `pm25Threshold?`, `vocThreshold?`, `updatedAt?` optional fields to `Device` interface.
- **Edit B**: Extended `devicesApi` with `create` and `rotateKey` methods.
- **Edit C**: Added `Reading` interface and `readingsApi` (time-series endpoint) immediately after `devicesApi`.
- **Edit D**: Typed `analyticsApi` generics, added `WeeklyPoint` interface, `StreamHandlers` interface, and `streamApi` SSE subscriber with cleanup return.

## Verification
All five new symbols confirmed present in file:
- `rotateKey` (line 130)
- `interface Reading` (line 134)
- `readingsApi` (line 139)
- `WeeklyPoint` (line 179)
- `streamApi` (line 194)

## Concerns
None. `getToken` and `BASE` and `Alert` were all already defined in the file and reused correctly. No redefinitions introduced.

---

## Fix wave 1

### Build Result
SUCCESS — `vite build` completed in 5.75s, 2352 modules transformed.
Pre-existing chunk-size warning (1,242 kB JS bundle) present; no new errors introduced.

### Commit
`96d13ef` — `fix(frontend): crash-safe SSE event parsing in streamApi` on branch `feat/iot-loop`.
Only `src/app/services/api.ts` staged and committed.

### Changes Applied
Replaced the `streamApi` export with a crash-safe version:
- Wrapped `JSON.parse` in a `try/catch` `parse` helper — malformed SSE frames now return `null` and are silently skipped instead of throwing.
- Captured `handlers.onReading` and `handlers.onAlert` into `const` locals, eliminating the unsafe non-null assertions (`!`).

### Verification
- `grep -n "onReading!\|onAlert!"` → no output (assertions removed).
- `grep -n "try { return JSON.parse"` → matched line 203 (crash-safe parse present).

### Concerns
None. The fix is strictly additive safety — no interface changes, no behaviour changes for well-formed frames.
