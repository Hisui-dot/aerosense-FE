const { test } = require('node:test');
const assert = require('node:assert');
const { DatabaseSync } = require('node:sqlite');
const { runMigrations, columnExists } = require('./migrations');

function baseDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE devices (id TEXT PRIMARY KEY, name TEXT, pm25 REAL, voc REAL);
    CREATE TABLE alerts  (id TEXT PRIMARY KEY, status TEXT, sensorId TEXT);
  `);
  return db;
}

test('creates sensor_readings table', () => {
  const db = baseDb();
  runMigrations(db);
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sensor_readings'").get();
  assert.ok(row, 'sensor_readings should exist');
});

test('adds new columns to devices and alerts', () => {
  const db = baseDb();
  runMigrations(db);
  assert.ok(columnExists(db, 'devices', 'apiKey'));
  assert.ok(columnExists(db, 'devices', 'pm25Threshold'));
  assert.ok(columnExists(db, 'devices', 'vocThreshold'));
  assert.ok(columnExists(db, 'devices', 'updatedAt'));
  assert.ok(columnExists(db, 'alerts', 'deviceId'));
  assert.ok(columnExists(db, 'alerts', 'pm25'));
  assert.ok(columnExists(db, 'alerts', 'voc'));
  assert.ok(columnExists(db, 'alerts', 'source'));
});

test('is idempotent (running twice does not throw)', () => {
  const db = baseDb();
  runMigrations(db);
  assert.doesNotThrow(() => runMigrations(db));
});