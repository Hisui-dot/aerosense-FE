require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const store = require('./db/store');

async function seed() {
  const users = await store.findAll('users');
  if (users.length === 0) {
    console.log('Seeding admin user...');
    await store.insert('users', {
      id: uuidv4(),
      username: 'admin',
      password: bcrypt.hashSync('admin123', 10),
      role: 'admin',
      name: 'System Admin',
      email: 'admin@vape.local',
      badge: 'ADM-001',
      contact: '555-0000',
      status: 'active',
      createdAt: new Date().toISOString(),
    });
    console.log('Admin user seeded (admin / admin123).');

    console.log('Seeding guard user...');
    await store.insert('users', {
      id: uuidv4(),
      username: 'guard',
      password: bcrypt.hashSync('Guard123@', 10),
      role: 'security',
      name: 'Security Guard',
      email: 'guard@vape.local',
      badge: 'GRD-001',
      contact: '555-0001',
      status: 'active',
      createdAt: new Date().toISOString(),
    });
    console.log('Guard user seeded (guard / Guard123@).');
  } else {
    console.log('Users already exist, skipping seed.');
  }
}

seed().then(() => {
  console.log('Seed complete.');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
