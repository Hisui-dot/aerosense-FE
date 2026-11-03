import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ClipboardList,
  Clock,
  MapPin,
  Radio,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { alertsApi, Alert as ApiAlert } from '@/app/services/api';
import { useLiveStream } from '@/app/hooks/useLiveStream';

interface HistoryAlert {
  id: string;
  floor: string;
  room: string;
  location: string;
  type: string;
  status: 'NEW' | 'ACK' | 'RESOLVED';
  rawStatus: string;
  detectedAt: string;
  sensorId: string;
  date: string;
  timestampValue: number;
  respondedBy?: string | null;
}

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const Alerts = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dateFilter, setDateFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [alerts, setAlerts] = useState<HistoryAlert[]>([]);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await alertsApi.getAll().catch(() => []);
      const mapped = data.map((a: ApiAlert) => {
        let dateObj = a.createdAt ? new Date(a.createdAt) : new Date();
        if (isNaN(dateObj.getTime())) dateObj = new Date();
        const floorStr = a.floor || '';
        const roomStr = a.location || 'Unknown Location';
        return {
          id: a.id,
          floor: floorStr,
          room: roomStr,
          location: [floorStr, roomStr].filter(Boolean).join(' — ') || roomStr,
          type: a.type || 'Vaping Detected',
          status:
            a.status === 'ACTIVE' || a.status === 'REOPENED'
              ? 'NEW'
              : a.status === 'ACKNOWLEDGED' || a.status === 'RESPONDING'
              ? 'ACK'
              : 'RESOLVED',
          rawStatus: a.status || 'RESOLVED',
          detectedAt: a.detectedAt || 'Unknown',
          sensorId: a.sensorId || 'Unknown',
          date: a.createdAt ? a.createdAt.split('T')[0] : 'Unknown',
          timestampValue: dateObj.getTime(),
          respondedBy: a.respondedBy,
        } as HistoryAlert;
      });
      setAlerts(mapped);
    } catch (error) {
      toast.error('Failed to load alerts');
    }
  }, []);

  useLiveStream({
    onAlert: () => {
      fetchAlerts();
    },
  });

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 3000);
    return () => {
      clearInterval(interval);
    };
  }, [fetchAlerts]);

  const handleAcknowledge = async (id: string) => {
    try {
      await alertsApi.acknowledge(id);
      setAlerts((prevAlerts) =>
        prevAlerts.map((alert) =>
          alert.id === id ? { ...alert, status: 'ACK' as const } : alert
        )
      );
      toast.success('Alert acknowledged successfully');
    } catch (e) {
      toast.error('Failed to acknowledge alert');
    }
  };

  // All history records belonging to this guard (excluding NEW/ACTIVE dispatches)
  const guardHistoryAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (alert.status === 'NEW') return false;
      if (
        alert.respondedBy &&
        alert.respondedBy !== user?.username &&
        alert.respondedBy !== user?.name
      ) {
        return false;
      }
      return true;
    });
  }, [alerts, user?.username, user?.name]);

  // Dynamic locations from history records + standard locations
  const locationOptions = useMemo(() => {
    const set = new Set<string>(['Library', 'CR', 'Classroom']);
    guardHistoryAlerts.forEach((a) => {
      if (a.room && a.room !== 'Unknown Location') set.add(a.room);
      if (a.floor) set.add(a.floor);
    });
    return Array.from(set);
  }, [guardHistoryAlerts]);

  const filteredAlerts = useMemo(() => {
    return guardHistoryAlerts
      .filter((alert) => {
        if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
        if (
          locationFilter !== 'all' &&
          !alert.location.toLowerCase().includes(locationFilter.toLowerCase())
        ) {
          return false;
        }

        if (dateFilter !== 'all') {
          const now = Date.now();
          const oneDay = 24 * 60 * 60 * 1000;
          if (dateFilter === 'today' && now - alert.timestampValue > oneDay) return false;
          if (dateFilter === 'week' && now - alert.timestampValue > 7 * oneDay) return false;
          if (dateFilter === 'month' && now - alert.timestampValue > 30 * oneDay) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const statusWeight: Record<string, number> = { NEW: 1, ACK: 2, RESOLVED: 3 };
        const weightA = statusWeight[a.status] || 4;
        const weightB = statusWeight[b.status] || 4;

        if (weightA !== weightB) return weightA - weightB;
        return b.timestampValue - a.timestampValue;
      });
  }, [guardHistoryAlerts, statusFilter, locationFilter, dateFilter]);

  const hasActiveFilters =
    dateFilter !== 'all' || locationFilter !== 'all' || statusFilter !== 'all';

  const resetFilters = () => {
    setDateFilter('all');
    setLocationFilter('all');
    setStatusFilter('all');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-8 pb-28 lg:pb-10">
      <div className="w-full max-w-[1400px] mx-auto space-y-6">
        {/* ── 1. PAGE HEADER & HIERARCHY (Stagger 0ms) ── */}
        <motion.div
          initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.75, delay: 0, ease: EASE_OUT_EXPO }}
          className="flex flex-col gap-1"
        >
          <span className="text-xs font-semibold tracking-wider text-blue-600 uppercase">
            HISTORY &amp; LOGS
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Response History
          </h1>
          <p className="text-sm text-slate-500">
            Review acknowledged, resolved, and logged incidents across facilities.
          </p>
        </motion.div>

        {/* ── 2. FILTER CONTROLS & CONTENT CONTAINER (Stagger 100ms) ── */}
        <motion.div
          initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.75, delay: 0.1, ease: EASE_OUT_EXPO }}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col"
        >
          {/* Card Header + Filters Row */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 mb-5 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-slate-900">Incident Log</h2>
                <span className="text-xs text-slate-600 font-semibold bg-slate-100 px-2.5 py-0.5 rounded-full">
                  {filteredAlerts.length} {filteredAlerts.length === 1 ? 'record' : 'records'}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-1">
                Historical dispatches handled and verified by your station
              </p>
            </div>

            {/* Clean Dropdown Select Inputs */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-full sm:w-[145px] border-slate-200 rounded-xl text-sm bg-white text-slate-700 font-medium shadow-2xs">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>

              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-full sm:w-[175px] border-slate-200 rounded-xl text-sm bg-white text-slate-700 font-medium shadow-2xs">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locationOptions.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc === 'CR' ? 'CR 2nd Floor' : loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px] border-slate-200 rounded-xl text-sm bg-white text-slate-700 font-medium shadow-2xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACK">Acknowledged</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* ── 3. INCIDENT LIST OR EMPTY STATE ── */}
          {filteredAlerts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18, ease: EASE_OUT_EXPO }}
              className="py-14 px-4 flex flex-col items-center justify-center text-center"
            >
              <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-3.5">
                <ClipboardList className="h-7 w-7 text-slate-400" />
              </div>
              <p className="text-slate-900 font-bold text-base sm:text-lg">
                No response history found
              </p>
              <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-sm">
                {guardHistoryAlerts.length === 0
                  ? 'Acknowledged and resolved incident dispatches will appear here.'
                  : 'No records match your selected date, location, or status filters.'}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map((alert, idx) => {
                const isAck = alert.status === 'ACK';
                const isFalseAlarm = alert.rawStatus === 'FALSE_ALARM';
                const isEscalated = alert.rawStatus === 'ESCALATED';

                let badgeClasses =
                  'bg-emerald-50 text-emerald-700 border border-emerald-200/80';
                let badgeLabel = 'RESOLVED';

                if (isAck) {
                  badgeClasses = 'bg-amber-50 text-amber-700 border border-amber-200/80';
                  badgeLabel = 'ACKNOWLEDGED';
                } else if (isFalseAlarm) {
                  badgeClasses = 'bg-slate-100 text-slate-600 border border-slate-200/80';
                  badgeLabel = 'FALSE ALARM';
                } else if (isEscalated) {
                  badgeClasses = 'bg-purple-50 text-purple-700 border border-purple-200/80';
                  badgeLabel = 'ESCALATED';
                }

                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 16, filter: 'blur(2px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{
                      duration: 0.65,
                      delay: Math.min(0.15 + idx * 0.05, 0.45),
                      ease: EASE_OUT_EXPO,
                    }}
                    onClick={() => navigate(`/alerts/${alert.id}`)}
                    className={`group bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-xs hover:shadow-md hover:border-slate-200/90 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isAck
                        ? 'border-l-4 border-l-amber-500'
                        : 'border-l-4 border-l-emerald-500'
                    }`}
                  >
                    {/* Left Info: Location, Sensor ID, Timestamp */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-[#0284C7] shrink-0" />
                          {alert.location}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide ${badgeClasses}`}
                        >
                          {badgeLabel}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Radio className="h-3.5 w-3.5 text-slate-400" />
                          Sensor <span className="font-mono font-semibold text-slate-700">{alert.sensorId}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          Detected: <span className="text-slate-700 font-semibold">{alert.detectedAt}</span>
                        </span>
                      </div>
                    </div>

                    {/* Right Action Buttons */}
                    <div
                      className="flex items-center gap-2.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {alert.status === 'NEW' && (
                        <button
                          type="button"
                          onClick={() => handleAcknowledge(alert.id)}
                          className="bg-[#003882] hover:bg-[#0284C7] text-white text-xs font-medium px-4 py-2 rounded-xl transition-all active:scale-95 cursor-pointer"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => navigate(`/alerts/${alert.id}`)}
                        className="inline-flex items-center justify-center gap-1.5 bg-[#071126] hover:bg-blue-900 text-white text-xs font-medium px-4 py-2 rounded-xl transition-all active:scale-95 shadow-xs cursor-pointer"
                      >
                        <span>View Details</span>
                        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};


