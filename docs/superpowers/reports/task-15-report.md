# Task 15 Report — Real-Data Pages: Loading / Empty / Error States + Live Updates

**Commit:** `b25ff2b`
**Branch:** `feat/iot-loop`
**Build:** Passed (pre-existing chunk-size warning only, no errors)

---

## Files Changed

### `src/app/pages/Sensors.tsx`

**Removed:**
- `SENSORS` constant (10-item hardcoded demo array)
- `battery` and `sensorHealth` random-number fallbacks (`Math.random()` calls) in the device-to-sensor mapping

**Added / Changed:**
- `Sensor.battery` and `Sensor.sensorHealth` typed as `number | null` (not always reported by hardware)
- `loading: boolean` (default `true`) and `error: string | null` (default `null`) states
- `fetchSensors` extracted as a named function so the Retry button can call it
- `finally` block in fetch sets `loading = false`; `catch` sets `error` message
- Full-screen loading spinner while `loading && sensors.length === 0`
- Full-screen error card with Retry button while `error && sensors.length === 0`
- Empty-state card ("No sensors found.") inside the sensor list when `filtered.length === 0 && !loading`
- Battery/health display now shows `"—"` when values are `null` instead of random numbers
- `criticalCount` and filter predicates guard against `null` battery

---

### `src/app/pages/admin/AdminDashboard.tsx`

**Removed:**
- `RECENT_ALERTS` constant (5-item hardcoded alert array)
- `ACTIVITY_DATA` constant (hardcoded Mon–Fri bar chart data)
- `localStorage.getItem('mock_alerts')` merge logic
- `window.addEventListener('storage', ...)` / `handleStorage` listener for `mock_alerts` / `force_sync`
- All `alerts.length > 0 ? realValue : hardcodedFallback` patterns in count displays
- 5000 ms polling interval

**Added / Changed:**
- Imports: `useCallback`, `useLiveStream`, `AlertTriangle` from lucide
- `loading: boolean` (default `true`) and `error: string | null` states
- `loadDashboardData` wrapped in `useCallback` so it is stable across renders
- `finally` sets `loading = false`; `catch` sets `error`
- Full-screen loading spinner before first load
- Full-screen error card with Retry button when error and no data
- Polling raised to **30 000 ms**
- `useLiveStream({ onAlert: () => loadDashboardData() })` for live push updates
- Chart area: `hasChartData` flag; when no data, renders "No data yet" empty-state instead of fake bars
- Recent Alerts table: empty row ("No alerts yet.") when `alerts.length === 0`; no longer falls back to `RECENT_ALERTS`
- PM2.5 / VOC columns show `"—"` when no reading available on a device
- Top Responder shows `"—"` when no data instead of hardcoded `'Admin'`
- All counts (`Active`, `New`, `Resolved`, `Total`, devices, users) computed directly from fetched arrays with no hardcoded fallbacks

---

### `src/app/pages/Analytics.tsx`

**Removed:**
- `localStorage.getItem('mock_alerts')` merge and `Map` dedup logic
- `|| 1` fake vapeCount fallback and hardcoded `34`/`446`/`55`/`18` fallbacks in `avgPM25`, `avgVOC`, `maxPM25`, `minPM25`
- `Math.random()` in `airQualityData` construction
- 5000 ms polling interval

**Added / Changed:**
- Imports: `useCallback`, `useLiveStream`
- `loading: boolean` (default `true`) state
- `fetchData` wrapped in `useCallback`; `finally` sets `loading = false`
- Full-screen loading spinner while loading
- `hasData` flag (`alerts.length > 0 || devices.length > 0`)
- Empty-state banner in Main Analytics tab when `!hasData`
- Incident Trends chart replaced with "No data yet" placeholder when `!hasData`
- `avgPM25`, `avgVOC`, `minPM25`, `maxPM25` typed `number | null`; displayed as `"—"` when null
- `airQualityData` uses `avgPM25 ?? 0` / `avgVOC ?? 0` — no randomness
- Polling raised to **30 000 ms**
- `useLiveStream({ onAlert: () => fetchData() })` for live push updates

---

## Verification

| Check | Result |
|-------|--------|
| `npm run build` | Passed (1 pre-existing chunk-size warning) |
| `grep SENSORS\|RECENT_ALERTS\|ACTIVITY_DATA\|mock_alerts` | No output (all removed) |
| `grep useLiveStream\|loading\|error` in Admin/Analytics | Present in both |
| `grep 30000` in Admin/Analytics | Present in both |
| Only 3 files staged | Confirmed (`Login.tsx` not staged) |

---

## Fix wave 1

**Commit:** `1215ff2`
**Branch:** `feat/iot-loop`
**Build:** Passed (pre-existing chunk-size warning only, no errors)

### What was derived / changed

#### `src/app/pages/admin/AdminDashboard.tsx`

- **Average Uptime tile** (was `93.8%`): now computed as `devices.length ? Math.round((devices.filter(d => d.status === 'online').length / devices.length) * 1000) / 10 + '%' : '—'` — percentage of `devices` array with `status === 'online'`.
- **Low Battery tile** (was `4`): now `devices.filter(d => (d.battery ?? 100) < 20).length` — count of devices with battery below 20%, defaulting to 100 (no flag) when field is absent.
- **Weak Signal tile** (was `2`): now `devices.filter(d => (d.signalStrength ?? 100) < 50).length` — count of devices with signal strength below 50, defaulting to 100 when absent.
- **Latest Reading tile** (was `2 min` / `Sensor S-12`): replaced with `—` / `No timestamp available` — no reliable last-reading timestamp is surfaced by the API.
- **Avg Response Time** (was `3.5m`): replaced with `—` — no response-timing data available.
- **PM2.5 / VOC color guards**: conditions changed from `pm25 > 35` / `voc > 0.60` to `typeof pm25 === 'number' && pm25 > 35` / `typeof voc === 'number' && voc > 0.60` to prevent coercion when values are `'—'`.

#### `src/app/pages/Sensors.tsx`

- `fetchSensors` wrapped in `useCallback(async () => { ... }, [])` and `useCallback` added to the `react` import. Call sites (mount effect, Retry button) unchanged.

### Verification

| Check | Result |
|-------|--------|
| `npm run build` | Passed (1 pre-existing chunk-size warning) |
| `grep "93.8%\|3.5m\|Sensor S-12"` in AdminDashboard | No output |
| `grep "useCallback"` in Sensors.tsx | Present (lines 1, 63) |
| `grep "typeof pm25\|typeof voc"` in AdminDashboard | Present (lines 314–315) |

### Concerns

None. All four fixes were straightforward substitutions. The `devices` array variable name matched the expected `devices` (fetched via `devicesApi.getAll()`). The `signalStrength` field name used in the Weak Signal tile should be verified against actual API responses when hardware is connected — if the field is named differently (e.g., `signal`), the count will always be `0`.
