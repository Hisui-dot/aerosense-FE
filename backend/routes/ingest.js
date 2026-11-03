const express = require('express');
const { v4: uuidv4 } = require('uuid');
const store = require('../db/store');
const { requireDevice } = require('../middleware/deviceAuth');
const { parseReading } = require('../validation/schemas');
const { evaluateThreshold, shouldDebounce, resolveThresholds } = require('../services/detection');
const { emitReading, emitAlert } = require('../services/events');

const pushService = require('../services/pushService');
const router = express.Router();
const COOLDOWN_SEC = 120;

router.post('/readings', requireDevice, async (req, res) => {
  const parsed = parseReading(req.body);
  if (!parsed.ok) return res.status(400).json({ message: 'Invalid reading', errors: parsed.errors });

  const device = req.device;
  const now = new Date();
  const nowIso = now.toISOString();
  const recordedAt = parsed.data.recordedAt || nowIso;

  const reading = {
    id: uuidv4(),
    deviceId: device.id,
    pm25: parsed.data.pm25,
    voc: parsed.data.voc,
    temperature: parsed.data.temperature ?? null,
    humidity: parsed.data.humidity ?? null,
    recordedAt,
    createdAt: nowIso,
  };
  await store.insert('sensor_readings', reading);

  await store.update('devices', device.id, {
    pm25: reading.pm25,
    voc: reading.voc,
    temperature: reading.temperature,
    humidity: reading.humidity,
    lastSeen: 'Just now',
    lastUpdate: nowIso,
    status: 'online',
    issue: null,
  });

  emitReading(reading);

  // --- detection ---
  const settings = await store.getSettings();
  const thresholds = resolveThresholds(device, settings);
  const { triggered, reasons } = evaluateThreshold(reading, thresholds);
  let alert = null;

  if (triggered) {
    const deviceAlerts = await store.findDeviceAlerts(device.id);
    const openCount = deviceAlerts.filter(a => a.status === 'ACTIVE' || a.status === 'RESPONDING').length;
    const autoAlerts = deviceAlerts.filter(a => a.source === 'auto' && a.createdAt);
    const lastAutoAlertAt = autoAlerts.length
      ? Math.max(...autoAlerts.map(a => new Date(a.createdAt).getTime()))
      : null;

    if (!shouldDebounce({ openCount, lastAutoAlertAt, now: now.getTime(), cooldownSec: COOLDOWN_SEC })) {
      alert = await store.insert('alerts', {
        id: uuidv4(),
        floor: device.floor || null,
        location: device.location || null,
        detectedAt: nowIso,
        sensorId: device.id,
        deviceId: device.id,
        status: 'ACTIVE',
        respondedBy: null,
        resolvedAt: null,
        pm25: reading.pm25,
        voc: reading.voc,
        source: 'auto',
        createdAt: nowIso,
      });

      await store.insert('logs', {
        id: uuidv4(),
        type: 'detection',
        title: `AeroSense Detection — ${device.location || device.id}`,
        description: reasons.join('; '),
        timestamp: nowIso,
        status: 'active',
        location: device.location || null,
        deviceId: device.id,
        user: null,
        severity: reading.pm25 >= thresholds.pm25Threshold * 1.5 ? 'critical' : 'high',
        metadata: { pm25: reading.pm25, voc: reading.voc, reasons },
      });
      emitAlert(alert);
      try { pushService.notifyAllGuards({ title: 'Alert: Vaping Detected', body: 'Click to see more.', url: '/alerts/' + alert.id }); } catch (err) {}
    }
  }

  res.json({ ok: true, readingId: reading.id, alert });
});

module.exports = router;




