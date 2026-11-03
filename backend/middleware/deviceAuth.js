const store = require('../db/store');

async function requireDevice(req, res, next) {
  const key = req.headers['x-device-key'];
  if (!key) return res.status(401).json({ message: 'Device key required' });
  const device = await store.findOne('devices', d => d.apiKey && d.apiKey === key);
  if (!device) return res.status(401).json({ message: 'Unknown device key' });
  req.device = device;
  next();
}

module.exports = { requireDevice };