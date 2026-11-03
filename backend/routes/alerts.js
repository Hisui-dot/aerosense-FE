const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const store = require('../db/store');
const { requireAuth } = require('../middleware/auth');
const { emitAlert } = require('../services/events');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// GET /api/alerts
router.get('/', requireAuth, async (req, res) => {
  let alerts = (await store.findAll('alerts')).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Extract hidden photoUrls from notes
  alerts = alerts.map(alert => {
    const photoNote = (alert.notes || []).find(n => n.text && n.text.startsWith('[SYSTEM:PHOTO_ATTACHED]'));
    if (photoNote) alert.photoUrl = photoNote.text.replace('[SYSTEM:PHOTO_ATTACHED]', '');
    return alert;
  });

  res.json(alerts);
});

// GET /api/alerts/:id
router.get('/:id', requireAuth, async (req, res) => {
  const alert = await store.findById('alerts', req.params.id);
  if (!alert) return res.status(404).json({ message: 'Alert not found' });
  
  const photoNote = (alert.notes || []).find(n => n.text && n.text.startsWith('[SYSTEM:PHOTO_ATTACHED]'));
  if (photoNote) alert.photoUrl = photoNote.text.replace('[SYSTEM:PHOTO_ATTACHED]', '');
  
  res.json(alert);
});

// POST /api/alerts (create new alert — sensor-triggered OR manual incident report)
router.post('/', requireAuth, async (req, res) => {
  const { floor, location, sensorId, source, severity, note } = req.body;
  const isManual = source === 'manual' || !sensorId;

  if (!floor || !location) {
    return res.status(400).json({ message: 'floor and location are required' });
  }
  if (!isManual && !sensorId) {
    return res.status(400).json({ message: 'sensorId is required' });
  }

  const now = new Date();
  const reporter = req.user.name || req.user.username;

  // A manual report is filed by a guard on-scene, so it starts as RESPONDING
  // (they are already handling it) and records them as the responder/reporter.
  const notes = isManual
    ? [{
        id: uuidv4(),
        text: note ? note : 'Manual incident report',
        author: reporter,
        timestamp: now.toISOString(),
      }]
    : [];

  const alert = await store.insert('alerts', {
    id: req.body.id || uuidv4(),
    floor,
    location,
    detectedAt: req.body.detectedAt || now.toISOString(),
    sensorId: sensorId || 'MANUAL',
    status: req.body.status || (isManual ? 'RESPONDING' : 'ACTIVE'),
    respondedBy: isManual ? reporter : null,
    resolvedAt: null,
    createdAt: req.body.createdAt || now.toISOString(),
    source: isManual ? 'manual' : (source || 'auto'),
    notes,
    severity: severity || 'medium',
  });

  if (isManual) {
    await store.insert('logs', {
      id: uuidv4(),
      type: 'detection',
      title: `Manual Report — ${location}`,
      description: `Reported by ${reporter}${severity ? ` · severity ${severity}` : ''}`,
      timestamp: now.toISOString(),
      status: 'reported',
      location,
      deviceId: sensorId || null,
      user: req.user.username,
      severity: severity || 'medium',
      metadata: JSON.stringify({ source: 'manual', floor }),
    });
  }

  emitAlert(alert);
    res.status(201).json(alert);
});

// PUT /api/alerts/:id/resolve
router.put('/:id/resolve', requireAuth, async (req, res) => {
  const alert = await store.findById('alerts', req.params.id);
  if (!alert) return res.status(404).json({ message: 'Alert not found' });

  const updated = await store.update('alerts', req.params.id, {
    status: 'RESOLVED',
    respondedBy: req.user.name || req.user.username,
    resolvedAt: new Date().toISOString(),
  });

  await store.insert('logs', {
    id: uuidv4(),
    type: 'detection',
    title: `Alert Resolved — ${alert.location || alert.floor || 'Unknown location'}`,
    description: `Resolved by ${req.user.name || req.user.username}`,
    timestamp: new Date().toISOString(),
    status: 'resolved',
    location: alert.location,
    deviceId: alert.sensorId,
    user: req.user.username,
    severity: 'low',
    metadata: JSON.stringify({}),
  });

  emitAlert(updated);
    res.json(updated);
});

// PUT /api/alerts/:id/false-alarm
router.put('/:id/false-alarm', requireAuth, async (req, res) => {
  const alert = await store.findById('alerts', req.params.id);
  if (!alert) return res.status(404).json({ message: 'Alert not found' });

  const updated = await store.update('alerts', req.params.id, {
    status: 'FALSE_ALARM',
    respondedBy: req.user.name || req.user.username,
    resolvedAt: new Date().toISOString(),
  });

  emitAlert(updated);
    res.json(updated);
});

// PUT /api/alerts/:id/acknowledge — guard takes ownership; alert enters ACKNOWLEDGED
router.put('/:id/acknowledge', requireAuth, async (req, res) => {
  const alert = await store.findById('alerts', req.params.id);
  if (!alert) return res.status(404).json({ message: 'Alert not found' });

  const responder = req.user.name || req.user.username;
  const updated = await store.update('alerts', req.params.id, {
    status: 'ACKNOWLEDGED',
    respondedBy: responder,
  });

  await store.insert('logs', {
    id: uuidv4(),
    type: 'detection',
    title: `Alert Acknowledged — ${alert.location || alert.floor || 'Unknown location'}`,
    description: `Acknowledged by ${responder}`,
    timestamp: new Date().toISOString(),
    status: 'acknowledged',
    location: alert.location,
    deviceId: alert.sensorId,
    user: req.user.username,
    severity: 'medium',
    metadata: JSON.stringify({}),
  });

  emitAlert(updated);
    res.json(updated);
});

// PUT /api/alerts/:id/respond — guard is on the scene; alert enters RESPONDING
router.put('/:id/respond', requireAuth, async (req, res) => {
  const alert = await store.findById('alerts', req.params.id);
  if (!alert) return res.status(404).json({ message: 'Alert not found' });

  const responder = req.user.name || req.user.username;
  const updated = await store.update('alerts', req.params.id, {
    status: 'RESPONDING',
    respondedBy: alert.respondedBy || responder,
  });

  await store.insert('logs', {
    id: uuidv4(),
    type: 'detection',
    title: `Responding — ${alert.location || alert.floor || 'Unknown location'}`,
    description: `${responder} is responding to the scene`,
    timestamp: new Date().toISOString(),
    status: 'responding',
    location: alert.location,
    deviceId: alert.sensorId,
    user: req.user.username,
    severity: 'medium',
    metadata: JSON.stringify({}),
  });

  emitAlert(updated);
    res.json(updated);
});

// PUT /api/alerts/:id/cancel-acknowledge — undo a mistaken acknowledgment (back to ACTIVE)
router.put('/:id/cancel-acknowledge', requireAuth, async (req, res) => {
  const alert = await store.findById('alerts', req.params.id);
  if (!alert) return res.status(404).json({ message: 'Alert not found' });

  const actor = req.user.name || req.user.username;
  const updated = await store.update('alerts', req.params.id, {
    status: 'ACTIVE',
    respondedBy: null,
  });

  await store.insert('logs', {
    id: uuidv4(),
    type: 'detection',
    title: `Acknowledgment Cancelled — ${alert.location || alert.floor || 'Unknown location'}`,
    description: `${actor} cancelled the acknowledgment; alert returned to active`,
    timestamp: new Date().toISOString(),
    status: 'active',
    location: alert.location,
    deviceId: alert.sensorId,
    user: req.user.username,
    severity: 'medium',
    metadata: JSON.stringify({}),
  });

  emitAlert(updated);
    res.json(updated);
});

// PUT /api/alerts/:id/escalate
router.put('/:id/escalate', requireAuth, async (req, res) => {
  const alert = await store.findById('alerts', req.params.id);
  if (!alert) return res.status(404).json({ message: 'Alert not found' });

  const responder = req.user.name || req.user.username;
  const updated = await store.update('alerts', req.params.id, {
    status: 'ESCALATED',
    respondedBy: alert.respondedBy || responder,
  });

  await store.insert('logs', {
    id: uuidv4(),
    type: 'detection',
    title: `Alert Escalated — ${alert.location || alert.floor || 'Unknown location'}`,
    description: `Escalated by ${responder}`,
    timestamp: new Date().toISOString(),
    status: 'escalated',
    location: alert.location,
    deviceId: alert.sensorId,
    user: req.user.username,
    severity: 'high',
    metadata: JSON.stringify({}),
  });

  emitAlert(updated);
    res.json(updated);
});

// PUT /api/alerts/:id/reopen
router.put('/:id/reopen', requireAuth, async (req, res) => {
  try {
    const alert = await store.findById('alerts', req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });

    const updated = await store.update('alerts', req.params.id, {
      status: 'REOPENED',
      resolvedAt: null,
      respondedBy: null,
    });

    await store.insert('logs', {
      id: uuidv4(),
      type: 'detection',
      title: `Alert Reopened — ${alert.location || alert.floor || 'Unknown location'}`,
      description: `Reopened by ${req.user ? (req.user.name || req.user.username) : 'System'}`,
      timestamp: new Date().toISOString(),
      status: 'reopened',
      location: alert.location,
      deviceId: alert.sensorId,
      user: req.user ? req.user.username : 'system',
      severity: 'medium',
      metadata: JSON.stringify({}),
    });

    emitAlert(updated);
    res.json(updated);
  } catch (error) {
    console.error('Error reopening alert:', error);
    res.status(500).json({ message: 'Internal server error while reopening' });
  }
});

// PUT /api/alerts/:id/assign
router.put('/:id/assign', requireAuth, async (req, res) => {
  const alert = await store.findById('alerts', req.params.id);
  if (!alert) return res.status(404).json({ message: 'Alert not found' });

  const { assignedTo } = req.body;
  if (!assignedTo) return res.status(400).json({ message: 'assignedTo is required' });

  const updated = await store.update('alerts', req.params.id, {
    respondedBy: assignedTo,
  });

  emitAlert(updated);
    res.json(updated);
});

// POST /api/alerts/:id/notes
router.post('/:id/notes', requireAuth, async (req, res) => {
  const alert = await store.findById('alerts', req.params.id);
  if (!alert) return res.status(404).json({ message: 'Alert not found' });

  const { note } = req.body;
  if (!note) return res.status(400).json({ message: 'note is required' });

  const notes = alert.notes || [];
  notes.push({
    id: uuidv4(),
    text: note,
    author: req.user.name || req.user.username,
    timestamp: new Date().toISOString(),
  });

  const updated = await store.update('alerts', req.params.id, { notes });
  emitAlert(updated);
    res.json(updated);
});

// POST /api/alerts/:id/photo
router.post('/:id/photo', requireAuth, upload.single('photo'), async (req, res) => {
  const alert = await store.findById('alerts', req.params.id);
  if (!alert) return res.status(404).json({ message: 'Alert not found' });
  if (!req.file) return res.status(400).json({ message: 'No photo uploaded' });

  const photoUrl = `/uploads/${req.file.filename}`;
  
  // Workaround: Since Supabase doesn't have a photoUrl column, we store it in the JSON notes array!
  const notes = alert.notes || [];
  notes.push({
    id: uuidv4(),
    text: `[SYSTEM:PHOTO_ATTACHED]${photoUrl}`,
    author: 'System',
    timestamp: new Date().toISOString(),
  });

  const updated = await store.update('alerts', req.params.id, { notes });
  updated.photoUrl = photoUrl; // Append it for the immediate response
  
  emitAlert(updated);
  res.json(updated);
});

module.exports = router;
