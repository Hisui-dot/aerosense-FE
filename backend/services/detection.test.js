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
