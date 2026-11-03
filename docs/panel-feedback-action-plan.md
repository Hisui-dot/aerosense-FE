# AeroSense — Panel Feedback Action Plan

> **Source:** Capstone defense panel suggestions (2 slides, June 2026).
> **Scope:** This plan captures every panel bullet, translates the Taglish/shorthand into a concrete change, maps it to the real file(s) in this repo, and sequences the work by priority.
> **Repo root:** `C:\Capstone_Vape` — dashboard in `frontend/`, API in `backend/`.
> **Related:** `docs/superpowers/specs/2026-06-19-admin-uiux-redesign-design.md` (prior admin redesign).

---

## 0. How to read this plan

- Every panel bullet is given an ID (`P1`…`P37`) so nothing is lost. The **Traceability Table** at the end maps each ID → workstream → status.
- Items are grouped into **workstreams (A–I)** and sequenced into **3 priority waves**.
- Two kinds of items:
  - **Build** = a code change in this repo.
  - **Doc/Research** = goes into the capstone manuscript / proposal, not the codebase.
- Each build item lists the **file(s)**, the **change**, and an **acceptance check**.

---

## 1. Panel bullets, transcribed & interpreted

### Slide 1 — "suggestions/improvements"
| ID | Panel said (verbatim) | Interpretation |
|----|------------------------|----------------|
| P1 | real time notif? Consider app instead of web app lang? | Push notifications + evaluate a mobile/native app vs web-only |
| P2 | assign designated personnel per floor | Persisted per-floor personnel assignment |
| P3 | beneficiary, lawakan and secure | Broaden + secure the beneficiary framing (manuscript) |
| P4 | look for smoke-free campus (benef) | Use smoke-free-campus law/policy as a beneficiary (manuscript) |
| P5 | maintenance support (as obj then relate to study) | Add "maintenance support" as a study objective (manuscript) |
| P6 | di payag company kasi mahal? | Address cost objection / feasibility (manuscript) |
| P7 | sobra yung UI for guard | Guard/personnel UI is too heavy — simplify |
| P8 | ensure na allowed guards to use phones or look for alternatives | Confirm phone-use policy or design an alternative delivery |
| P9 | edit ui maging user friendly sa personnels | Make the personnel UI friendlier |
| P10 | cancel false acknowledge | Allow undoing/cancelling an acknowledgment |
| P11 | upload proof photo | Proof-photo upload on response (**already exists** — verify) |
| P12 | admin dashboard: change performance section (into needs or smth) | Replace fake "performance" widget with an honest "needs attention" panel |
| P13 | lifespan tsaka warranty of parts | Track part lifespan + warranty on devices |
| P14 | notif for batteries / sa dashboard | Low-battery alert/notification on dashboard |
| P15 | makita sinong guard nag aacknowledge | Show which guard acknowledged each alert |
| P16 | remove admin dashboard? personnel side should be focused on their task/job then admin side monitors their performance | Sharpen role separation: personnel = act, admin = monitor |
| P17 | redundancy and prio of info na nagddisplay sa system | Remove redundant info; prioritize what's shown |
| P18 | marketable ba yung system for its price? | Marketability / pricing analysis (manuscript) |

### Slide 2
| ID | Panel said (verbatim) | Interpretation |
|----|------------------------|----------------|
| P19 | adu nest | ~~Ignored per user (2026-06-20)~~ — dropped, do not pursue |
| P20 | ios and android devices compatible yung camera (or overall system) | Camera capture + app must work on iOS & Android |
| P21 | sensor list edit button palitan into i icon | Change Sensors "edit" button to an info "ⓘ" icon |
| P22 | user list - three dot icon palit, redundant din yung user level and permissions | Use a kebab (⋮) menu; drop redundant "level vs permissions" |
| P23 | user levels - usually 3 bukod sa admins and personnel | Support ≥3 user levels beyond admin/personnel |
| P24 | logs page - pagination(??) by 10 ideally | Paginate logs, ~10 per page |
| P25 | colors ng statuses | Audit/standardize status colors |
| P26 | reports page - coverage date | Add coverage-date range to reports |
| P27 | reports export file - mga prepared by | Add "Prepared by" (+ coverage dates) to exports |
| P28 | alerts modal medyo pumatong daw | Fix alerts modal overlap/stacking |
| P29 | ivcam if magloko | Allow an IP-webcam (IVCam) fallback camera source |
| P30 | pag assign ng personnel for acknowledgment how?? | Define & implement assign-for-acknowledgment flow |
| P31 | ayusin yung pending pag nag acknowledge | Fix the "pending" state after acknowledging |
| P32 | alert details view full log button | Add "View full log" on the security alert detail |
| P33 | reopened status for the alert pop up modal | Add an explicit "Reopened" status, shown in the modal |
| P34 | register or sign up di dapat nagccreate ng session while signing up | Signup must NOT auto-login (no session on register) |
| P35 | user deact vs suspended pop up | Distinguish Deactivate vs Suspend with a confirm dialog |
| P36 | unique id din dapat yung email | Email must be unique (treat as identity) |
| P37 | status sa deactivated | Distinct "Deactivated" status for users |

---

## 2. Workstreams

### A. Manuscript / Research (no code) — P3, P4, P5, P6, P16(framing), P18, P19
Owner: capstone writers. Output: updated proposal sections, not commits.
- **P3/P4** — Rewrite the *Beneficiaries* section: broaden (students, faculty, admin, facilities) and tie to the **Smoke-Free Campus / RA 9211** policy angle. Add a "security/privacy of data" subsection.
- **P5** — Add **"Provide maintenance support"** (battery/part servicing, warranty tracking) as a stated objective, then link it to the maintenance features (workstream E).
- **P6** — Add a **cost/feasibility** subsection: BOM per node, total deployment cost, and the value argument for why a campus would pay.
- **P18** — Add a **marketability vs price** analysis: comparable products, price band, target buyer.
- **P19** — ~~Clarify "adu nest"~~ **Ignored per user direction (2026-06-20).** Do not pursue.
- **P16 (framing half)** — Document the operating model: **personnel act on alerts; admins monitor performance.** The code half is in workstream D.

### B. Auth & account integrity — P34, P36, P23, P22, P35, P37
The highest-value *correctness* fixes; several are quick.

> **✅ P34 + P36 implemented & verified — 2026-06-20.** Files: `backend/routes/auth.js` (signup issues **no token**; email required, validated, unique), `backend/routes/users.js` (admin user create/update enforce unique email), `frontend/src/app/services/api.ts` (`authApi.signup` takes an object, returns `{message,user}` — no token; `SignupInput`/`SignupResponse`), `AuthContext.tsx` (signup no longer stores a token/session), `pages/auth/Signup.tsx` (email required; redirects to `/login`). Verified: signup → `201` with `hasToken:false`; missing email → `400`; duplicate email → `409`; UI signup lands on `/login` with no session while the account is created.
>
> **✅ P22 + P23 + P35 + P37 implemented & verified — 2026-06-20 (Workstream B COMPLETE).** Files: `pages/admin/AdminUsers.tsx` (row actions → single kebab ⋮ `DropdownMenu`; three roles Admin·Supervisor·Guard; status model active/suspended/deactivated; suspend & deactivate go through an `AlertDialog` that explains the difference; email required), `services/api.ts` (`UserRole`/`UserStatus` types), `components/layout/ProtectedRoute.tsx` (`roleSatisfies` — supervisor counts as personnel → security module), `pages/admin/AdminAlerts.tsx` (assignable personnel = non-admins, includes supervisors). Verified in-browser + API: kebab menu (Edit/Suspend/Deactivate/Delete) renders; suspend confirm dialog shows the temporary-hold wording; supervisor create→login→role `supervisor` and routes to `/` (guard module); deactivated & suspended both block login (`403`), reactivate restores (`200`); duplicate email on admin-create → `409`.
- **P34 — No session on signup.** `frontend/src/app/pages/auth/Signup.tsx` currently calls signup then logs in + navigates to the dashboard. Change to: register → toast "Account created" → redirect to `/login` (do not store token). Check the backend `POST /api/auth/signup` (`backend/routes/auth.js`) — stop returning/short-circuit using the token client-side. *Acceptance:* after signup, user lands on login and is NOT authenticated.
- **P36 — Email is unique identity.** Make email **required** in `Signup.tsx`, add a unique constraint/check in the users table (`backend/db/store.js` / `db/migrations.js`) and reject duplicates in `backend/routes/auth.js` with a clear 409. Decide: keep username for login or switch login to email (recommend: allow login by email; keep username as display). *Acceptance:* duplicate email → friendly error; no two users share an email.
- **P23 — ≥3 user levels.** Today roles are only `admin | security` (`AdminUsers.tsx`, auth middleware). Introduce a third role (e.g. `supervisor` / `personnel` / `viewer`). Touch: role enum in `backend/middleware/auth.js`, seed (`backend/db/seed.js`), role `<Select>` in the user editor dialog, and any `requiredRole` route guards (`frontend/src/app/routes.tsx`). *Acceptance:* a non-admin/non-security level exists, is selectable, and is enforced.
- **P22 — Kebab menu + drop redundant level/permissions.** In `AdminUsers.tsx` replace the row of icon buttons (edit/power/ban/delete) with a single **⋮ dropdown menu** (shadcn `DropdownMenu`). Confirm there's no separate "permissions" field duplicating "role/level" — if a column shows both, keep one. *Acceptance:* one ⋮ per row; no duplicated role/permission columns.
- **P35 + P37 — Deactivate vs Suspend, with confirm + distinct status.** Users currently use `active | inactive | suspended`. Define the semantics clearly: **Suspended** = temporary hold (reversible), **Deactivated** = decommissioned account. Add a confirmation dialog (shadcn `AlertDialog`) for each action explaining the difference, and render a distinct **Deactivated** status badge (`frontend/src/app/lib/status.ts`). *Acceptance:* both actions prompt a confirm that states the difference; status badges are visually distinct.

### C. Alerts workflow — P31, P15, P10, P33, P32, P30, P28, P11, P29
Core to the guard experience; fixes + small features.

> **✅ P31 + P15 implemented & verified — 2026-06-20.** Root cause of "pending": `acknowledge` jumped straight to `RESPONDING` while the UI optimistically showed `acknowledged`, then the live-stream refetch flipped it. Fix: `backend/routes/alerts.js` — `acknowledge` now persists a real **`ACKNOWLEDGED`** state, a new **`PUT /alerts/:id/respond`** sets `RESPONDING`, and `escalate` now actually sets `ESCALATED` (was log-only); all record `respondedBy`. Frontend: `alertsApi.respond`, `AlertDetails.tsx` uses it for "Mark as Responding" and reads `respondedBy` from the response; the 3 active-count filters (`SecurityTopBar`, `SecurityBottomNav`, `AdminLayout`) now include `ACKNOWLEDGED` so acknowledged alerts stay counted. Verified: acknowledge → `ACKNOWLEDGED` (stable), respond → `RESPONDING`, `respondedBy` recorded both times.
>
> **✅ P10 + P32 + P33 implemented & verified — 2026-06-20.** P10 cancel-false-acknowledge: new `PUT /alerts/:id/cancel-acknowledge` (→ ACTIVE, clears responder, logged) + `alertsApi.cancelAck` + a "Cancel acknowledgment" button in the security AlertDetails verification form. P32: a "View full log" button on the security AlertDetails. P33 reopened status: `reopen` now sets **`REOPENED`** (was silently ACTIVE); added to the `Alert` union, `lib/status.ts` (amber badge), AdminAlerts (open-statuses, active count, filter), and every active-count filter + status mapping (TopBar/BottomNav/AdminLayout, security Dashboard/Alerts/Logs/AlertDetails) so a reopened alert is treated as open. Bonus: the responder card now reads "Acknowledged by"/"Resolved by" (P15 polish). Verified API: acknowledge→cancel→ACTIVE (responder cleared); RESOLVED→reopen→REOPENED. Verified UI: both buttons render, no console errors. **Remaining in C:** P28 (modal overlap — needs screen pointer), P29 (IVCam fallback), P11 (proof-photo end-to-end check), P30 (assign-for-ack — blocked by P2/Workstream H).
- **P31 — Fix "pending" after acknowledge.** Trace the status transition in `AlertDetails.tsx` / `AdminAlerts.tsx` and `backend/routes/alerts.js`. Ensure acknowledging moves the alert cleanly to `ACKNOWLEDGED` (no stuck "pending" limbo) and the UI reflects it immediately. *Acceptance:* acknowledge → status updates without a stale pending state.
- **P15 — Show who acknowledged.** `assignedResponder` already exists; ensure the acknowledging user's name + timestamp is set on acknowledge and displayed on the **list**, **detail**, and **admin table**. *Acceptance:* every acknowledged alert shows "Acknowledged by <name> at <time>".
- **P10 — Cancel false acknowledge.** Add an "Undo acknowledgment" action (visible to the acknowledging guard / admin) that returns an alert from `ACKNOWLEDGED` back to `ACTIVE` and clears the responder, writing an audit log. Touch `alerts.js` + `AlertDetails.tsx`. *Acceptance:* an accidental ack can be reverted and is logged.
- **P33 — "Reopened" status.** Add `REOPENED` to the alert status set (api type in `services/api.ts`, `lib/status.ts` mapping, backend transitions). Reopening a `RESOLVED`/`FALSE_ALARM` alert sets `REOPENED` (not silently back to `ACTIVE`) and the modal shows it. *Acceptance:* reopened alerts read "Reopened", with a distinct badge.
- **P32 — "View full log" on security detail.** Admin already deep-links to logs; add the same button to `frontend/src/app/pages/security/AlertDetails.tsx` linking to the device/location-filtered log view. *Acceptance:* security detail has a working "View full log".
- **P30 — Assign-for-acknowledgment flow.** Decide the model: an admin/supervisor assigns an alert (or a floor) to a specific guard who is then expected to acknowledge. Wire to `assignmentsApi` + `alertsApi.assign`. This depends on workstream H (per-floor assignment). *Acceptance:* an alert can be routed to a named guard who sees it as theirs to acknowledge.
- **P28 — Fix alerts modal overlap.** "Medyo pumatong" = stacking/z-index or content overlap in the alert dialog. Reproduce, then fix layout/`z-index`/scroll in the alert modal (`AdminAlerts.tsx` dialog + shared `components/ui/dialog`). *Acceptance:* modal renders with no overlapping elements at common breakpoints.
- **P11 — Proof photo (verify, don't rebuild).** `CameraCapture` + `alertsApi.uploadPhoto` already exist in `AlertDetails.tsx`. Verify the upload works end-to-end (multer route `backend/routes/alerts.js`, `/uploads`), and make the captured photo visible in the alert record/log. *Acceptance:* a photo taken during response is stored and viewable later.
- **P29 — IVCam / IP-webcam fallback.** In `CameraCapture`, allow selecting a camera source; if the device camera fails, allow an IP-webcam stream URL (IVCam/DroidCam) or device-picker via `navigator.mediaDevices.enumerateDevices()`. *Acceptance:* when the default camera is unavailable, the guard can pick an alternative source.

### D. Personnel-side UX simplification — P7, P9, P17, P16(code)
Theme: the guard view shows too much; trim to what they need to act.
- **P7/P9 — Slim the guard UI.** Audit `frontend/src/app/pages/security/*` (Dashboard, Alerts, AlertDetails). Remove decorative/secondary widgets; keep: my active alerts, acknowledge/respond actions, response history. Larger tap targets, fewer columns. *Acceptance:* security dashboard fits the "act fast" job with noticeably less chrome.
- **P17 — Remove redundancy / prioritize.** Across pages, collapse duplicated fields (e.g. status shown twice, repeated location strings) and lead with the highest-priority info (active count, newest alert). *Acceptance:* no field is shown twice in the same view; primary info is top-left/first.
- **P16 (code half) — Role separation.** Per the framing decision, keep the security tree task-focused and the admin tree monitoring-focused. **Do not delete the admin dashboard** (panel asked as a question) — instead retarget its fake "performance" widget (see P12) toward monitoring personnel performance. *Acceptance:* security pages contain no admin-monitoring widgets and vice-versa.

### E. Devices / sensors — P13, P14, P21
- **P13 — Lifespan + warranty.** Devices already carry `replaceIn`/lifespan estimates; add **`warrantyUntil`** (and surface `lifespan`) as real `devices` columns (`backend/db/migrations.js`), editable in the provisioning/threshold dialogs (`components/admin/DeviceProvisioningDialog.tsx`, `DeviceThresholdsDialog.tsx`) and shown on `AdminDeviceDetail.tsx`. Remember the **PUT field-whitelist** gotcha in `store.update` (see backend memory) — add new keys to the whitelist or the PUT 500s. *Acceptance:* warranty + lifespan persist and display per device.
- **P14 — Battery low notification.** Add a dashboard surface for low batteries: a banner/badge when any device battery < threshold (e.g. 15%), reusing the Sensors page's existing battery logic. Optionally emit a `device`/`system` log entry. *Acceptance:* a low battery is visible on the admin dashboard without opening the Sensors page.
- **P21 — Edit → info icon.** In `frontend/src/app/pages/security/Sensors.tsx` (and admin device list if applicable) change the "edit" affordance to an info **ⓘ** icon, since the security view is read-only. *Acceptance:* the security sensor card uses an info icon, not a pencil/edit.

### F. Logs — P24, P25

> **✅ P24 + P25 implemented & verified — 2026-06-20.** Files: `pages/admin/AdminLogs.tsx` (client pagination at 10/page — Prev/Next + "Showing X–Y of Z / Page n of m", resets on filter change, clamps on poll), `lib/status.ts` (new `logStatus()` tone map), status column + detail dialog now render a colored `StatusBadge`. Also guarded alert log titles against null location (`backend/routes/alerts.js`). Verified: page 1 = 10 rows ("Showing 1–10 of 15"), Next → page 2 = 5 rows ("11–15 of 15"); statuses render as colored badges (Reported/Responding/Acknowledged); no console errors.
- **P24 — Pagination (10/page).** `AdminLogs.tsx` loads all logs into a table. Add client (or server) pagination at 10 rows/page with prev/next + page count. Prefer server-side `limit/offset` in `backend/routes/logs.js` if log volume is large. *Acceptance:* logs show 10 per page with working navigation.
- **P25 — Status colors.** Logs currently color **severity** but not **status**. Extend `lib/status.ts` with log-status tones and apply a colored badge to the status column; audit all pages so the same status uses the same color everywhere. *Acceptance:* log status is color-coded and consistent with other pages.

### G. Analytics / reports — P26, P27, P12
- **P26 — Coverage date range.** Add a date-range picker to `AdminAnalytics.tsx`; pass `from`/`to` to the analytics endpoints (`backend/routes/analytics.js` — `/summary`, `/weekly`, `/reports`, `/qos`) so the period is user-selectable instead of fixed. *Acceptance:* changing the range changes the charts/tables.
- **P27 — "Prepared by" + coverage on exports.** The CSV export omits metadata. Add a header block to exports: **Prepared by: <current user>**, **Coverage: <from>–<to>**, **Generated: <date>**. Apply to analytics, users, devices, and logs CSV exports. *Acceptance:* every exported file names who prepared it and the coverage window.
- **P12 — Performance → "Needs attention".** The admin dashboard "performance" numbers are hardcoded placeholders (`uptime '99.7%'`, etc.). Replace the widget with an honest **"Needs attention"** panel computed from real data: offline devices, low batteries, unacknowledged alerts, overdue maintenance. *Acceptance:* the widget shows only real, computed items; no invented percentages.

### H. Assignments — P2 (+ enables P30)
- **P2 — Persist per-floor assignment.** `frontend/src/app/pages/security/GuardAssignments.tsx` is **local state with a hardcoded guard list**. Wire it to `assignmentsApi` (already in `services/api.ts`) backed by the `assignments` table; populate the guard dropdown from `usersApi` (real personnel). *Acceptance:* assignments persist across refresh and the guard list is real users. This unblocks **P30**.

### I. Mobile delivery — web only, **NO PWA** — P1, P8, P20
> **Decision (user, 2026-06-20): strictly no PWA.** No service worker, no web-app manifest/installability, no Web Push, no offline cache. The security console stays a normal responsive web app — but styled **mobile-first / app-like** (phone form factor). Real-time stays in-app via the existing SSE feed while the page is open. See workstream **J** for the app-like shell.
- **P1 — Real-time notifications (in-app only).** The dashboard already has an SSE live feed (`useLiveStream.ts`). With PWA off the table, "notif" = a strong **in-app** signal while the guard has the console open: a toast + sound + a badge count on the bottom-nav **Alerts** tab when a new alert arrives. No background/push delivery. *Acceptance:* a new alert raises an in-app toast + sound and increments the Alerts tab badge.
- **P8 — Phone-use policy / alternative.** Operational: confirm guards may use phones on duty. If not, the same mobile-first UI runs on a **per-floor wall tablet/kiosk** (the layout is identical). Document the decision; it shapes J/P7. *Acceptance:* a documented delivery channel that matches campus policy.
- **P20 — iOS & Android compatibility.** Test the camera capture (P11/P29) and the mobile shell (workstream J) on real iOS Safari + Android Chrome; fix `getUserMedia` constraints, viewport/safe-area, and bottom-nav spacing (iOS home indicator). *Acceptance:* the bottom nav + Quick Report + capture all work on both mobile OSes.

### J. Security app-like mobile shell — U1, U2, U3 *(user-directed, 2026-06-20)*
This is the **priority refinement track** the user called out: make the security/guard side feel like a phone app, with a 5-slot bottom navigation bar whose center is a quick-action button. Builds on the UX slim-down (D / P7,P9,P17).

> **✅ Implemented & browser-verified — 2026-06-20.** Files: `backend/routes/alerts.js` (manual `POST /api/alerts`), `frontend/src/app/services/api.ts` (`alertsApi.createManual` + `ManualReportInput`), `frontend/src/app/components/layout/QuickReportSheet.tsx` (new), `SecurityBottomNav.tsx` (rewritten to 5 slots + badge), `SecurityLayout.tsx` (safe-area bottom padding). Verified at desktop + mobile (375px): 5-slot nav renders, center button opens the sheet, assignment prefill works, submit returns `201` with `status:RESPONDING, source:manual, respondedBy:<guard>` and routes to the new alert; no console errors.

- **U1 — Mobile-first, app-like security console (no PWA).** Restructure `frontend/src/app/components/layout/SecurityLayout.tsx` (and its CSS) into a phone-shaped shell: a slim top bar (title + alert badge + avatar), a scrollable content area, and a **fixed bottom navigation bar**. Plain responsive web — **no service worker / manifest / push**. Keep it usable on desktop (center the phone column or let it go full-width). *Acceptance:* the security tree renders as a single-column app-like layout with a persistent bottom nav; no PWA artifacts are added.
- **U2 — Bottom navigation bar: 5 slots (4 tabs + center action).** Build a `BottomNav` component with exactly **5 slots**. The **middle (3rd)** slot is the raised/emphasized **Quick** button (U3); the other four are page tabs with icon + label, active-state highlight, and a badge on Alerts. Proposed tabs (final set pending P16 slim-down):
  1. **Home** (Dashboard)
  2. **Alerts** (with unread badge)
  3. **➕ Quick Report** *(center, U3)*
  4. **Sensors** (status of nodes on their floor)
  5. **Profile / More** (assignment, history, logout)
  *(Assignments + Logs move under Home or Profile to keep the guard nav to 4 tabs; Analytics is admin-only per P16.)* *Acceptance:* a 5-button bottom bar with the center button visually distinct; tapping a tab routes and highlights; Alerts shows a live badge.
- **U3 — Center "Quick Report" button (purpose found).** The middle button opens a fast **manual incident report** sheet — the highest-value one-tap action for a roving guard who *physically* catches someone vaping where no sensor covers. It wires up the **already-existing, currently-unused `POST /api/alerts`** endpoint (manual alert, `source='manual'` — noted in backend memory as having no client method yet). The sheet: location/floor **prefilled from the guard's assignment**, severity, optional note, and optional **photo via the existing `CameraCapture`**. On submit it creates an alert/incident the guard can immediately acknowledge/resolve. Add a `createManual` method to `alertsApi` in `services/api.ts`. *Acceptance:* tapping center → fills a quick report → a manual incident appears in the alerts list with the guard as reporter and (if taken) a photo attached. *Alternative purposes considered & rejected: "quick-acknowledge newest alert" (already one tap from the Alerts tab) and "SOS/escalate" (too narrow for the primary action).*

---

## 3. Priority waves

### Wave 1 — Correctness & quick wins (do first)
Low-risk, high-credibility-with-panel fixes:
`P34` no-session signup · `P36` unique email · `P31` fix pending-after-ack · `P15` who acknowledged · `P28` modal overlap · `P21` edit→info icon · `P24` logs pagination · `P25` status colors · `P11` verify proof photo.

### Wave 2 — Features the panel explicitly wants
`P10` cancel false ack · `P33` reopened status · `P32` view-full-log (security) · `P22` kebab menu · `P35`/`P37` deactivate-vs-suspend · `P13` lifespan/warranty · `P14` battery notif · `P26` coverage date · `P27` prepared-by · `P12` needs-attention panel · `P2` persist assignments · `P7`/`P9`/`P17` UX slim-down.

### Wave 3 — Bigger / decision-gated
`P23` 3rd user level · `P30` assign-for-ack (needs H) · `P29` IVCam fallback · `P8` phone policy · `P20` mobile QA · `P16` role-separation pass.

### ★ Priority track — Security app-like shell (user-directed)
Per the 2026-06-20 direction, the security UI refinement runs as its own focused track and should land alongside Wave 1–2 (it's the frame the slimmed pages live in):
`U1` mobile-first shell → `U2` 5-button bottom nav → `U3` center Quick Report. Pulls in `P7`/`P9`/`P17` (slim-down) and `P1` (in-app notif badge/sound). **No PWA.**

### Manuscript track (parallel, not blocking code)
`P3` `P4` `P5` `P6` `P18`. *(`P19` "adu nest" — ignored.)*

---

## 4. Suggested execution order (build items)

1. **Auth integrity:** P34 → P36 (one PR, touches signup + users table).
2. **Alert flow fixes:** P31 → P15 → P28 → P11 (verify) → then P10 → P33 → P32.
3. **Users management:** P22 → P35/P37 → P23.
4. **Devices/logs/reports:** P21 → P24 → P25 → P13 → P14 → P26 → P27 → P12.
5. **Assignments + routing:** P2 → P30.
6. **UX slim-down pass:** P7/P9/P17/P16 (after the above land, as a cleanup sweep).
7. **Mobile/PWA:** P8 (decide) → P1 → P20 → P29.

Each build item should follow the repo norms in `CLAUDE.md`: new endpoints go through `services/api.ts`; status colors stay centralized in `lib/status.ts`; backend PUTs need the field whitelist; no fake/placeholder data — show loading/empty/error states.

---

## 5. Open questions for the adviser/panel (resolve before Wave 3)

**Decided (2026-06-20):** ~~adu nest~~ ignored · **no PWA** (mobile-first responsive web only, in-app SSE notifications) · security side gets an app-like bottom-nav shell with a center **Quick Report** button.

Still open:
1. **P8** — Are guards **allowed phones** on duty, or do we deploy the same mobile UI on a **per-floor tablet/kiosk**?
2. **P23** — What are the three+ user levels (e.g. Admin · Supervisor · Guard)? What can each do?
3. **P36** — Login by **email** or keep **username**, with email merely unique?
4. **P30** — Who assigns alerts to guards — admin, supervisor, or auto-by-floor?
5. **U2** — Confirm the 4 page tabs (proposed: Home · Alerts · Sensors · Profile) — is **Assignments** wanted as a tab instead of Sensors?

---

## 6. Traceability table (nothing dropped)

| ID | Workstream | Type | Wave | Primary file(s) |
|----|-----------|------|------|-----------------|
| P1 | I/J | Build | ★ track | in-app toast/sound/badge via `useLiveStream.ts` (**no PWA/push**) |
| P2 | H | Build | 2 | `pages/security/GuardAssignments.tsx`, `services/api.ts`, `backend/routes/assignments.js` |
| P3 | A | Doc | MS | manuscript |
| P4 | A | Doc | MS | manuscript |
| P5 | A | Doc | MS | manuscript |
| P6 | A | Doc | MS | manuscript |
| P7 | D | Build | 2 | `pages/security/*` |
| P8 | I | Decision | 3 | manuscript + design |
| P9 | D | Build | 2 | `pages/security/*` |
| P10 | C | Build | 2 | `pages/security/AlertDetails.tsx`, `backend/routes/alerts.js` |
| P11 | C | Verify | 1 | `AlertDetails.tsx` (CameraCapture), `backend/routes/alerts.js` |
| P12 | G | Build | 2 | `pages/admin/AdminDashboard.tsx` |
| P13 | E | Build | 2 | `db/migrations.js`, device dialogs, `AdminDeviceDetail.tsx` |
| P14 | E | Build | 2 | `AdminDashboard.tsx`, sensors logic |
| P15 | C | Build | 1 | `alerts.js`, `AlertDetails.tsx`, `AdminAlerts.tsx` |
| P16 | A/D | Doc+Build | 3 | manuscript + `pages/admin/*`,`pages/security/*` |
| P17 | D | Build | 2 | all pages (sweep) |
| P18 | A | Doc | MS | manuscript |
| P19 | — | Ignored | — | dropped per user (2026-06-20) |
| P20 | I | QA | 3 | mobile testing |
| P21 | E | Build | 1 | `pages/security/Sensors.tsx` |
| P22 | B | Build | 2 | `pages/admin/AdminUsers.tsx` |
| P23 | B | Build | 3 | `backend/middleware/auth.js`, `seed.js`, user editor, `routes.tsx` |
| P24 | F | Build | 1 | `pages/admin/AdminLogs.tsx`, `backend/routes/logs.js` |
| P25 | F | Build | 1 | `lib/status.ts`, `AdminLogs.tsx` |
| P26 | G | Build | 2 | `pages/admin/AdminAnalytics.tsx`, `backend/routes/analytics.js` |
| P27 | G | Build | 2 | export helpers (analytics/users/devices/logs) |
| P28 | C | Fix | 1 | `AdminAlerts.tsx` dialog, `components/ui/dialog` |
| P29 | C | Build | 3 | `AlertDetails.tsx` (CameraCapture) |
| P30 | C/H | Build | 3 | `alerts.js`, `assignmentsApi`, depends on P2 |
| P31 | C | Fix | 1 | `AlertDetails.tsx`, `AdminAlerts.tsx`, `alerts.js` |
| P32 | C | Build | 2 | `pages/security/AlertDetails.tsx` |
| P33 | C | Build | 2 | `services/api.ts`, `lib/status.ts`, `alerts.js` |
| P34 | B | Fix | 1 | `pages/auth/Signup.tsx`, `context/AuthContext.tsx`, `backend/routes/auth.js` |
| P35 | B | Build | 2 | `pages/admin/AdminUsers.tsx`, `lib/status.ts` |
| P36 | B | Build | 1 | `pages/auth/Signup.tsx`, `db/store.js`/`migrations.js`, `routes/auth.js` |
| P37 | B | Build | 2 | `lib/status.ts`, `AdminUsers.tsx` |
| U1 | J | Build | ★ track | `components/layout/SecurityLayout.tsx` + shell CSS |
| U2 | J | Build | ★ track | new `components/layout/BottomNav.tsx`, `routes.tsx` |
| U3 | J | Build | ★ track | new Quick Report sheet, `services/api.ts` (`alertsApi.createManual`), `backend/routes/alerts.js` (`POST /api/alerts`), `CameraCapture` |

---

*Last updated: 2026-06-20. This is a living plan — check off items as PRs land and update the Status column as work progresses.*
*Changelog:*
*- 2026-06-20 — ignored P19 (adu nest); dropped PWA (in-app SSE only); added workstream J (security app-like shell: U1 mobile-first layout, U2 5-button bottom nav, U3 center Quick Report).*
*- 2026-06-20 — **built + verified workstream J (U1/U2/U3).** Security bottom nav is now 5 slots with a center Quick Report button that files a manual incident (wires the previously-unused manual `POST /api/alerts`).*
*- 2026-06-20 — **Wave-1 correctness: built + verified P34, P36, P31, P15.** Signup no longer creates a session (redirects to login); email is required + unique (signup & admin user mgmt); acknowledge now persists a stable `ACKNOWLEDGED` state with a dedicated `respond` transition, and the acknowledging/responding guard is recorded + shown.*
*- 2026-06-20 — **Wave-1 quick wins: built + verified P24, P25.** Logs page paginates at 10/page; log status renders as colored badges via a new `logStatus()` map. P21 (sensor "edit"→info icon) deferred — no edit button exists on the sensor list today; needs the panel to point at the exact screen. P28 (alerts modal overlap) and P11 (proof-photo end-to-end) still pending.*
*- 2026-06-20 — **PWA dropped entirely (user decision).** No installable PWA, service worker, offline, or web push. Workstream I/P1 (push) is out. The already-built app-like guard shell (workstream J) stays — it is plain responsive web, not PWA tech. Focus shifts to the remaining feature/correctness tasks below.*
*- 2026-06-20 — **Workstream B COMPLETE (P22, P23, P35, P37) + Workstream C core (P10, P32, P33).** Users: kebab menu, three roles (Admin·Supervisor·Guard), deactivate-vs-suspend confirm + distinct deactivated status. Alerts: cancel-false-acknowledge, view-full-log, explicit Reopened status. All verified API + in-browser. Remaining: C tail (P28 modal — needs screen pointer, P29 IVCam, P11 photo check, P30 — blocked by P2) and Workstream D (P7/P9/P17 guard-UX slim-down, P16 role separation).*
</content>
</invoke>
