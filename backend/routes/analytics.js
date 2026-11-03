const express = require('express');
const store = require('../db/store');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Per-weekday alert counts for the current week (Mon..Sun)
async function weeklyAlertCounts() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const alerts = await store.findAll('alerts');
  return days.map((day, i) => {
    const start = new Date(monday); start.setDate(monday.getDate() + i);
    const end = new Date(start); end.setDate(start.getDate() + 1);
    const count = alerts.filter(a => { const t = new Date(a.createdAt); return t >= start && t < end; }).length;
    return { id: i + 1, day, date: start.getDate(), count };
  });
}

// GET /api/analytics/summary
router.get('/summary', requireAdmin, async (req, res) => {
  const alerts = await store.findAll('alerts');
  const devices = await store.findAll('devices');
  const sensors = await store.findAll('devices');
  const logs = await store.findAll('logs');

  const total = alerts.length;
  const confirmed = alerts.filter(a => a.status === 'RESOLVED' || a.status === 'RESPONDING').length;
  const falseAlarms = alerts.filter(a => a.status === 'FALSE_ALARM').length;
  const active = alerts.filter(a => a.status === 'ACTIVE').length;

  const onlineDevices = devices.filter(d => d.status === 'online').length;
  const offlineDevices = devices.filter(d => d.status === 'offline').length;
  const warningDevices = devices.filter(d => d.status === 'warning').length;
  const avgSignal = onlineDevices > 0
    ? Math.round(devices.filter(d => d.status === 'online').reduce((s, d) => s + (d.signalStrength || 0), 0) / onlineDevices)
    : 0;

  const fpr = total > 0 ? ((falseAlarms / total) * 100).toFixed(1) : '0.0';
  const accuracy = (100 - parseFloat(fpr)).toFixed(1);
  const uptime = devices.length > 0 ? ((onlineDevices / devices.length) * 100).toFixed(1) : '100.0';
  
  let totalResponseTimeMs = 0;
  let resolvedCount = 0;
  alerts.forEach(a => {
    if (a.resolvedAt && a.createdAt) {
      const ms = new Date(a.resolvedAt).getTime() - new Date(a.createdAt).getTime();
      if (ms > 0) {
        totalResponseTimeMs += ms;
        resolvedCount++;
      }
    }
  });
  
  const avgResponseSecs = resolvedCount > 0 ? (totalResponseTimeMs / resolvedCount / 1000).toFixed(1) : '0.0';

  res.json({
    alerts: { total, confirmed, falseAlarms, active },
    devices: { total: devices.length, online: onlineDevices, offline: offlineDevices, warning: warningDevices, avgSignal },
    sensors: { total: sensors.length, online: sensors.filter(s => s.status === 'online').length, needAttention: sensors.filter(s => s.battery < 15 || s.status === 'offline').length },
    performance: { uptime: `${uptime}%`, accuracy: `${accuracy}%`, responseTime: `${avgResponseSecs}s`, falsePositiveRate: `${fpr}%` },
  });
});

// GET /api/analytics/weekly — detections per day this week
router.get('/weekly', requireAdmin, async (req, res) => {
  res.json(await weeklyAlertCounts());
});

// GET /api/analytics/reports
router.get('/reports', requireAdmin, async (req, res) => {
  const alerts = await store.findAll('alerts');
  const readings = await store.findAll('sensor_readings');
  const devices = await store.findAll('devices');
  const users = await store.findAll('users');

  const totalDetections = alerts.length;
  const confirmedIncidents = alerts.filter(a => a.status === 'RESOLVED' || a.status === 'RESPONDING').length;
  const falseAlarms = alerts.filter(a => a.status === 'FALSE_ALARM').length;

  const byLocation = {};
  for (const a of alerts) {
    const key = a.location || 'Unknown';
    byLocation[key] = (byLocation[key] || 0) + 1;
  }
  const highRiskAreas = Object.entries(byLocation)
    .map(([location, incidents]) => ({ location, incidents, percentage: totalDetections ? Math.round((incidents / totalDetections) * 100) : 0 }))
    .sort((a, b) => b.incidents - a.incidents).slice(0, 5);

  const buckets = ['8:00–10:00 AM', '10:00–12:00 PM', '12:00–2:00 PM', '2:00–4:00 PM', '4:00–6:00 PM'];
  const bucketFor = (h) => (h >= 8 && h < 10 ? 0 : h >= 10 && h < 12 ? 1 : h >= 12 && h < 14 ? 2 : h >= 14 && h < 16 ? 3 : h >= 16 && h < 18 ? 4 : -1);
  const peakCounts = [0, 0, 0, 0, 0];
  for (const a of alerts) { const b = bucketFor(new Date(a.createdAt).getHours()); if (b >= 0) peakCounts[b]++; }

  res.json({
    summary: {
      totalDetections,
      confirmedIncidents,
      falseAlarms,
      avgResponseTime: '—',
      successRate: totalDetections ? `${Math.round((confirmedIncidents / totalDetections) * 100)}%` : '—',
      period: 'This week',
    },
    detectionTrend: (await weeklyAlertCounts()).map(({ id, day, count }) => ({ id, day, count })),
    highRiskAreas,
    peakTimePeriods: buckets.map((time, i) => ({ time, incidents: peakCounts[i] })),
    devicePerformance: devices.map(d => ({
      id: d.id,
      detections: alerts.filter(a => a && (a.deviceId === d.id || a.sensorId === d.id)).length,
      offlineEvents: d.status === 'offline' ? 1 : 0,
      avgResponse: d.responseTime || '—',
    })),
    userActivity: users.filter(u => u.role === 'security').map(u => ({
      name: u.name,
      handled: alerts.filter(a => a.respondedBy === u.name || a.respondedBy === u.username).length,
      avgAck: '—',
      resolved: alerts.filter(a => (a.respondedBy === u.name || a.respondedBy === u.username) && a.status === 'RESOLVED').length,
    })),
    airQuality: readings.length ? {
      avgPm25: Math.round(readings.reduce((s, r) => s + (r.pm25 || 0), 0) / readings.length * 10) / 10,
      avgVoc: Math.round(readings.reduce((s, r) => s + (r.voc || 0), 0) / readings.length * 100) / 100,
    } : { avgPm25: 0, avgVoc: 0 },
  });
});

// GET /api/analytics/qos
router.get('/qos', requireAdmin, async (req, res) => {
  const devices = await store.findAll('devices');
  const allAlerts = await store.findAll('alerts');
  const allReadings = await store.findAll('sensor_readings');
  const onlineDevices = devices.filter(d => d.status === 'online').length;

  const uptime = devices.length > 0 ? ((onlineDevices / devices.length) * 100).toFixed(1) : '100.0';
  let totalResponseTimeMs = 0;
  let resolvedCount = 0;
  allAlerts.forEach(a => {
    if (a.resolvedAt && a.createdAt) {
      const ms = new Date(a.resolvedAt).getTime() - new Date(a.createdAt).getTime();
      if (ms > 0) {
        totalResponseTimeMs += ms;
        resolvedCount++;
      }
    }
  });
  const avgResponseSecs = resolvedCount > 0 ? (totalResponseTimeMs / resolvedCount / 1000).toFixed(1) : '0.0';

  res.json({
    systemStatus: {
      status: onlineDevices >= devices.length * 0.8 ? 'healthy' : 'warning',
      devicesOnline: onlineDevices,
      totalDevices: devices.length,
      avgResponse: `${avgResponseSecs}s`,
      uptime: `${uptime}%`,
    },
    summaryMetrics: [
      { label: 'Alerts Today', value: String(allAlerts.filter(a => {
        const t = new Date(a.createdAt); const now = new Date();
        return t.toDateString() === now.toDateString();
      }).length) },
      { label: 'Active Alerts', value: String(allAlerts.filter(a => a.status === 'ACTIVE').length) },
      { label: 'Offline Devices', value: String(devices.filter(d => d.status === 'offline').length) },
      { label: 'Readings (24h)', value: String(allReadings.filter(r => Date.now() - new Date(r.recordedAt).getTime() < 86400000).length) },
    ],
    activeIssues: devices
      .filter(d => d.status !== 'online' || d.issue)
      .map(d => ({
        id: d.id,
        location: d.location,
        severity: d.status === 'offline' ? 'critical' : 'warning',
        issue: d.issue || `Status: ${d.status}`,
        lastSeen: d.lastSeen,
        canResolve: d.status === 'offline',
        canInvestigate: d.status !== 'offline',
      })),
    // 'response' key retained for frontend shape compatibility; value is the recent PM2.5 reading (µg/m³)
    performanceData: (() => {
      const readings = allReadings
        .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt)).slice(-12);
      return readings.map((r, i) => ({ id: i + 1, time: new Date(r.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), response: r.pm25 }));
    })(),
    recentEvents: (await store.findAll('logs'))
      .filter(l => l.type === 'device' || l.type === 'system')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5)
      .map(l => ({ time: new Date(l.timestamp).toLocaleTimeString(), event: l.title, severity: l.severity })),
  });
});

module.exports = router;
