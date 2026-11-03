# Admin Redesign — Phase 2 (Cuts + Navigation) Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Remove the fabricated/orphaned QoS and Network pages, retire dead nav code, and rewire the admin navigation to the agreed 7-item structure (Dashboard · Alerts · Devices · Analytics · Users · Logs · Settings) with Profile moved to the avatar menu.

**Architecture:** Purely structural — delete two page components + one dead nav component, drop their routes, rename the `reports` route to `analytics` (component rework deferred to Phase 3), and update the three nav surfaces (`AdminSidebar`, `AdminLayout` header/avatar, `AdminBottomNav` deletion). No backend, no data logic.

**Tech Stack:** React Router 7, lucide-react icons, Tailwind v4.

## Global Constraints

- `@` → `src/`. Node 22.5+. `legacy-peer-deps=true`.
- Verification gate = `npm run build` (catches broken imports/missing components) + `npm test` (Phase 1 suite stays green). No new pure logic to unit-test in this phase.
- Do not modify the security (guard) route tree or pages.
- Interim acceptable state: `/admin/analytics` renders the existing `AdminReports` component until Phase 3 reworks/renames it.

## Reference (verified) — every reference to the affected routes
- `routes.tsx`: imports `AdminQoS`, `AdminNetwork`, `AdminReports`; routes `network`, `qos`, `reports`.
- `AdminSidebar.tsx` `MAIN_NAV`: has `Reports` + `Profile`; missing `Analytics`, `Settings`.
- `AdminLayout.tsx` `PAGE_TITLES`: has `/admin/qos`, `/admin/reports`, `/admin/profile`; avatar dropdown has only Sign Out.
- `AdminBottomNav.tsx`: **unused** (no imports); links to `/admin/qos`, `/admin/reports`, `/admin/profile`.
- No page calls `navigate('/admin/qos')` or `/admin/network` — confirmed by grep.

---

### Task 1: Remove QoS + Network routes, rename reports→analytics

**Files:**
- Modify: `Vape/src/app/routes.tsx`
- Delete: `Vape/src/app/pages/admin/AdminQoS.tsx`, `Vape/src/app/pages/admin/AdminNetwork.tsx`

- [ ] **Step 1:** In `routes.tsx`, delete the import lines for `AdminQoS` and `AdminNetwork`.
- [ ] **Step 2:** In `routes.tsx` admin children, delete the `{ path: 'network', ... }` and `{ path: 'qos', ... }` entries; change `{ path: 'reports', Component: AdminReports }` to `{ path: 'analytics', Component: AdminReports }`.
- [ ] **Step 3:** Delete the two page files (`AdminQoS.tsx`, `AdminNetwork.tsx`).
- [ ] **Step 4:** `npm run build` → succeeds (no dangling imports).
- [ ] **Step 5:** Commit: `chore: remove fabricated QoS + Network admin pages; route reports as analytics`.

---

### Task 2: Delete dead AdminBottomNav

**Files:**
- Delete: `Vape/src/app/components/AdminBottomNav.tsx`

- [ ] **Step 1:** Confirm no imports (`grep -rn AdminBottomNav src` → only its own definition). Delete the file.
- [ ] **Step 2:** `npm run build` → succeeds.
- [ ] **Step 3:** Commit: `chore: delete unused AdminBottomNav (referenced removed routes)`.

---

### Task 3: Rewire AdminSidebar nav

**Files:**
- Modify: `Vape/src/app/components/AdminSidebar.tsx`

- [ ] **Step 1:** Update the lucide import to: `LayoutDashboard, Bell, Radio, BarChart3, Users, History, Settings, LogOut, X` (drop `FileText`, `User`, `ShieldCheck`).
- [ ] **Step 2:** Replace `MAIN_NAV` with:

```tsx
const MAIN_NAV = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/alerts', icon: Bell, label: 'Alerts' },
  { path: '/admin/devices', icon: Radio, label: 'Devices' },
  { path: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/admin/users', icon: Users, label: 'Users' },
  { path: '/admin/logs', icon: History, label: 'Logs' },
  { path: '/admin/settings', icon: Settings, label: 'Settings' },
];
```

- [ ] **Step 3:** `npm run build` → succeeds.
- [ ] **Step 4:** Commit: `feat: rewire admin sidebar to 7-item nav (add Analytics + Settings, drop Profile)`.

---

### Task 4: AdminLayout — titles + Profile in avatar menu

**Files:**
- Modify: `Vape/src/app/components/AdminLayout.tsx`

- [ ] **Step 1:** Add `User` to the lucide-react import.
- [ ] **Step 2:** Replace `PAGE_TITLES` with:

```tsx
const PAGE_TITLES: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/alerts': 'Alerts',
  '/admin/devices': 'Devices',
  '/admin/analytics': 'Analytics',
  '/admin/users': 'Users',
  '/admin/logs': 'Logs',
  '/admin/settings': 'Settings',
  '/admin/profile': 'Profile',
};
```

- [ ] **Step 3:** In the avatar dropdown (the `showUserMenu` panel), add a Profile link directly above the Sign Out button:

```tsx
<Link
  to="/admin/profile"
  onClick={() => setShowUserMenu(false)}
  className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-gray-50 text-gray-700 transition-colors"
>
  <User className="h-4 w-4" />
  <span className="text-sm font-medium">Profile</span>
</Link>
```

- [ ] **Step 4:** `npm run build` → succeeds; `npm test` → Phase 1 suite still green.
- [ ] **Step 5:** Commit: `feat: add Profile to admin avatar menu; refresh page titles`.

---

## Self-Review
- Cuts (QoS, Network) → Tasks 1 + (dead nav) 2 ✓
- Nav rewire (add Analytics, Settings; drop Profile from sidebar) → Task 3 ✓
- Profile → avatar menu → Task 4 ✓
- `reports`→`analytics` route → Task 1 ✓
- No dangling references: every grep hit (routes, sidebar, layout titles, bottom nav) is addressed.
- Out-of-scope guard: component bodies of AdminReports/AdminSettings/AdminProfile are NOT reworked here (Phases 3/6); only routing/nav changes.
