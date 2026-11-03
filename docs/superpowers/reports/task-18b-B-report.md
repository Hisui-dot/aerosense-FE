# Task 18b-B Report — Remove Dead Mock-Alert Reads

**Date:** 2026-06-19  
**Branch:** feat/iot-loop  
**Commit:** 28baa04

---

## Per-File Changes

### 1. `src/app/components/AdminLayout.tsx`
- Removed `const mockAlerts = JSON.parse(localStorage.getItem('mock_alerts') || '[]');` (first occurrence, in `fetchNotifications`)
- Removed `[...mockAlerts, ...alertsData]` Map merge — `combinedAlerts` replaced with direct `alertsData.filter(...)`
- Removed `const mockAlerts = ...` (second occurrence, in `loadSearchData`)
- Removed `[...mockAlerts, ...alertsData]` Map merge in search cache — replaced with `alertsData` directly
- Removed entire `storage` listener: the `handleStorage` function, `window.addEventListener('storage', handleStorage)`, and `window.removeEventListener('storage', handleStorage)` — the listener's only action was the `mock_alerts`/`force_sync` condition, so the whole listener was removed. The `clearInterval` cleanup remains.

### 2. `src/app/components/SecurityTopBar.tsx`
- Removed `const mockAlerts = JSON.parse(localStorage.getItem('mock_alerts') || '[]');`
- Removed `[...mockAlerts, ...alertsData]` Map merge — replaced with `alertsData.filter(...)`
- Removed entire `storage` listener: `handleStorage` function, `addEventListener`, and `removeEventListener` — only action was the `mock_alerts`/`force_sync` condition. Cleanup retains only `clearInterval`.

### 3. `src/app/pages/admin/AdminLogs.tsx`
- Removed `const mockAlerts = JSON.parse(localStorage.getItem('mock_alerts') || '[]');`
- Removed `Array.from(new Map([...mockAlerts, ...(alertsData as any[])].map(...)).values())` — replaced with direct `(alertsData as any[]).map(...)`

### 4. `src/app/pages/admin/AdminNetwork.tsx`
- Removed `const mockAlerts = JSON.parse(localStorage.getItem('mock_alerts') || '[]');`
- Removed `Array.from(new Map([...mockAlerts, ...a].map(...)).values())` — replaced with `setAlerts(a)`

### 5. `src/app/pages/admin/AdminQoS.tsx`
- Removed `const mockAlerts = JSON.parse(localStorage.getItem('mock_alerts') || '[]');`
- Removed `[...mockAlerts, ...data]` spread — replaced with `alertsApi.getAll().then(setAlerts).catch(console.error)`

### 6. `src/app/pages/admin/AdminSettings.tsx`
- Removed `localStorage.removeItem('mock_alerts');` from the `handleClearLogs` handler
- Handler itself and the `logsApi.clear()` call remain intact; only the stale `removeItem` was dropped

### 7. `src/app/pages/Logs.tsx`
- Removed `const mockAlerts = JSON.parse(localStorage.getItem('mock_alerts') || '[]');`
- Removed `const combined = [...mockAlerts, ...data];` — replaced with direct `data.map(...)`

### 8. `src/app/pages/Profile.tsx`
- Removed `const mockAlerts = JSON.parse(localStorage.getItem('mock_alerts') || '[]');`
- Removed `Array.from(new Map([...mockAlerts, ...data].map(...)).values())` — replaced with direct `data.filter(...)`

---

## Verification

### grep mock_alerts / force_sync / alert_precision_ in src/app
```
No matches found
```

### grep mockAlerts in src/app
```
No matches found
```

The mock system is fully removed from the entire `src/app` tree.

---

## Build Result

```
✓ built in 5.81s
```

Build succeeded. Pre-existing chunk-size warning (1,231.90 kB) is unchanged from before these edits — no new issues introduced.

---

## Commit

```
28baa04  refactor(frontend): remove dead mock-alert reads from peripheral pages
8 files changed, 9 insertions(+), 41 deletions(-)
```

Files staged: exactly the 8 listed above. `Login.tsx` was not staged.

---

## Concerns

None. All 8 files were read before editing. All `mockAlerts` variable references were removed in full (declarations + usages). The two storage listeners in `AdminLayout` and `SecurityTopBar` were entirely removed since their only logic was the `mock_alerts`/`force_sync` condition. Functional logic (API calls, interval polling, notification bell, settings handler) is untouched.
