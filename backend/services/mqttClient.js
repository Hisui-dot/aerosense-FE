const mqtt = require('mqtt');
const pushService = require('./pushService');
const store = require('../db/store');
const { v4: uuidv4 } = require('uuid');
const { parseReading } = require('../validation/schemas');
const { evaluateThreshold, shouldDebounce, resolveThresholds } = require('./detection');
const { emitReading, emitAlert } = require('./events');

const COOLDOWN_SEC = 300;

const deviceHealthMap = new Map();
const deviceLastAlertTime = new Map();

function getDeviceHealth(deviceId) {
  return deviceHealthMap.get(deviceId) || {
    signalStrength: 0,
    battery: 0,
    firmware: 'Unknown',
    responseTime: '--'
  };
}

let mqttClientInstance = null;

function initMqtt() {
  const url = process.env.MQTT_URL || 'mqtt://localhost:1883';
  mqttClientInstance = mqtt.connect(url, {
    username: process.env.MQTT_USERNAME || 'aerosense_node',
    password: process.env.MQTT_PASSWORD || 'aerosense123',
    protocolId: 'MQTT',
    protocolVersion: 4,
    clean: true,
    reconnectPeriod: 1000,
  });

  mqttClientInstance.on('error', (err) => { console.error('MQTT Connection Error:', err); });
  mqttClientInstance.on('connect', () => {
    console.log('MQTT Client connected to EMQX Cloud');
    // Subscribe to the new hardware topics
    mqttClientInstance.subscribe('aerosense/nodes/+/alert');
    mqttClientInstance.subscribe('aerosense/nodes/+/telemetry');
    mqttClientInstance.subscribe('aerosense/nodes/+/status');
    // Keep legacy topic just in case
    mqttClientInstance.subscribe('aerosense/+/readings');
  });

  mqttClientInstance.on('message', async (topic, message) => {
    try {
      const parts = topic.split('/');
      let apiKey;
      let rawPayload = JSON.parse(message.toString());
      let adaptedPayload = rawPayload;
      let isNodeAlert = false;
      let isStatusMsg = false;

      // Check if it's the new hardware topic structure
      if (parts[1] === 'nodes' && parts.length >= 4) {
        apiKey = parts[2]; // e.g. NODE-MB-2F-FCR01
        const msgType = parts[3];

        if (msgType === 'status') {
          isStatusMsg = true;
        } else {
          // Adapt the hardware payload to the internal backend schema
          adaptedPayload = {
            pm25: rawPayload.pm25,
            voc: rawPayload.voc_index,
            temperature: rawPayload.temperature_c,
            humidity: rawPayload.humidity_pct,
            recordedAt: rawPayload.timestamp
          };
          if (msgType === 'alert') {
            isNodeAlert = true;
          }
        }
      } else {
        apiKey = parts[1]; // legacy topic structure
      }

      const device = await store.findOne('devices', d => d.apiKey && d.apiKey === apiKey);
      if (!device) {
        console.warn('Received MQTT message for unknown device api key (or node_id):', apiKey);
        return;
      }

      const now = new Date();
      const nowIso = now.toISOString();

      // Handle simple Status heartbeat pings
                  let extraUpdate = {};
      if (rawPayload.rssi !== undefined) {
        let r = Number(rawPayload.rssi);
        extraUpdate.signalStrength = Math.round(Math.max(0, Math.min(100, 2 * (r + 100))));
      }
      if (rawPayload.firmware_version) extraUpdate.firmware = String(rawPayload.firmware_version);
      extraUpdate.battery = rawPayload.battery !== undefined ? Number(rawPayload.battery) : 100;
      extraUpdate.responseTime = '< 50ms';

              // Update in-memory health
        let health = deviceHealthMap.get(device.id) || {};
        if (rawPayload.rssi !== undefined) {
          let r = Number(rawPayload.rssi);
          health.signalStrength = Math.round(Math.max(0, Math.min(100, 2 * (r + 100))));
        }
        if (rawPayload.firmware_version) health.firmware = String(rawPayload.firmware_version);
        health.battery = rawPayload.battery !== undefined ? Number(rawPayload.battery) : 100;
        health.responseTime = '< 50ms';
        deviceHealthMap.set(device.id, health);

        if (isStatusMsg) {
        await store.update('devices', device.id, {
          lastSeen: 'Just now',
          lastUpdate: nowIso,
          status: 'online',
          issue: null,
          
        });
        return; // No reading to process
      }

      // Parse and validate the adapted reading payload
            

      const parsed = parseReading(adaptedPayload);
      if (!parsed.ok) {
        console.warn('Invalid MQTT reading payload:', parsed.errors, adaptedPayload);
        return;
      }

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

      await store.insert('sensor_readings', reading);

      await store.update('devices', device.id, {
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

      // --- detection logic ---
      const settings = await store.getSettings();
      const thresholds = resolveThresholds(device, settings);
      
      // We check if the backend evaluates it as an alert, OR if the Node specifically sent it to /alert
      const { triggered, reasons } = evaluateThreshold(reading, thresholds);
      
      const shouldTriggerAlert = triggered || isNodeAlert;
      let finalReasons = reasons;
      if (isNodeAlert && !triggered) {
        finalReasons = ['Node Hardware Alert Triggered'];
      }

      if (shouldTriggerAlert) {
        const deviceAlerts = await store.findDeviceAlerts(device.id);
        const openCount = deviceAlerts.filter(a => a.status === 'ACTIVE' || a.status === 'RESPONDING').length;
        const autoAlerts = deviceAlerts.filter(a => a.source === 'auto' && a.createdAt);
        const lastAutoAlertAt = autoAlerts.length
          ? Math.max(...autoAlerts.map(a => new Date(a.createdAt).getTime()))
          : null;

                const lastMem = deviceLastAlertTime.get(device.id) || 0;
        const timeSinceLastMem = now.getTime() - lastMem;
        
        // Block exact duplicate race conditions (e.g. telemetry + alert hitting at the same millisecond)
        if (timeSinceLastMem < 5000) {
          // It's a duplicate race condition, silently drop the alert creation
        } else if (!shouldDebounce({ openCount, lastAutoAlertAt, now: now.getTime(), cooldownSec: COOLDOWN_SEC }) || isNodeAlert) {
          deviceLastAlertTime.set(device.id, now.getTime());
          const alert = await store.insert('alerts', {
            id: uuidv4(),
            floor: device.floor || null,
            location: device.location || null,
            detectedAt: nowIso,
            sensorId: device.id,
            deviceId: device.id,
            status: 'ACTIVE',
            respondedBy: null,
            resolvedAt: null,
            pm25: reading.pm25,
            voc: reading.voc,
            source: 'auto',
            createdAt: nowIso,
          });

          await store.insert('logs', {
            id: uuidv4(),
            type: 'detection',
            title: 'AeroSense Detection - ' + (device.location || device.id),
            description: finalReasons.join('; '),
            timestamp: nowIso,
            status: 'active',
            location: device.location || null,
            deviceId: device.id,
            user: null,
            severity: reading.pm25 >= thresholds.pm25Threshold * 1.5 ? 'critical' : 'high',
            metadata: { pm25: reading.pm25, voc: reading.voc, reasons: finalReasons },
          });
          emitAlert(alert);
          try { pushService.notifyAllGuards({ title: 'Alert: Vaping Detected', body: 'Click to see more.', url: '/alerts/' + alert.id }); } catch (err) { console.error('Push failed', err); }
        }
      }
    } catch (e) {
      console.error('Error processing MQTT message:', e);
    }
  });
}

function publishCommand(nodeId, commandObj) {
  if (mqttClientInstance && mqttClientInstance.connected) {
    const topic = `aerosense/nodes//control`;
    mqttClientInstance.publish(topic, JSON.stringify(commandObj));
    return true;
  }
  return false;
}

module.exports = { initMqtt, publishCommand, getDeviceHealth };











