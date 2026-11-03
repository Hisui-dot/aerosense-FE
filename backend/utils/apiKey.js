const crypto = require('crypto');

function generateApiKey() {
  return 'ak_' + crypto.randomBytes(24).toString('hex');
}

module.exports = { generateApiKey };
