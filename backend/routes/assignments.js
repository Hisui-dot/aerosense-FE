const express = require('express');
const store = require('../db/store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  res.json(await store.findAll('assignments'));
});

router.put('/:id', requireAuth, async (req, res) => {
  const assignment = await store.findById('assignments', req.params.id);
  if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
  const { guardName, shift, status } = req.body;
  const updated = await store.update('assignments', req.params.id, { guardName, shift, status });
  res.json(updated);
});

module.exports = router;
