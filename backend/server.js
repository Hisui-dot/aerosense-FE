const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const authRoutes = require('./routes/auth');
const alertRoutes = require('./routes/alerts');
const sensorRoutes = require('./routes/sensors');
const assignmentRoutes = require('./routes/assignments');
const deviceRoutes = require('./routes/devices');
const userRoutes = require('./routes/users');
const logRoutes = require('./routes/logs');
const settingsRoutes = require('./routes/settings');
const analyticsRoutes = require('./routes/analytics');
const streamRoutes = require('./routes/stream');
const ingestRoutes = require('./routes/ingest');
const pushRoutes = require('./routes/push');

const app = express();
app.set('trust proxy', 1); // Fixes express-rate-limit behind Render proxy
// Override port 8000 to match the Vite proxy (8001) and prevent EADDRINUSE conflicts
const PORT = process.env.PORT === '8000' ? 8001 : (process.env.PORT || 8001);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    if (!path.extname(filePath)) {
      res.setHeader('Content-Type', 'image/jpeg');
    }
  },
}));

app.use('/api/auth', authRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/push', pushRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Global error handler so errors are returned as JSON instead of HTML error pages
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
});

// Backend is API-only in production since Vercel serves the frontend
app.get('/', (req, res) => {
  res.json({ status: 'Aerosense API is running' });
});

const { initCronJobs } = require('./services/cron');
const { initMqtt } = require('./services/mqttClient');

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  initCronJobs();
  initMqtt();
});

