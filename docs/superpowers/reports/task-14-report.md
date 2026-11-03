# Task 14 Report — Live SSE Updates, Remove Mock-Alert System

**Commit:** `e9efdb8`
**Branch:** `feat/iot-loop`
**Files changed:** `src/app/pages/Dashboard.tsx`, `src/app/pages/Alerts.tsx`

---

## Dashboard.tsx

### Removed

| Item | Detail |
|------|--------|
| `INITIAL_ALERTS` constant | 3-element hardcoded `Alert[]` array seeded with fake "Boys Restroom", "Girls Restroom", "Hallway East Wing" entries |
| `INITIAL_HISTORY` constant | 3-element hardcoded `ResponseHistoryItem[]` with fake "Cafeteria", "Faculty Restroom", "Library Section C" entries |
| `useState(INITIAL_ALERTS)` initializer | Replaced with `useState<Alert[]>([])` |
| `useState(INITIAL_HISTORY)` initializer | Replaced with `useState<ResponseHistoryItem[]>([])` |
| `localStorage.getItem('mock_alerts')` merge | Lines that read `mock_alerts`, built a `Map` merging mock + API results (`combinedAlerts`), and mapped over the combined list — removed entirely; now maps over `alertsData` directly |
| `alert_precision_*` localStorage reads | Per-alert precision overrides pulled from `localStorage` — removed; `pm25`, `voc`, `confidence` now come from API data only |
| `window.addEventListener('storage', handleStorage)` | Listener that re-fetched on `mock_alerts` or `force_sync` key changes — removed |
| `setHistory` merge with `INITIAL_HISTORY` | The `setHistory` callback that filtered `INITIAL_HISTORY` and appended hardcoded entries not present in the API response — replaced with `setHistory(fetchedHistory)` |
| `fetchAlerts` defined inside `useEffect` | Inlined definition prevented calling it from the hook |

### Added / Changed

- `fetchAlerts` hoisted outside `useEffect` using `useCallback` so it can be passed to `useLiveStream`.
- `import { useLiveStream } from '../hooks/useLiveStream'` added.
- `useLiveStream({ onAlert: () => { fetchAlerts(); } })` called at the component top level.
- `import { useCallback }` added to React import.
- Polling interval raised from `5000` ms to `30000` ms.

---

## Alerts.tsx

### Removed

| Item | Detail |
|------|--------|
| `localStorage.getItem('mock_alerts')` merge | Read `mock_alerts`, built a `Map` merging mock + API data into `combined`, mapped over combined — removed; now maps directly over API `data` |
| `window.addEventListener('storage', handleStorage)` | Listener re-fetching on `mock_alerts` / `force_sync` — removed |
| Mock-aware `handleAcknowledge` branch | Checked if alert ID existed in `mock_alerts`; if so, updated mock in localStorage instead of calling the real API. Also wrote `force_sync` to localStorage. Both removed — acknowledge now only calls `alertsApi.acknowledge(id)` |

### Added / Changed

- `fetchAlerts` hoisted outside `useEffect` using `useCallback`.
- `import { useLiveStream } from '../hooks/useLiveStream'` added.
- `useLiveStream({ onAlert: () => { fetchAlerts(); } })` called at the component top level.
- `import { useCallback }` added to React import.
- Polling interval raised from `5000` ms to `30000` ms.

---

## Build Result

```
vite v6.3.5 building for production...
✓ 2353 modules transformed.
✓ built in 6.07s
```

Only the pre-existing chunk-size warning (1,240 kB bundle) — no new errors.

---

## Verification

```
grep -n "mock_alerts|INITIAL_ALERTS|INITIAL_HISTORY" Dashboard.tsx Alerts.tsx
→ CLEAN (no output)

grep -n "useLiveStream" Dashboard.tsx Alerts.tsx
→ present in both files (import + call)
```

---

---

## Fix Wave 1 — Type-Safety Improvements

**Commit:** `b979e4a`
**Branch:** `feat/iot-loop`
**Date:** 2026-06-19

### Build Result

```
vite v6.3.5 building for production...
✓ 2353 modules transformed.
✓ built in 5.63s
```

Only the pre-existing chunk-size warning (1,240 kB bundle) — no new errors or warnings.

### Changes Made

#### `src/app/services/api.ts`
- Expanded the `Alert` interface:
  - Widened `status` union to include `'ACKNOWLEDGED'` and `'ESCALATED'` (were missing, causing narrowness vs. what the backend actually returns).
  - Added optional backend sensor-snapshot columns: `pm25?: number | null`, `voc?: number | null`, `deviceId?: string | null`, `source?: string`.
  - Added optional display/synthetic fields: `confidence?: number`, `priority?: string`, `type?: string`, `notes?: unknown`.
  - All additions are optional (`?`) so existing consumers are unaffected (additive change).

#### `src/app/pages/Alerts.tsx`
- **`(alertsApi as any).acknowledge(id)` → `alertsApi.acknowledge(id)`**: The method was already typed on `alertsApi`; the cast was unnecessary. Cast fully removed.
- **`.map((a: any)` → `.map((a: ApiAlert)`**: `Alert` imported from `../services/api` as `ApiAlert` (alias to avoid clash with the local `Alert` interface). All fields read in the mapping body (`id`, `createdAt`, `floor`, `location`, `status`, `detectedAt`, `sensorId`) are declared on the expanded `ApiAlert` interface.

#### `src/app/pages/Dashboard.tsx`
- **Both `.map((a: any)` callbacks → `.map((a: ApiAlert)`**: `Alert` imported from `../services/api` as `ApiAlert`. Fields read in the first mapping body (`id`, `pm25`, `voc`, `confidence`, `type`, `floor`, `location`, `detectedAt`, `status`, `priority`, `respondedBy`) and the second mapping body for history (`id`, `floor`, `location`, `status`, `resolvedAt`, `notes`) are all declared on the expanded `ApiAlert` interface.
- **`.filter((a: any)` → `.filter((a: ApiAlert)`**: The history-filter callback also had `any` and was retightened.

### Casts Successfully Retyped to `Alert`

| File | Location | Was | Now |
|------|----------|-----|-----|
| `Alerts.tsx` | `alertsApi.acknowledge` call | `(alertsApi as any).acknowledge(id)` | `alertsApi.acknowledge(id)` |
| `Alerts.tsx` | `.map` callback | `(a: any)` | `(a: ApiAlert)` |
| `Dashboard.tsx` | active-alerts `.map` callback | `(a: any)` | `(a: ApiAlert)` |
| `Dashboard.tsx` | history `.filter` callback | `(a: any)` | `(a: ApiAlert)` |
| `Dashboard.tsx` | history `.map` callback | `(a: any)` | `(a: ApiAlert)` |

### Casts Left as `any`

| File | Location | Reason |
|------|----------|--------|
| `Dashboard.tsx` | `devicesData.find((d: any) => ...)` | `d` is a `Device` from `devicesApi.getAll()` — out of scope for this fix wave (not an `Alert` cast). Runtime behaviour unchanged. |

### Verification

```
grep -n "pm25?" src/app/services/api.ts  → line 70: pm25?: number | null; (present)
grep -n "alertsApi as any" src/app/pages/Alerts.tsx  → no output (clean)
```

---

## Decisions / Ambiguities

1. **`alert_precision_*` localStorage entries in Dashboard**: These stored per-alert pm25/voc/confidence overrides originating from the mock system. They were removed along with the mock merge since their only purpose was to augment mock-generated alerts. Real API alerts carry their own sensor values.
2. **`useCallback` dependency array**: `fetchAlerts` in both files has an empty `[]` dep array (no external deps inside the callback other than stable setters), which is correct.
3. **`handleAcknowledge` in Alerts.tsx**: The original code kept a localStorage `force_sync` write even after the real API call. Removed it — the SSE stream (via `useLiveStream`) or the 30 s poll will pick up the server-side change automatically.
