const bcrypt = require('bcryptjs');

function seed(db) {
  const now = new Date().toISOString();

  const users = [
    { id: 'u1', username: 'admin', password: bcrypt.hashSync('admin123', 10), role: 'admin', name: 'Admin', email: 'admin@aerosense.com', badge: 'ADM-001', contact: '+63 912 345 6789', status: 'active', createdAt: now },
    { id: 'u2', username: 'security', password: bcrypt.hashSync('security123', 10), role: 'security', name: 'Security', email: 'security@aerosense.com', badge: 'SEC-001', contact: '+63 917 001 0001', status: 'active', createdAt: now },
    { id: 'u3', username: 'jdoe', password: bcrypt.hashSync('password123', 10), role: 'security', name: 'John Doe', email: 'john.doe@aerosense.com', badge: 'SEC-002', contact: '+63 917 234 5678', status: 'active', createdAt: now },
    { id: 'u4', username: 'asmith', password: bcrypt.hashSync('password123', 10), role: 'admin', name: 'Anna Smith', email: 'anna.smith@aerosense.com', badge: 'ADM-002', contact: '+63 920 345 6789', status: 'active', createdAt: now },
    { id: 'u5', username: 'Admin', password: bcrypt.hashSync('Admin123', 10), role: 'admin', name: 'Admin User', email: 'admin-new@aerosense.com', badge: 'ADM-003', contact: '', status: 'active', createdAt: now },
  ];

  const alerts = [
    { id: 'a1', floor: '1st Floor', location: 'Room 101', detectedAt: '10:02 AM', sensorId: 'S001', deviceId: 'S001', status: 'ACTIVE', respondedBy: null, resolvedAt: null, photoUrl: null, createdAt: now },
    { id: 'a2', floor: '2nd Floor', location: 'CR 2F', detectedAt: '10:08 AM', sensorId: 'S002', deviceId: 'S002', status: 'ACTIVE', respondedBy: null, resolvedAt: null, photoUrl: null, createdAt: now },
    { id: 'a3', floor: '1st Floor', location: 'Lab 1', detectedAt: '9:55 AM', sensorId: 'S003', deviceId: 'S003', status: 'RESPONDING', respondedBy: 'Security', resolvedAt: null, photoUrl: null, createdAt: now },
    { id: 'a4', floor: '1st Floor', location: 'Hallway East', detectedAt: '9:40 AM', sensorId: 'S004', deviceId: 'S004', status: 'RESOLVED', respondedBy: 'John Doe', resolvedAt: now, photoUrl: null, createdAt: now },
    { id: 'a5', floor: 'Ground Floor', location: 'Cafeteria', detectedAt: '9:25 AM', sensorId: 'S005', deviceId: 'S005', status: 'RESOLVED', respondedBy: 'Security', resolvedAt: now, photoUrl: null, createdAt: now },
  ];

  const sensors = [
    { id: 'S-01', name: 'Vape Sensor 01', floor: '1st Floor', location: 'CR – Main Lobby', battery: 78, status: 'online', sensorHealth: 92, lastServiced: 'Mar 15, 2026', replaceIn: '~8 months', nextService: 'Sep 15, 2026', notes: null },
    { id: 'S-02', name: 'Vape Sensor 02', floor: '1st Floor', location: 'Hallway – West Wing', battery: 12, status: 'online', sensorHealth: 68, lastServiced: 'Feb 20, 2026', replaceIn: '~4 months', nextService: 'Jun 20, 2026', notes: 'Battery replacement needed soon.' },
    { id: 'S-03', name: 'Vape Sensor 03', floor: '2nd Floor', location: 'CR – Boys Restroom', battery: 55, status: 'online', sensorHealth: 85, lastServiced: 'Apr 1, 2026', replaceIn: '~6 months', nextService: 'Oct 1, 2026', notes: null },
    { id: 'S-04', name: 'Vape Sensor 04', floor: '2nd Floor', location: 'CR – Girls Restroom', battery: 9, status: 'online', sensorHealth: 71, lastServiced: 'Jan 10, 2026', replaceIn: '~3 months', nextService: 'Apr 10, 2026', notes: 'Critical battery — replace immediately.' },
    { id: 'S-05', name: 'Vape Sensor 05', floor: '3rd Floor', location: 'CR – Boys Restroom', battery: 43, status: 'maintenance', sensorHealth: 45, lastServiced: 'Mar 5, 2026', replaceIn: '~2 months', nextService: 'May 5, 2026', notes: 'Sensor element degraded. Schedule replacement.' },
    { id: 'S-06', name: 'Vape Sensor 06', floor: '3rd Floor', location: 'CR – Girls Restroom', battery: 91, status: 'online', sensorHealth: 97, lastServiced: 'Apr 10, 2026', replaceIn: '~10 months', nextService: 'Feb 10, 2027', notes: null },
    { id: 'S-07', name: 'Vape Sensor 07', floor: '3rd Floor', location: 'Hallway – East Wing', battery: 6, status: 'offline', sensorHealth: 30, lastServiced: 'Dec 1, 2025', replaceIn: 'Overdue', nextService: 'Immediate', notes: 'Sensor offline. Battery dead. Requires urgent attention.' },
    { id: 'S-08', name: 'Vape Sensor 08', floor: '4th Floor', location: 'CR – Faculty Restroom', battery: 67, status: 'online', sensorHealth: 88, lastServiced: 'Apr 5, 2026', replaceIn: '~7 months', nextService: 'Nov 5, 2026', notes: null },
    { id: 'S-09', name: 'Vape Sensor 09', floor: '4th Floor', location: 'Library – Section A', battery: 34, status: 'online', sensorHealth: 76, lastServiced: 'Mar 28, 2026', replaceIn: '~5 months', nextService: 'Sep 28, 2026', notes: null },
    { id: 'S-10', name: 'Vape Sensor 10', floor: 'Ground Floor', location: 'Cafeteria – Section B', battery: 82, status: 'online', sensorHealth: 94, lastServiced: 'Apr 12, 2026', replaceIn: '~9 months', nextService: 'Jan 12, 2027', notes: null },
  ];

  const assignments = [
    { id: 'f1', floor: 'Ground Floor', zones: JSON.stringify(['Main Entrance', 'Cafeteria', 'Guard Post']), guardName: 'John Doe', badge: 'SEC-001', shift: 'Morning', status: 'on-duty', contact: '0917-001-0001' },
    { id: 'f2', floor: '1st Floor', zones: JSON.stringify(['Lobby', 'CR – West', 'Admin Office']), guardName: 'Security', badge: 'SEC-002', shift: 'Morning', status: 'on-duty', contact: '0917-001-0002' },
    { id: 'f3', floor: '2nd Floor', zones: JSON.stringify(['CR – Boys', 'CR – Girls', 'Hallway']), guardName: 'Guard A', badge: 'SEC-003', shift: 'Morning', status: 'break', contact: '0917-001-0003' },
    { id: 'f4', floor: '3rd Floor', zones: JSON.stringify(['CR – Boys', 'CR – Girls', 'Library']), guardName: 'Guard B', badge: 'SEC-004', shift: 'Afternoon', status: 'on-duty', contact: '0917-001-0004' },
    { id: 'f5', floor: '4th Floor', zones: JSON.stringify(['Faculty CR', 'Conference Rm']), guardName: 'Guard C', badge: 'SEC-005', shift: 'Afternoon', status: 'off-duty', contact: '0917-001-0005' },
    { id: 'f6', floor: 'Rooftop', zones: JSON.stringify(['Rooftop Access', 'Fire Exit']), guardName: 'Guard D', badge: 'SEC-006', shift: 'Night', status: 'on-duty', contact: '0917-001-0006' },
  ];

  const devices = [
    { id: 'S001', name: 'Sensor A', location: 'Room 101', floor: '1st Floor', status: 'online', pm25: 12, voc: 0.3, temperature: 22, humidity: 45, lastUpdate: '5s ago', lastSeen: 'Just now', responseTime: '1.2s', signalStrength: 95, battery: 87, firmware: 'v2.1.4', powerStatus: 'Battery', networkSignal: 'Strong', issue: null },
    { id: 'S002', name: 'Sensor B', location: 'CR 2F', floor: '2nd Floor', status: 'offline', pm25: 0, voc: 0, temperature: null, humidity: null, lastUpdate: '5 mins ago', lastSeen: '5 mins ago', responseTime: 'N/A', signalStrength: 0, battery: 45, firmware: 'v2.1.3', powerStatus: 'Battery', networkSignal: 'None', issue: 'Device offline' },
    { id: 'S003', name: 'Sensor C', location: 'Lab 1', floor: '1st Floor', status: 'warning', pm25: 45, voc: 2.8, temperature: 24, humidity: 52, lastUpdate: '2s ago', lastSeen: 'Just now', responseTime: '4.5s', signalStrength: 78, battery: 92, firmware: 'v2.1.4', powerStatus: 'Battery', networkSignal: 'Fair', issue: 'High VOC levels' },
    { id: 'S004', name: 'Sensor D', location: 'Hallway East', floor: '1st Floor', status: 'online', pm25: 15, voc: 0.5, temperature: 23, humidity: 48, lastUpdate: '3s ago', lastSeen: 'Just now', responseTime: '1.4s', signalStrength: 88, battery: 76, firmware: 'v2.1.4', powerStatus: 'Battery', networkSignal: 'Good', issue: null },
    { id: 'S005', name: 'Sensor E', location: 'Cafeteria', floor: 'Ground Floor', status: 'online', pm25: 18, voc: 0.7, temperature: 26, humidity: 60, lastUpdate: '1s ago', lastSeen: 'Just now', responseTime: '1.1s', signalStrength: 91, battery: 65, firmware: 'v2.1.4', powerStatus: 'Battery', networkSignal: 'Strong', issue: null },
    { id: 'S006', name: 'Sensor F', location: 'Room 203', floor: '2nd Floor', status: 'online', pm25: 10, voc: 0.4, temperature: 21, humidity: 44, lastUpdate: '4s ago', lastSeen: 'Just now', responseTime: '1.3s', signalStrength: 82, battery: 88, firmware: 'v2.1.4', powerStatus: 'Battery', networkSignal: 'Good', issue: null },
    { id: 'S007', name: 'Sensor G', location: 'Lab 2', floor: '2nd Floor', status: 'offline', pm25: 0, voc: 0, temperature: null, humidity: null, lastUpdate: '15 mins ago', lastSeen: '15 mins ago', responseTime: 'N/A', signalStrength: 0, battery: 12, firmware: 'v2.1.2', powerStatus: 'Battery', networkSignal: 'None', issue: 'Low battery, offline' },
  ];

  const logs = [
    { id: 'L001', type: 'detection', title: 'AeroSense Detection — Room 203', description: 'High VOC levels detected', timestamp: now, status: 'active', location: 'Room 203', deviceId: 'S003', user: null, severity: 'high', metadata: JSON.stringify({ voc: 2.8, pm25: 45, confidence: 95 }) },
    { id: 'L002', type: 'detection', title: 'AeroSense Detection — CR 2F', description: 'PM2.5 spike detected', timestamp: now, status: 'resolved', location: 'CR 2F', deviceId: 'S002', user: null, severity: 'high', metadata: JSON.stringify({ voc: 1.9, pm25: 62, confidence: 88 }) },
    { id: 'L003', type: 'system', title: 'System Health Check Passed', description: 'All monitors healthy', timestamp: now, status: 'success', location: null, deviceId: null, user: null, severity: 'low', metadata: JSON.stringify({}) },
    { id: 'L004', type: 'device', title: 'Device Offline — S002', description: 'Lost connection', timestamp: now, status: 'error', location: 'CR 2F', deviceId: 'S002', user: null, severity: 'critical', metadata: JSON.stringify({}) },
    { id: 'L005', type: 'audit', title: 'Admin Login', description: 'Admin logged in from web dashboard', timestamp: now, status: 'success', location: null, deviceId: null, user: 'admin', severity: 'low', metadata: JSON.stringify({}) },
    { id: 'L006', type: 'detection', title: 'AeroSense Detection — Cafeteria', description: 'PM2.5 elevated', timestamp: now, status: 'false_alarm', location: 'Cafeteria', deviceId: 'S005', user: null, severity: 'medium', metadata: JSON.stringify({ voc: 0.9, pm25: 28, confidence: 55 }) },
    { id: 'L007', type: 'system', title: 'Firmware Update Available', description: 'v2.1.5 available for S007', timestamp: now, status: 'warning', location: null, deviceId: 'S007', user: null, severity: 'medium', metadata: JSON.stringify({}) },
    { id: 'L008', type: 'device', title: 'Low Battery — S004', description: 'Battery at 12%', timestamp: now, status: 'warning', location: 'Hallway East', deviceId: 'S004', user: null, severity: 'medium', metadata: JSON.stringify({ battery: 12 }) },
    { id: 'L009', type: 'audit', title: 'User Role Changed', description: 'jreyes role updated to security', timestamp: now, status: 'success', location: null, deviceId: null, user: 'admin', severity: 'low', metadata: JSON.stringify({}) },
    { id: 'L010', type: 'detection', title: 'AeroSense Detection — Lab 1', description: 'Multiple sensors triggered', timestamp: now, status: 'resolved', location: 'Lab 1', deviceId: 'S003', user: null, severity: 'critical', metadata: JSON.stringify({ voc: 3.1, pm25: 78, confidence: 97 }) },
  ];

  const defaultSettings = {
    pm25Threshold: '35', vocThreshold: '0.60', sensitivityLevel: 'medium', detectionDelay: '2',
    requireBothSensors: true, autoConfirmDetection: false, sendAlertOnDetection: true,
    requireConfirmation: true, autoResolveAlerts: false, webDashboard: true, mobilePush: true,
    emailAlerts: false, retryFailedAlerts: true, maxRetryAttempts: '3', defaultLocationTag: 'Unassigned',
    defaultSensitivity: 'medium', autoSync: true, autoCalibration: false, firmwareAutoUpdate: false,
    healthCheckInterval: '5', systemName: 'AeroSense System', timezone: 'GMT+8',
    dataRefreshRate: '5', logRetention: '30', autoBackup: true, dataExportFormat: 'CSV',
    requireLogin: true, sessionTimeout: '15', roleBasedAccess: true, passwordPolicy: 'strong',
    twoFactorAuth: false, failedLoginLockout: '3', networkStatus: 'Connected', protocol: 'LoRaWAN',
    apiAccess: false,
  };

  // Insert all data in a transaction
  db.exec('BEGIN');
  try {
    for (const u of users) {
      db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?)').run(
        u.id, u.username, u.password, u.role, u.name, u.email, u.badge, u.contact, u.status, u.createdAt
      );
    }
    for (const a of alerts) {
      db.prepare(`INSERT INTO alerts
        (id, floor, location, detectedAt, sensorId, status, respondedBy, resolvedAt, photoUrl, createdAt, deviceId)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
        a.id, a.floor, a.location, a.detectedAt, a.sensorId, a.status, a.respondedBy, a.resolvedAt, a.photoUrl, a.createdAt, a.deviceId
      );
    }
    for (const s of sensors) {
      db.prepare('INSERT INTO sensors VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
        s.id, s.name, s.floor, s.location, s.battery, s.status, s.sensorHealth, s.lastServiced, s.replaceIn, s.nextService, s.notes
      );
    }
    for (const a of assignments) {
      db.prepare('INSERT INTO assignments VALUES (?,?,?,?,?,?,?,?)').run(
        a.id, a.floor, a.zones, a.guardName, a.badge, a.shift, a.status, a.contact
      );
    }
    const crypto = require('crypto');
    const deviceKeys = {};
    for (const d of devices) {
      const apiKey = 'ak_' + crypto.randomBytes(24).toString('hex');
      deviceKeys[d.id] = apiKey;
      db.prepare(`INSERT INTO devices
        (id, name, location, floor, status, pm25, voc, temperature, humidity,
         lastUpdate, lastSeen, responseTime, signalStrength, battery,
         firmware, powerStatus, networkSignal, issue, apiKey)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        d.id, d.name, d.location, d.floor, d.status, d.pm25, d.voc, d.temperature, d.humidity,
        d.lastUpdate, d.lastSeen, d.responseTime, d.signalStrength, d.battery,
        d.firmware, d.powerStatus, d.networkSignal, d.issue, apiKey
      );
    }
    const nowMs = Date.now();
    for (const d of devices) {
      for (let i = 24; i >= 1; i--) {
        const ts = new Date(nowMs - i * 5 * 60 * 1000).toISOString(); // every 5 min, last 2h
        const jitterPm = Math.max(0, (d.pm25 || 8) + (i % 5) - 2);
        const jitterVoc = Math.max(0, (d.voc || 0.3) + ((i % 3) - 1) * 0.05);
        db.prepare(`INSERT INTO sensor_readings
          (id, deviceId, pm25, voc, temperature, humidity, recordedAt, createdAt)
          VALUES (?,?,?,?,?,?,?,?)`).run(
          `${d.id}-r${i}`, d.id, jitterPm, jitterVoc, d.temperature, d.humidity, ts, ts
        );
      }
    }
    for (const l of logs) {
      db.prepare('INSERT INTO logs VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
        l.id, l.type, l.title, l.description, l.timestamp, l.status,
        l.location, l.deviceId, l.user, l.severity, l.metadata
      );
    }
    for (const [key, value] of Object.entries(defaultSettings)) {
      db.prepare('INSERT INTO settings VALUES (?,?)').run(key, JSON.stringify(value));
    }
    db.exec('COMMIT');
    console.log('Seeded device API keys (local dev only):');
    for (const [id, key] of Object.entries(deviceKeys)) console.log(`  ${id}: ${key}`);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = { seed };
