const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const store = require('../db/store');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  const users = (await store.findAll('users')).map(({ password, ...u }) => u);
  res.json(users);
});

router.get('/:id', requireAdmin, async (req, res) => {
  const user = await store.findById('users', req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const { password, ...safe } = user;
  res.json(safe);
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', requireAdmin, async (req, res) => {
  const { username, password, role, name, email, badge, contact } = req.body;
  if (!username || !password || !email) {
    return res.status(400).json({ message: 'Username, email and password are required' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Please enter a valid email address' });
  }
  if (await store.findOne('users', u => u.username === username)) {
    return res.status(409).json({ message: 'Username already exists' });
  }
  if (await store.findOne('users', u => u.email && u.email.toLowerCase() === normalizedEmail)) {
    return res.status(409).json({ message: 'Email already in use' });
  }
  const user = await store.insert('users', {
    id: uuidv4(),
    username,
    password: bcrypt.hashSync(password, 10),
    role: role || 'security',
    name: name || username,
    email: normalizedEmail,
    badge: badge || `SEC-${String((await store.findAll('users')).length).padStart(3, '0')}`,
    contact: contact || '',
    status: 'active',
    createdAt: new Date().toISOString(),
  });
  const { password: _, ...safe } = user;
  res.status(201).json(safe);
});

router.put('/:id', requireAdmin, async (req, res) => {
  const user = await store.findById('users', req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const { password, ...changes } = req.body;
  if (password) changes.password = bcrypt.hashSync(password, 10);

  if (changes.email) {
    const normalizedEmail = String(changes.email).trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    const clash = await store.findOne(
      'users',
      u => u.id !== req.params.id && u.email && u.email.toLowerCase() === normalizedEmail
    );
    if (clash) return res.status(409).json({ message: 'Email already in use' });
    changes.email = normalizedEmail;
  }

  const updated = await store.update('users', req.params.id, changes);
  const { password: _, ...safe } = updated;
  res.json(safe);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const user = await store.findById('users', req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  await store.remove('users', req.params.id);
  res.json({ message: 'User deleted' });
});

module.exports = router;
