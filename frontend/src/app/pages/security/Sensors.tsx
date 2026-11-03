import { useState, useEffect, useCallback } from 'react';
import { Wrench, BatteryFull, BatteryMedium, BatteryLow, Battery, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { devicesApi } from '@/app/services/api';

interface Sensor {
  id: string;
  name: string;
  floor: string;
  location: string;
  battery: number | null; // 0–100 or null when not reported
  status: 'online' | 'offline' | 'maintenance';
  sensorHealth: number | null; // 0–100 or null when not reported
  lastServiced: string;
  replaceIn: string;
  nextService: string;
  notes?: string;
}


const getBatteryIcon = (pct: number) => {
  if (pct >= 60) return BatteryFull;
  if (pct >= 30) return BatteryMedium;
  if (pct >= 15) return BatteryLow;
  return Battery;
};

const getBatteryColor = (pct: number) => {
  if (pct >= 60) return 'text-green-600';
  if (pct >= 30) return 'text-yellow-600';
  if (pct >= 15) return 'text-orange-600';
  return 'text-red-600';
};

const getBatteryBarColor = (pct: number) => {
  if (pct >= 60) return 'bg-green-500';
  if (pct >= 30) return 'bg-yellow-500';
  if (pct >= 15) return 'bg-orange-500';
  return 'bg-red-500';
};

const getHealthColor = (h: number) => {
  if (h >= 75) return 'text-green-600';
  if (h >= 50) return 'text-yellow-600';
  return 'text-red-600';
};

const getHealthLabel = (h: number) => {
  if (h >= 85) return 'Excellent';
  if (h >= 70) return 'Good';
  if (h >= 50) return 'Fair';
  if (h >= 30) return 'Poor';
  return 'Critical';
};

export const Sensors = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'OFFLINE'>('ALL');
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSensors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const devicesData = await devicesApi.getAll();
      const mappedSensors: Sensor[] = (devicesData || []).map((d: any, index: number) => ({
        id: d.id || `S-${(index + 1).toString().padStart(2, '0')}`,
        name: d.name || `Vape Sensor ${(index + 1).toString().padStart(2, '0')}`,
        floor: d.floor || 'Unknown Floor',
        location: d.location || 'Unknown Location',
        battery: d.battery ?? null,
        status: d.status?.toLowerCase() === 'offline' ? 'offline' : d.status?.toLowerCase() === 'maintenance' ? 'maintenance' : 'online',
        sensorHealth: d.health ?? null,
        lastServiced: d.lastServiced || '—',
        replaceIn: d.replaceIn || '—',
        nextService: d.nextService || '—',
        notes: d.notes,
      }));
      setSensors(mappedSensors);
    } catch (err) {
      setError('Failed to load sensors. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSensors();
  }, []);

  const criticalCount = sensors.filter(s => (s.battery !== null && s.battery < 15) || s.status === 'offline').length;

  const filtered = sensors.filter(s => {
    if (filter === 'CRITICAL') return s.battery !== null && s.battery < 15;
    if (filter === 'OFFLINE') return s.status === 'offline' || s.status === 'maintenance';
    return true;
  });

  const handleReport = async (id: string) => {
    try {
      await (devicesApi as any).update(id, { status: 'maintenance' });
      setSensors(prev => prev.map(s => s.id === id ? { ...s, status: 'maintenance' } : s));
      toast.success(`Maintenance ticket submitted for ${id}`);
    } catch(e) {
      toast.error('Failed to submit maintenance ticket');
    }
  };

  if (loading && sensors.length === 0) {
    return (
      <div className="min-h-screen bg-[#82BCFE] flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-white border-t-transparent mx-auto mb-3" />
          <p className="font-semibold text-lg">Loading sensors…</p>
        </div>
      </div>
    );
  }

  if (error && sensors.length === 0) {
    return (
      <div className="min-h-screen bg-[#82BCFE] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 text-center max-w-sm w-full">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <p className="font-semibold text-gray-800 mb-4">{error}</p>
          <button
            onClick={fetchSensors}
            className="bg-[#2665D0] text-white font-bold py-2 px-6 rounded-xl hover:bg-[#1a4d9e] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#82BCFE] pb-24">

      {/* Summary Bar */}
      <div className="px-4 pt-4 pb-3 w-full mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 text-center shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <div className="font-bold text-2xl text-gray-900">{sensors.length}</div>
            <div className="text-xs text-gray-500 font-semibold mt-0.5">Total</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <div className="font-bold text-2xl text-green-600">{sensors.filter(s => s.status === 'online').length}</div>
            <div className="text-xs text-gray-500 font-semibold mt-0.5">Online</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <div className="font-bold text-2xl text-red-600">{criticalCount}</div>
            <div className="text-xs text-gray-500 font-semibold mt-0.5">Need Attention</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 w-full mx-auto mb-3">
        <div className="flex gap-2 bg-white/30 rounded-xl p-1">
          {(['ALL', 'CRITICAL', 'OFFLINE'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                filter === f
                  ? 'bg-white text-[#2665D0] shadow-sm'
                  : 'text-white hover:bg-white/20'
              }`}
            >
              {f === 'CRITICAL' ? '🔋 Critical' : f === 'OFFLINE' ? '⚠️ Offline' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Sensor Cards */}
      <div className="px-4 w-full mx-auto space-y-3">
        {filtered.length === 0 && !loading && (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <p className="text-gray-500 font-semibold">No sensors found.</p>
          </div>
        )}
        {filtered.map(sensor => {
          const batteryValue = sensor.battery ?? 0;
          const hasBattery = sensor.battery !== null;
          const BattIcon = getBatteryIcon(batteryValue);
          const isCriticalBattery = hasBattery && batteryValue < 15;
          const isExpanded = expandedId === sensor.id;
          const healthValue = sensor.sensorHealth ?? 0;
          const hasHealth = sensor.sensorHealth !== null;

          return (
            <div
              key={sensor.id}
              className={`rounded-2xl shadow-lg overflow-hidden border-2 transition-all hover:shadow-xl hover:-translate-y-1 duration-300 ${
                isCriticalBattery || sensor.status === 'offline'
                  ? 'border-red-300 bg-orange-50'
                  : hasBattery && batteryValue < 30
                  ? 'border-yellow-300 bg-yellow-50'
                  : 'border-transparent bg-white'
              }`}
            >
              {/* Critical Banner */}
              {(isCriticalBattery || sensor.status === 'offline') && (
                <div className={`px-4 py-2 flex items-center gap-2 ${
                  sensor.status === 'offline' ? 'bg-red-600' : 'bg-orange-500'
                }`}>
                  <AlertTriangle className="h-4 w-4 text-white" />
                  <span className="text-xs font-bold text-white uppercase tracking-wide">
                    {sensor.status === 'offline' ? 'SENSOR OFFLINE — Immediate Action' : 'CRITICAL BATTERY — Replace Soon'}
                  </span>
                </div>
              )}

              <div className="p-5">
                {/* Top Row */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{sensor.floor}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        sensor.status === 'online' ? 'bg-green-100 text-green-700' :
                        sensor.status === 'offline' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {sensor.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="font-bold text-gray-900 text-base leading-tight">{sensor.id}</div>
                    <div className="text-sm text-gray-600 mt-0.5">{sensor.location}</div>
                  </div>

                  {/* Status Icon */}
                  <div>
                    {sensor.status === 'online'
                      ? <CheckCircle className="h-7 w-7 text-green-500" />
                      : sensor.status === 'offline'
                      ? <XCircle className="h-7 w-7 text-red-500" />
                      : <Wrench className="h-7 w-7 text-yellow-500" />
                    }
                  </div>
                </div>

                {/* Battery Row */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <BattIcon className={`h-5 w-5 ${hasBattery ? getBatteryColor(batteryValue) : 'text-gray-400'}`} />
                      <span className="text-sm font-semibold text-gray-700">Battery Level</span>
                    </div>
                    <span className={`font-bold ${hasBattery ? getBatteryColor(batteryValue) : 'text-gray-400'}`}>
                      {hasBattery ? `${batteryValue}%` : '—'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all ${hasBattery ? getBatteryBarColor(batteryValue) : 'bg-gray-300'}`}
                      style={{ width: hasBattery ? `${batteryValue}%` : '0%' }}
                    />
                  </div>
                  {isCriticalBattery && (
                    <p className="text-xs text-red-600 font-bold mt-1">⚠ Replace battery immediately</p>
                  )}
                </div>

                {/* Health Row */}
                <div className="flex items-center justify-between py-3 border-t border-gray-100">
                  <div>
                    <div className="text-xs text-gray-500 font-semibold">Sensor Element Health</div>
                    <div className={`font-bold ${hasHealth ? getHealthColor(healthValue) : 'text-gray-400'}`}>
                      {hasHealth ? `${healthValue}% — ${getHealthLabel(healthValue)}` : '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 font-semibold">Est. Lifespan</div>
                    <div className={`font-bold ${sensor.replaceIn === 'Overdue' ? 'text-red-600' : 'text-gray-800'}`}>
                      {sensor.replaceIn}
                    </div>
                  </div>
                </div>

                {/* Expand Toggle */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : sensor.id)}
                  className="w-full flex items-center justify-between py-2 text-sm text-[#2665D0] font-semibold mt-1"
                >
                  <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="text-xs text-gray-500 font-semibold">Last Serviced</div>
                        <div className="font-bold text-gray-900 text-sm mt-0.5">{sensor.lastServiced}</div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="text-xs text-gray-500 font-semibold">Next Service</div>
                        <div className={`font-bold text-sm mt-0.5 ${
                          sensor.nextService === 'Immediate' ? 'text-red-600' : 'text-gray-900'
                        }`}>{sensor.nextService}</div>
                      </div>
                    </div>

                    {sensor.notes && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-yellow-800 font-medium">{sensor.notes}</p>
                      </div>
                    )}

                    <button
                      onClick={() => handleReport(sensor.id)}
                      className="w-full bg-[#2665D0] text-white font-bold py-3 rounded-xl hover:bg-[#1a4d9e] transition-colors flex items-center justify-center gap-2"
                    >
                      <Wrench className="h-4 w-4" />
                      Submit Maintenance Ticket
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

