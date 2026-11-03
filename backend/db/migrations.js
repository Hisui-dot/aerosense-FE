function columnExists(db, table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some(c => c.name === column);
}

function ensureColumn(db, table, column, typeDef) {
  if (!columnExists(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDef}`);
  }
}

function runMigrations(db) {
  // First, ensure all new columns exist.
  ensureColumn(db, 'devices', 'apiKey', 'TEXT');
  ensureColumn(db, 'devices', 'pm25Threshold', 'REAL');
  ensureColumn(db, 'devices', 'vocThreshold', 'REAL');
  ensureColumn(db, 'devices', 'updatedAt', 'TEXT');

  ensureColumn(db, 'alerts', 'deviceId', 'TEXT');
  ensureColumn(db, 'alerts', 'pm25', 'REAL');
  ensureColumn(db, 'alerts', 'voc', 'REAL');
  ensureColumn(db, 'alerts', 'source', "TEXT DEFAULT 'manual'");
  ensureColumn(db, 'alerts', 'notes', 'TEXT');
  ensureColumn(db, 'alerts', 'severity', "TEXT DEFAULT 'medium'");

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      appliedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS sensor_readings (
      id          TEXT PRIMARY KEY,
      deviceId    TEXT NOT NULL,
      pm25        REAL,
      voc         REAL,
      temperature REAL,
      humidity    REAL,
      recordedAt  TEXT NOT NULL,
      createdAt   TEXT NOT NULL,
      FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_readings_device_time ON sensor_readings(deviceId, recordedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_readings_time        ON sensor_readings(recordedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_alerts_device        ON alerts(deviceId);
    CREATE INDEX IF NOT EXISTS idx_alerts_sensor        ON alerts(sensorId);
  `);

  const stamp = new Date().toISOString();
  db.prepare('INSERT OR IGNORE INTO schema_migrations (version, appliedAt) VALUES (?, ?)').run(1, stamp);
}

module.exports = { runMigrations, columnExists };