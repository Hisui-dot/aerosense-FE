import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ClipboardList,
  RotateCcw,
} from 'lucide-react';
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

export interface HistoryAlert {
  id: string;
  floor: string;
  room: string;
  location: string;
  type: string;
  status: 'NEW' | 'ACK' | 'RESOLVED';
  rawStatus: string;
  detectedAt: string;
  formattedDateTime: string;
  sensorId: string;
  telemetrySummary: string;
  responder: string;
  notes?: string;
  date: string;
  timestampValue: number;
}

export const MOCK_HISTORY_DATA: HistoryAlert[] = [
  {
    id: 'ALT-2026-089',
    floor: '2nd Floor',
    room: 'SV Cubicle 1M',
    location: '2nd Floor — SV Cubicle 1M',
    sensorId: 'SN-VAPE-004 (Active Sensor)',
    type: 'Vaping Detected',
    detectedAt: '11-04-2026 09:42:15 AM',
    formattedDateTime: 'Nov 4, 2026 · 09:42 AM',
    telemetrySummary: 'PM2.5: 312 µg/m³ · VOC: 215 ppb · AI Confidence: 96%',
    status: 'RESOLVED',
    rawStatus: 'RESOLVED',
    responder: 'Officer Johnson',
    notes: 'Area inspected and ventilated. Confirmed vape aerosol spike in SV Cubicle 1M; incident logged and cleared.',
    date: '2026-11-04',
    timestampValue: new Date('2026-11-04T09:42:15').getTime(),
  },
  {
    id: 'ALT-2026-088',
    floor: '3rd Floor',
    room: 'Girls Restroom',
    location: '3rd Floor — Girls Restroom',
    sensorId: 'SN-VAPE-012',
    type: 'Vaping Detected',
    detectedAt: '11-04-2026 08:15:30 AM',
    formattedDateTime: 'Nov 4, 2026 · 08:15 AM',
    telemetrySummary: 'PM2.5: 184 µg/m³ · VOC: 140 ppb · AI Confidence: 91%',
    status: 'ACK',
    rawStatus: 'ACKNOWLEDGED',
    responder: 'Security Guard',
    notes: 'Dispatched booth operator to 3rd Floor Girls Restroom for on-site verification.',
    date: '2026-11-04',
    timestampValue: new Date('2026-11-04T08:15:30').getTime(),
  },
  {
    id: 'ALT-2026-085',
    floor: 'Ground Floor',
    room: 'Cafeteria East Cubicle',
    location: 'Ground Floor — Cafeteria East Cubicle',
    sensorId: 'SN-VAPE-001',
    type: 'Vaping Detected',
    detectedAt: '11-03-2026 04:30:10 PM',
    formattedDateTime: 'Nov 3, 2026 · 04:30 PM',
    telemetrySummary: 'PM2.5: 98 µg/m³ · VOC: 88 ppb · AI Confidence: 89%',
    status: 'RESOLVED',
    rawStatus: 'RESOLVED',
    responder: 'Officer Martinez',
    notes: 'Routine patrol verification completed. Cubicle cleared and sensor returned to baseline.',
    date: '2026-11-03',
    timestampValue: new Date('2026-11-03T16:30:10').getTime(),
  },
];

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const Alerts = () => {
  const navigate = useNavigate();
  const [dateFilter, setDateFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [apiAlerts, setApiAlerts] = useState<HistoryAlert[]>([]);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await alertsApi.getAll().catch(() => []);
      const mapped = data
        .filter((a: ApiAlert) => a.status !== 'ACTIVE' && a.status !== 'REOPENED')
        .map((a: ApiAlert) => {
          let dateObj = a.createdAt ? new Date(a.createdAt) : new Date();
          if (isNaN(dateObj.getTime())) dateObj = new Date();
          const floorStr = a.floor || '';
          const roomStr = a.location || 'Unknown Location';
          const pm25Val = a.pm25 ?? 120;
          const vocVal = a.voc ?? 145;
          const confVal = a.confidence ?? 92;
          const formattedDateStr = dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          const formattedTimeStr = dateObj.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });

          return {
            id: a.id,
            floor: floorStr,
            room: roomStr,
            location: [floorStr, roomStr].filter(Boolean).join(' — ') || roomStr,
            type: a.type || 'Vaping Detected',
            status:
              a.status === 'ACKNOWLEDGED' || a.status === 'RESPONDING'
                ? 'ACK'
                : 'RESOLVED',
            rawStatus: a.status || 'RESOLVED',
            detectedAt: a.detectedAt || 'Unknown',
            formattedDateTime: `${formattedDateStr} · ${formattedTimeStr}`,
            sensorId: a.sensorId || 'SN-VAPE-001',
            telemetrySummary: `PM2.5: ${pm25Val} µg/m³ · VOC: ${vocVal} ppb · AI Confidence: ${confVal}%`,
            responder: a.respondedBy || 'Security Guard',
            date: a.createdAt ? a.createdAt.split('T')[0] : 'Unknown',
            timestampValue: dateObj.getTime(),
          } as HistoryAlert;
        });
      setApiAlerts(mapped);
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

  // Combine temporary mock dataset with any live history records
  const mockData = useMemo(() => {
    const existingIds = new Set(apiAlerts.map((a) => a.id));
    const combined = [
      ...apiAlerts,
      ...MOCK_HISTORY_DATA.filter((m) => !existingIds.has(m.id)),
    ];
    return combined;
  }, [apiAlerts]);

  // Dynamic locations from records
  const locationOptions = useMemo(() => {
    const set = new Set<string>([
      '2nd Floor — SV Cubicle 1M',
      '3rd Floor — Girls Restroom',
      'Ground Floor — Cafeteria East Cubicle',
    ]);
    mockData.forEach((a) => {
      if (a.location) set.add(a.location);
    });
    return Array.from(set);
  }, [mockData]);

  const filteredAlerts = useMemo(() => {
    return mockData
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
      .sort((a, b) => b.timestampValue - a.timestampValue);
  }, [mockData, statusFilter, locationFilter, dateFilter]);

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
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 mb-2 border-b border-slate-100">
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
                <SelectTrigger className="w-full sm:w-[220px] border-slate-200 rounded-xl text-sm bg-white text-slate-700 font-medium shadow-2xs">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locationOptions.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
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

          {/* ── 3. INCIDENT TABLE OR EMPTY STATE ── */}
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
                {mockData.length === 0
                  ? 'Acknowledged and resolved incident dispatches will appear here.'
                  : 'No records match your selected date, location, or status filters.'}
              </p>
            </motion.div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      DATE / TIME
                    </th>
                    <th className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      TYPE
                    </th>
                    <th className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      LOCATION
                    </th>
                    <th className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      ASSIGNED TO / RESPONDER
                    </th>
                    <th className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      STATUS
                    </th>
                    <th className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlerts.map((alert) => {
                    const isAck = alert.status === 'ACK';
                    const isFalseAlarm = alert.rawStatus === 'FALSE_ALARM';
                    const isEscalated = alert.rawStatus === 'ESCALATED';

                    let badgeClasses =
                      'bg-emerald-50 text-emerald-700 border border-emerald-200/70';
                    let badgeLabel = 'RESOLVED';

                    if (isAck) {
                      badgeClasses = 'bg-amber-50 text-amber-700 border border-amber-200/70';
                      badgeLabel = 'ACKNOWLEDGED';
                    } else if (isFalseAlarm) {
                      badgeClasses = 'bg-slate-100 text-slate-600 border border-slate-200/70';
                      badgeLabel = 'FALSE ALARM';
                    } else if (isEscalated) {
                      badgeClasses = 'bg-purple-50 text-purple-700 border border-purple-200/70';
                      badgeLabel = 'ESCALATED';
                    }

                    return (
                      <tr
                        key={alert.id}
                        onClick={() => navigate(`/alerts/${alert.id}`)}
                        className="bg-white border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 transition-colors cursor-pointer"
                      >
                        {/* Column 1: DATE / TIME */}
                        <td className="py-4 px-4 align-middle whitespace-nowrap text-sm text-slate-600">
                          {alert.formattedDateTime}
                        </td>

                        {/* Column 2: TYPE */}
                        <td className="py-4 px-4 align-middle whitespace-nowrap text-slate-700 font-medium text-sm">
                          {alert.type}
                        </td>

                        {/* Column 3: LOCATION */}
                        <td className="py-4 px-4 align-middle text-slate-800 font-medium text-sm">
                          {alert.location}
                        </td>

                        {/* Column 4: ASSIGNED TO / RESPONDER */}
                        <td className="py-4 px-4 align-middle whitespace-nowrap text-slate-700 font-medium text-sm">
                          {alert.responder}
                        </td>

                        {/* Column 5: STATUS */}
                        <td className="py-4 px-4 align-middle whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${badgeClasses}`}
                          >
                            {badgeLabel}
                          </span>
                        </td>

                        {/* Column 6: ACTIONS */}
                        <td
                          className="py-4 px-4 align-middle text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => navigate(`/alerts/${alert.id}`)}
                            className="bg-[#071126] text-white hover:bg-blue-900 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer"
                          >
                            View Log
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};



