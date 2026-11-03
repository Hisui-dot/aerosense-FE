const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const store = require('../db/store');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

function initCronJobs() {
  console.log('Initializing cron jobs...');

  // 1. Device Heartbeat Checker (Runs every minute)
  setInterval(async () => {
    try {
      await checkDeviceHeartbeats();
    } catch (err) {
      console.error('Error in heartbeat checker:', err);
    }
  }, 60 * 1000);

  // 2. Database Backup (Runs every 24 hours)
  // Let's run it once on startup (delayed by 5s) and then every 24 hours.
  setTimeout(() => {
    try {
      backupDatabase();
    } catch (err) {
      console.error('Error in initial DB backup:', err);
    }
  }, 5000);

  setInterval(() => {
    try {
      backupDatabase();
    } catch (err) {
      console.error('Error in DB backup cron:', err);
    }
  }, 24 * 60 * 60 * 1000);
}

async function checkDeviceHeartbeats() {
  const devices = await store.findAll('devices');
  const nowMs = Date.now();
  const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  for (const d of devices) {
    if (d.status !== 'online') continue;

    // Check lastUpdate
    if (d.lastUpdate) {
      const lastUpdateMs = new Date(d.lastUpdate).getTime();
      if (nowMs - lastUpdateMs > OFFLINE_THRESHOLD_MS) {
        // Mark as offline
        await store.update('devices', d.id, {
          status: 'offline',
          issue: 'Lost connection (No heartbeat in 5 mins)',
          lastSeen: 'Over 5 mins ago',
        });

        // Generate log
        const logId = `L-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
        await store.insert('logs', {
          id: logId,
          type: 'device',
          title: `Device Offline — ${d.name || d.id}`,
          description: 'Lost connection (No heartbeat in 5 mins)',
          timestamp: new Date().toISOString(),
          status: 'error',
          location: d.location,
          deviceId: d.id,
          user: null,
          severity: 'critical',
          metadata: JSON.stringify({ threshold: '5m' })
        });
        
        console.log(`[CRON] Device ${d.id} marked as OFFLINE due to missed heartbeat.`);
      }
    }
  }
}

function backupDatabase() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Keep max 7 backups
  const existingFiles = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db'));
  if (existingFiles.length >= 7) {
    // Sort oldest first and delete
    existingFiles.sort();
    const toDelete = existingFiles.slice(0, existingFiles.length - 6);
    for (const f of toDelete) {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
    }
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const backupPath = path.join(BACKUP_DIR, `vape-backup-${dateStr}.db`);
  
  // Use VACUUM INTO for a safe hot backup
  try {
    // Note: getDb() is not exported directly, but we can do a hack or export it,
    // actually, let's just use the fact that store requires 'node:sqlite' 
    // Wait, store.js doesn't export the db instance.
    // So we can just export a `backupDb(path)` function in store.js!
    store.backupDb(backupPath);
    console.log(`[CRON] Database safely backed up to ${backupPath}`);
  } catch (err) {
    console.error(`[CRON] Database backup failed: ${err.message}`);
  }
}

module.exports = { initCronJobs };
