const express = require('express');
const store = require('../db/store');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { type, severity, search, limit, offset } = req.query;
  const numLimit = limit ? parseInt(limit, 10) : 50;
  const numOffset = offset ? parseInt(offset, 10) : 0;
  
  const result = await store.findLogs({ type, severity, search, limit: numLimit, offset: numOffset });
  res.json(result);
});

router.delete('/', requireAdmin, async (req, res) => {
  await store.clearTable('logs');
  res.json({ message: 'All logs cleared' });
});

module.exports = router;
