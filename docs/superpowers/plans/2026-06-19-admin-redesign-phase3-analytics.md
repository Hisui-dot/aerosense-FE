# Admin Redesign — Phase 3 (Analytics P0) Implementation Plan

> Use superpowers:executing-plans. Reworks two pages onto the real `analyticsApi`.

**Goal:** Replace the fabricated AdminDashboard and AdminReports with honest, real-data pages driven by the four `/api/analytics/*` endpoints (currently 100% unused) + Recharts + the Phase 1 components.

**Architecture:** Add typed response interfaces for the analytics endpoints to `api.ts`, then rewrite `AdminDashboard` and create `AdminAnalytics` (replacing `AdminReports`). Every value traces to an API field; placeholder fields the backend returns as `'—'`/hardcoded strings (`avgResponseTime`, `performance.uptime`) are omitted, not displayed. Loading/empty/error via `AsyncBoundary`. Charts via Recharts. No backend change.

## Global Constraints
- Node 22.5+, `@`→`src`, build+test gate per task, commit on `main` (user-approved).
- Honesty: no fabricated fallbacks; omit placeholder fields; use `lib/thresholds` for any threshold coloring (no inline `pm25>35`).
- Use Phase 1 components: `PageHeader`, `MetricCard`, `ChartCard`, `AsyncBoundary`, `StatusBadge`; `lib/csv` for export; `theme/tokens` `chart`/`status` colors for Recharts.

## Backend response shapes (verified in `routes/analytics.js`)
- `summary` → `{ alerts:{total,confirmed,falseAlarms,active}, devices:{total,online,offline,warning,avgSignal}, sensors:{total,online,needAttention}, performance:{uptime,accuracy,responseTime,falsePositiveRate} }` (performance.* are hardcoded → DO NOT surface).
- `weekly` → `WeeklyPoint[]` `{id,day,date,count}`.
- `reports` → `{ summary:{totalDetections,confirmedIncidents,falseAlarms,avgResponseTime:'—',successRate,period}, detectionTrend:[{id,day,count}], highRiskAreas:[{location,incidents,percentage}], peakTimePeriods:[{time,incidents}], devicePerformance:[{id,detections,offlineEvents,avgResponse}], userActivity:[{name,handled,avgAck:'—',resolved}], airQuality:{avgPm25,avgVoc} }`.
- `qos` → `{ systemStatus:{status,devicesOnline,totalDevices,avgResponse,uptime}, summaryMetrics:[{label,value}], activeIssues:[{id,location,severity,issue,lastSeen,canResolve,canInvestigate}], performanceData:[{id,time,response}] (response = recent PM2.5 µg/m³), recentEvents:[{time,event,severity}] }`.

---

### Task 1: Typed analytics interfaces in `api.ts`
**Files:** Modify `Vape/src/app/services/api.ts`
- [ ] Add interfaces: `AnalyticsSummary`, `AnalyticsReports`, `AnalyticsQos`, `HighRiskArea`, `PeakTimePeriod`, `DevicePerformance`, `UserActivity`, `QosActiveIssue`, `QosPerfPoint`, `QosSummaryMetric`.
- [ ] Change `analyticsApi.summary/reports/qos` return generics from `Record<string,unknown>` to those interfaces.
- [ ] `npm run build` → succeeds. Commit: `feat: add typed analytics response interfaces`.

### Task 2: Rework AdminDashboard (real data)
**Files:** Rewrite `Vape/src/app/pages/admin/AdminDashboard.tsx`
Data: `Promise.all([analyticsApi.summary, analyticsApi.weekly, analyticsApi.reports, analyticsApi.qos, alertsApi.getAll])`. 30s poll + `useLiveStream({onAlert: reload})`. `AsyncBoundary` for first load.
Layout:
- `PageHeader` "Dashboard", subtitle `${summary.devices.total} sensors monitored`.
- KPI row (4 `MetricCard`): Active alerts (`summary.alerts.active`, tone danger if >0 else success, sub `${summary.alerts.total} total`); Sensors online (`${summary.devices.online}/${summary.devices.total}`, tone success, sub `${summary.devices.offline} offline`); Detections today (qos `summaryMetrics` label `Alerts Today`, sub `${reports.summary.totalDetections} all-time`); Avg PM2.5 (label "Avg PM2.5 (recent)", `reports.airQuality.avgPm25` µg/m³, tone from `classifyReading(avgPm25, DEFAULT_PM25_THRESHOLD)` mapped normal→success/warning→warning/critical→danger, sub `threshold 35`).
- Row: `ChartCard` "Air quality — recent readings" (Recharts AreaChart of `qos.performanceData` x=time y=response, `ReferenceLine y=35` danger dashed) [2 cols] + `ChartCard` "High-risk areas" (list of `reports.highRiskAreas`: location, incidents, bar width=percentage, color red if rank0 else amber) [1 col].
- Row: `ChartCard` "Detection activity — this week" (Recharts BarChart of `weekly` x=day y=count, bars brand.blue) [2 cols] + Recent alerts list (top 5 from alerts, each row → `navigate('/admin/alerts',{state:{alertId}})`, `StatusBadge alertStatus(status)`, show pm25/voc) [1 col].
- Remove entirely: System Health card, Avg Response/Latest Reading/Top Responder placeholders, div-bar chart.
- [ ] `npm run build` + `npm test` → pass. Commit: `feat: rework admin dashboard onto real analytics data (Recharts, honest KPIs)`.

### Task 3: Create AdminAnalytics, retire AdminReports
**Files:** Create `Vape/src/app/pages/admin/AdminAnalytics.tsx`; modify `routes.tsx`; delete `AdminReports.tsx`
Data: `Promise.all([analyticsApi.reports, analyticsApi.weekly, analyticsApi.qos])`. `AsyncBoundary`.
Layout:
- `PageHeader` "Analytics", subtitle `reports.summary.period`, action: `Export CSV` button → `downloadCsv('high-risk-areas.csv', reports.highRiskAreas)`.
- KPI strip (5 `MetricCard`, omit avgResponseTime): Total detections, Confirmed incidents, False alarms, Success rate (`reports.summary.successRate`), Avg PM2.5 (`airQuality.avgPm25`), Avg VOC (`airQuality.avgVoc`).
- Row: `ChartCard` "Detection trend" (BarChart `reports.detectionTrend` day/count) + `ChartCard` "Peak hours" (BarChart `reports.peakTimePeriods` time/incidents).
- Row: `ChartCard` "High-risk areas" (bar list) + `ChartCard` "Air quality — recent PM2.5" (LineChart `qos.performanceData` + threshold ReferenceLine).
- `ChartCard` "Device performance" → table (id, detections, offline events, avg response).
- `ChartCard` "Officer activity" → table (name, handled, resolved) [omit avgAck '—'].
- `routes.tsx`: change `{ path: 'analytics', Component: AdminReports }` → `AdminAnalytics`; update import; remove `AdminReports` import; delete file.
- [ ] `npm run build` + `npm test` → pass. Commit: `feat: replace AdminReports with real analytics page (wires dead analyticsApi endpoints)`.

## Self-Review
- Dashboard fakes removed (System Health, placeholders, div-bars) → Task 2 ✓
- analyticsApi (4 dead endpoints) wired → Tasks 2+3 ✓
- Recharts everywhere, threshold drawn → Tasks 2+3 ✓
- Blob CSV export → Task 3 ✓
- Placeholder fields omitted (avgResponseTime, uptime) → Tasks 2+3 ✓
- Loading/empty/error via AsyncBoundary → Tasks 2+3 ✓
- Live detection feed is NOT here (P1, Phase 5) — intentional.
