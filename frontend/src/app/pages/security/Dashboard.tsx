import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle,
  Clock,
  MapPin,
  TriangleAlert,
  Activity,
  RotateCcw,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/app/context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { AnimatedCounter } from '@/app/components/ui/AnimatedCounter';
import { alertsApi, devicesApi, Alert as ApiAlert } from '@/app/services/api';
import { useLiveStream } from '@/app/hooks/useLiveStream';

/* ─── types ─────────────────────────────────────────────────────── */
interface Alert {
  id: string;
  sensorId: string;
  type: string;
  location: string;
  room: string;
  timeDetected: string;
  createdAt?: string;
  status: 'new' | 'acknowledged' | 'responding' | 'resolved';
  priority: 'high' | 'medium' | 'low';
  assignedResponder?: string | null;
  pm25: number;
  voc: number;
  pm25Max: number;
  vocMax: number;
  confidence: number;
}

interface ResponseHistoryItem {
  id: string;
  location: string;
  timeResolved: string;
  finalStatus: string;
  notes: string;
}

/* ─── style maps ─────────────────────────────────────────────────── */
const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-rose-50 text-rose-700 border border-rose-200/80',
  medium: 'bg-amber-50 text-amber-700 border border-amber-200/80',
  low: 'bg-slate-100 text-slate-700 border border-slate-200/80',
};

const STATUS_BADGE: Record<string, string> = {
  new: 'bg-rose-500/10 text-rose-600 border border-rose-500/20',
  acknowledged: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
  responding: 'bg-sky-500/10 text-sky-600 border border-sky-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
};

const PM25_SAFE = 35;
const VOC_SAFE = 150;

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ─────────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────────── */
export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [history, setHistory] = useState<ResponseHistoryItem[]>([]);
  const [incomingAlert, setIncomingAlert] = useState<any | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // Filter States
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const subscribeToPush = async () => {
    let perm = window.Notification.permission;
    if (perm !== 'granted') {
      perm = await window.Notification.requestPermission();
    }
    if (perm === 'denied') {
      alert('CRITICAL: You MUST enable Push Notifications in your browser settings to use this dashboard!');
      return;
    }
    if (perm !== 'granted') {
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications not supported in this browser.');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const vapidRes = await fetch('https://aerosense-u67m.onrender.com' + '/api/push/vapid-public-key');
        const vapidPublicKey = await vapidRes.text();
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
      }

      await fetch('https://aerosense-u67m.onrender.com' + '/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
        body: JSON.stringify(sub),
      });

      console.log('Push enabled silently');
    } catch (e) {
      console.error(e);
      console.log('Push failed silently');
    }
  };

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const displayFirst = user?.username
    ? user.username.charAt(0).toUpperCase() + user.username.slice(1)
    : 'Guard';

  const activeAlerts = useMemo(
    () =>
      alerts.filter(
        (a) => a.status === 'new' || a.status === 'acknowledged' || a.status === 'responding'
      ),
    [alerts]
  );

  const acknowledgedCount = useMemo(
    () => alerts.filter((a) => a.status === 'acknowledged' || a.status === 'responding').length,
    [alerts]
  );

  const resolvedToday = useMemo(
    () => history.filter((h) => !h.timeResolved.includes('Yesterday')).length,
    [history]
  );

  const availableLocations = useMemo(() => {
    const locs = new Set<string>();
    activeAlerts.forEach((a) => {
      if (a.location) locs.add(a.location);
    });
    return Array.from(locs);
  }, [activeAlerts]);

  const filteredAlerts = useMemo(() => {
    return activeAlerts.filter((alert) => {
      if (locationFilter !== 'all' && alert.location !== locationFilter) return false;
      if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && alert.priority !== priorityFilter) return false;
      if (dateFilter === 'today') {
        const isYesterday = alert.timeDetected.toLowerCase().includes('yesterday');
        if (isYesterday) return false;
      }
      return true;
    });
  }, [activeAlerts, locationFilter, statusFilter, priorityFilter, dateFilter]);

  const hasActiveFilters =
    dateFilter !== 'all' ||
    locationFilter !== 'all' ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all';

  const resetFilters = () => {
    setDateFilter('all');
    setLocationFilter('all');
    setStatusFilter('all');
    setPriorityFilter('all');
  };

  const fetchAlerts = useCallback(async () => {
    try {
      const [alertsData, devicesData] = await Promise.all([
        alertsApi.getAll(),
        devicesApi.getAll().catch(() => []),
      ]);

      const mappedAlerts = alertsData.map((a: ApiAlert) => {
        const device = devicesData.find((d: any) => d.id === a.sensorId);

        const pm25Val = a.pm25 ?? device?.pm25 ?? 45;
        const vocVal = a.voc ?? device?.voc ?? 180;
        const confVal = a.confidence ?? 94;

        return {
          id: a.id,
          sensorId: a.sensorId || device?.id || 'SEN-01',
          type: a.type ?? 'Vaping Detected',
          location: a.floor || '1st Floor',
          room: a.location || 'SV Cubicle 1M',
          timeDetected: a.detectedAt || 'Just now',
          createdAt: a.createdAt,
          status:
            a.status === 'ACTIVE' || a.status === 'REOPENED'
              ? 'new'
              : a.status === 'RESPONDING' || a.status === 'ESCALATED'
              ? 'responding'
              : a.status === 'ACKNOWLEDGED'
              ? 'acknowledged'
              : 'resolved',
          priority: a.priority || (confVal >= 95 ? 'high' : confVal >= 80 ? 'medium' : 'low'),
          assignedResponder: a.respondedBy,
          pm25: pm25Val,
          voc: vocVal,
          pm25Max: 100,
          vocMax: 500,
          confidence: confVal,
        } as Alert;
      });

      setAlerts((prev) => {
        const prevActive = prev.filter((a) => a.status === 'new').map((a) => a.id);
        const newActive = mappedAlerts.filter((a) => a.status === 'new');
        const newlyAppeared = newActive.find((a) => !prevActive.includes(a.id));
        if (newlyAppeared && prev.length > 0) {
          setIncomingAlert(newlyAppeared);
          try {
            const siren = document.getElementById('siren-audio');
            if (siren) {
              (siren as HTMLAudioElement).currentTime = 0;
              (siren as HTMLAudioElement).play().catch(() => {});
            }
          } catch (e) {}
        }

        const incomingId = searchParams.get('incoming');
        if (incomingId) {
          const inc = mappedAlerts.find((a) => a.id === incomingId);
          if (inc && inc.status === 'new' && !incomingAlert) {
            setIncomingAlert(inc);
            try {
              const siren = document.getElementById('siren-audio');
              if (siren) {
                (siren as HTMLAudioElement).currentTime = 0;
                (siren as HTMLAudioElement).play().catch((e) => console.error('Autoplay blocked:', e));
              }
            } catch (e) {}
            searchParams.delete('incoming');
            setSearchParams(searchParams);
          }
        }

        return mappedAlerts;
      });

      const fetchedHistory = alertsData
        .filter(
          (a: ApiAlert) =>
            ['RESOLVED', 'FALSE_ALARM', 'ESCALATED'].includes(a.status) &&
            (a.respondedBy === user?.username || a.respondedBy === user?.name || !a.respondedBy)
        )
        .map((a: ApiAlert) => {
          let noteText = 'Processed via system';
          if (Array.isArray(a.notes) && a.notes.length > 0) {
            noteText = (a.notes as any)[(a.notes as any).length - 1].text;
          } else if (typeof a.notes === 'string' && a.notes) {
            noteText = a.notes;
          }

          let resDate = a.resolvedAt ? new Date(a.resolvedAt) : new Date();
          if (isNaN(resDate.getTime())) resDate = new Date();

          return {
            id: a.id,
            location: `${a.floor || 'Unknown Floor'} — ${a.location || 'Unknown Room'}`,
            timeResolved: a.resolvedAt
              ? resDate.toDateString() === new Date().toDateString()
                ? resDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                : resDate.toLocaleDateString([], { month: 'short', day: 'numeric' })
              : resDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
            finalStatus:
              a.status === 'FALSE_ALARM'
                ? 'False Alarm'
                : a.status === 'ESCALATED'
                ? 'Escalated'
                : 'Confirmed',
            notes: noteText,
          } as ResponseHistoryItem;
        });

      setHistory(fetchedHistory);
    } catch (error) {
      console.error('Failed to sync alerts', error);
    }
  }, [user?.username, user?.name, searchParams, setSearchParams, incomingAlert]);

  const handleQuickAction = async (
    e: React.MouseEvent,
    alertId: string,
    action: 'acknowledge' | 'respond' | 'resolve'
  ) => {
    e.stopPropagation();
    setActionBusyId(`${alertId}-${action}`);
    try {
      if (action === 'acknowledge') {
        await alertsApi.acknowledge(alertId);
        toast.success(`Alert ${alertId.slice(0, 8)} acknowledged`);
      } else if (action === 'respond') {
        await alertsApi.respond(alertId);
        toast.success(`Responding to alert ${alertId.slice(0, 8)}`);
      } else if (action === 'resolve') {
        await alertsApi.resolve(alertId);
        toast.success(`Alert ${alertId.slice(0, 8)} resolved`);
      }
      await fetchAlerts();
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${action} alert`);
    } finally {
      setActionBusyId(null);
    }
  };

  useEffect(() => {
    const unlockAudio = () => {
      const siren = document.getElementById('siren-audio');
      if (siren && (siren as HTMLAudioElement).paused) {
        (siren as HTMLAudioElement)
          .play()
          .then(() => {
            (siren as HTMLAudioElement).pause();
            (siren as HTMLAudioElement).currentTime = 0;
          })
          .catch(() => {});
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      }
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, [user?.username]);

  useLiveStream({
    onAlert: (a) => {
      fetchAlerts();
      if (a.status === 'ACTIVE') setIncomingAlert(a);
    },
  });

  useEffect(() => {
    if (window.Notification && Notification.permission !== 'granted') {
      setTimeout(subscribeToPush, 500);
    } else if (window.Notification && Notification.permission === 'granted') {
      setTimeout(subscribeToPush, 500);
    }
    fetchAlerts();
    const intervalId = setInterval(fetchAlerts, 3000);
    return () => {
      clearInterval(intervalId);
    };
  }, [fetchAlerts]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-8 pb-28 lg:pb-10">
      <div className="w-full max-w-[1400px] mx-auto space-y-6">
        
        {/* ── 1. GREETING HEADER (Stagger 0s) ── */}
        <motion.div
          initial={{ opacity: 0, y: 24, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0, ease: EASE_OUT_EXPO }}
          className="flex flex-col gap-1"
        >
          <span className="text-[10px] font-bold tracking-widest text-[#0284C7] uppercase">
            Live Monitor
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Hi, {displayFirst}!
            </h1>
            <span className="inline-flex items-center border border-slate-200 bg-white text-slate-600 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest shadow-2xs">
              Booth Operator
            </span>
          </div>
          <p className="text-sm font-medium text-slate-500">
            Welcome back. Monitoring campus telemetry and active dispatches in real-time.
          </p>
        </motion.div>

        {/* ── 2. TOP KPI METRIC CARDS (Staggered 0.1s, 0.18s, 0.26s) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Active Alerts */}
          <motion.div
            initial={{ opacity: 0, y: 24, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 0.1, ease: EASE_OUT_EXPO }}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between transition-shadow duration-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-600">Active Alerts</h3>
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                <TriangleAlert className="w-5 h-5 text-rose-500" />
              </div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                <AnimatedCounter value={activeAlerts.length} duration={1200} />
              </div>
              <p className="text-xs font-semibold text-slate-400 mt-1">
                {activeAlerts.length > 0 ? 'Requires immediate dispatch' : 'All zones clear'}
              </p>
            </div>
          </motion.div>

          {/* Card 2: In Progress */}
          <motion.div
            initial={{ opacity: 0, y: 24, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 0.18, ease: EASE_OUT_EXPO }}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between transition-shadow duration-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-600">In Progress</h3>
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <Activity className="w-5 h-5 text-amber-500" />
              </div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                <AnimatedCounter value={acknowledgedCount} duration={1200} />
              </div>
              <p className="text-xs font-semibold text-slate-400 mt-1">
                Acknowledged &amp; responding
              </p>
            </div>
          </motion.div>

          {/* Card 3: Resolved Today */}
          <motion.div
            initial={{ opacity: 0, y: 24, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 0.26, ease: EASE_OUT_EXPO }}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between transition-shadow duration-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-600">Resolved Today</h3>
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                <AnimatedCounter value={resolvedToday} duration={1200} />
              </div>
              <p className="text-xs font-semibold text-slate-400 mt-1">
                Completed shift incidents
              </p>
            </div>
          </motion.div>
        </div>

        {/* ── 3. MAIN ALERT LIST / MONITOR CONTAINER (Stagger 0.35s) ── */}
        <motion.div
          initial={{ opacity: 0, y: 24, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.85, delay: 0.35, ease: EASE_OUT_EXPO }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col"
        >
          {/* Card Header & Filters */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 mb-5 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-slate-900">Alert List</h2>
                <span className="text-xs text-slate-600 font-semibold bg-slate-100 px-2.5 py-0.5 rounded-full">
                  {filteredAlerts.length} ongoing
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-1">
                Real-time IoT sensor triggers and active dispatch queue
              </p>
            </div>

            {/* Compact Pill Filter Triggers */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by Date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full px-3.5 py-1.5 text-xs font-semibold text-[#071126] focus:outline-none focus:border-[#003882] transition-all cursor-pointer"
              >
                <option value="all">Date: All</option>
                <option value="today">Date: Today</option>
              </select>

              <select
                aria-label="Filter by Location"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full px-3.5 py-1.5 text-xs font-semibold text-[#071126] focus:outline-none focus:border-[#003882] transition-all cursor-pointer"
              >
                <option value="all">Location: All Floors</option>
                {availableLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full px-3.5 py-1.5 text-xs font-semibold text-[#071126] focus:outline-none focus:border-[#003882] transition-all cursor-pointer"
              >
                <option value="all">Status: All</option>
                <option value="new">New</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="responding">Responding</option>
              </select>

              <select
                aria-label="Filter by Priority"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full px-3.5 py-1.5 text-xs font-semibold text-[#071126] focus:outline-none focus:border-[#003882] transition-all cursor-pointer"
              >
                <option value="all">Priority: All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#071126] text-white text-xs font-semibold hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Table Content or Empty State */}
          {filteredAlerts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.45, ease: EASE_OUT_EXPO }}
              className="py-12 px-4 flex flex-col items-center justify-center text-center"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-3.5">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="text-slate-900 font-bold text-base sm:text-lg">
                All clear — no active alerts
              </p>
              <p className="text-slate-500 text-xs sm:text-sm mt-1">
                Monitoring systems are operational.
              </p>
            </motion.div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-3 whitespace-nowrap">Alert ID</th>
                    <th className="py-3 px-3 whitespace-nowrap">Type</th>
                    <th className="py-3 px-3 whitespace-nowrap">Location / Sensor</th>
                    <th className="py-3 px-3 whitespace-nowrap">Timestamp</th>
                    <th className="py-3 px-3 whitespace-nowrap">Telemetry</th>
                    <th className="py-3 px-3 whitespace-nowrap">Confidence %</th>
                    <th className="py-3 px-3 whitespace-nowrap">Status / Priority</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredAlerts.map((alert) => {
                    const pm25Danger = alert.pm25 > PM25_SAFE;
                    const vocDanger = alert.voc > VOC_SAFE;

                    return (
                      <tr
                        key={alert.id}
                        onClick={() => navigate(`/alerts/${alert.id}`)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* ALERT ID */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-[#071126] bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80">
                            #{alert.id.slice(0, 8).toUpperCase()}
                          </span>
                        </td>

                        {/* TYPE */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/70">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            {alert.type}
                          </span>
                        </td>

                        {/* LOCATION / SENSOR */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-[#0284C7] shrink-0" />
                              {alert.room}
                            </span>
                            <span className="text-xs text-slate-500 font-medium pl-4.5">
                              {alert.location} • <span className="font-mono">{alert.sensorId}</span>
                            </span>
                          </div>
                        </td>

                        {/* TIMESTAMP */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            {alert.timeDetected}
                          </span>
                        </td>

                        {/* TELEMETRY (PM2.5 & VOC) */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums border ${
                                pm25Danger
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              PM2.5: {alert.pm25} µg/m³
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums border ${
                                vocDanger
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              VOC: {alert.voc} ppb
                            </span>
                          </div>
                        </td>

                        {/* CONFIDENCE % */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  alert.confidence >= 90
                                    ? 'bg-rose-500'
                                    : alert.confidence >= 75
                                    ? 'bg-amber-500'
                                    : 'bg-sky-500'
                                }`}
                                style={{ width: `${Math.min(alert.confidence, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-extrabold tabular-nums text-slate-900">
                              {alert.confidence}%
                            </span>
                          </div>
                        </td>

                        {/* STATUS / PRIORITY */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                                STATUS_BADGE[alert.status]
                              }`}
                            >
                              {alert.status}
                            </span>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                PRIORITY_BADGE[alert.priority]
                              }`}
                            >
                              {alert.priority}
                            </span>
                          </div>
                        </td>

                        {/* ADAMSON BLUE PILL ACTION BUTTONS */}
                        <td
                          className="py-3.5 px-3 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-2">
                            {alert.status === 'new' && (
                              <button
                                type="button"
                                disabled={actionBusyId === `${alert.id}-acknowledge`}
                                onClick={(e) => handleQuickAction(e, alert.id, 'acknowledge')}
                                className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#071126] hover:bg-[#003882] text-white shadow-xs hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                              >
                                {actionBusyId === `${alert.id}-acknowledge` ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  'Acknowledge'
                                )}
                              </button>
                            )}

                            {(alert.status === 'new' || alert.status === 'acknowledged') && (
                              <button
                                type="button"
                                disabled={actionBusyId === `${alert.id}-respond`}
                                onClick={(e) => handleQuickAction(e, alert.id, 'respond')}
                                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#003882] hover:bg-[#0284C7] text-white shadow-xs hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                              >
                                {actionBusyId === `${alert.id}-respond` ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <span>Respond</span>
                                    <ArrowRight className="h-3 w-3" />
                                  </>
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={actionBusyId === `${alert.id}-resolve`}
                              onClick={(e) => handleQuickAction(e, alert.id, 'resolve')}
                              className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#071126] hover:bg-emerald-600 text-white shadow-xs hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                            >
                              {actionBusyId === `${alert.id}-resolve` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                'Resolve'
                              )}
                            </button>
                          </div>
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

      {/* Siren Audio & Incoming Alert Modal */}
      <audio
        id="siren-audio"
        src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"
        preload="auto"
      />
      <Dialog
        open={!!incomingAlert}
        onOpenChange={(o) => {
          if (!o) setIncomingAlert(null);
          const siren = document.getElementById('siren-audio');
          if (siren) (siren as HTMLAudioElement).pause();
        }}
      >
        <DialogContent className="sm:max-w-md border-red-500 border-2 bg-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2 text-2xl font-bold">
              <TriangleAlert className="h-8 w-8 animate-pulse" />
              NEW ALERT DETECTED
            </DialogTitle>
            <DialogDescription className="text-lg pt-4 text-slate-700">
              Vaping has been detected in{' '}
              <strong className="text-black font-bold">
                {incomingAlert?.location || incomingAlert?.floor || 'Unknown Room'}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 sm:justify-center">
            <Button
              className="w-full rounded-full bg-[#003882] hover:bg-[#071126] text-white text-lg h-14 font-bold"
              onClick={() => {
                const siren = document.getElementById('siren-audio');
                if (siren) (siren as HTMLAudioElement).pause();
                if (incomingAlert) navigate(`/alerts/${incomingAlert.id}`);
              }}
            >
              RESPOND NOW
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
