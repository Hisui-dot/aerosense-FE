# AeroSense Admin Console — UI/UX Redesign Design Spec

- **Date:** 2026-06-19
- **Status:** Scope approved by owner; pending spec review before planning
- **Scope owner decisions:** Real small deployment (real ESP32 nodes). Cut QoS + Network, merge Profile, strip Settings. Build all four new features (2× P0, 2× P1). Theme: "polish current brand."
- **Audit basis:** 14-agent page/backend/nav audit (run 2026-06-19). Backend facts re-verified firsthand against `routes/devices.js`, `routes/analytics.js`, `db/migrations.js`.

---

## 1. Problem

The admin console's problem is **not styling — it is fabricated data**. Roughly half of every admin page is hardcoded fiction: all-green "System Health" badges that stay green when the backend is down, invented audit timestamps (`createdAt + 60s`), fallback KPIs (`18/20 devices`, `124 alerts`), faked temperature/humidity (`|| 22`, `|| 45`), and action handlers that `.catch(() => {})` then toast success even on a 404.

Meanwhile the backend already exposes richer, real data that **no page consumes**:

- The four `analyticsApi` endpoints (`summary`, `weekly`, `reports`, `qos`) — the only real server-side aggregation — are **100% dead from the UI**.
- `sensor_readings` (per-minute PM2.5/VOC/temp/humidity) is charted only on one device-detail page; temp/humidity nowhere.
- Device provisioning (`POST /api/devices` → one-time API key) exists but is never called, so a real ESP32 cannot be onboarded from the dashboard.

For a real deployment, the redesign = **delete the fake, surface what is already real, build the one missing hardware bridge, and unify the visual language.**

## 2. Goals & non-goals

**Goals**
- Every displayed value traces to a real API field, or it does not render. Explicit loading / empty / error states on every data surface.
- Shrink the admin tree from ~11 pages to a coherent **7**: Dashboard · Alerts · Devices · Analytics · Users · Logs · Settings (Profile via avatar menu).
- Ship two P0s (device provisioning, air-quality analytics) and two P1s (live detection feed, per-device threshold tuning).
- One coherent, professional design system on the existing brand (navy sidebar + AeroSense blue), built on shadcn + Recharts + lucide, with semantic status colors.

**Non-goals (explicitly out of scope — do NOT build, and remove fake toggles that imply them)**
- MQTT broker, LoRaWAN/Zigbee/BLE protocols, gateway NOC metrics, packet-loss/latency telemetry.
- Two-factor auth, granular RBAC/permission matrices, password-reset email flow.
- Email/SMS notification delivery.
- Rewriting the security (guard) console. Touch security pages only where a page is explicitly merged (Profile) or where shared components are extracted.

## 3. Design principles

1. **Honest data only.** A number renders only if it comes from the API. No fabricated fallbacks. No success toast on a failed call — surface the error.
2. **Three explicit states everywhere.** Every data view distinguishes loading, empty, and error. A dead backend must look different from a healthy-but-empty system.
3. **One design system.** Design tokens instead of raw hex (`#EEF2FE`, `#82BCFE`, …). shadcn `Dialog`/primitives instead of hand-rolled `createPortal` modals. **Recharts** for every chart (no div-width bars). lucide icons, never emoji. Two font weights, sentence case.
4. **Semantic status colors, used consistently.** green = online/normal, amber = warning/degraded, red = critical/offline/over-threshold. The same language for device status, alert severity, and threshold breaches.
5. **Threshold-aware.** The active detection threshold is drawn on air-quality charts and shown next to readings, so "why did it fire" is always visible. Thresholds come from device config / settings, never inline magic numbers.

## 4. Theme & design system ("polish current brand")

Keep the current identity, make it consistent:

- **Palette → tokens.** Define a single token set (CSS variables + a Tailwind theme extension) for: brand navy `#0B1847` (sidebar), brand blue `#1B44CC`/`#2665D0` (accent), surface/page (`#EEF2FE` → `--surface`), and semantic `success`/`warning`/`danger`/`info`. Replace raw hex literals across admin pages with tokens. Single source of truth in one module (e.g. `src/app/theme/tokens.ts` + Tailwind config), so dark mode / rebrand stays possible.
- **Components.** Standardize on the existing shadcn/Radix `Dialog`, `Select`, `Badge`, `Button`, `Tabs`, `Table` primitives already in the repo. Remove hand-rolled portal modals (focus trap, Esc, aria come for free).
- **Charts.** Recharts (already a dependency) for all charts: line/area for time series with a `ReferenceLine` at the threshold, bar for weekday/peak-time.
- **Status vocabulary.** One `StatusBadge` + status→color map shared by devices, alerts, and logs.
- **Icons.** lucide only; delete decorative emoji (📜 ⚙️ 🟢) used as functional indicators.
- **Density & hierarchy.** KPI row → primary visualization → supporting panels. Consistent card component, spacing scale, and a single page-header pattern.

## 5. Information architecture

### Admin nav — before → after

| Current sidebar (`AdminSidebar.MAIN_NAV`) | After |
|---|---|
| Dashboard | Dashboard |
| Alerts | Alerts |
| Devices | Devices |
| Users | Users |
| Logs | Logs |
| Reports | **Analytics** (renamed; wires `analyticsApi`) |
| Profile | → moved to avatar dropdown |
| — | **Settings** (re-added; trimmed) |

Orphaned routes `/admin/qos`, `/admin/network` are **removed** (route + component). `/admin/settings` is **re-linked** (was orphaned). `/admin/profile` route stays but renders the shared role-aware Profile.

### Page disposition

| Page | Disposition | Notes |
|---|---|---|
| AdminDashboard | **Rework** | Honest KPIs; air-quality trend (Recharts + threshold line); high-risk areas; live detection feed; honest fleet-health strip (absorbs Network's one real signal). Delete fake "System Health" card + dead placeholder metrics. |
| AdminAlerts | **Rework** | Stop fabricating ack/respond timestamps; persist every field the Edit modal shows or remove it; real `acknowledged` state; Blob CSV; typed client. |
| AdminDevices | **Rework + extend** | Drop synthetic fields (building, gateway, sampling/detection window) or wire them; add **provisioning wizard** (P0) and **per-device threshold tuning** (P1). |
| AdminDeviceDetail | **Rework** | Remove mock initial device + static green reading badges + fake firmware timer; compute reading status from real thresholds; honest action results. Consolidate with the Devices detail modal. |
| AdminAnalytics (was AdminReports) | **Rework → P0** | Drive entirely from `analyticsApi.reports/weekly/qos`. Real trend, high-risk areas, peak hours, per-device & per-officer effectiveness, system avg PM2.5/VOC. Export = Blob CSV (+ optional print). |
| AdminUsers | **Trim** | Keep real CRUD (name, username, email, contact, role, status, password). Remove fake assigned-area/last-login/permissions/metrics/2FA-roles and the no-op password-reset. |
| AdminLogs | **Rework** | Render real `/api/logs` as source of truth (stop overwriting with alert-derived rows); real "today" count; drop empty network category; surface admin `clear logs`; Blob CSV; shared Dialog. |
| AdminSettings | **Strip** | Keep only what the backend reads: detection thresholds (PM2.5/VOC/sensitivity) + log retention/clear. Remove ~35 write-only toggles and the fake "Restart System" button. |
| AdminProfile | **Merge** | One role-aware `Profile`. Drop fake 2FA/session-timeout rows. Harden change-password (current+new+confirm, validation, typed call). |
| AdminQoS | **Cut** | Delete route + component. |
| AdminNetwork | **Cut** | Delete route + component; one honest health strip survives on the Dashboard. |

## 6. Component foundation (build first — small, shared, reused)

Create a small set of focused building blocks so pages stay thin and consistent (per the repo's small-files / typed-public-API conventions):

- `theme/tokens.ts` (+ Tailwind theme) — color/spacing tokens.
- `components/admin/PageHeader.tsx` — title + subtitle + actions slot.
- `components/admin/MetricCard.tsx` — label, value, sub, optional status color. Renders nothing/`—`-free when value absent.
- `components/admin/StatusBadge.tsx` + `lib/status.ts` — status→color/label map shared by device/alert/log.
- `components/admin/AsyncBoundary.tsx` (or `useAsync` hook) — standard loading/empty/error rendering so no page hand-rolls it.
- `components/admin/ChartCard.tsx` — card wrapper for Recharts with title + legend.
- `lib/csv.ts` — Blob-based CSV with proper escaping (replaces all `data:` URI string-concat exports).
- `lib/thresholds.ts` — resolve effective threshold (device → settings → default) + reading-status classification (normal/warning/critical). Removes inline `pm25>35`/`voc>0.60` magic numbers and fixes ppb/ppm unit inconsistency (define units once).

## 7. Page-by-page design

### 7.1 Shell / navigation
- `AdminSidebar.MAIN_NAV` → Dashboard, Alerts, Devices, Analytics, Users, Logs, Settings. Remove the unused `ShieldCheck` import. Profile/Sign-out via the existing top-bar avatar dropdown.
- Delete `AdminQoS`/`AdminNetwork` imports and routes from `routes.tsx`; remove the stale `/admin/qos` entry from `AdminLayout.PAGE_TITLES`; add `/admin/analytics`.

### 7.2 Dashboard (rework)
- **KPI row (4 cards), all real — each labeled to match its data's actual scope:**
  - Active alerts → `analyticsApi.summary.alerts.active` (responding sub-count derived from `/alerts`).
  - Sensors online → `summary.devices.online`/`.total` + `.offline`.
  - Detections today → `analyticsApi.qos.summaryMetrics["Alerts Today"]` (genuinely today-scoped).
  - Avg PM2.5 → `analyticsApi.reports.airQuality.avgPm25` (this is the **all-readings** average; label it accordingly, e.g. "Avg PM2.5 (recent)", NOT "today", unless we add the §8.2 today-bucketed endpoint). Show the threshold beside it.
  - Hard rule: no KPI label may claim a time scope the data doesn't have. If a desired scope isn't available, relabel or omit — never fabricate.
- **Air quality — last 24h:** Recharts area/line of PM2.5 (and VOC toggle) from aggregated `sensor_readings`, with a `ReferenceLine` at the threshold. (Backend: see §8 note on an aggregate-readings endpoint; until then, derive from `analyticsApi.qos.performanceData` which already returns a recent PM2.5 series.)
- **High-risk areas:** from `analyticsApi.reports.highRiskAreas` (location + incidents + %).
- **Live detection feed:** SSE via existing `useLiveStream`; each item shows location, PM2.5/VOC, and which threshold was breached (from alert `pm25`/`voc` + `source`/log `metadata`).
- **Fleet health strip (honest):** online/offline/warning device counts + active alerts. This is the *only* real signal salvaged from Network/QoS. No gateway/MQTT/DB cards.
- **Remove:** "System Health" card, "Avg Response Time" + "Latest Reading" placeholder metrics, hand-rolled weekday bars (replace with Recharts from `analyticsApi.weekly`).

### 7.3 Devices + provisioning + thresholds
- **List:** real columns only (status, PM2.5, VOC, battery, signal, last reading). Drop synthetic building/gateway/detection-state. Loading/empty/error states. Filters derived from actual data, not hardcoded lists. Typed `devicesApi` (no `as any`).
- **Provisioning wizard (P0):** "Add device" → form (name, location, floor, optional thresholds) → `devicesApi.create` → success screen showing the **one-time API key** (copy button, "store it now" warning) + short ESP32 setup note (set `x-device-key`, POST to `/api/ingest/readings`). Rotate-key available from device detail.
- **Per-device threshold tuning (P1):** device detail/modify form exposes `pm25Threshold`/`vocThreshold` (and effective fallback shown when null). Saves via `devicesApi.update` (real columns). Backend: add field whitelist (§8).
- **Device detail (rework):** no mock seed device; reading status badges computed via `lib/thresholds`; remove fake firmware timer; action handlers surface real success/failure. Consolidate the list's detail modal and the full detail page into one drill-down.

### 7.4 Analytics (P0 — was Reports)
- Single page driven by `analyticsApi`: `weekly` (detection trend), `reports` (high-risk areas, peak hours, device performance, user activity, system avg PM2.5/VOC), `qos` (recent PM2.5 series, active issues). All Recharts.
- Honesty: fields the backend returns as placeholders (`avgResponseTime: '—'`, `summary.performance.uptime: '99.7%'`) are **computed if feasible, else omitted** — never shown as if real. Add loading/empty/error.
- Export: Blob CSV via `lib/csv`. Drop the iframe `window.print` "PDF" theater (optional real print stylesheet later).

### 7.5 Alerts (rework)
- Map backend statuses faithfully (ACTIVE / ACKNOWLEDGED / RESPONDING / ESCALATED / RESOLVED / FALSE_ALARM); no synthesized ack/respond timestamps — show real event times from logs or omit.
- Edit modal: persist **every** field shown, or remove fields with no endpoint (priority/finalStatus/result). Keep `reasonForEdit` only if stored as a note. Typed `alertsApi`. Blob CSV export.
- Note: `escalate` only logs (doesn't change status) — either reflect that honestly or add status change in backend (small; see §8, optional).

### 7.6 Users (trim)
- Real CRUD only. Remove assigned-area, last-login, permissions, user-level, performance-metrics block, the `Network Administrator`/`Incident Responder` phantom roles, and the no-op "Reset Password" (or wire a real admin set-password via existing `PUT /users/:id` with confirm). Validate role on create. Typed client. Blob CSV.

### 7.7 Logs (rework)
- `/api/logs` is the source of truth; stop discarding real alert-category rows and substituting alert records. Use the endpoint's server-side `type`/`severity`/`search` filters. Real "today" count. Remove the always-empty network category. Surface admin **Clear logs** (`logsApi.clear`) with a confirm Dialog. Blob CSV. Shared Dialog for detail.

### 7.8 Settings (strip to real)
- Keep: detection thresholds (PM2.5, VOC, sensitivity, `requireBothSensors`) and log retention + Clear logs. These map to firmware/ingest behavior and the real `settings` store.
- Remove: 2FA, password policy, session timeout, role-based-access, auto-backup, firmware auto-update, auto-calibration, email/mobile push, retry logic, timezone, protocol select (LoRaWAN/Zigbee/BLE), "Restart System" button, "Last Sync"/"External System Link" static widgets.
- Add a dirty-state indicator + validation (no negative/zero thresholds). Resolve duplicate-source-of-truth with the security `Settings.tsx` (one writes, or they share defaults from one module).

### 7.9 Profile (merge)
- One role-aware `Profile` component used by both `/profile` and `/admin/profile`. Real fields from the authenticated user / `GET /api/users/:id`. Drop fake 2FA + session-timeout rows. Change-password: current + new + confirm, length/strength validation, typed call.

## 8. Backend changes (minimal, enumerated)

Most features need **no** backend change. The few that help:

1. **Whitelist `PUT /api/devices/:id`** (robustness + enables threshold tuning safely): accept only known device columns (incl. `pm25Threshold`, `vocThreshold`); ignore unknown keys instead of letting `store.update` 500 on a stray column. _Required for P1._
2. **(Optional) Aggregate readings endpoint** for the Dashboard 24h chart, e.g. `GET /api/analytics/readings?window=24h&bucket=1h` returning bucketed avg PM2.5/VOC. _Nice-to-have;_ until then reuse `analyticsApi.qos.performanceData` (recent PM2.5 series) + per-device `readings`.
3. **(Optional) `escalate` status change** — make `PUT /alerts/:id/escalate` set `status='ESCALATED'` so the frontend union isn't dead. Small; only if Alerts rework needs it.
4. **(Optional) `alertsApi.create`** client method for `POST /api/alerts` if we expose manual alert creation. Defer unless desired.

No schema migrations required (threshold/reading columns already exist).

## 9. Cross-cutting fixes (apply during each page's rework)
- Replace `(devicesApi as any)` / `(alertsApi as any)` / `any[]` with the typed clients and exported interfaces in `services/api.ts`.
- Remove `.catch(() => {})`-then-toast-success patterns; show real outcomes.
- Replace `data:` URI string-concat CSV with `lib/csv` (Blob + escaping).
- Replace hand-rolled `createPortal` modals with shadcn `Dialog`.
- Centralize thresholds + units (`lib/thresholds`); fix ppb/ppm inconsistency.
- Files over the repo's 800-line guideline (e.g. AdminAlerts 908, AdminSettings 859) get split as part of their rework.

## 10. Verification strategy

The project has **no test runner, linter, or formatter** configured, and `tsconfig` is `strict: false`. Pragmatic approach for a capstone:

- **Pure logic:** add **Vitest** (dev-only) and unit-test the new pure modules — `lib/thresholds` (effective threshold + reading classification), `lib/csv` (escaping), and any analytics formatting. These are the bug-prone, easily-tested pieces. Target meaningful coverage of these utilities (not the whole UI).
- **Type safety:** run `tsc --noEmit` (or `vite build`) as a gate after each phase. Tighten new code by hand (explicit types on exported APIs) even though the compiler is lax.
- **Manual/preview verification:** run frontend (`npm run dev`) + backend (`npm run dev:backend`) and verify each reworked page against real seeded data and an intentionally-stopped backend (to confirm error states, not fake green). Use the `/run` app-launch flow.
- **Honest-data check per page:** grep the page for hardcoded literals after rework — every number must originate from an API field.

This deviates from the global "80% coverage / full TDD" rule because the repo has no harness; we add just enough (Vitest for pure logic) to be responsible without over-building. Flag to owner in spec review.

## 11. Build phases (sequencing for implementation)

1. **Foundation:** tokens + Tailwind theme; shared components (`PageHeader`, `MetricCard`, `StatusBadge`/`lib/status`, `AsyncBoundary`, `ChartCard`, `lib/csv`, `lib/thresholds`); Vitest setup + tests for `lib/*`.
2. **Cuts + nav:** remove QoS/Network (routes + components), re-link Settings, rename Reports→Analytics, move Profile to avatar menu, fix `PAGE_TITLES`.
3. **P0 — Analytics dashboard:** wire `analyticsApi` into the new Analytics page + Dashboard KPIs/charts/high-risk/fleet-health. Delete Dashboard fakes.
4. **P0 — Device provisioning:** wizard + one-time key screen + rotate-key; Devices list rework.
5. **P1 — Thresholds + live feed:** PUT whitelist (backend); per-device threshold tuning; SSE live detection feed on Dashboard.
6. **Honesty reworks:** Alerts, Users, Logs, Settings strip, Profile merge, Device detail.
7. **Polish + verify:** error/empty states audit, type-cast cleanup, build gate, manual preview pass.

Each phase ends green (`tsc`/build passes) and is independently demoable.

## 12. Risks
- **Scope is large for one session.** Phasing (above) makes it incremental and demoable; we can stop after any phase with a working app. Owner wants to start building this session — we proceed phase by phase, not big-bang.
- **Two parallel "sensor" models** (`sensors` ids `S-0x` vs `devices` ids `S00x`). The redesign standardizes the admin console on `devices` (what alerts/readings reference); the `sensors` maintenance catalog is left as-is (security side) to avoid scope creep.
- **Security console untouched** except shared-component extraction + Profile merge; we avoid regressing the guard flow.
```
