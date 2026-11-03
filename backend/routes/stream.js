const express = require('express');
const jwt = require('jsonwebtoken');
const { bus } = require('../services/events');

const router = express.Router();

// EventSource cannot set Authorization headers, so accept the JWT via ?token=
router.get('/', (req, res) => {
  const token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '');
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write(': connected\n\n');

  const send = (event) => (payload) => res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  const onReading = send('reading');
  const onAlert = send('alert');
  bus.on('reading', onReading);
  bus.on('alert', onAlert);

  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    bus.off('reading', onReading);
    bus.off('alert', onAlert);
  });
});

module.exports = router;
