const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const store = require('../db/store');
const { requireAuth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { parseSignup } = require('../validation/schemas');

const router = express.Router();

// Rate limiters to prevent brute force attacks
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 login requests per window
  message: { message: 'Too many login attempts from this IP, please try again after 5 minutes.' }
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 signups per hour to prevent spam
  message: { message: 'Too many accounts created from this IP, please try again later.' }
});

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
}

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  let { username, password } = req.body;
  if (username) username = username.trim();
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }

  const user = await store.findOne('users', u => u.username.toLowerCase() === username.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
          return res.status(401).json({ message: 'Invalid username or password' });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ message: 'Account is not active' });
  }

  const token = signToken(user);
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, name: user.name } });
});

// POST /api/auth/signup - registration only. Does NOT create a session (no token).
router.post('/signup', signupLimiter, async (req, res) => {
  const parsed = parseSignup(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ message: parsed.message });
  }

  const { username, password, role = 'security', name, email } = parsed.data;
  const normalizedEmail = String(email).trim().toLowerCase();

  if (await store.findOne('users', u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ message: 'Username already exists' });
  }
  if (await store.findOne('users', u => u.email && u.email.toLowerCase() === normalizedEmail)) {
    return res.status(409).json({ message: 'Email already in use' });
  }

  const user = await store.insert('users', {
    id: uuidv4(),
    username,
    password: bcrypt.hashSync(password, 10),
    role: role === 'admin' ? 'security' : role,
    name: name || username,
    email: normalizedEmail,
    badge: `SEC-${String((await store.findAll('users')).length).padStart(3, '0')}`,
    contact: '',
    status: 'active',
    createdAt: new Date().toISOString(),
  });

  // Intentionally no token: the user must sign in after registering.
  res.status(201).json({
    message: 'Account created. Please sign in.',
    user: { id: user.id, username: user.username, role: user.role, name: user.name, email: user.email },
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const user = await store.findById('users', req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const { password, ...safe } = user;
  res.json(safe);
});

module.exports = router;




