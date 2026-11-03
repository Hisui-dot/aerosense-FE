const express = require('express');
const store = require('../db/store');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  res.json(await store.getSettings());
});

router.put('/', requireAdmin, async (req, res) => {
  await store.setSettings(req.body);
  res.json(await store.getSettings());
});

module.exports = router;
