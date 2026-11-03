import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import {
  Download, MapPin, Clock, User, CircleCheck, X, BellRing, Activity, TriangleAlert, Search, ArrowRight, ChevronDown, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { alertsApi, usersApi, type Alert, type UserRecord, API_HOST } from '@/app/services/api';
import { useLiveStream } from '@/app/hooks/useLiveStream';
import { PageHeader } from '@/app/components/admin/PageHeader';
import { MetricCard } from '@/app/components/admin/MetricCard';
import { StatusBadge } from '@/app/components/admin/StatusBadge';
import { AsyncBoundary } from '@/app/components/admin/AsyncBoundary';
import { AnimatedCounter } from '@/app/components/ui/AnimatedCounter';
import { alertStatus } from '@/app/lib/status';
import { downloadCsv } from '@/app/lib/csv';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/app/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/app/components/ui/dialog';

/** A persisted note as stored by POST /api/alerts/:id/notes. */
interface AlertNote {
  id: string;
  text: string;
  author: string;
  timestamp: string;
}

/** Lifecycle action keys that map 1:1 to a real alertsApi endpoint. */
type LifecycleAction = 'acknowledge' | 'escalate' | 'resolve' | 'falseAlarm' | 'reopen';

const PENDING = '__pending__';

// Statuses whose state-changing endpoint still makes sense to offer.
const OPEN_STATUSES = new Set(['ACTIVE', 'REOPENED', 'ACKNOWLEDGED', 'RESPONDING', 'ESCALATED']);

function parseNotes(raw: unknown): AlertNote[] {
  if (!Array.isArray(raw)) return [];
  const validNotes = raw.filter((n): n is AlertNote => !!n && typeof n === 'object' && typeof (n as AlertNote).text === 'string');
  const unique = [];
  const seen = new Set();
  for (const note of validNotes) {
    if (!seen.has(note.text)) {
      unique.push(note);
      seen.add(note.text);
    }
  }
  return unique.map((n, i) => ({ id: String(i), text: (n as any).text, author: (n as any).author, timestamp: (n as any).timestamp }));
}

function formatTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    // detectedAt is stored as a pre-formatted time string (e.g. "09:14 AM"); show it as-is.
    return String(value);
  }
  return d.toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function locationLabel(a: Alert): string {
  return [a.floor, a.location].filter(Boolean).join(' — ') || a.location || '—';
}

function shortId(id: string): string {
  return `ALT-${String(id).slice(0, 6).toUpperCase()}`;
}

function AdminCreateAlertDialog({ open, onOpenChange, personnel, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personnel: UserRecord[];
  onCreated: (alert: Alert) => void;
}) {
  const [floor, setFloor] = useState('');
  const [location, setLocation] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [assignee, setAssignee] = useState<string>('unassigned');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!floor.trim() || !location.trim()) {
      toast.error('Floor and location are required');
      return;
    }
    setSubmitting(true);
    try {
      const alert = await alertsApi.createManual({ floor, location, severity, note });
      if (assignee !== 'unassigned') {
        const pName = personnel.find(p => p.id === assignee)?.name || assignee;
        await alertsApi.assign(alert.id, pName);
        alert.respondedBy = pName;
      }
      toast.success('Incident logged successfully');
      onCreated(alert);
      onOpenChange(false);
      setFloor(''); setLocation(''); setNote(''); setSeverity('medium'); setAssignee('unassigned');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create alert');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Manual Incident</DialogTitle>
          <DialogDescription>
            Report an incident identified via radio or patrol. No camera proof required.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="floor" className="text-right">Floor</Label>
            <Input maxLength={50} id="floor" value={floor} onChange={e => setFloor(e.target.value)} placeholder="e.g. 2nd Floor" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="location" className="text-right">Location</Label>
            <Input maxLength={50} id="location" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Boys Restroom" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="severity" className="text-right">Severity</Label>
            <Select value={severity} onValueChange={(v: any) => setSeverity(v)}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="assignee" className="text-right">Assign to</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select guard" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Leave Unassigned</SelectItem>
                {personnel.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="note" className="text-right mt-2">Notes</Label>
            <Textarea id="note" value={note} onChange={e => setNote(e.target.value)} placeholder="Initial incident details (optional)" className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Saving...' : 'Log Incident'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const AdminAlerts = () => {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const deepLinkId: string | undefined = routeLocation.state?.alertId;

  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [personnel, setPersonnel] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [alertData, userData] = await Promise.all([
        alertsApi.getAll(),
        usersApi.getAll().catch(() => [] as UserRecord[]),
      ]);
      setAlerts(alertData);
      // Personnel = anyone who works the floor (guard or supervisor), not admins.
      setPersonnel(userData.filter((u) => u.role !== 'admin'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  useLiveStream({ onAlert: () => { load().catch(() => {}); } });

  // Deep-link: open a specific alert once data is present.
  useEffect(() => {
    if (deepLinkId && alerts?.some((a) => String(a.id) === String(deepLinkId))) {
      setSelectedId(String(deepLinkId));
    }
  }, [deepLinkId, alerts]);

  const selected = useMemo(
    () => (alerts ?? []).find((a) => String(a.id) === String(selectedId)) ?? null,
    [alerts, selectedId],
  );

  const closeDetail = () => {
    setSelectedId(null);
    if (deepLinkId) navigate('/admin/alerts', { replace: true, state: {} });
  };

  const personnelNames = useMemo(
    () => Array.from(new Set(personnel.map((u) => u.name || u.username).filter(Boolean))).sort(),
    [personnel],
  );

  const locations = useMemo(
    () => Array.from(new Set((alerts ?? []).map((a) => a.location).filter(Boolean))).sort(),
    [alerts],
  );

  const stats = useMemo(() => {
    const list = alerts ?? [];
    return {
      total: list.length,
      active: list.filter((a) => a.status === 'ACTIVE' || a.status === 'REOPENED').length,
      responding: list.filter((a) => a.status === 'RESPONDING' || a.status === 'ACKNOWLEDGED').length,
      resolved: list.filter((a) => a.status === 'RESOLVED').length,
      falseAlarm: list.filter((a) => a.status === 'FALSE_ALARM').length,
    };
  }, [alerts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (alerts ?? []).filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (locationFilter !== 'all' && a.location !== locationFilter) return false;
      if (q) {
        const hay = `${shortId(a.id)} ${a.floor ?? ''} ${a.location ?? ''} ${a.respondedBy ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [alerts, statusFilter, locationFilter, search]);

  const runAction = useCallback(
    async (id: string, action: LifecycleAction, successMsg: string) => {
      try {
        await alertsApi[action](id);
        toast.success(successMsg);
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Action failed');
      }
    },
    [load],
  );

  const assignTo = useCallback(
    async (id: string, name: string) => {
      try {
        await alertsApi.assign(id, name);
        toast.success(`Assigned to ${name}`);
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Assignment failed');
      }
    },
    [load],
  );

  const exportCsv = () => {
    downloadCsv(
      'alerts.csv',
      filtered.map((a) => ({
        id: shortId(a.id),
        rawId: a.id,
        floor: a.floor ?? '',
        location: a.location ?? '',
        status: alertStatus(a.status).label,
        assignedTo: a.respondedBy ?? '',
        detectedAt: a.detectedAt ?? '',
        createdAt: a.createdAt ?? '',
        resolvedAt: a.resolvedAt ?? '',
      })),
    );
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full max-w-[1400px] mx-auto space-y-6">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.75, delay: 0, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
        >
          <div>
            <span className="text-[10px] font-bold tracking-widest text-[#0284C7] uppercase">SECURITY CENTER</span>
            <h1 className="text-3xl font-bold text-[#071126] tracking-tight mt-1">Alert Management</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              {alerts ? `${stats.total} total alerts recorded today` : 'Loading alerts...'}
            </p>
          </div>
          <button
            onClick={exportCsv}
            disabled={!filtered.length}
            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl px-4 py-2 flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </motion.div>

        <AsyncBoundary loading={loading && !alerts} error={error} onRetry={load}>
          {alerts ? (
            <div className="space-y-6">
              {/* Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.75, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-white rounded-2xl p-5 border border-slate-100/80 shadow-sm transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-600">Total Alerts</h3>
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                      <BellRing className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                  <div className="text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                    <AnimatedCounter value={stats.total} duration={1200} />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.75, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-white rounded-2xl p-5 border border-slate-100/80 shadow-sm transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-600">Active Threats</h3>
                    <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                      <TriangleAlert className="w-5 h-5 text-rose-500" />
                    </div>
                  </div>
                  <div className="text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                    <AnimatedCounter value={stats.active} duration={1200} />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.75, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-white rounded-2xl p-5 border border-slate-100/80 shadow-sm transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-600">Responding</h3>
                    <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-amber-500" />
                    </div>
                  </div>
                  <div className="text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                    <AnimatedCounter value={stats.responding} duration={1200} />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.75, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-white rounded-2xl p-5 border border-slate-100/80 shadow-sm transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-600">Resolved / False</h3>
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                      <CircleCheck className="w-5 h-5 text-emerald-500" />
                    </div>
                  </div>
                  <div className="text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                    <AnimatedCounter value={stats.resolved + stats.falseAlarm} duration={1200} />
                  </div>
                </motion.div>
              </div>

              {/* Toolbar */}
              <motion.div
                initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.75, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                  <button
                    onClick={() => setCreateOpen(true)}
                    className="bg-[#0B1B33] hover:bg-[#0e2242] text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-all duration-200 hover:shadow-md active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Log Manual Incident
                  </button>

                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search alerts..."
                        className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400 text-slate-700"
                      />
                    </div>
                    
                    <div className="flex w-full sm:w-auto gap-2">
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-36 bg-white border-slate-200 rounded-xl text-sm font-medium focus:ring-sky-500/20">
                          <SelectValue placeholder="Status: All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Status: All</SelectItem>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="REOPENED">Reopened</SelectItem>
                          <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                          <SelectItem value="RESPONDING">Responding</SelectItem>
                          <SelectItem value="ESCALATED">Escalated</SelectItem>
                          <SelectItem value="RESOLVED">Resolved</SelectItem>
                          <SelectItem value="FALSE_ALARM">False alarm</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={locationFilter} onValueChange={setLocationFilter}>
                        <SelectTrigger className="w-full sm:w-40 bg-white border-slate-200 rounded-xl text-sm font-medium focus:ring-sky-500/20">
                          <SelectValue placeholder="Location: All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Location: All</SelectItem>
                          {locations.map((l) => (
                            <SelectItem key={l} value={l}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 px-1 mt-1">
                  <span className="font-medium">Live Alerts • {filtered.length} requiring attention</span>
                  <span>Updated just now</span>
                </div>
              </motion.div>

              {/* Alert list */}
              <motion.div
                initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.75, delay: 0.34, ease: [0.16, 1, 0.3, 1] }}
              >
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/60 bg-slate-50/50 py-16 text-center">
                    <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                      <BellRing className="h-6 w-6 text-slate-400" />
                    </div>
                    <h3 className="text-slate-900 font-bold text-lg mb-1">
                      {alerts.length === 0 ? 'No alerts yet' : 'No matches found'}
                    </h3>
                    <p className="font-medium text-slate-500">
                      {alerts.length === 0 ? 'Your environment is fully secure.' : 'Try adjusting your search or filters.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filtered.map((a) => {
                      const detected = formatTimestamp(a.detectedAt);
                      const isActive = a.status === 'ACTIVE' || a.status === 'REOPENED';
                      const isResponding = a.status === 'RESPONDING' || a.status === 'ACKNOWLEDGED';
                      
                      let borderClass = 'border-transparent pl-4 sm:pl-5';
                      if (isActive) borderClass = 'border-l-4 border-l-rose-500 pl-4';
                      else if (isResponding) borderClass = 'border-l-4 border-l-amber-500 pl-4';

                      let statusPill = null;
                      if (isActive) {
                        statusPill = <span className="bg-rose-500 text-white text-[10px] sm:text-xs px-2.5 sm:px-3 py-1 rounded-full font-bold shadow-sm whitespace-nowrap">Active</span>;
                      } else if (isResponding) {
                        statusPill = <span className="bg-amber-500 text-white text-[10px] sm:text-xs px-2.5 sm:px-3 py-1 rounded-full font-bold shadow-sm whitespace-nowrap">Responding</span>;
                      } else if (a.status === 'ESCALATED') {
                        statusPill = <span className="bg-purple-500 text-white text-[10px] sm:text-xs px-2.5 sm:px-3 py-1 rounded-full font-bold shadow-sm whitespace-nowrap">Escalated</span>;
                      } else if (a.status === 'RESOLVED') {
                        statusPill = <span className="bg-emerald-100 text-emerald-700 text-[10px] sm:text-xs px-2.5 sm:px-3 py-1 rounded-full font-bold whitespace-nowrap">Resolved</span>;
                      } else if (a.status === 'FALSE_ALARM') {
                        statusPill = <span className="bg-slate-100 text-slate-600 text-[10px] sm:text-xs px-2.5 sm:px-3 py-1 rounded-full font-bold whitespace-nowrap">False Alarm</span>;
                      }

                      return (
                        <button
                          key={a.id}
                          onClick={() => setSelectedId(String(a.id))}
                          className={`w-full group bg-white rounded-2xl py-4 pr-4 sm:pr-5 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200 hover:shadow-md hover:border-slate-200/80 hover:-translate-y-0.5 text-left ${borderClass}`}
                        >
                          <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1 min-w-0">
                            {/* Column 1: ID & Threat Type */}
                            <div className="w-full md:w-48 lg:w-56 shrink-0">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{shortId(a.id)}</div>
                              <div className="font-bold text-slate-900 truncate">{a.type || 'Vape / Smoke Detected'}</div>
                            </div>

                            {/* Column 2: Location */}
                            <div className="flex items-start gap-2 w-full md:w-56 lg:w-72 shrink-0">
                              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                              <div className="text-sm font-medium text-slate-600 leading-snug line-clamp-2">
                                {locationLabel(a)}
                              </div>
                            </div>

                            {/* Column 3: Timestamp & Status Pill */}
                            <div className="flex flex-row md:flex-col lg:flex-row items-center md:items-start lg:items-center gap-2 lg:gap-3 shrink-0">
                              <div className="text-xs font-semibold text-slate-400 hidden sm:block w-28 truncate">{detected}</div>
                              {statusPill}
                            </div>

                            {/* Column 4: Assignee Avatar */}
                            <div className="hidden xl:flex items-center gap-2 w-48 shrink-0 ml-auto">
                              {a.respondedBy ? (
                                <>
                                  <div className="w-6 h-6 rounded-full bg-[#061121] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                    {a.respondedBy.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                                  </div>
                                  <span className="text-xs font-semibold text-slate-700 truncate">Assigned to {a.respondedBy}</span>
                                </>
                              ) : (
                                <span className="text-xs font-semibold text-slate-400 italic">Unassigned</span>
                              )}
                            </div>
                          </div>

                          {/* Column 5: Action */}
                          <div className="flex items-center justify-end w-full md:w-auto shrink-0 mt-2 md:mt-0">
                            <span className="text-xs sm:text-sm font-bold text-slate-700 group-hover:text-sky-600 flex items-center gap-1 transition-colors">
                              View Details <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-150" />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </div>
          ) : null}
        </AsyncBoundary>
      </div>

      {/* Alert detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) closeDetail(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selected ? (
            <AlertDetail
              alert={selected}
              personnelNames={personnelNames}
              onAction={runAction}
              onAssign={assignTo}
              onEdit={() => setEditOpen(true)}
              onViewLog={() => navigate('/admin/logs', { state: { search: selected.deviceId || selected.sensorId || selected.location } })}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit dialog — only persistable fields */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {selected ? (
            <EditAlertForm
              alert={selected}
              personnelNames={personnelNames}
              onClose={() => setEditOpen(false)}
              onSaved={load}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      
      <AdminCreateAlertDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        personnel={personnel}
        onCreated={() => load()}
      />
    </div>
  );
};

// ---------- Detail view ----------

interface AlertDetailProps {
  alert: Alert;
  personnelNames: string[];
  onAction: (id: string, action: LifecycleAction, msg: string) => void;
  onAssign: (id: string, name: string) => void;
  onEdit: () => void;
  onViewLog: () => void;
}

function Field({ label, value, muted }: { label: string; value: string | null; muted?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={muted || value == null ? 'text-sm text-muted-foreground italic' : 'text-sm font-medium text-foreground'}>
        {value ?? 'Not recorded'}
      </div>
    </div>
  );
}

function AlertDetail({ alert, personnelNames, onAction, onAssign, onEdit, onViewLog }: AlertDetailProps) {
  const notes = parseNotes(alert.notes);
  const isOpen = OPEN_STATUSES.has(alert.status);
  const isResolved = alert.status === 'RESOLVED' || alert.status === 'FALSE_ALARM';

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {shortId(alert.id)}
          <StatusBadge status={alertStatus(alert.status)} />
        </DialogTitle>
        <DialogDescription>{locationLabel(alert)}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Location" value={locationLabel(alert)} />
          <Field label="Sensor" value={alert.sensorId ?? null} />
          <Field label="Detected at" value={formatTimestamp(alert.detectedAt)} />
          <Field label="Created at" value={formatTimestamp(alert.createdAt)} />
          <Field label="Assigned to" value={alert.respondedBy ?? null} muted={!alert.respondedBy} />
          <Field label="Resolved at" value={formatTimestamp(alert.resolvedAt)} />
          {alert.pm25 != null ? <Field label="PM2.5" value={`${alert.pm25} µg/m³`} /> : null}
          {alert.voc != null ? <Field label="VOC" value={String(alert.voc)} /> : null}
        </div>

        {alert.photoUrl ? (
          <div>
            <div className="mb-1 text-xs uppercase text-muted-foreground">Evidence photo</div>
            <div className="flex justify-center overflow-hidden rounded-lg border border-border bg-surface-muted">
              <img src={alert.photoUrl.startsWith('http') ? alert.photoUrl : API_HOST + alert.photoUrl} alt="Alert evidence" className="max-h-[320px] w-auto object-contain" />
            </div>
          </div>
        ) : null}

        <div>
          <div className="mb-1.5 text-xs uppercase text-muted-foreground">Notes</div>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No notes recorded</p>
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg border border-border bg-surface-muted/50 p-2.5">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{n.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.author}{formatTimestamp(n.timestamp) ? ` · ${formatTimestamp(n.timestamp)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <DialogFooter className="flex-wrap gap-2 sm:justify-start">
        <Button variant="outline" size="sm" onClick={onEdit}>Edit</Button>

        {isOpen ? (
          <>
            {alert.status === 'ACTIVE' ? (
              <Button
                size="sm"
                className="bg-brand-blue text-white hover:bg-brand-blue-strong"
                onClick={() => onAction(alert.id, 'acknowledge', 'Alert acknowledged — now responding')}
              >
                Acknowledge
              </Button>
            ) : null}
            <Button
              size="sm"
              className="bg-success text-white hover:bg-success/90"
              onClick={() => onAction(alert.id, 'resolve', 'Alert resolved')}
            >
              Resolve
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction(alert.id, 'falseAlarm', 'Marked as false alarm')}
            >
              False alarm
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction(alert.id, 'escalate', 'Escalation logged (status unchanged)')}
            >
              Escalate
            </Button>
            {personnelNames.length ? (
              <Select onValueChange={(name) => onAssign(alert.id, name)}>
                <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Assign personnel" /></SelectTrigger>
                <SelectContent>
                  {personnelNames.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </>
        ) : null}

        {isResolved ? (
          <>
            <Button variant="outline" size="sm" onClick={onViewLog}>View log</Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction(alert.id, 'reopen', 'Alert reopened')}
            >
              Reopen
            </Button>
          </>
        ) : null}
      </DialogFooter>
    </>
  );
}

// ---------- Edit form (persistable fields only) ----------

interface EditAlertFormProps {
  alert: Alert;
  personnelNames: string[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

const STATUS_TRANSITIONS: Array<{ value: string; label: string; action: LifecycleAction }> = [
  { value: 'RESPONDING', label: 'Acknowledged / responding', action: 'acknowledge' },
  { value: 'RESOLVED', label: 'Resolved', action: 'resolve' },
  { value: 'FALSE_ALARM', label: 'False alarm', action: 'falseAlarm' },
  { value: 'ACTIVE', label: 'Active (reopen)', action: 'reopen' },
];

function EditAlertForm({ alert, personnelNames, onClose, onSaved }: EditAlertFormProps) {
  const initialAssignee = alert.respondedBy ?? PENDING;
  const [assignee, setAssignee] = useState(initialAssignee);
  const [statusValue, setStatusValue] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const assigneeOptions = useMemo(
    () => Array.from(new Set([...(alert.respondedBy ? [alert.respondedBy] : []), ...personnelNames])).sort(),
    [alert.respondedBy, personnelNames],
  );

  const save = async () => {
    setSaving(true);
    let changed = false;
    try {
      // 1) Re-assignment (PUT /assign)
      if (assignee !== initialAssignee && assignee !== PENDING) {
        await alertsApi.assign(alert.id, assignee);
        changed = true;
      }
      // 2) Note (POST /notes) — this is where any reason/action text is persisted.
      if (note.trim()) {
        await alertsApi.addNote(alert.id, note.trim());
        changed = true;
      }
      // 3) Status transition via the real lifecycle endpoint.
      const transition = STATUS_TRANSITIONS.find((t) => t.value === statusValue);
      if (transition && transition.value !== alert.status) {
        await alertsApi[transition.action](alert.id);
        changed = true;
      }

      if (!changed) {
        toast('No changes to save');
      } else {
        toast.success('Alert updated');
      }
      await onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update alert');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit {shortId(alert.id)}</DialogTitle>
        <DialogDescription>
          Only changes the system can persist: assignment, status transition, and a note.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="edit-assignee">Assigned personnel</Label>
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger id="edit-assignee">
              <SelectValue placeholder="Select personnel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PENDING}>Unassigned</SelectItem>
              {assigneeOptions.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {personnelNames.length === 0 ? (
            <p className="text-xs text-muted-foreground">No security personnel found to assign.</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-status">Status transition</Label>
          <Select value={statusValue} onValueChange={setStatusValue}>
            <SelectTrigger id="edit-status">
              <SelectValue placeholder={`Keep ${alertStatus(alert.status).label}`} />
            </SelectTrigger>
            <SelectContent>
              {STATUS_TRANSITIONS.filter((t) => t.value !== alert.status).map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-note">Add note</Label>
          <Textarea
            id="edit-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Record the reason, action taken, or any follow-up…"
            rows={4}
          />
          <p className="text-xs text-muted-foreground">Saved to the alert&rsquo;s note history with your name and timestamp.</p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          onClick={save}
          disabled={saving}
          className="bg-brand-blue text-white hover:bg-brand-blue-strong"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogFooter>
    </>
  );
}





