const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey && supabaseUrl !== 'https://your-project-id.supabase.co') {
  supabase = createClient(supabaseUrl, supabaseKey);
}

const bcrypt = require('bcryptjs');

const mockDb = {
  users: [{
    id: 'mock-admin-uuid',
    username: 'admin',
    password: bcrypt.hashSync('admin123', 10),
    role: 'admin',
    name: 'System Admin',
    email: 'admin@vape.local',
    badge: 'ADM-001',
    status: 'active'
  }, {
    id: 'mock-guard-uuid',
    username: 'guard',
    password: bcrypt.hashSync('Guard123@', 10),
    role: 'security',
    name: 'Security Guard',
    email: 'guard@vape.local',
    badge: 'GRD-001',
    status: 'active'
  }], 
  alerts: [], devices: [], sensors: [], assignments: [], logs: [], sensor_readings: [],
  settings: [{ id: 'global', pm25Threshold: 50, vocThreshold: 300, sensitivityLevel: 'normal' }]
};

// Returns true if Supabase is connected, false to use mockDb
function isSupabase() {
  return supabase !== null;
}

async function findAll(table) {
  if (!isSupabase()) return mockDb[table] || [];
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  return data || [];
}

async function findById(table, id) {
  if (!isSupabase()) {
    const list = mockDb[table] || [];
    return list.find(item => item.id === id || item.id === 'global') || null;
  }
  const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
  if (error && error.code !== 'PGRST116') throw error; // Not found
  return data || null;
}

async function findOne(table, predicate) {
  const data = await findAll(table);
  return data.find(predicate) || null;
}

async function insert(table, record) {
  if (!isSupabase()) {
    if (!mockDb[table]) mockDb[table] = [];
    mockDb[table].push(record);
    return record;
  }
  const { data, error } = await supabase.from(table).insert(record).select().single();
  if (error) throw error;
  return data;
}

async function update(table, id, changes) {
  if (!isSupabase()) {
    if (!mockDb[table]) return null;
    const idx = mockDb[table].findIndex(item => item.id === id || item.id === 'global');
    if (idx === -1) return null;
    mockDb[table][idx] = { ...mockDb[table][idx], ...changes };
    return mockDb[table][idx];
  }
  const { data, error } = await supabase.from(table).update(changes).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function remove(table, id) {
  if (!isSupabase()) {
    if (!mockDb[table]) return true;
    mockDb[table] = mockDb[table].filter(item => item.id !== id);
    return true;
  }
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
  return true;
}

async function clearTable(table) {
  if (!isSupabase()) {
    mockDb[table] = [];
    return true;
  }
  const { error } = await supabase.from(table).delete().neq('id', 'dummy_id_to_clear_all');
  if (error) throw error;
  return true;
}

async function getSettings() {
  if (!isSupabase()) {
    return mockDb.settings.find(s => s.id === 'global') || { pm25Threshold: 50, vocThreshold: 300, sensitivityLevel: 'normal' };
  }
  const { data, error } = await supabase.from('settings').select('*').single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || { pm25Threshold: 50, vocThreshold: 300, sensitivityLevel: 'normal' };
}

async function setSettings(newSettings) {
  if (!isSupabase()) {
    let settings = mockDb.settings.find(s => s.id === 'global');
    if (!settings) {
      settings = { id: 'global' };
      mockDb.settings.push(settings);
    }
    Object.assign(settings, newSettings);
    return settings;
  }
  const { data, error } = await supabase.from('settings').upsert({ id: 'global', ...newSettings }).select().single();
  if (error) throw error;
  return data;
}

async function recentReadings(deviceId, limit = 50) {
  if (!isSupabase()) {
    const list = mockDb.sensor_readings || [];
    const filtered = list.filter(r => r.deviceId === deviceId).sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    return filtered.slice(0, limit).reverse();
  }
  const { data, error } = await supabase.from('sensor_readings')
    .select('*')
    .eq('deviceId', deviceId)
    .order('recordedAt', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.reverse();
}

async function findDeviceAlerts(deviceId) {
  if (!isSupabase()) {
    return (mockDb.alerts || []).filter(a => a.deviceId === deviceId);
  }
  const { data, error } = await supabase.from('alerts')
    .select('*')
    .eq('deviceId', deviceId);
  if (error) throw error;
  return data || [];
}

async function findLogs({ limit = 100, offset = 0 } = {}) {
  if (!isSupabase()) {
    const list = [...(mockDb.logs || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { logs: list.slice(offset, offset + limit), total: list.length };
  }
  const { data, error, count } = await supabase.from('logs')
    .select('*', { count: 'exact' })
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return { logs: data || [], total: count || 0 };
}

function backupDb(destinationPath) {
  console.log('backupDb ignored.');
}

module.exports = { supabase, findAll, findById, findOne, insert, update, remove, clearTable, getSettings, setSettings, recentReadings, findLogs, backupDb, findDeviceAlerts };
