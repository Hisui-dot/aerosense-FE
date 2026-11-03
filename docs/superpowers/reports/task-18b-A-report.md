# Task 18b-A Report — Remove Mock-Alert System from Alert Pages

## Summary

Removed all `localStorage['mock_alerts']`, `localStorage['force_sync']`, and `localStorage['alert_precision_*']` reads/writes from the routed alert pages, and deleted the obsolete demo simulate panel (`AdminSimulate`). All alert data now flows exclusively through `alertsApi`.

---

## Changes per File

### `src/app/pages/admin/AdminSimulate.tsx` — DELETED
- Removed via `git rm`. This file was the entire in-browser demo panel that wrote `mock_alerts`, `force_sync`, and `alert_precision_*` keys. Replaced by the backend simulator script (`backend/scripts/simulate.js`).

### `src/app/pages/admin/AdminDashboard.tsx` — EDITED
- Removed `import { AdminSimulate } from './AdminSimulate'`
- Removed `import { Play, X }` icons (only used for the demo panel button/UI)
- Removed `showDemo` state variable
- Removed the demo-mode render branch (`if (showDemo) { return <AdminSimulate /> }`)
- Removed the "Panel Demo Mode" button from the header JSX

### `src/app/pages/admin/AdminAlerts.tsx` — EDITED
- Added `import { useLiveStream } from '../../hooks/useLiveStream'`
- Removed `storage` event listener (`window.addEventListener('storage', handleStorage)`) that re-fetched on `mock_alerts`/`force_sync` changes
- Raised polling interval from 5000 ms to 30000 ms
- Added `useLiveStream({ onAlert: () => fetchAlerts() })` for real-time push updates
- In `fetchAlerts`: removed `mock_alerts` read from localStorage and the merge/dedup with backend data; alerts now come from `alertsApi.getAll()` only
- In `fetchAlerts`: removed `alert_precision_` read; `type` and `priority` now come directly from the API alert object (`alert.type`, `alert.priority`)
- Removed `alert_photo_*` localStorage fallback in photo URL resolution (uses `alert.photoUrl` from API only)
- In `handleApiAction`: removed the mock-only branch and `force_sync` write; always calls the provided `apiCall`
- In `handleSaveChanges`: removed the `isMockOnly` branch and `force_sync` write; all updates go through `alertsApi` methods
- Removed third `simAction` argument from all `handleApiAction` call sites in the JSX

### `src/app/pages/AlertDetails.tsx` — EDITED
- Added `import { useLiveStream } from '../hooks/useLiveStream'`
- Extracted `fetchAlert` out of the `useEffect` closure so `useLiveStream` can reference it
- Removed `mock_alerts` read from localStorage and the merge/dedup in `fetchAlert`
- Removed `alert_precision_` read; `pm25`, `voc`, `confidence`, `type`, and `priority` now come directly from the API alert object (with device fallback for pm25/voc)
- Removed `alert_photo_*` localStorage fallback
- Removed the `storage` event listener
- Added `useLiveStream({ onAlert: () => fetchAlert() })` for live updates
- In `handleAcknowledge`: removed mock branch and `force_sync` write; always calls `alertsApi.acknowledge` + `alertsApi.assign`
- In `handleResponding`: removed mock branch and `force_sync` write; always calls `alertsApi.addNote` + `alertsApi.acknowledge`
- In `handleSubmitResolve`: removed mock branch and `force_sync` write; always calls `alertsApi.uploadPhoto` (via blob conversion) then the appropriate resolution API call; removed `alert_photo_*` localStorage write

---

## Legacy `src/app/pages/AdminAlerts.tsx` — DELETED

Decision: **Deleted** via `git rm`.

Reason: `grep` found no imports of `pages/AdminAlerts` or `from './AdminAlerts'` anywhere in `src/app/`. The `routes.tsx` file imports `AdminAlerts` from `./pages/admin/AdminAlerts` (the canonical admin version). This file was an unreferenced duplicate.

---

## Build Result

**PASS** — `npm run build` succeeded in 5.64s with zero errors. The only warning is the pre-existing chunk-size notice (1,232 kB JS bundle), which predates these changes.

---

## Commit Hash

`0f46656` — `refactor(frontend): remove mock-alert system from alert pages and delete demo simulate panel`

---

## Fix wave 1

### Build result

**PASS** — `npm run build` succeeded in 5.44s with zero errors. Pre-existing chunk-size warning (1,233 kB JS bundle) only; no new warnings introduced.

### Changes applied

**Fix 1 — Surface photo-upload failure (`AlertDetails.tsx` line 299):**
Replaced the silent swallow in the inner `catch` with `toast.warning('Alert resolved, but the evidence photo failed to upload — it was not saved.')`. Resolve flow continues unaffected.

**Fix 2 — Guard floating promises from `useLiveStream` callbacks (all three files):**
- `src/app/pages/admin/AdminAlerts.tsx` line 78: `fetchAlerts()` wrapped as `fetchAlerts().catch(() => {})`
- `src/app/pages/AlertDetails.tsx` line 247: `fetchAlert()` wrapped as `fetchAlert().catch(() => {})`
- `src/app/pages/admin/AdminDashboard.tsx` line 61: `loadDashboardData()` wrapped as `loadDashboardData().catch(() => {})` (was already block-syntax, added `.catch`)

All three refetch functions are `async` and return a `Promise`; the `.catch(() => {})` suppresses unhandled-rejection noise without altering visible behaviour.

### Commit hash

`7af4543` — `fix(frontend): surface photo upload failures and guard live-stream refetch promises`
