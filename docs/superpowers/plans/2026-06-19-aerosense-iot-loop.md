# AeroSense IoT Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ESP32 telemetry flow into time-series storage, auto-generate threshold alerts, and stream live to the dashboard — replacing the mock/hardcoded data.

**Architecture:** Additive (non-breaking) upgrade of the existing Express + `node:sqlite` backend and Vite/React frontend. Devices POST readings to an API-key-authenticated ingestion endpoint; a detection service evaluates configured thresholds and creates debounced alerts; an SSE bus pushes `reading`/`alert` events to the dashboard. `devices` is the canonical telemetry node; `devices`/`sensors` unification is deferred.

**Tech Stack:** Node.js 22.5+ (CommonJS), Express 4, `node:sqlite` (`DatabaseSync`), `zod` (new backend dep), `node:test` (built-in, no new runner), React 18 + TypeScript + Vite 6, Recharts, browser `EventSource`.

## Global Constraints

- Node **22.5+** required (`node:sqlite`). Backend dev runs via `npm run dev` in `backend/` (uses `node --watch`).
- Backend is **CommonJS** (`require`/`module.exports`). Frontend is **ESM TypeScript**.
- Backend port is forced to **8001**; Vite proxies `/api` and `/uploads` to `http://127.0.0.1:8001`.
- Existing API response shapes for current endpoints **must not change** (frontend depends on raw objects, no envelope). New endpoints may use `{ message }` / `{ errors }`.
- **No `console.log` in shipped request paths** beyond existing `console.error`; the simulator script and seed key printout are the only allowed console output.
- DB access goes through `backend/db/store.js`; frontend↔backend calls go through `src/app/services/api.ts`. No raw `fetch` in components.
- Detection thresholds come from `settings` (`pm25Threshold=35`, `vocThreshold=0.60`, `requireBothSensors=true`) unless a per-device override is set.
- `npm install` in `Vape/` must keep `--legacy-peer-deps` (`.npmrc`).

---

## PHASE 1 — DATABASE

### Task 1: Migration runner + `sensor_readings` table + new columns

**Files:**
- Create: `Vape/backend/db/migrations.js`
- Test: `Vape/backend/db/migrations.test.js`

**Interfaces:**
- Produces: `runMigrations(db)` — takes a `DatabaseSync` instance, idempotently creates `sensor_readings`, `schema_migrations`, indexes, and adds columns to `devices`/`alerts`. `columnExists(db, table, column) -> boolean`.
- Consumes: nothing (operates on a passed-in db handle).

- [ ] **Step 1: Write the failing test**

```javascript
// Vape/backend/db/migrations.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Vape/backend && node --test db/migrations.test.js`
Expected: FAIL — `Cannot find module './migrations'`.

- [ ] **Step 3: Write minimal implementation**

```javascript
// Vape/backend/db/migrations.js
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

  ensureColumn(db, 'devices', 'apiKey', 'TEXT');
  ensureColumn(db, 'devices', 'pm25Threshold', 'REAL');
  ensureColumn(db, 'devices', 'vocThreshold', 'REAL');
  ensureColumn(db, 'devices', 'updatedAt', 'TEXT');

  ensureColumn(db, 'alerts', 'deviceId', 'TEXT');
  ensureColumn(db, 'alerts', 'pm25', 'REAL');
  ensureColumn(db, 'alerts', 'voc', 'REAL');
  ensureColumn(db, 'alerts', 'source', "TEXT DEFAULT 'manual'");

  const stamp = new Date().toISOString();
  db.prepare('INSERT OR IGNORE INTO schema_migrations (version, appliedAt) VALUES (?, ?)').run(1, stamp);
}

module.exports = { runMigrations, columnExists };
```

> Note: `alerts(createdAt)` and `logs(deviceId)`/`logs(timestamp)` indexes are added in Task 2 where the real `store` schema (with those columns) is guaranteed present.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Vape/backend && node --test db/migrations.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add Vape/backend/db/migrations.js Vape/backend/db/migrations.test.js
git commit -m "feat(db): add idempotent migration runner, sensor_readings table, telemetry columns"
```

---

### Task 2: Wire migrations into store + `updatedAt` stamping + readings query

**Files:**
- Modify: `Vape/backend/db/store.js` (getDb at :8-21, update at :143-150, module.exports at :211)

**Interfaces:**
- Consumes: `runMigrations(db)` from Task 1.
- Produces: `store.recentReadings(deviceId, limit)`; `store.update` auto-stamps `updatedAt` when that column exists on the table; migrations run on every startup before seeding.

- [ ] **Step 1: Add the migration import and call in `getDb`**

Replace lines 8-21 of `store.js` with:

```javascript
function getDb() {
  if (!db) {
    const isNew = !fs.existsSync(DB_PATH);
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    createSchema();
    const { runMigrations } = require('./migrations');
    runMigrations(db);
    db.exec('CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(createdAt)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_logs_device ON logs(deviceId)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_logs_time ON logs(timestamp)');
    if (isNew) {
      const { seed } = require('./seed');
      seed(db);
    }
  }
  return db;
}
```

- [ ] **Step 2: Auto-stamp `updatedAt` in `update`**

Replace lines 143-150 of `store.js` with:

```javascript
const TABLES_WITH_UPDATED_AT = new Set(['devices']);

function update(table, id, changes) {
  const withStamp = TABLES_WITH_UPDATED_AT.has(table)
    ? { ...changes, updatedAt: new Date().toISOString() }
    : changes;
  const row = serialize(withStamp);
  const entries = Object.entries(row);
  if (!entries.length) return findById(table, id);
  const set = entries.map(([k]) => `${k} = ?`).join(', ');
  getDb().prepare(`UPDATE ${table} SET ${set} WHERE id = ?`).run(...entries.map(([, v]) => v), id);
  return findById(table, id);
}
```

- [ ] **Step 3: Add `recentReadings` (index-backed) and export it**

Add after `findOne` (after line 132):

```javascript
function recentReadings(deviceId, limit = 100) {
  const rows = getDb()
    .prepare('SELECT * FROM sensor_readings WHERE deviceId = ? ORDER BY recordedAt DESC LIMIT ?')
    .all(deviceId, limit);
  return rows.map(deserialize);
}
```

Replace line 211 (`module.exports = ...`) with:

```javascript
module.exports = { findAll, findById, findOne, insert, update, remove, clearTable, getSettings, setSettings, recentReadings };
```

- [ ] **Step 4: Verify the backend boots and upgrades an existing DB**

Run: `cd Vape/backend && node -e "const s=require('./db/store'); s.findAll('devices'); console.log('booted, devices:', s.findAll('devices').length); console.log('readings query ok:', Array.isArray(s.recentReadings('S001')))"`
Expected: prints `booted, devices: 7` (or current count) and `readings query ok: true`, no errors. (This runs migrations against the real `vape.db`.)

- [ ] **Step 5: Commit**

```bash
git add Vape/backend/db/store.js
git commit -m "feat(db): run migrations on boot, stamp updatedAt, add recentReadings query"
```

---

### Task 3: Seed API keys + historical readings

**Files:**
- Modify: `Vape/backend/db/seed.js` (devices insert at :102-108, add readings + key generation, end of transaction)

**Interfaces:**
- Consumes: tables already migrated (Task 1/2 guarantee `devices.apiKey` and `sensor_readings` exist before `seed` runs).
- Produces: each seeded device has a printed `apiKey`; each device has ~24 historical `sensor_readings` rows.

- [ ] **Step 1: Generate and persist an apiKey per device**

In `seed.js`, replace the devices loop (lines 102-108) with:

```javascript
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
```

> Uses an explicit column list (not positional `VALUES (?,…18…)`) so the appended `apiKey` column is populated correctly.

- [ ] **Step 2: Seed historical readings for each device**

Immediately after the devices loop (still inside the `try`), add:

```javascript
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
```

- [ ] **Step 3: Print keys after commit (local dev convenience)**

Immediately after `db.exec('COMMIT');` (line 118), add:

```javascript
    console.log('Seeded device API keys (local dev only):');
    for (const [id, key] of Object.entries(deviceKeys)) console.log(`  ${id}: ${key}`);
```

- [ ] **Step 4: Verify a fresh seed produces keys + readings**

Run:
```bash
cd Vape/backend
node -e "const fs=require('fs');for(const f of ['db/vape.db','db/vape.db-wal','db/vape.db-shm']){try{fs.unlinkSync(f)}catch{}}"
node -e "const s=require('./db/store'); const d=s.findAll('devices'); console.log('keys ok:', d.every(x=>x.apiKey && x.apiKey.startsWith('ak_'))); console.log('readings for', d[0].id, '=', s.recentReadings(d[0].id).length)"
```
Expected: prints the seeded keys, then `keys ok: true` and `readings for S001 = 24`.

> This deletes and recreates the dev DB. That is intended for first rollout. On a real deployment, back up `vape.db` first (migrations preserve existing DBs; only this verification wipes it).

- [ ] **Step 5: Commit**

```bash
git add Vape/backend/db/seed.js
git commit -m "feat(db): seed per-device API keys and historical sensor readings"
```

---

## PHASE 2 — BACKEND

### Task 4: Add zod + ingestion/validation schemas

**Files:**
- Modify: `Vape/backend/package.json` (dependencies)
- Create: `Vape/backend/validation/schemas.js`
- Test: `Vape/backend/validation/schemas.test.js`

**Interfaces:**
- Produces: `readingSchema` (zod), `parseReading(body) -> { ok: true, data } | { ok: false, errors }`.

- [ ] **Step 1: Install zod**

Run: `cd Vape/backend && npm install zod@^3.23.8`
Expected: `zod` appears in `package.json` dependencies.

- [ ] **Step 2: Write the failing test**

```javascript
// Vape/backend/validation/schemas.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { parseReading } = require('./schemas');

test('accepts a valid reading', () => {
  const r = parseReading({ pm25: 42, voc: 0.7, temperature: 24, humidity: 50 });
  assert.equal(r.ok, true);
  assert.equal(r.data.pm25, 42);
});

test('rejects negative pm25', () => {
  const r = parseReading({ pm25: -1, voc: 0.7 });
  assert.equal(r.ok, false);
  assert.ok(r.errors.length > 0);
});

test('rejects missing voc', () => {
  const r = parseReading({ pm25: 10 });
  assert.equal(r.ok, false);
});

test('accepts optional recordedAt ISO string', () => {
  const r = parseReading({ pm25: 10, voc: 0.2, recordedAt: '2026-06-19T10:00:00Z' });
  assert.equal(r.ok, true);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd Vape/backend && node --test validation/schemas.test.js`
Expected: FAIL — `Cannot find module './schemas'`.

- [ ] **Step 4: Write implementation**

```javascript
// Vape/backend/validation/schemas.js
const { z } = require('zod');

const readingSchema = z.object({
  pm25: z.number().nonnegative().finite(),
  voc: z.number().nonnegative().finite(),
  temperature: z.number().finite().optional(),
  humidity: z.number().min(0).max(100).optional(),
  recordedAt: z.string().datetime({ offset: true }).optional(),
});

function parseReading(body) {
  const result = readingSchema.safeParse(body);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, errors: result.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) };
}

module.exports = { readingSchema, parseReading };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd Vape/backend && node --test validation/schemas.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add Vape/backend/package.json Vape/backend/package-lock.json Vape/backend/validation/
git commit -m "feat(backend): add zod and ingestion reading validation schema"
```

---

### Task 5: API-key generator + device-auth middleware

**Files:**
- Create: `Vape/backend/utils/apiKey.js`
- Create: `Vape/backend/middleware/deviceAuth.js`
- Test: `Vape/backend/utils/apiKey.test.js`

**Interfaces:**
- Produces: `generateApiKey() -> string` (prefix `ak_`, 48 hex chars). `requireDevice(req, res, next)` — resolves `req.device` from `X-Device-Key` header via `store.findOne('devices', ...)`, 401 on missing/unknown.

- [ ] **Step 1: Write the failing test**

```javascript
// Vape/backend/utils/apiKey.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { generateApiKey } = require('./apiKey');

test('generates a prefixed key', () => {
  const k = generateApiKey();
  assert.ok(k.startsWith('ak_'));
  assert.equal(k.length, 3 + 48);
});

test('generates unique keys', () => {
  assert.notEqual(generateApiKey(), generateApiKey());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Vape/backend && node --test utils/apiKey.test.js`
Expected: FAIL — `Cannot find module './apiKey'`.

- [ ] **Step 3: Write the generator**

```javascript
// Vape/backend/utils/apiKey.js
const crypto = require('crypto');

function generateApiKey() {
  return 'ak_' + crypto.randomBytes(24).toString('hex');
}

module.exports = { generateApiKey };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Vape/backend && node --test utils/apiKey.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the device-auth middleware**

```javascript
// Vape/backend/middleware/deviceAuth.js
const store = require('../db/store');

function requireDevice(req, res, next) {
  const key = req.headers['x-device-key'];
  if (!key) return res.status(401).json({ message: 'Device key required' });
  const device = store.findOne('devices', d => d.apiKey && d.apiKey === key);
  if (!device) return res.status(401).json({ message: 'Unknown device key' });
  req.device = device;
  next();
}

module.exports = { requireDevice };
```

- [ ] **Step 6: Commit**

```bash
git add Vape/backend/utils/ Vape/backend/middleware/deviceAuth.js
git commit -m "feat(backend): add API-key generator and device-auth middleware"
```

---

### Task 6: Detection service (threshold + debounce, pure logic)

**Files:**
- Create: `Vape/backend/services/detection.js`
- Test: `Vape/backend/services/detection.test.js`

**Interfaces:**
- Produces:
  - `evaluateThreshold(reading, thresholds) -> { triggered: boolean, reasons: string[] }` where `reading={pm25,voc}`, `thresholds={pm25Threshold,vocThreshold,requireBothSensors}`.
  - `shouldDebounce({ openCount, lastAutoAlertAt, now, cooldownSec }) -> boolean`.
  - `resolveThresholds(device, settings) -> { pm25Threshold, vocThreshold, requireBothSensors }`.

- [ ] **Step 1: Write the failing test**

```javascript
// Vape/backend/services/detection.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { evaluateThreshold, shouldDebounce, resolveThresholds } = require('./detection');

const T = { pm25Threshold: 35, vocThreshold: 0.6, requireBothSensors: false };

test('triggers when pm25 over threshold', () => {
  assert.equal(evaluateThreshold({ pm25: 40, voc: 0.1 }, T).triggered, true);
});

test('triggers when voc over threshold', () => {
  assert.equal(evaluateThreshold({ pm25: 5, voc: 0.9 }, T).triggered, true);
});

test('does not trigger when both under', () => {
  assert.equal(evaluateThreshold({ pm25: 5, voc: 0.1 }, T).triggered, false);
});

test('requireBothSensors needs both over threshold', () => {
  const TB = { ...T, requireBothSensors: true };
  assert.equal(evaluateThreshold({ pm25: 40, voc: 0.1 }, TB).triggered, false);
  assert.equal(evaluateThreshold({ pm25: 40, voc: 0.9 }, TB).triggered, true);
});

test('debounce when an alert is already open', () => {
  assert.equal(shouldDebounce({ openCount: 1, lastAutoAlertAt: null, now: 1000, cooldownSec: 60 }), true);
});

test('debounce within cooldown window', () => {
  assert.equal(shouldDebounce({ openCount: 0, lastAutoAlertAt: 1000, now: 1000 + 30_000, cooldownSec: 60 }), true);
});

test('no debounce after cooldown with no open alerts', () => {
  assert.equal(shouldDebounce({ openCount: 0, lastAutoAlertAt: 1000, now: 1000 + 120_000, cooldownSec: 60 }), false);
});

test('resolveThresholds prefers device override', () => {
  const r = resolveThresholds({ pm25Threshold: 20, vocThreshold: null }, { pm25Threshold: '35', vocThreshold: '0.60', requireBothSensors: true });
  assert.equal(r.pm25Threshold, 20);
  assert.equal(r.vocThreshold, 0.6);
  assert.equal(r.requireBothSensors, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Vape/backend && node --test services/detection.test.js`
Expected: FAIL — `Cannot find module './detection'`.

- [ ] **Step 3: Write the implementation**

```javascript
// Vape/backend/services/detection.js
function num(v, fallback) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : fallback;
}

function resolveThresholds(device, settings) {
  return {
    pm25Threshold: num(device && device.pm25Threshold, num(settings.pm25Threshold, 35)),
    vocThreshold: num(device && device.vocThreshold, num(settings.vocThreshold, 0.6)),
    requireBothSensors: settings.requireBothSensors === true || settings.requireBothSensors === 'true',
  };
}

function evaluateThreshold(reading, thresholds) {
  const reasons = [];
  const pmOver = reading.pm25 >= thresholds.pm25Threshold;
  const vocOver = reading.voc >= thresholds.vocThreshold;
  if (pmOver) reasons.push(`PM2.5 ${reading.pm25} >= ${thresholds.pm25Threshold}`);
  if (vocOver) reasons.push(`VOC ${reading.voc} >= ${thresholds.vocThreshold}`);
  const triggered = thresholds.requireBothSensors ? (pmOver && vocOver) : (pmOver || vocOver);
  return { triggered, reasons };
}

function shouldDebounce({ openCount, lastAutoAlertAt, now, cooldownSec }) {
  if (openCount > 0) return true;
  if (lastAutoAlertAt != null && now - lastAutoAlertAt < cooldownSec * 1000) return true;
  return false;
}

module.exports = { evaluateThreshold, shouldDebounce, resolveThresholds };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Vape/backend && node --test services/detection.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add Vape/backend/services/detection.js Vape/backend/services/detection.test.js
git commit -m "feat(backend): add detection threshold + debounce service"
```

---

### Task 7: SSE event bus + stream route (query-token auth)

**Files:**
- Create: `Vape/backend/services/events.js`
- Create: `Vape/backend/routes/stream.js`
- Modify: `Vape/backend/server.js` (mount route)

**Interfaces:**
- Produces: `bus` (EventEmitter), `emitReading(payload)`, `emitAlert(payload)`. Route `GET /api/stream?token=<jwt>` streams `reading`/`alert` SSE events.
- Consumes: `process.env.JWT_SECRET`.

- [ ] **Step 1: Write the event bus**

```javascript
// Vape/backend/services/events.js
const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(100);

function emitReading(payload) { bus.emit('reading', payload); }
function emitAlert(payload) { bus.emit('alert', payload); }

module.exports = { bus, emitReading, emitAlert };
```

- [ ] **Step 2: Write the stream route**

```javascript
// Vape/backend/routes/stream.js
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
```

- [ ] **Step 3: Mount the route in `server.js`**

After line 14 (`const analyticsRoutes = ...`), add:
```javascript
const streamRoutes = require('./routes/stream');
```
After line 32 (`app.use('/api/analytics', analyticsRoutes);`), add:
```javascript
app.use('/api/stream', streamRoutes);
```

- [ ] **Step 4: Manual verification**

Start backend: `cd Vape/backend && npm run dev`. In another terminal, get a token then connect:
```bash
TOKEN=$(curl -s -X POST localhost:8001/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")
curl -N "localhost:8001/api/stream?token=$TOKEN"
```
Expected: connection stays open, prints `: connected` then `: ping` every 25s. Ctrl-C to stop.

- [ ] **Step 5: Commit**

```bash
git add Vape/backend/services/events.js Vape/backend/routes/stream.js Vape/backend/server.js
git commit -m "feat(backend): add SSE event bus and /api/stream route"
```

---

### Task 8: Ingestion endpoint with auto-detection

**Files:**
- Create: `Vape/backend/routes/ingest.js`
- Modify: `Vape/backend/server.js` (mount route)

**Interfaces:**
- Consumes: `requireDevice` (T5), `parseReading` (T4), `evaluateThreshold`/`shouldDebounce`/`resolveThresholds` (T6), `emitReading`/`emitAlert` (T7), `store` (T2).
- Produces: `POST /api/ingest/readings` → `{ ok: true, readingId, alert: <alert|null> }`.

- [ ] **Step 1: Write the ingestion route**

```javascript
// Vape/backend/routes/ingest.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const store = require('../db/store');
const { requireDevice } = require('../middleware/deviceAuth');
const { parseReading } = require('../validation/schemas');
const { evaluateThreshold, shouldDebounce, resolveThresholds } = require('../services/detection');
const { emitReading, emitAlert } = require('../services/events');

const router = express.Router();
const COOLDOWN_SEC = 120;

router.post('/readings', requireDevice, (req, res) => {
  const parsed = parseReading(req.body);
  if (!parsed.ok) return res.status(400).json({ message: 'Invalid reading', errors: parsed.errors });

  const device = req.device;
  const now = new Date();
  const nowIso = now.toISOString();
  const recordedAt = parsed.data.recordedAt || nowIso;

  const reading = {
    id: uuidv4(),
    deviceId: device.id,
    pm25: parsed.data.pm25,
    voc: parsed.data.voc,
    temperature: parsed.data.temperature ?? null,
    humidity: parsed.data.humidity ?? null,
    recordedAt,
    createdAt: nowIso,
  };
  store.insert('sensor_readings', reading);

  store.update('devices', device.id, {
    pm25: reading.pm25,
    voc: reading.voc,
    temperature: reading.temperature,
    humidity: reading.humidity,
    lastSeen: 'Just now',
    lastUpdate: nowIso,
    status: 'online',
    issue: null,
  });

  emitReading(reading);

  // --- detection ---
  const settings = store.getSettings();
  const thresholds = resolveThresholds(device, settings);
  const { triggered, reasons } = evaluateThreshold(reading, thresholds);
  let alert = null;

  if (triggered) {
    const deviceAlerts = store.findAll('alerts').filter(a => a.deviceId === device.id);
    const openCount = deviceAlerts.filter(a => a.status === 'ACTIVE' || a.status === 'RESPONDING').length;
    const autoAlerts = deviceAlerts.filter(a => a.source === 'auto' && a.createdAt);
    const lastAutoAlertAt = autoAlerts.length
      ? Math.max(...autoAlerts.map(a => new Date(a.createdAt).getTime()))
      : null;

    if (!shouldDebounce({ openCount, lastAutoAlertAt, now: now.getTime(), cooldownSec: COOLDOWN_SEC })) {
      alert = store.insert('alerts', {
        id: uuidv4(),
        floor: device.floor || null,
        location: device.location || null,
        detectedAt: now.toLocaleTimeString(),
        sensorId: device.id,
        deviceId: device.id,
        status: 'ACTIVE',
        respondedBy: null,
        resolvedAt: null,
        photoUrl: null,
        pm25: reading.pm25,
        voc: reading.voc,
        source: 'auto',
        createdAt: nowIso,
      });

      store.insert('logs', {
        id: uuidv4(),
        type: 'detection',
        title: `AeroSense Detection — ${device.location || device.id}`,
        description: reasons.join('; '),
        timestamp: nowIso,
        status: 'active',
        location: device.location || null,
        deviceId: device.id,
        user: null,
        severity: reading.pm25 >= thresholds.pm25Threshold * 1.5 ? 'critical' : 'high',
        metadata: { pm25: reading.pm25, voc: reading.voc, reasons },
      });

      emitAlert(alert);
    }
  }

  res.json({ ok: true, readingId: reading.id, alert });
});

module.exports = router;
```

- [ ] **Step 2: Mount the route in `server.js`**

After the stream require (T7 step 3), add:
```javascript
const ingestRoutes = require('./routes/ingest');
```
After `app.use('/api/stream', streamRoutes);`, add:
```javascript
app.use('/api/ingest', ingestRoutes);
```

- [ ] **Step 3: Manual verification — happy path + auto-alert**

With backend running, grab a device key from the seed console output (or query it), then:
```bash
KEY=<paste an ak_... key for S001>
# normal reading — no alert
curl -s -X POST localhost:8001/api/ingest/readings -H "X-Device-Key: $KEY" -H 'Content-Type: application/json' -d '{"pm25":10,"voc":0.2}'
# over-threshold reading — should return an alert object
curl -s -X POST localhost:8001/api/ingest/readings -H "X-Device-Key: $KEY" -H 'Content-Type: application/json' -d '{"pm25":80,"voc":2.0}'
```
Expected: first returns `{"ok":true,...,"alert":null}`; second returns `{"ok":true,...,"alert":{...,"status":"ACTIVE","source":"auto"}}`. A third identical over-threshold call within 2 min returns `alert:null` (debounced).

- [ ] **Step 4: Verify validation + auth failures**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:8001/api/ingest/readings -H 'Content-Type: application/json' -d '{"pm25":10,"voc":0.2}'   # 401 (no key)
curl -s -X POST localhost:8001/api/ingest/readings -H "X-Device-Key: $KEY" -H 'Content-Type: application/json' -d '{"pm25":-1}'   # 400 with errors
```
Expected: `401`, then a `{ "message":"Invalid reading","errors":[...] }` body.

- [ ] **Step 5: Commit**

```bash
git add Vape/backend/routes/ingest.js Vape/backend/server.js
git commit -m "feat(backend): add telemetry ingestion endpoint with auto-alert detection"
```

---

### Task 9: Device key management + readings endpoint

**Files:**
- Modify: `Vape/backend/routes/devices.js` (add create, rotate-key, readings)

**Interfaces:**
- Consumes: `generateApiKey` (T5), `store.recentReadings` (T2).
- Produces: `POST /api/devices` (admin, returns device w/ apiKey), `POST /api/devices/:id/rotate-key` (admin), `GET /api/devices/:id/readings?limit=` (auth).

- [ ] **Step 1: Add imports**

In `devices.js`, replace line 2-4 with:
```javascript
const { v4: uuidv4 } = require('uuid');
const store = require('../db/store');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { generateApiKey } = require('../utils/apiKey');
```

- [ ] **Step 2: Add create + rotate-key + readings routes**

Insert before `module.exports = router;` (line 96):

```javascript
// Create a device (admin) — returns the generated apiKey once
router.post('/', requireAdmin, (req, res) => {
  const { name, location, floor } = req.body || {};
  if (!name) return res.status(400).json({ message: 'name is required' });
  const now = new Date().toISOString();
  const device = store.insert('devices', {
    id: req.body.id || `D-${uuidv4().slice(0, 8)}`,
    name,
    location: location || null,
    floor: floor || null,
    status: 'offline',
    pm25: 0,
    voc: 0,
    temperature: null,
    humidity: null,
    lastUpdate: now,
    lastSeen: 'Never',
    responseTime: 'N/A',
    signalStrength: 0,
    battery: 100,
    firmware: req.body.firmware || 'v1.0.0',
    powerStatus: 'Battery',
    networkSignal: 'None',
    issue: null,
    apiKey: generateApiKey(),
    pm25Threshold: req.body.pm25Threshold ?? null,
    vocThreshold: req.body.vocThreshold ?? null,
    updatedAt: now,
  });
  res.status(201).json(device);
});

// Rotate a device's API key (admin)
router.post('/:id/rotate-key', requireAdmin, (req, res) => {
  const device = store.findById('devices', req.params.id);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  const updated = store.update('devices', req.params.id, { apiKey: generateApiKey() });
  res.json({ id: updated.id, apiKey: updated.apiKey });
});

// Recent readings for a device (auth) — index-backed time series
router.get('/:id/readings', requireAuth, (req, res) => {
  const device = store.findById('devices', req.params.id);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
  res.json(store.recentReadings(req.params.id, limit));
});
```

- [ ] **Step 3: Manual verification**

```bash
TOKEN=<admin jwt>   # from /api/auth/login
curl -s -X POST localhost:8001/api/devices -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"Test Node","location":"Room 999","floor":"9th"}'
curl -s localhost:8001/api/devices/S001/readings?limit=5 -H "Authorization: Bearer $TOKEN"
curl -s -X POST localhost:8001/api/devices/S001/rotate-key -H "Authorization: Bearer $TOKEN"
```
Expected: created device JSON includes an `ak_...` apiKey; readings returns an array (≤5); rotate returns a new `apiKey`.

- [ ] **Step 4: Commit**

```bash
git add Vape/backend/routes/devices.js
git commit -m "feat(backend): add device creation, key rotation, and readings endpoints"
```

---

### Task 10: Real analytics from stored data

**Files:**
- Modify: `Vape/backend/routes/analytics.js` (replace hardcoded `weekly`, `reports`, `qos` bodies)

**Interfaces:**
- Consumes: `store.findAll('alerts'|'sensor_readings'|'devices'|'logs')`.
- Produces: same response shapes as before, computed from real data (keeps frontend compatibility).

- [ ] **Step 1: Replace `/weekly` to count real alerts per weekday**

Replace the body of the `/weekly` handler (lines 35-49) with:

```javascript
router.get('/weekly', requireAdmin, (req, res) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const alerts = store.findAll('alerts');
  const data = days.map((label, i) => {
    const start = new Date(monday); start.setDate(monday.getDate() + i);
    const end = new Date(start); end.setDate(start.getDate() + 1);
    const count = alerts.filter(a => {
      const t = new Date(a.createdAt);
      return t >= start && t < end;
    }).length;
    return { id: i + 1, day: label, date: start.getDate(), count };
  });
  res.json(data);
});
```

- [ ] **Step 2: Replace `/reports` to compute from real data**

Replace the body of the `/reports` handler (lines 52-89) with:

```javascript
router.get('/reports', requireAdmin, (req, res) => {
  const alerts = store.findAll('alerts');
  const readings = store.findAll('sensor_readings');
  const devices = store.findAll('devices');

  const totalDetections = alerts.length;
  const confirmedIncidents = alerts.filter(a => a.status === 'RESOLVED' || a.status === 'RESPONDING').length;
  const falseAlarms = alerts.filter(a => a.status === 'FALSE_ALARM').length;

  const byLocation = {};
  for (const a of alerts) {
    const key = a.location || 'Unknown';
    byLocation[key] = (byLocation[key] || 0) + 1;
  }
  const highRiskAreas = Object.entries(byLocation)
    .map(([location, incidents]) => ({ location, incidents, percentage: totalDetections ? Math.round((incidents / totalDetections) * 100) : 0 }))
    .sort((a, b) => b.incidents - a.incidents).slice(0, 5);

  const buckets = ['8:00–10:00 AM', '10:00–12:00 PM', '12:00–2:00 PM', '2:00–4:00 PM', '4:00–6:00 PM'];
  const bucketFor = (h) => (h >= 8 && h < 10 ? 0 : h >= 10 && h < 12 ? 1 : h >= 12 && h < 14 ? 2 : h >= 14 && h < 16 ? 3 : h >= 16 && h < 18 ? 4 : -1);
  const peakCounts = [0, 0, 0, 0, 0];
  for (const a of alerts) { const b = bucketFor(new Date(a.createdAt).getHours()); if (b >= 0) peakCounts[b]++; }

  res.json({
    summary: {
      totalDetections,
      confirmedIncidents,
      falseAlarms,
      avgResponseTime: '—',
      successRate: totalDetections ? `${Math.round((confirmedIncidents / totalDetections) * 100)}%` : '—',
      period: 'This week',
    },
    detectionTrend: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day, i) => ({ id: i + 1, day, count: 0 })),
    highRiskAreas,
    peakTimePeriods: buckets.map((time, i) => ({ time, incidents: peakCounts[i] })),
    devicePerformance: devices.map(d => ({
      id: d.id,
      detections: alerts.filter(a => a.deviceId === d.id || a.sensorId === d.id).length,
      offlineEvents: d.status === 'offline' ? 1 : 0,
      avgResponse: d.responseTime || '—',
    })),
    userActivity: store.findAll('users').filter(u => u.role === 'security').map(u => ({
      name: u.name,
      handled: alerts.filter(a => a.respondedBy === u.name || a.respondedBy === u.username).length,
      avgAck: '—',
      resolved: alerts.filter(a => (a.respondedBy === u.name || a.respondedBy === u.username) && a.status === 'RESOLVED').length,
    })),
    airQuality: readings.length ? {
      avgPm25: Math.round(readings.reduce((s, r) => s + (r.pm25 || 0), 0) / readings.length * 10) / 10,
      avgVoc: Math.round(readings.reduce((s, r) => s + (r.voc || 0), 0) / readings.length * 100) / 100,
    } : { avgPm25: 0, avgVoc: 0 },
  });
});
```

- [ ] **Step 3: Replace `/qos` hardcoded blocks with real data**

In the `/qos` handler, replace the `summaryMetrics` array (lines 104-109) and the `performanceData` array (lines 121-126) with:

```javascript
    summaryMetrics: [
      { label: 'Alerts Today', value: String(store.findAll('alerts').filter(a => {
        const t = new Date(a.createdAt); const now = new Date();
        return t.toDateString() === now.toDateString();
      }).length) },
      { label: 'Active Alerts', value: String(store.findAll('alerts').filter(a => a.status === 'ACTIVE').length) },
      { label: 'Offline Devices', value: String(devices.filter(d => d.status === 'offline').length) },
      { label: 'Readings (24h)', value: String(store.findAll('sensor_readings').filter(r => Date.now() - new Date(r.recordedAt).getTime() < 86400000).length) },
    ],
```

```javascript
    performanceData: (() => {
      const readings = store.findAll('sensor_readings')
        .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt)).slice(-12);
      return readings.map((r, i) => ({ id: i + 1, time: new Date(r.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), response: r.pm25 }));
    })(),
```

- [ ] **Step 4: Manual verification**

```bash
TOKEN=<admin jwt>
curl -s localhost:8001/api/analytics/weekly -H "Authorization: Bearer $TOKEN"
curl -s localhost:8001/api/analytics/reports -H "Authorization: Bearer $TOKEN"
curl -s localhost:8001/api/analytics/qos -H "Authorization: Bearer $TOKEN"
```
Expected: `weekly` counts reflect seeded/ingested alerts; `reports.highRiskAreas` lists real locations; `qos.performanceData` shows real reading values. No `Math.random()` remains in the file.

- [ ] **Step 5: Commit**

```bash
git add Vape/backend/routes/analytics.js
git commit -m "feat(backend): compute analytics from real readings and alerts"
```

---

### Task 11: Run the full backend test suite

**Files:**
- Modify: `Vape/backend/package.json` (add `test` script)

- [ ] **Step 1: Add the test script**

In `package.json` `scripts`, add:
```json
    "test": "node --test"
```

- [ ] **Step 2: Run the suite**

Run: `cd Vape/backend && npm test`
Expected: all test files pass (migrations: 3, schemas: 4, apiKey: 2, detection: 8).

- [ ] **Step 3: Commit**

```bash
git add Vape/backend/package.json
git commit -m "chore(backend): add node:test runner script"
```

---

## PHASE 3 — FRONTEND

### Task 12: API client — readings, SSE, typed analytics, device key methods

**Files:**
- Modify: `Vape/src/app/services/api.ts`

**Interfaces:**
- Produces: `Reading` type; `readingsApi.forDevice(id, limit)`; `streamApi.subscribe(handlers)`; typed `analyticsApi`; `devicesApi.create`/`devicesApi.rotateKey`.

- [ ] **Step 1: Add the `Reading` type and `readingsApi` (after the Devices block, ~line 127)**

```typescript
// ---- Readings (time series) ----
export interface Reading {
  id: string; deviceId: string; pm25: number; voc: number;
  temperature: number | null; humidity: number | null; recordedAt: string; createdAt: string;
}

export const readingsApi = {
  forDevice: (id: string, limit = 100) => api.get<Reading[]>(`/devices/${id}/readings?limit=${limit}`),
};
```

- [ ] **Step 2: Extend `devicesApi` with create + rotateKey**

Replace the `devicesApi` object (lines 120-127) with:

```typescript
export const devicesApi = {
  getAll:       () => api.get<Device[]>('/devices'),
  getById:      (id: string) => api.get<Device>(`/devices/${id}`),
  restart:      (id: string) => api.post(`/devices/${id}/restart`),
  disable:      (id: string) => api.post(`/devices/${id}/disable`),
  recalibrate:  (id: string) => api.post(`/devices/${id}/recalibrate`),
  update:       (id: string, data: Partial<Device>) => api.put<Device>(`/devices/${id}`, data),
  create:       (data: { name: string; location?: string; floor?: string; pm25Threshold?: number; vocThreshold?: number }) =>
                  api.post<Device & { apiKey: string }>('/devices', data),
  rotateKey:    (id: string) => api.post<{ id: string; apiKey: string }>(`/devices/${id}/rotate-key`),
};
```

Also add `apiKey?`, `pm25Threshold?`, `vocThreshold?`, `updatedAt?` to the `Device` interface (after `issue` on line 114):
```typescript
  apiKey?: string; pm25Threshold?: number | null; vocThreshold?: number | null; updatedAt?: string;
```

- [ ] **Step 3: Type `analyticsApi` and add `streamApi` (replace lines 164-170)**

```typescript
// ---- Analytics ----
export interface WeeklyPoint { id: number; day: string; date: number; count: number; }
export const analyticsApi = {
  summary: () => api.get<Record<string, unknown>>('/analytics/summary'),
  weekly:  () => api.get<WeeklyPoint[]>('/analytics/weekly'),
  reports: () => api.get<Record<string, unknown>>('/analytics/reports'),
  qos:     () => api.get<Record<string, unknown>>('/analytics/qos'),
};

// ---- Live stream (SSE) ----
export interface StreamHandlers {
  onReading?: (r: Reading) => void;
  onAlert?: (a: Alert) => void;
  onError?: (e: Event) => void;
}

export const streamApi = {
  subscribe(handlers: StreamHandlers): () => void {
    const token = getToken();
    if (!token) return () => {};
    const es = new EventSource(`${BASE}/stream?token=${encodeURIComponent(token)}`);
    if (handlers.onReading) es.addEventListener('reading', (e) => handlers.onReading!(JSON.parse((e as MessageEvent).data)));
    if (handlers.onAlert) es.addEventListener('alert', (e) => handlers.onAlert!(JSON.parse((e as MessageEvent).data)));
    if (handlers.onError) es.onerror = handlers.onError;
    return () => es.close();
  },
};
```

- [ ] **Step 4: Verify the frontend type-checks/builds**

Run: `cd Vape && npm run build`
Expected: build succeeds (no TS errors in `api.ts`).

- [ ] **Step 5: Commit**

```bash
git add Vape/src/app/services/api.ts
git commit -m "feat(frontend): add readings, SSE stream, typed analytics, device key API clients"
```

---

### Task 13: `useLiveStream` hook

**Files:**
- Create: `Vape/src/app/hooks/useLiveStream.ts`

**Interfaces:**
- Consumes: `streamApi.subscribe` (T12).
- Produces: `useLiveStream({ onReading?, onAlert? })` — subscribes on mount, cleans up on unmount; reconnect handled by the browser `EventSource`.

- [ ] **Step 1: Write the hook**

```typescript
// Vape/src/app/hooks/useLiveStream.ts
import { useEffect, useRef } from 'react';
import { streamApi, type Reading, type Alert } from '../services/api';

interface UseLiveStreamArgs {
  onReading?: (r: Reading) => void;
  onAlert?: (a: Alert) => void;
}

export function useLiveStream({ onReading, onAlert }: UseLiveStreamArgs): void {
  const readingRef = useRef(onReading);
  const alertRef = useRef(onAlert);
  readingRef.current = onReading;
  alertRef.current = onAlert;

  useEffect(() => {
    const unsubscribe = streamApi.subscribe({
      onReading: (r) => readingRef.current?.(r),
      onAlert: (a) => alertRef.current?.(a),
    });
    return unsubscribe;
  }, []);
}
```

- [ ] **Step 2: Verify build**

Run: `cd Vape && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add Vape/src/app/hooks/useLiveStream.ts
git commit -m "feat(frontend): add useLiveStream SSE hook"
```

---

### Task 14: Remove mock-alert merge + wire SSE on Dashboard and Alerts

**Files:**
- Modify: `Vape/src/app/pages/Dashboard.tsx`
- Modify: `Vape/src/app/pages/Alerts.tsx`

> The executor MUST read each file fully before editing — these are large components.

**Interfaces:**
- Consumes: `useLiveStream` (T13), `alertsApi`/`devicesApi` (existing).

- [ ] **Step 1: Read `Dashboard.tsx`** and locate (a) the `INITIAL_ALERTS`/`INITIAL_HISTORY` constants, (b) the `localStorage.getItem('mock_alerts')` merge logic, (c) the 5-second polling `setInterval`.

- [ ] **Step 2: Remove the mock-alert merge in `Dashboard.tsx`**

Delete the block that reads `localStorage.getItem('mock_alerts')` and merges those entries into the alerts list. The fetch should use only `alertsApi.getAll()` results. Delete the `INITIAL_ALERTS` and `INITIAL_HISTORY` fallback constants and any code path that substitutes them when the API returns data; replace their use with empty arrays as the initial state (`useState<Alert[]>([])`).

- [ ] **Step 3: Add live updates to `Dashboard.tsx`**

Add the import:
```typescript
import { useLiveStream } from '../hooks/useLiveStream';
```
Inside the component, after the existing fetch function is defined, add (re-fetch on any pushed alert so derived view-state stays consistent):
```typescript
  useLiveStream({
    onAlert: () => { fetchData(); },
  });
```
(Replace `fetchData` with the actual name of the component's fetch function.) Keep the existing polling `setInterval` but raise it to 30000 ms as a reconnect fallback.

- [ ] **Step 4: Repeat Steps 1-3 for `Alerts.tsx`**

Remove the `mock_alerts` merge and any hardcoded fallback list; drive the list purely from `alertsApi.getAll()`. Add `useLiveStream({ onAlert: () => fetchAlerts() })` (use the real fetch function name). Raise polling to 30000 ms.

- [ ] **Step 5: Manual verification**

Start backend + frontend (`npm run dev:backend` and `npm run dev`). Log in as `security`. In a third terminal, post an over-threshold reading (Task 8 curl). Expected: the new ACTIVE alert appears on the Dashboard/Alerts within ~1s without a manual refresh, and no `mock_alerts` localStorage entries are required.

- [ ] **Step 6: Commit**

```bash
git add Vape/src/app/pages/Dashboard.tsx Vape/src/app/pages/Alerts.tsx
git commit -m "feat(frontend): live SSE updates and remove mock-alert merge on Dashboard/Alerts"
```

---

### Task 15: Remove hardcoded fallbacks + add loading/empty/error states

**Files:**
- Modify: `Vape/src/app/pages/Sensors.tsx`
- Modify: `Vape/src/app/pages/AdminDashboard.tsx`
- Modify: `Vape/src/app/pages/Analytics.tsx`

> Read each file fully before editing.

- [ ] **Step 1: `Sensors.tsx` — remove the hardcoded `SENSORS` array**

Delete the 10-item `SENSORS` constant and the random battery/health generation fallback. Initialize state as `useState<Sensor[]>([])` with a `loading` boolean (default `true`) and an `error: string | null`. In the fetch: set `loading=false` on completion; on catch set `error`. Render: `loading` → a spinner/skeleton; `error` → an error message with a Retry button calling the fetch; empty array → an empty-state ("No sensors found"); otherwise the list.

- [ ] **Step 2: `AdminDashboard.tsx` — remove `RECENT_ALERTS`/`ACTIVITY_DATA` fallbacks**

Delete those constants. Use only fetched alerts/devices/users. Add `loading`/`error` states like Step 1 (the activity chart derives from real alert timestamps; when there are no alerts, render an empty-state in the chart area rather than fake bars).

- [ ] **Step 3: `Analytics.tsx` — remove hardcoded trend fallback**

Delete any hardcoded chart array used when the API returns nothing. Where the page currently recomputes everything client-side, keep that (it already uses real alerts/devices) but add `loading` and empty states so an empty dataset shows "No data yet" instead of an empty chart frame.

- [ ] **Step 4: Manual verification**

With a freshly seeded DB and backend running, load each page as the appropriate role. Expected: brief loading state, then real data. Stop the backend and reload: expected an explicit error state with Retry (not silent fake data).

- [ ] **Step 5: Commit**

```bash
git add Vape/src/app/pages/Sensors.tsx Vape/src/app/pages/AdminDashboard.tsx Vape/src/app/pages/Analytics.tsx
git commit -m "feat(frontend): remove hardcoded fallbacks, add loading/empty/error states"
```

---

### Task 16: Readings charts on detail pages

**Files:**
- Modify: `Vape/src/app/pages/SensorDetail.tsx`
- Modify: `Vape/src/app/pages/admin/AdminDeviceDetail.tsx` (confirm exact path while reading routes)

> Read each file and confirm Recharts is already used elsewhere (it is a project dependency).

**Interfaces:**
- Consumes: `readingsApi.forDevice` (T12).

- [ ] **Step 1: Fetch readings in `SensorDetail.tsx`**

Add imports:
```typescript
import { useEffect, useState } from 'react';
import { readingsApi, type Reading } from '../services/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
```
Add state + fetch keyed on the route id:
```typescript
  const [readings, setReadings] = useState<Reading[]>([]);
  useEffect(() => {
    if (!id) return;
    readingsApi.forDevice(id, 100).then(r => setReadings([...r].reverse())).catch(() => setReadings([]));
  }, [id]);
```
(Use the component's existing route-id variable name in place of `id`.)

- [ ] **Step 2: Render a PM2.5 / VOC chart**

Add where the detail body renders:
```tsx
  {readings.length > 0 ? (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={readings.map(r => ({
        t: new Date(r.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pm25: r.pm25, voc: r.voc,
      }))}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="t" minTickGap={24} />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="pm25" stroke="#ef4444" dot={false} name="PM2.5" />
        <Line type="monotone" dataKey="voc" stroke="#3b82f6" dot={false} name="VOC" />
      </LineChart>
    </ResponsiveContainer>
  ) : (
    <p className="text-sm text-muted-foreground">No readings yet for this device.</p>
  )}
```

- [ ] **Step 3: Repeat for `AdminDeviceDetail.tsx`** with the same fetch + chart pattern, using its route-id variable.

- [ ] **Step 4: Manual verification**

Open a device/sensor detail page for `S001`. Expected: a time-series chart of the last readings (seeded history makes it non-empty immediately). Run the simulator (Task 18) and watch new points appear on reload.

- [ ] **Step 5: Commit**

```bash
git add Vape/src/app/pages/SensorDetail.tsx Vape/src/app/pages/admin/AdminDeviceDetail.tsx
git commit -m "feat(frontend): add live readings charts to device/sensor detail pages"
```

---

### Task 17: Admin device API-key UI (show + rotate)

**Files:**
- Modify: `Vape/src/app/pages/admin/AdminDevices.tsx` (or the device detail/edit modal — confirm while reading)

**Interfaces:**
- Consumes: `devicesApi.rotateKey` (T12).

- [ ] **Step 1: Add masked key display + rotate action**

In the device detail/edit view, render the device's `apiKey` masked (e.g. `ak_••••••••` + last 4 chars) with a Copy button, and a "Rotate key" button:
```tsx
  const [revealed, setRevealed] = useState(false);
  // ...
  <div className="flex items-center gap-2">
    <code>{revealed ? device.apiKey : `ak_…${(device.apiKey || '').slice(-4)}`}</code>
    <button onClick={() => setRevealed(v => !v)}>{revealed ? 'Hide' : 'Reveal'}</button>
    <button onClick={() => navigator.clipboard.writeText(device.apiKey || '')}>Copy</button>
    <button onClick={async () => {
      const { apiKey } = await devicesApi.rotateKey(device.id);
      // update local state with new key, then toast
    }}>Rotate</button>
  </div>
```
(Wire the post-rotate state update to the page's existing device state setter and `sonner` toast.)

- [ ] **Step 2: Manual verification**

As admin, open a device, reveal/copy the key, rotate it. Expected: a new `ak_...` key is shown; the old key now returns 401 on `/api/ingest/readings` (verify with a curl using the old key).

- [ ] **Step 3: Commit**

```bash
git add Vape/src/app/pages/admin/AdminDevices.tsx
git commit -m "feat(frontend): admin UI to reveal, copy, and rotate device API keys"
```

---

### Task 18: Telemetry simulator script

**Files:**
- Create: `Vape/backend/scripts/simulate.js`
- Modify: `Vape/backend/package.json` (add `simulate` script)
- Modify: `Vape/CLAUDE.md` or a short `Vape/backend/scripts/README.md` (document usage)

**Interfaces:**
- Consumes: the running ingestion endpoint + a device `apiKey`.

- [ ] **Step 1: Write the simulator**

```javascript
// Vape/backend/scripts/simulate.js
// Usage: node scripts/simulate.js <DEVICE_API_KEY> [intervalMs]
const key = process.argv[2];
const interval = parseInt(process.argv[3], 10) || 4000;
const BASE = process.env.SIM_BASE || 'http://localhost:8001';

if (!key) {
  console.error('Usage: node scripts/simulate.js <DEVICE_API_KEY> [intervalMs]');
  process.exit(1);
}

let tick = 0;
async function post() {
  tick++;
  const spike = tick % 8 === 0; // every 8th reading crosses the threshold
  const pm25 = spike ? 60 + Math.floor(Math.random() * 40) : 8 + Math.floor(Math.random() * 12);
  const voc = spike ? 1.5 + Math.random() : 0.2 + Math.random() * 0.2;
  try {
    const res = await fetch(`${BASE}/api/ingest/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Key': key },
      body: JSON.stringify({ pm25, voc, temperature: 23 + Math.random() * 3, humidity: 45 + Math.random() * 10 }),
    });
    const body = await res.json();
    console.log(`[${tick}] pm25=${pm25} voc=${voc.toFixed(2)} -> ${res.status}${body.alert ? ' ALERT' : ''}`);
  } catch (e) {
    console.error('post failed:', e.message);
  }
}

console.log(`Simulating device ${key.slice(0, 8)}… every ${interval}ms against ${BASE}`);
setInterval(post, interval);
post();
```

- [ ] **Step 2: Add the npm script**

In `backend/package.json` `scripts`, add:
```json
    "simulate": "node scripts/simulate.js"
```

- [ ] **Step 3: Document usage**

Create `Vape/backend/scripts/README.md`:
```markdown
# Telemetry simulator

Posts realistic readings through the real ingestion endpoint so the dashboard
exercises the full pipeline (storage → detection → SSE → UI).

1. Start the backend: `npm run dev` (from `backend/`).
2. Grab a device API key from the seed console output, or:
   `node -e "console.log(require('./db/store').findAll('devices')[0].apiKey)"`
3. Run: `npm run simulate -- <DEVICE_API_KEY> 4000`

Every 8th reading crosses the vape threshold and triggers an auto-alert.
```

- [ ] **Step 4: Manual verification (full loop)**

Start backend + frontend, log in as security, run `npm run simulate -- <key>`. Expected: console logs readings; roughly every 8th prints `ALERT`; the Dashboard shows a new alert live via SSE and the device detail chart fills with new points.

- [ ] **Step 5: Commit**

```bash
git add Vape/backend/scripts/ Vape/backend/package.json
git commit -m "feat(backend): add telemetry simulator script for end-to-end demos"
```

---

## Final verification

- [ ] `cd Vape/backend && npm test` — all green.
- [ ] `cd Vape && npm run build` — production build succeeds.
- [ ] Full loop: backend + frontend up, `npm run simulate -- <key>` running → live alerts on Dashboard, live charts on device detail, real numbers on Analytics, no `mock_alerts`/hardcoded fallbacks in use.
- [ ] Reviewer agents: `database-reviewer` (Phase 1), `security-reviewer` (device auth + ingestion + SSE token), `typescript-reviewer`/`code-reviewer` (Phase 3).
