import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Download, Trash2, FileText, ListChecks, TriangleAlert, Clock } from 'lucide-react';
import { logsApi, type LogEntry } from '@/app/services/api';
import { useAuth } from '@/app/context/AuthContext';
import { PageHeader } from '@/app/components/admin/PageHeader';
import { MetricCard } from '@/app/components/admin/MetricCard';
import { StatusBadge } from '@/app/components/admin/StatusBadge';
import { AsyncBoundary } from '@/app/components/admin/AsyncBoundary';
import { severityStatus, logStatus } from '@/app/lib/status';
import { downloadCsv } from '@/app/lib/csv';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/app/components/ui/dialog';

// Real /api/logs `type` values (see backend seed + store). No invented 'network' category.
const TYPE_LABEL: Record<string, string> = {
  detection: 'Detection',
  device: 'Device',
  system: 'System',
  audit: 'Audit',
};

function typeLabel(type: string): string {
  return TYPE_LABEL[type] ?? (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Other');
}

// Parse a log timestamp into epoch ms, or null when it is missing / unparseable.
function parseTs(timestamp: string | null | undefined): number | null {
  if (!timestamp) return null;
  const ms = new Date(timestamp).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function formatTs(timestamp: string | null | undefined): string {
  const ms = parseTs(timestamp);
  if (ms == null) return '—';
  return new Date(ms).toLocaleString([], {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function isToday(ms: number): boolean {
  const now = new Date();
  const d = new Date(ms);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

interface ClearLogsDialogProps {
  count: number;
  onCleared: () => void;
}

function ClearLogsDialog({ count, onCleared }: ClearLogsDialogProps) {
  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (o) setError(null);
  };

  const clear = async () => {
    setClearing(true);
    setError(null);
    try {
      await logsApi.clear();
      onCleared();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear logs');
    } finally {
      setClearing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button variant="outline" size="sm" onClick={() => onOpenChange(true)} disabled={count === 0}>
        <Trash2 className="mr-1.5 h-4 w-4" /> Clear all logs
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear all logs</DialogTitle>
          <DialogDescription>
            This permanently deletes all {count} log {count === 1 ? 'entry' : 'entries'} from the server. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={clear} disabled={clearing}>
            {clearing ? 'Clearing…' : 'Clear all logs'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface LogDetailDialogProps {
  log: LogEntry | null;
  onClose: () => void;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  );
}

function LogDetailDialog({ log, onClose }: LogDetailDialogProps) {
  const hasMetadata = log && log.metadata && Object.keys(log.metadata).length > 0;
  return (
    <Dialog open={log != null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        {log ? (
          <>
            <DialogHeader>
              <DialogTitle>{log.title || 'Log entry'}</DialogTitle>
              <DialogDescription>{log.description || 'No description recorded.'}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-1">
              <DetailRow label="Log ID" value={<span className="font-mono text-xs">{log.id}</span>} />
              <DetailRow label="Category" value={typeLabel(log.type)} />
              <DetailRow label="Severity" value={<StatusBadge status={severityStatus(log.severity)} />} />
              <DetailRow label="Status" value={<StatusBadge status={logStatus(log.status)} />} />
              <DetailRow label="Date and time" value={formatTs(log.timestamp)} />
              <DetailRow label="Performed by" value={log.user || '—'} />
              <DetailRow label="Device" value={log.deviceId || '—'} />
              <DetailRow label="Location" value={log.location || '—'} />
            </div>
            {hasMetadata ? (
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Metadata</div>
                <pre className="max-h-48 overflow-auto rounded-md bg-surface-muted p-3 text-xs text-foreground">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            ) : null}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export const AdminLogs = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const locationState = useLocation();

  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Server-side filter dimensions: type, severity, search.
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [search, setSearch] = useState('');
  // Client-side dimensions (no server support): status + date range.
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const [selected, setSelected] = useState<LogEntry | null>(null);

  // Pagination — ~10 rows per page (panel request).
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      setError(null);
      const params: { type?: string; severity?: string; search?: string } = {};
      if (typeFilter !== 'all') params.type = typeFilter;
      if (severityFilter !== 'all') params.severity = severityFilter;
      const res = await logsApi.getAll({ ...params, limit: 1000 });
      setLogs(res.logs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, severityFilter, search]);

  // Debounce search; reload on filter changes; poll live data every 30s.
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  // Deep-link from another page may carry a search term (e.g. a device id).
  useEffect(() => {
    const incoming = locationState.state?.search;
    if (typeof incoming === 'string' && incoming) setSearch(incoming);
  }, [locationState.state?.search]);

  // Status values that actually appear (status is not a server-side filter).
  const statusOptions = useMemo(
    () => Array.from(new Set((logs ?? []).map((l) => l.status).filter(Boolean))).sort(),
    [logs],
  );

  // Client-side status + date refinement on top of the server-filtered feed.
  const visibleLogs = useMemo(() => {
    return (logs ?? []).filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (dateFilter !== 'all') {
        const ms = parseTs(l.timestamp);
        if (ms == null) return false;
        if (dateFilter === 'today' && !isToday(ms)) return false;
        const span = dateFilter === 'week' ? 7 : dateFilter === 'month' ? 30 : 0;
        if (span && Date.now() - ms > span * 24 * 60 * 60 * 1000) return false;
      }
      return true;
    });
  }, [logs, statusFilter, dateFilter]);

  // Reset to the first page whenever the filtered result set changes.
  useEffect(() => {
    setPage(1);
  }, [typeFilter, severityFilter, statusFilter, dateFilter, search]);

  // Page slice (clamped so polling/filtering can't strand us past the last page).
  const totalPages = Math.max(1, Math.ceil(visibleLogs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedLogs = visibleLogs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = visibleLogs.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, visibleLogs.length);

  // Stats computed from the loaded feed — every number is real or omitted.
  const stats = useMemo(() => {
    const list = logs ?? [];
    const todayCount = list.filter((l) => {
      const ms = parseTs(l.timestamp);
      return ms != null && isToday(ms);
    }).length;
    const critical = list.filter((l) => String(l.severity).toLowerCase() === 'critical').length;
    let latestMs: number | null = null;
    for (const l of list) {
      const ms = parseTs(l.timestamp);
      if (ms != null && (latestMs == null || ms > latestMs)) latestMs = ms;
    }
    return { total: list.length, todayCount, critical, latestMs };
  }, [logs]);

  // Category cards built only from the types present in the data.
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of logs ?? []) counts.set(l.type, (counts.get(l.type) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [logs]);

  const exportCsv = () => {
    downloadCsv(
      'logs.csv',
      visibleLogs.map((l) => ({
        id: l.id,
        timestamp: l.timestamp,
        category: l.type,
        title: l.title,
        description: l.description,
        severity: l.severity,
        status: l.status,
        device: l.deviceId ?? '',
        location: l.location ?? '',
        user: l.user ?? '',
      })),
    );
  };

  const headerActions = (
    <>
      <Button variant="outline" size="sm" onClick={exportCsv} disabled={!visibleLogs.length}>
        <Download className="mr-1.5 h-4 w-4" /> Export
      </Button>
      {isAdmin ? <ClearLogsDialog count={logs?.length ?? 0} onCleared={load} /> : null}
    </>
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="admin-page-container w-full max-w-7xl mx-auto space-y-4 md:space-y-6">
        <PageHeader
          title="Logs"
          subtitle={logs ? `${logs.length} log ${logs.length === 1 ? 'entry' : 'entries'}` : undefined}
          actions={headerActions}
        />

        <AsyncBoundary loading={loading && !logs} error={error} onRetry={load}>
          {logs ? (
            <div className="space-y-4 md:space-y-6">
              {/* Stat cards — all values derived from the loaded feed */}
              <motion.div
                initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.75, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="grid grid-cols-2 lg:grid-cols-4 gap-3"
              >
                <MetricCard label="Total logs" value={stats.total} icon={<ListChecks className="h-4 w-4" />} />
                <MetricCard label="Logs today" value={stats.todayCount} icon={<FileText className="h-4 w-4" />} />
                <MetricCard
                  label="Critical"
                  value={stats.critical}
                  tone={stats.critical ? 'danger' : 'neutral'}
                  icon={<TriangleAlert className="h-4 w-4" />}
                />
                <MetricCard
                  label="Latest log"
                  value={stats.latestMs != null ? formatTs(new Date(stats.latestMs).toISOString()) : '—'}
                  sub={stats.latestMs == null ? 'No timestamps' : undefined}
                  icon={<Clock className="h-4 w-4" />}
                />
              </motion.div>

              {/* Category breakdown + Filter bar */}
              <motion.div
                initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.75, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-3"
              >
                {categoryCounts.length ? (
                  <div className="flex flex-wrap gap-2">
                    {categoryCounts.map(([type, count]) => (
                      <button
                        key={type}
                        onClick={() => setTypeFilter((prev) => (prev === type ? 'all' : type))}
                        className={
                          'rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                          (typeFilter === type
                            ? 'border-brand-blue bg-brand-blue text-white'
                            : 'border-border bg-card text-muted-foreground hover:bg-surface-muted')
                        }
                      >
                        {typeLabel(type)} · {count}
                      </button>
                    ))}
                  </div>
                ) : null}

                {/* Filter bar */}
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search title, description, or location"
                    className="w-full sm:max-w-xs"
                  />
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categoryCounts.map(([type]) => (
                        <SelectItem key={type} value={type}>{typeLabel(type)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Severity" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All severities</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {statusOptions.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Date range" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">Last 7 days</SelectItem>
                      <SelectItem value="month">Last 30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>

              {/* Log table + Pagination */}
              <motion.div
                initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.75, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-4"
              >
                <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                        <th className="py-2.5 px-4 font-medium">Date and time</th>
                        <th className="py-2.5 px-3 font-medium">Category</th>
                        <th className="py-2.5 px-3 font-medium">Activity</th>
                        <th className="py-2.5 px-3 font-medium">Location</th>
                        <th className="py-2.5 px-3 font-medium">Performed by</th>
                        <th className="py-2.5 px-3 font-medium">Severity</th>
                        <th className="py-2.5 px-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleLogs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-muted-foreground">
                            {logs.length === 0 ? 'No logs recorded yet.' : 'No logs match your filters.'}
                          </td>
                        </tr>
                      ) : (
                        pagedLogs.map((l) => (
                          <tr
                            key={l.id}
                            onClick={() => setSelected(l)}
                            className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-muted/60"
                          >
                            <td className="py-2.5 px-4 whitespace-nowrap text-muted-foreground">{formatTs(l.timestamp)}</td>
                            <td className="py-2.5 px-3 text-foreground">{typeLabel(l.type)}</td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-foreground">{l.title || '—'}</div>
                              {l.description ? <div className="text-xs text-muted-foreground">{l.description}</div> : null}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">{l.location || '—'}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">{l.user || '—'}</td>
                            <td className="py-2.5 px-3"><StatusBadge status={severityStatus(l.severity)} /></td>
                            <td className="py-2.5 px-3"><StatusBadge status={logStatus(l.status)} /></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination — 10 entries per page */}
                {visibleLogs.length > 0 ? (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Showing <span className="font-medium text-foreground">{rangeStart}–{rangeEnd}</span> of{' '}
                      <span className="font-medium text-foreground">{visibleLogs.length}</span>
                    </p>
                    {totalPages > 1 ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={safePage <= 1}
                        >
                          Previous
                        </Button>
                        <span className="text-xs text-muted-foreground px-1">
                          Page {safePage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={safePage >= totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </motion.div>
            </div>
          ) : null}
        </AsyncBoundary>

        <LogDetailDialog log={selected} onClose={() => setSelected(null)} />
      </div>
    </div>
  );
};


