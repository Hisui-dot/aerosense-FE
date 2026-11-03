const express = require('express');
const { v4: uuidv4 } = require('uuid');
const store = require('../db/store');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { generateApiKey } = require('../utils/apiKey');

const { publishCommand, getDeviceHealth } = require('../services/mqttClient');
const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const devices = (await store.findAll('devices')).map(d => {
    let finalDevice = { ...d, ...getDeviceHealth(d.id) };
    if (!isAdmin) delete finalDevice.apiKey;
    return finalDevice;
  });
  res.json(devices);
});

router.get('/:id', requireAuth, async (req, res) => {
  const device = await store.findById('devices', req.params.id);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  
  Object.assign(device, getDeviceHealth(device.id));
  

  const events = (await store.findAll('logs'))
    .filter(l => l.deviceId === req.params.id)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);

  const isAdmin = req.user.role === 'admin';
  const { apiKey, ...rest } = device;
  const payload = isAdmin ? device : rest;
  res.json({ ...payload, events });
});

// Columns an admin may update via PUT. `id`/`apiKey` are protected; `updatedAt`
// is auto-stamped by store.update. Unknown keys are ignored (no 500 on stray fields).
const DEVICE_UPDATABLE = [
  'name', 'location', 'status', 'pm25', 'voc', 'temperature', 'humidity',
  'lastUpdate', 'lastSeen', 'issue'
];

router.put('/:id', requireAdmin, async (req, res) => {
  const device = await store.findById('devices', req.params.id);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  const body = req.body || {};
  const patch = {};
  for (const key of DEVICE_UPDATABLE) {
    if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = body[key];
  }
  const updated = await store.update('devices', req.params.id, patch);
  res.json(updated);
});

router.post('/:id/restart', requireAdmin, async (req, res) => {
  const device = await store.findById('devices', req.params.id);
  if (!device) return res.status(404).json({ message: 'Device not found' });

  publishCommand(device.apiKey, { command: 'restart', timestamp: new Date().toISOString() });

  await store.insert('logs', {
    id: uuidv4(),
    type: 'device',
    title: "Device Restarted - ",
    description: "Restart command sent by  via MQTT",
    timestamp: new Date().toISOString(),
    status: 'success',
    location: device.location,
    deviceId: device.id,
    user: req.user.username,
    severity: 'low',
    metadata: JSON.stringify({ action: 'restart' }),
  });

  res.json({ message: 'Restart command transmitted to hardware' });
});

router.post('/:id/disable', requireAdmin, async (req, res) => {
  const device = await store.findById('devices', req.params.id);
  if (!device) return res.status(404).json({ message: 'Device not found' });

  publishCommand(device.apiKey, { command: 'sleep', duration: 'indefinite' });
  await store.update('devices', req.params.id, { status: 'offline', issue: 'Manually disabled' });

  await store.insert('logs', {
    id: uuidv4(),
    type: 'device',
    title: "Device Disabled - ",
    description: "Sleep command transmitted by  via MQTT",
    timestamp: new Date().toISOString(),
    status: 'warning',
    location: device.location,
    deviceId: device.id,
    user: req.user.username,
    severity: 'medium',
    metadata: JSON.stringify({ action: 'sleep' }),
  });

  res.json({ message: 'Sleep command transmitted to hardware' });
});

router.post('/:id/recalibrate', requireAdmin, async (req, res) => {
  const device = await store.findById('devices', req.params.id);
  if (!device) return res.status(404).json({ message: 'Device not found' });

  publishCommand(device.apiKey, { command: 'recalibrate_baseline' });

  await store.insert('logs', {
    id: uuidv4(),
    type: 'device',
    title: "Recalibration Started - ",
    description: "Recalibrate baseline command sent by  via MQTT",
    timestamp: new Date().toISOString(),
    status: 'success',
    location: device.location,
    deviceId: device.id,
    user: req.user.username,
    severity: 'low',
    metadata: JSON.stringify({ action: 'recalibrate' }),
  });

  res.json({ message: 'Recalibration command transmitted to hardware' });
});

// Create a device (admin) - returns the generated apiKey once
router.post('/', requireAdmin, async (req, res) => {
  const { name, location, floor, apiKey: customApiKey } = req.body || {};
  if (!name) return res.status(400).json({ message: 'name is required' });
  const now = new Date().toISOString();
  
  try {
    const device = await store.insert('devices', {
      id: uuidv4(),
      name,
      location: location || null,
      status: 'offline',
      pm25: 0,
      voc: 0,
      temperature: null,
      humidity: null,
      issue: null,
      lastSeen: 'Never',
      lastUpdate: now,
      createdAt: now,
      apiKey: customApiKey ? customApiKey : generateApiKey(),
    });
    res.status(201).json(device);
  } catch (err) {
    console.error('Device creation error:', err);
    res.status(500).json({ message: err.message || 'Failed to create device' });
  }
});

// Rotate a device's API key (admin)
router.post('/:id/rotate-key', requireAdmin, async (req, res) => {
  const device = await store.findById('devices', req.params.id);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  const updated = await store.update('devices', req.params.id, { apiKey: generateApiKey() });
  res.json({ id: updated.id, apiKey: updated.apiKey });
});

// Recent readings for a device (auth) — index-backed time series
router.get('/:id/readings', requireAuth, async (req, res) => {
  const device = await store.findById('devices', req.params.id);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  const parsedLimit = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 1000) : 100;
  res.json(await store.recentReadings(req.params.id, limit));
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const device = await store.findById('devices', req.params.id);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  await store.remove('devices', req.params.id);
  res.json({ message: 'Device deleted' });
});

module.exports = router;





