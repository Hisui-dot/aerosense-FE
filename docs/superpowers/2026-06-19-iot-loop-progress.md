# AeroSense IoT Loop — Progress Ledger

Repo: `C:\Capstone_Vape\Vape` (branch `feat/iot-loop`, from `main`).
Plan: `docs/superpowers/plans/2026-06-19-aerosense-iot-loop.md` (18 tasks).
Pre-existing uncommitted change to leave untouched: `src/app/pages/Login.tsx`.

## Status

- [x] Task 1 — Migration runner + sensor_readings + columns
- [x] Task 2 — Wire migrations into store + updatedAt + recentReadings
- [x] Task 3 — Seed API keys + historical readings  ✅ PHASE 1 (DB) COMPLETE
- [x] Task 4 — zod + ingestion validation schema
- [x] Task 5 — API-key generator + deviceAuth middleware
- [x] Task 6 — Detection service (threshold + debounce)
- [x] Task 7 — SSE event bus + stream route
- [x] Task 8 — Ingestion endpoint with auto-detection
- [x] Task 9 — Device key management + readings endpoint
- [x] Task 10 — Real analytics
- [x] Task 11 — Backend test runner script  ✅ PHASE 2 (BACKEND) COMPLETE (17 tests pass)
- [x] Task 12 — API client: readings/SSE/typed analytics/keys
- [x] Task 13 — useLiveStream hook
- [x] Task 14 — Live Dashboard/Alerts + remove mock merge
- [x] Task 18b (ADDED) — Mock system FULLY removed (A: alert pages + delete AdminSimulate/legacy; B: 8 peripheral readers). Verified: ZERO mock tokens in src/app. PHASE 3 (FRONTEND) COMPLETE.
- [x] Task 15 — Remove hardcoded fallbacks + loading/error states
- [x] Task 16 — Readings charts on detail pages
- [x] Task 17 — Admin device API-key UI
- [x] Task 18 — Telemetry simulator script

## Log
Task 1: complete (commits f26fbe9..604fd1d, review clean). Plan-bug fixed by implementer: alert indexes moved after ensureColumn. Minor follow-ups for final review: add index-existence test; identifier interpolation matches existing store.js convention (accepted).
Task 2: complete (commit 1f50078, review clean). Minors: SELECT * in recentReadings (spec-mandated, fine at scale); TABLES_WITH_UPDATED_AT placement (style).
Task 3: complete (commit 158bbc8, review clean). Implementer also fixed alerts positional insert (plan gap) — verified correct. Fresh DB verified: devices 7, alerts 5, readings 24/device, keys ok. PHASE 1 DONE.
Task 4: complete (commit d7d78d0, review clean). zod 3.25.76, 4/4 tests. Suggestion (not required): add upper bounds on pm25/voc/temperature for final-review consideration.
Task 5: complete (commit 8a7394d, review clean — security approved). CARRY FORWARD TO TASK 8: (a) Important — add express-rate-limit on /api/ingest route; (b) Minor — guard duplicate X-Device-Key header (Array.isArray -> raw[0]) in deviceAuth.js. Implementer's "no apiKey column" concern refuted (column exists+populated).
Task 6: complete (commit 8aed742, review clean). 8/8 tests. Minors for final review: add boundary tests (pm25=35, voc=0.6), JSDoc on exported fns.
Task 7: complete (commit 012b40a, review clean). Full SSE verified. Important(accepted): JWT in ?token= query is the EventSource limitation — fine for LAN/short JWT; optional stream-ticket mitigation for prod. Minor: SSE fan-out (Set of res) if many clients.
Task 8: complete (commits 36b0c7d impl + 96eb521 fix, re-review clean). Full pipeline verified: 401/400/normal/auto-alert/debounce. Fix wave 1: try/catch generic-500 + recordedAt future-skew clamp. Minors for final/prod: app.set('trust proxy') if behind proxy; debounce cooldown currently counts resolved auto-alerts (matches spec literally). NOTE: test data accumulated in vape.db for S001 — reseed before final demo.
Task 9: complete (commits dc22820 impl + 276d8bf fix, re-review clean). CRITICAL caught+fixed: GET /devices leaked apiKey to security role — now admin-only. Also fixed: negative-limit unbounded read, client-supplied device id, PUT apiKey overwrite. NOTE: junk test devices (Test Node/X/HACKED) added to vape.db during verification — reseed before final demo.
Task 10: complete (commits 5b1a02f impl + 3996bda fix, re-review clean). Fixed plan gap: detectionTrend was hardcoded count:0 — now real via shared weeklyAlertCounts() helper. Deduped scans, documented qos perf field. Minor: /reports double-scans alerts (helper+inline) — trivial.
Task 11: complete (commit 0c7990c). `npm test` = 17 pass / 0 fail. PHASE 2 (BACKEND) DONE.
Baseline frontend build: PASS (vite 5.68s, only pre-existing chunk-size warning).
Task 12: complete (commits 03a730f impl + 96d13ef fix). SSE/readings/typed-analytics/key clients. Fix: crash-safe SSE JSON.parse + removed non-null assertions. Minor for final: devicesApi.update Partial<Device> now permits apiKey in payload (backend strips it).
Task 13: complete (commit 8c6f22f). useLiveStream hook (ref pattern, subscribe-once). Build clean.
Task 14: complete (commits e9efdb8 impl + b979e4a fix). Dashboard/Alerts: mock_alerts merge + INITIAL_* fallbacks removed, useLiveStream wired (onAlert->refetch), polling 5s->30s, acknowledge always hits API. Fix: expanded Alert type with pm25/voc/deviceId/source (auto-alerts carry them at runtime), dropped any-casts. FOUND: other pages still use mock system -> added Task 18b.
Task 15: complete (commits b25ff2b impl + 1215ff2 fix, re-review clean). Sensors/AdminDashboard/Analytics: hardcoded arrays + mock merges removed, loading/empty/error states, useLiveStream + 30s polling on the two pollers. Fix: SPEC FAIL caught — derived AdminDashboard sensor-summary tiles + avg-response from real devices (or '—'), type-guarded pm25/voc coloring, useCallback. Minor for final: Analytics air-quality trend shows flat global avg (derived, coarse); Analytics no error state (acceptable).
Task 16: complete (commit 7e8d1d5, review clean). Recharts PM2.5/VOC line charts on SensorDetail + AdminDeviceDetail. Minors: inline map per render; chart not refreshed by 10s interval; no Legend.
Task 17: complete (commits dcfa92d impl + a292ae0 fix). AdminDeviceDetail API-key card (masked/reveal/copy/rotate); implementer added apiKey to loadDevice mapping (was dropped). Fix: clipboard then/catch (no false success). Minor: Zap icon reuse.
Task 18: complete (commit cc210a0, review clean). backend/scripts/simulate.js + README + npm run simulate. 10x 200, spike debounced (S001 had open alert). Minor: res.json before res.ok check.
Task 18b-A: complete (commits 0f46656 impl + 7af4543 fix, review clean). Removed mock system from admin/AdminAlerts + AlertDetails; DELETED AdminSimulate.tsx + legacy pages/AdminAlerts.tsx (-1243 net lines); useLiveStream wired. Fix: photo-upload-failure toast.warning + guarded live-stream promises. Minors (pre-existing, noted): console.error, as-any casts, ACKNOWLEDGED->resolved mapping.
Task 18b-B: complete (commit 28baa04). Removed dead mock reads from 8 peripheral files (AdminLayout, SecurityTopBar, AdminLogs, AdminNetwork, AdminQoS, AdminSettings, Logs, Profile); 2 storage listeners deleted. VERIFIED: zero mock tokens in src/app. PHASE 3 DONE.

=== FINAL VERIFICATION ===
- Backend tests: 17 pass / 0 fail.
- Frontend build: clean (vite 5.46s, only pre-existing chunk-size warning).
- Mock system: fully removed (grep zero matches).
- END-TO-END on fresh DB: 7 normal readings -> 200/no-alert; spike (pm25=80,voc=2.0) -> 200 + auto-alert (source=auto); repeat -> debounced. Detection + debounce + time-series storage all confirmed.
- Port 8001 freed after verification.

=== FINAL WHOLE-BRANCH REVIEW (opus) -> READY-WITH-FOLLOWUPS, 3 Important items fixed (commit ca75d30) ===
- Fix: added alerts.notes column (POST /alerts/:id/notes was 500ing; resolve-with-notes flow depends on it). 17/17 tests.
- Fix: seed alert ids (S-03..) now match device ids (S001..S005) + deviceId persisted -> navigation & analytics joins work on fresh DB (5/5 matching).
- Fix: removed Math.random() from AdminReports (derive from real alerts/users).
Remaining = MINOR follow-ups only (non-blocking): wire AdminReports/AdminQoS to the (already-built, typed) analytics endpoints OR leave local compute; zod numeric .max(); debounce-counts-resolved; trust-proxy/cors tighten for prod; console.error+as-any cleanup; ACKNOWLEDGED->resolved mapping comment; readings chart refresh on interval; SSE refetch debounce for high ingest; simulator res.ok check.

Accumulated MINOR findings for optional follow-up (none blocking): T1 add index-existence test; T4 numeric upper bounds in zod; T6 boundary tests/JSDoc; T8 trust-proxy for prod, debounce counts resolved auto-alerts; T16 chart not refreshed by 10s interval / no Legend; T18 res.ok check; frontend console.error + as-any casts + ACKNOWLEDGED->resolved status mapping; Analytics flat air-quality trend + no error state.
