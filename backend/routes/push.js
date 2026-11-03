const express = require('express');
const { requireAuth } = require('../middleware/auth');
const pushService = require('../services/pushService');

const router = express.Router();

router.get('/vapid-public-key', (req, res) => {
  res.send(pushService.getPublicKey());
});

router.post('/subscribe', requireAuth, (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }
  pushService.saveSubscription(req.user.id, subscription);
  res.status(201).json({ success: true });
});

router.post('/test', requireAuth, (req, res) => {
  pushService.notifyAllGuards({ title: 'TEST SUCCESS', body: 'The Push Notification system is 100% working!' });
  res.json({ success: true });
});

router.get('/count', (req, res) => {
  res.json({ count: pushService.getSubscriptionsCount() });
});

module.exports = router;
