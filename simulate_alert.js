const http = require('http');

async function simulate() {
  console.log('1. Logging in as admin...');
  const authRes = await fetch('http://localhost:8001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const { token } = await authRes.json();
  if (!token) throw new Error('Login failed!');

  console.log('2. Creating a test device to get an API key...');
  const devRes = await fetch('http://localhost:8001/api/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ name: 'Test Sensor', location: 'Boys Restroom', floor: '2nd Floor' })
  });
  const device = await devRes.json();
  const apiKey = device.apiKey;
  console.log(`   Device Created! API Key: ${apiKey}`);

  console.log('3. Sending a massive vape reading to trigger an alert...');
  const readRes = await fetch('http://localhost:8001/api/ingest/readings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-device-key': apiKey },
    body: JSON.stringify({ pm25: 150, voc: 400, temperature: 24, humidity: 45 })
  });
  
  const result = await readRes.json();
  if (result.alert) {
    console.log('\n✅ SUCCESS! A new alert was just triggered on your dashboard!');
  } else {
    console.log('\n❌ Reading sent, but no alert triggered (Thresholds might be higher).');
  }
}

simulate().catch(console.error);
