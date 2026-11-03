# Admin Redesign — Phase 5 (Threshold Tuning + Live Feed P1) Implementation Plan

> Use superpowers:executing-plans.

**Goal:** (1) Let admins tune each device's PM2.5/VOC detection thresholds; (2) show a real-time SSE detection feed on the Dashboard.

**Architecture:** Whitelist the device `PUT` (backend) so threshold writes are safe. Add a `DeviceThresholdsDialog` (shadcn) reachable from the Devices list. Add an SSE-driven live feed to the Dashboard using the existing `useLiveStream` hook, seeded from the initial alerts fetch and prepended on each streamed alert.

## Global Constraints
- Node 22.5+, `@`→`src`, build+test gate, commit on `main`.
- Honesty: breach reason derived from real `pm25`/`voc` vs thresholds (`lib/thresholds`); typed clients; no fabricated values.

---

### Task 1: Backend — whitelist `PUT /api/devices/:id`
**Files:** Modify `backend/routes/devices.js`
- [ ] Replace the blind `{ apiKey, id, ...patch }` merge with an explicit whitelist of updatable columns: `name, location, floor, status, pm25, voc, temperature, humidity, lastUpdate, lastSeen, responseTime, signalStrength, battery, firmware, powerStatus, networkSignal, issue, pm25Threshold, vocThreshold`. Pick only keys present in the body; ignore everything else (`apiKey`/`id`/`updatedAt` excluded — `updatedAt` is auto-stamped by `store.update`).
- [ ] Smoke test: boot backend, login as admin, `PUT` a device with `pm25Threshold` + a stray field, `GET` it back → threshold persisted, stray ignored, 200 (not 500). Stop backend.
- [ ] Commit: `fix(api): whitelist device PUT columns to safely persist thresholds`.

### Task 2: `DeviceThresholdsDialog` + wire into Devices list
**Files:** Create `frontend/src/app/components/admin/DeviceThresholdsDialog.tsx`; modify `frontend/src/app/pages/admin/AdminDevices.tsx`
- [ ] Dialog props `{ device: Device; onSaved: () => void }`; trigger is a per-row "tune thresholds" icon button (`SlidersHorizontal`) with `stopPropagation` so the row doesn't navigate. On open, seed inputs from `device.pm25Threshold`/`vocThreshold` (blank = using default). Show the effective value + whether default or custom. Validate positive numbers. Save → `devicesApi.update(device.id, { pm25Threshold, vocThreshold })` (blank → `null` = reset to default). Toast + `onSaved()` + close.
- [ ] AdminDevices: add an "Actions" column cell rendering `<DeviceThresholdsDialog device={d} onSaved={load} />` (cell `stopPropagation`). Add `pm25Threshold`/`vocThreshold` columns to the CSV export.
- [ ] `npm run build` + `npm test` → pass. Commit: `feat: per-device threshold tuning dialog`.

### Task 3: Dashboard live detection feed (SSE)
**Files:** Modify `frontend/src/app/pages/admin/AdminDashboard.tsx`
- [ ] Add `LiveDetection` type + `toDetection(alert)` (breach computed via `classifyReading` vs `DEFAULT_PM25_THRESHOLD`/`DEFAULT_VOC_THRESHOLD`: `'pm25'|'voc'|'both'|'none'`). Parent holds `liveFeed` state, seeded once from the first alerts fetch (newest first, ~8). `useLiveStream.onAlert` prepends the mapped detection (dedupe by id, cap 8) AND reloads data.
- [ ] Replace the "Recent alerts" panel with a "Live detections" panel: a small pulsing "Live" indicator, each item = colored dot (red if breach) + location + `PM2.5 x · VOC y` + breach reason ("PM2.5 over threshold" / "VOC elevated" / "cleared") + time; click → `/admin/alerts` with `alertId`. Empty state when no detections.
- [ ] `npm run build` + `npm test` → pass. Commit: `feat: SSE-driven live detection feed on admin dashboard`.

## Self-Review
- PUT whitelist (enables safe threshold writes) → Task 1 ✓
- Per-device threshold tuning UI → Task 2 ✓
- SSE live detection feed with breach reason → Task 3 ✓
