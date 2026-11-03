const express = require('express');
const { v4: uuidv4 } = require('uuid');
const store = require('../db/store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  res.json(await store.findAll('devices'));
});

router.get('/:id', requireAuth, async (req, res) => {
  const sensor = await store.findById('devices', req.params.id);
  if (!sensor) return res.status(404).json({ message: 'Sensor not found' });
  res.json(sensor);
});

router.put('/:id', requireAuth, async (req, res) => {
  const sensor = await store.findById('devices', req.params.id);
  if (!sensor) return res.status(404).json({ message: 'Sensor not found' });
  const updated = await store.update('devices', req.params.id, req.body);
  res.json(updated);
});

router.post('/:id/maintenance', requireAuth, async (req, res) => {
  const sensor = await store.findById('devices', req.params.id);
  if (!sensor) return res.status(404).json({ message: 'Sensor not found' });

  await store.insert('logs', {
    id: uuidv4(),
    type: 'device',
    title: `Maintenance Ticket — ${sensor.id}`,
    description: `Maintenance requested by ${req.user.name || req.user.username}`,
    timestamp: new Date().toISOString(),
    status: 'warning',
    location: sensor.location,
    deviceId: sensor.id,
    user: req.user.username,
    severity: 'medium',
    metadata: JSON.stringify({ sensor: sensor.id }),
  });

  res.json({ message: `Maintenance ticket submitted for ${sensor.id}` });
});

module.exports = router;
