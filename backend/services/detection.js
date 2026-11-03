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
  if (lastAutoAlertAt != null && now - lastAutoAlertAt < cooldownSec * 1000) return true;
  return false;
}

module.exports = { evaluateThreshold, shouldDebounce, resolveThresholds };

