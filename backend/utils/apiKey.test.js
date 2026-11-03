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
