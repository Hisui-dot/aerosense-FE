const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(100);

function emitReading(payload) { bus.emit('reading', payload); }
function emitAlert(payload) { bus.emit('alert', payload); }

module.exports = { bus, emitReading, emitAlert };
