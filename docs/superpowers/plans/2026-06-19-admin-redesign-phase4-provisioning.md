# Admin Redesign — Phase 4 (Device Provisioning P0) Implementation Plan

> Use superpowers:executing-plans. Adds the hardware-onboarding bridge.

**Goal:** Let an admin provision a real ESP32: Add device → `devicesApi.create` → show the one-time API key + ESP32 setup instructions; and rework the Devices list onto real `Device` data.

**Architecture:** New `DeviceProvisioningDialog` (shadcn `Dialog`, two steps: form → key) under `components/admin/`. Rewrite `pages/admin/AdminDevices.tsx` as a clean list driven by `devicesApi.getAll()` + Phase 1 components, replacing the 940-line fabricated version (synthetic building/gateway/detection-state fields, hardcoded filters, `createPortal` modals). No backend change — `POST /api/devices` (returns apiKey once) and rotate-key already exist; rotate-key already lives on AdminDeviceDetail.

## Global Constraints
- Node 22.5+, `@`→`src`, build+test gate, commit on `main`.
- Honesty: real data only; loading/empty/error via `AsyncBoundary`; threshold coloring via `lib/thresholds` (no inline magic numbers); typed `devicesApi` (no `as any`); CSV via `lib/csv`.
- Per-device threshold *tuning* of existing devices is Phase 5 — but the create form may set initial thresholds (the backend accepts them).

## Verified API (`services/api.ts`)
- `devicesApi.getAll(): Device[]`
- `devicesApi.create({ name, location?, floor?, pm25Threshold?, vocThreshold? }): Device & { apiKey: string }` — apiKey returned ONCE.
- `Device`: id, name, location, floor, status('online'|'offline'|'warning'), pm25, voc, battery, signalStrength, firmware, lastSeen, …

---

### Task 1: `DeviceProvisioningDialog` component
**Files:** Create `frontend/src/app/components/admin/DeviceProvisioningDialog.tsx`

**Interface:** `<DeviceProvisioningDialog onCreated={() => void} />` — renders its own "Add device" trigger button; calls `onCreated` after a successful create (to refresh the list).

Behavior:
- Step `form`: inputs name* (required), location, floor, optional pm25Threshold / vocThreshold (numbers). Validate name non-empty. Submit → `devicesApi.create(payload)` (typed payload, omit empty fields). On error, show message inline. On success → step `key` + call `onCreated()`.
- Step `key`: show new device id + the **one-time API key** with reveal/hide toggle, a Copy button (`navigator.clipboard` + toast), a clear "shown once — store it now" warning, and an ESP32 setup snippet (`X-Device-Key: <key>` header; `POST /api/ingest/readings`). "Done" closes the dialog.
- Closing resets to step `form` and clears state.

- [ ] Implement component. `npm run build` → succeeds. Commit: `feat: add device provisioning dialog (one-time API key + ESP32 setup)`.

### Task 2: Rewrite `AdminDevices` list
**Files:** Rewrite `frontend/src/app/pages/admin/AdminDevices.tsx`

Data: `devicesApi.getAll()` on mount + 30s poll; `AsyncBoundary` for first load.
Layout:
- `PageHeader` "Devices", subtitle `${devices.length} sensors`, actions: Export CSV (`downloadCsv` of filtered rows) + `<DeviceProvisioningDialog onCreated={load} />`.
- KPI row (6 `MetricCard`): total, online (success), offline (danger), warning (warning), low battery (<20%), weak signal (<50).
- Toolbar: search Input (id/name/location) + status Select (all/online/offline/warning) + floor Select (derived from data, not hardcoded).
- Table of filtered devices: Device (id + name), Location (floor — location), Status (`StatusBadge` via `deviceStatus`), PM2.5 (colored by `classifyReading` vs `effectivePm25Threshold(d)`), VOC, Battery %, Signal %, Last seen. Row click → `navigate('/admin/devices/' + d.id)`. Empty-filter note when no rows match.
- Drop all synthetic fields, the 6 hardcoded filters, groupBy, and `createPortal` modals.

- [ ] Rewrite. `npm run build` + `npm test` → pass. Commit: `feat: rework devices list on real data + wire provisioning dialog`.

## Self-Review
- Provisioning wizard + one-time key + ESP32 note → Task 1 ✓
- Devices list real-data rework (KPIs, derived filters, threshold coloring, CSV, async states) → Task 2 ✓
- Rotate-key: already on AdminDeviceDetail (no change needed) ✓
- Per-device threshold tuning of existing devices: deferred to Phase 5 (intentional).
