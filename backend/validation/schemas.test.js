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
