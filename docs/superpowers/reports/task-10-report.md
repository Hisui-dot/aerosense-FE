# Task 10 Report — Real Analytics Computation

## Commit
- Hash: `5b1a02f`
- Message: `feat(backend): compute analytics from real readings and alerts`
- Only `backend/routes/analytics.js` was staged and committed.

## Math.random Verification
```
$ grep -n "Math.random" routes/analytics.js
(no output — zero matches)
```

## Syntax Check
```
$ node --check routes/analytics.js
SYNTAX OK
```

## Curl Outputs

### GET /api/analytics/weekly
```json
[
  {"id":1,"day":"Mon","date":15,"count":0},
  {"id":2,"day":"Tue","date":16,"count":0},
  {"id":3,"day":"Wed","date":17,"count":0},
  {"id":4,"day":"Thu","date":18,"count":0},
  {"id":5,"day":"Fri","date":19,"count":6},
  {"id":6,"day":"Sat","date":20,"count":0},
  {"id":7,"day":"Sun","date":21,"count":0}
]
```
7 day objects with numeric `count` fields derived from real alerts.

### GET /api/analytics/reports (trimmed)
```json
{
  "summary": {
    "totalDetections": 6,
    "confirmedIncidents": 3,
    "falseAlarms": 0,
    "avgResponseTime": "—",
    "successRate": "50%",
    "period": "This week"
  },
  "highRiskAreas": [
    {"location":"CR – Boys Restroom","incidents":1,"percentage":17},
    {"location":"CR – Girls Restroom","incidents":1,"percentage":17},
    {"location":"Hallway – East Wing","incidents":1,"percentage":17},
    {"location":"Cafeteria – Section B","incidents":1,"percentage":17},
    {"location":"CR – Faculty Restroom","incidents":1,"percentage":17}
  ],
  "airQuality": {"avgPm25": 18, "avgVoc": 0.78}
}
```
`summary.totalDetections` is a real count (6), `highRiskAreas` contains real location strings from the DB, `airQuality.avgPm25` is computed from sensor_readings.

### GET /api/analytics/qos (trimmed)
```json
{
  "summaryMetrics": [
    {"label":"Alerts Today","value":"6"},
    {"label":"Active Alerts","value":"3"},
    {"label":"Offline Devices","value":"4"},
    {"label":"Readings (24h)","value":"175"}
  ],
  "performanceData": [
    {"id":1,"time":"02:09 AM","response":44},
    {"id":2,"time":"02:09 AM","response":14},
    {"id":3,"time":"02:09 AM","response":17}
  ]
}
```
`summaryMetrics` has 4 items with real counts; `performanceData` is derived from the last 12 sensor_readings rows.

## Summary
All three handlers (`/weekly`, `/reports`, `/qos`) now compute from live DB data. No `Math.random()` calls remain. Syntax check passes. Port 8001 confirmed free after testing.

---

## Fix Wave 1

### Commit
- Hash: `3996bda`
- Message: `fix(backend): compute detectionTrend from real alerts, dedupe scans, clarify qos perf field`
- Only `backend/routes/analytics.js` staged and committed.

### Verification Outputs

**1. Syntax check**
```
$ node --check routes/analytics.js
syntax OK
```

**2. Math.random check**
```
$ grep -n "Math.random" routes/analytics.js
(no output — zero matches)
```

**3. count: 0 check**
```
$ grep -n "count: 0" routes/analytics.js
(no output — zero matches, hardcoded zero-trend removed)
```

**4. GET /api/analytics/weekly**
```json
[{"id":1,"day":"Mon","date":15,"count":0},{"id":2,"day":"Tue","date":16,"count":0},{"id":3,"day":"Wed","date":17,"count":0},{"id":4,"day":"Thu","date":18,"count":0},{"id":5,"day":"Fri","date":19,"count":6},{"id":6,"day":"Sat","date":20,"count":0},{"id":7,"day":"Sun","date":21,"count":0}]
```
7 day objects. Friday: 6 alerts.

**5. GET /api/analytics/reports — detectionTrend cross-check**
```
detectionTrend total: 6 (should equal weekly alert count, can be >0)
detectionTrend: [{"id":1,"day":"Mon","count":0},{"id":2,"day":"Tue","count":0},{"id":3,"day":"Wed","count":0},{"id":4,"day":"Thu","count":0},{"id":5,"day":"Fri","count":6},{"id":6,"day":"Sat","count":0},{"id":7,"day":"Sun","count":0}]
```
detectionTrend sum (6) equals /weekly sum (6). Cross-check passes.

**6. GET /api/analytics/qos**
```
summaryMetrics count: 4
summaryMetrics: [{"label":"Alerts Today","value":"6"},{"label":"Active Alerts","value":"3"},{"label":"Offline Devices","value":"4"},{"label":"Readings (24h)","value":"175"}]
performanceData count: 12
```
Valid JSON with 4 summaryMetrics and 12 performanceData entries.

**7. Port 8001 after stop**
```
Port 8001 is free
```

### Changes Applied
- Fix 1: Extracted `weeklyAlertCounts()` shared helper; `/weekly` delegates to it; `/reports.detectionTrend` uses it (no more `count: 0` hardcoding).
- Fix 2: Added clarifying comment above `performanceData` in `/qos` noting `response` key carries PM2.5 µg/m³ for frontend shape compatibility.
- Fix 3: Hoisted `allAlerts` and `allReadings` at top of `/qos` handler; replaced 3 inline `store.findAll()` calls with the cached vars.
- Fix 4: Hoisted `users = store.findAll('users')` in `/reports`; replaced inline `store.findAll('users').filter(...)` with `users.filter(...)`.

### Concerns
None. All verifications pass cleanly.
