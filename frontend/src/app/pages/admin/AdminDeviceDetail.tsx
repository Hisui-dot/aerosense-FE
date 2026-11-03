import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import {
  ChevronLeft, MapPin, Clock, Activity, Battery, Signal, Wind, Power, RefreshCw,
  KeyRound, Settings, Eye, EyeOff, Copy, FileText, ScrollText, Trash2,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import {
  devicesApi, readingsApi, type Device, type Reading,
} from '@/app/services/api';
import { PageHeader } from '@/app/components/admin/PageHeader';
import { MetricCard } from '@/app/components/admin/MetricCard';
import { StatusBadge } from '@/app/components/admin/StatusBadge';
import { AsyncBoundary } from '@/app/components/admin/AsyncBoundary';
import { ChartCard } from '@/app/components/admin/ChartCard';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  DialogTrigger, DialogClose,
} from '@/app/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/app/components/ui/alert-dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/app/components/ui/select';
import { deviceStatus, severityStatus } from '@/app/lib/status';
import {
  classifyReading, effectivePm25Threshold, effectiveVocThreshold,
} from '@/app/lib/thresholds';
import { chart } from '@/app/theme/tokens';

const POLL_MS = 3000;

// A device event is one of the 10 most-recent logs the backend attaches to getById.
interface DeviceLogEvent {
  id: string;
  title: string;
  description?: string | null;
  timestamp: string;
  severity?: string | null;
}

function readingTone(level: ReturnType<typeof classifyReading>): 'success' | 'warning' | 'danger' {
  return level === 'critical' ? 'danger' : level === 'warning' ? 'warning' : 'success';
}

function readingLabel(level: ReturnType<typeof classifyReading>): string {
  return level === 'critical' ? 'Over threshold' : level === 'warning' ? 'Near threshold' : 'Normal';
}

function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

interface ModifyForm {
  name: string;
  location: string;
  floor: string;
  status: string;
  firmware: string;
  issue: string;
  powerStatus: string;
  networkSignal: string;
  battery: string;
  pm25Threshold: string;
  vocThreshold: string;
}

function toForm(d: Device): ModifyForm {
  return {
    name: d.name ?? '',
    location: d.location ?? '',
    floor: d.floor ?? '',
    status: d.status ?? 'offline',
    firmware: d.firmware ?? '',
    issue: d.issue ?? '',
    powerStatus: d.powerStatus ?? '',
    networkSignal: d.networkSignal ?? '',
    battery: d.battery != null ? String(d.battery) : '',
    pm25Threshold: d.pm25Threshold != null ? String(d.pm25Threshold) : '',
    vocThreshold: d.vocThreshold != null ? String(d.vocThreshold) : '',
  };
}

export const AdminDeviceDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [device, setDevice] = useState<Device | null>(null);
  const [events, setEvents] = useState<DeviceLogEvent[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guards so the 10s poll never clobbers an in-flight edit or running action.
  const [modifyOpen, setModifyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const pausePoll = useRef(false);
  pausePoll.current = modifyOpen || busy;

  const [form, setForm] = useState<ModifyForm | null>(null);

  // API key (only ever fully visible right after a rotate).
  const [keyReveal, setKeyReveal] = useState(false);
  const [rotating, setRotating] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!id) return;
    if (pausePoll.current && opts?.silent) return; // don't refetch over an open edit
    try {
      if (!opts?.silent) setError(null);
      const [dev, reads] = await Promise.all([
        devicesApi.getById(id),
        readingsApi.forDevice(id, 100),
      ]);
      const { events: evts, ...rest } = dev as Device & { events?: DeviceLogEvent[] };
      setDevice(rest);
      setEvents(Array.isArray(evts) ? evts : []);
      setReadings([...reads].reverse()); // oldest -> newest for the time series
    } catch (e) {
      if (!opts?.silent) setError(e instanceof Error ? e.message : 'Failed to load device');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(() => load({ silent: true }), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const pm25Threshold = device ? effectivePm25Threshold(device) : 0;
  const vocThreshold = device ? effectiveVocThreshold(device) : 0;

  const pm25Level = device && device.status !== 'offline'
    ? classifyReading(device.pm25, pm25Threshold) : 'normal';
  const vocLevel = device && device.status !== 'offline'
    ? classifyReading(device.voc, vocThreshold) : 'normal';

  const chartData = useMemo(
    () => readings.map((r) => ({
      t: new Date(r.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      pm25: r.pm25,
      voc: r.voc,
    })),
    [readings],
  );

  // --- real action handlers: await, then toast on the actual result/throw ---

  const runAction = async (
    fn: () => Promise<unknown>,
    okMsg: string,
    failMsg: string,
    after?: () => void,
  ) => {
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      after?.();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : failMsg);
    } finally {
      setBusy(false);
    }
  };

  const handleRestart = () =>
    runAction(() => devicesApi.restart(id!), 'Restart command sent', 'Failed to restart device');

  const handleToggleStatus = () => {
    if (!device) return;
    if (device.status === 'offline') {
      runAction(
        () => devicesApi.update(id!, { status: 'online', issue: null }),
        'Device enabled', 'Failed to enable device',
      );
    } else {
      runAction(() => devicesApi.disable(id!), 'Device disabled', 'Failed to disable device');
    }
  };

  const handleRecalibrate = () =>
    runAction(() => devicesApi.recalibrate(id!), 'Recalibration started', 'Failed to recalibrate sensor');

  const openModify = () => {
    if (!device) return;
    setForm(toForm(device));
    setModifyOpen(true);
  };

  const numericOrError = (raw: string, label: string): number | null | string => {
    const t = raw.trim();
    if (t === '') return null;
    const n = Number(t);
    if (!Number.isFinite(n)) return `${label} must be a number`;
    return n;
  };

  const handleSaveModify = async () => {
    if (!id || !form) return;
    if (!form.name.trim()) { toast.error('Device name is required'); return; }

    const battery = numericOrError(form.battery, 'Battery');
    const pm25Threshold = numericOrError(form.pm25Threshold, 'PM2.5 threshold');
    const vocThreshold = numericOrError(form.vocThreshold, 'VOC threshold');
    for (const v of [battery, pm25Threshold, vocThreshold]) {
      if (typeof v === 'string') { toast.error(v); return; }
    }
    if ((pm25Threshold as number | null) != null && (pm25Threshold as number) <= 0) {
      toast.error('PM2.5 threshold must be positive'); return;
    }
    if ((vocThreshold as number | null) != null && (vocThreshold as number) <= 0) {
      toast.error('VOC threshold must be positive'); return;
    }

    // Only fields the backend PUT whitelists.
    const patch: Partial<Device> = {
      name: form.name.trim(),
      location: form.location.trim() || null as unknown as string,
      floor: form.floor.trim(),
      status: form.status as Device['status'],
      firmware: form.firmware.trim(),
      issue: form.issue.trim() ? form.issue.trim() : null,
      powerStatus: form.powerStatus.trim(),
      networkSignal: form.networkSignal.trim(),
      battery: battery as number | null ?? undefined,
      pm25Threshold: pm25Threshold as number | null,
      vocThreshold: vocThreshold as number | null,
    };

    setBusy(true);
    try {
      await devicesApi.update(id, patch);
      toast.success('Device updated');
      setModifyOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update device');
    } finally {
      setBusy(false);
    }
  };

  const handleRotateKey = async () => {
    if (!id) return;
    setRotating(true);
    try {
      const result = await devicesApi.rotateKey(id);
      setDevice((prev) => (prev ? { ...prev, apiKey: result.apiKey } : prev));
      setKeyReveal(true); // show once, just after rotation
      toast.success('API key rotated — reflash the device with the new key');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to rotate API key');
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="admin-page-container w-full max-w-7xl mx-auto space-y-4 md:space-y-6">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground -ml-2"
          onClick={() => navigate('/admin/devices')}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to devices
        </Button>

        <PageHeader
          title={device ? (device.name || device.id) : 'Device'}
          subtitle={device ? device.id : undefined}
          actions={device ? <StatusBadge status={deviceStatus(device.status)} /> : undefined}
        />

        <AsyncBoundary loading={loading && !device} error={error} onRetry={() => load()}>
          {device ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              {/* Main column */}
              <motion.div
                initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.75, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="lg:col-span-2 space-y-4 md:space-y-6"
              >
                {/* Identity / placement */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard
                    label="Location"
                    value={device.location || '—'}
                    sub={device.floor || undefined}
                    icon={<MapPin className="h-4 w-4" />}
                  />
                  <MetricCard
                    label="last active"
                    value={device.lastSeen || '—'}
                    icon={<Clock className="h-4 w-4" />}
                  />
                  <MetricCard
                    label="Power"
                    value={device.powerStatus || '—'}
                    icon={<Battery className="h-4 w-4" />}
                  />
                  <MetricCard
                    label="Firmware"
                    value={device.firmware || '—'}
                    icon={<FileText className="h-4 w-4" />}
                  />
                </div>

                {device.issue ? (
                  <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
                    Reported issue: {device.issue}
                  </div>
                ) : null}

                {/* Live readings */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard
                    label="PM2.5"
                    value={device.status === 'offline'
                      ? '—'
                      : <>{device.pm25}<span className="text-sm text-muted-foreground"> µg/m³</span></>}
                    tone={device.status === 'offline' ? 'neutral' : readingTone(pm25Level)}
                    sub={device.status === 'offline'
                      ? 'Device offline'
                      : `${readingLabel(pm25Level)} · threshold ${pm25Threshold}`}
                    icon={<Wind className="h-4 w-4" />}
                  />
                  <MetricCard
                    label="VOC"
                    value={device.status === 'offline' ? '—' : device.voc}
                    tone={device.status === 'offline' ? 'neutral' : readingTone(vocLevel)}
                    sub={device.status === 'offline'
                      ? 'Device offline'
                      : `${readingLabel(vocLevel)} · threshold ${vocThreshold}`}
                    icon={<Activity className="h-4 w-4" />}
                  />
                  <MetricCard
                    label="Temperature"
                    value={device.temperature != null
                      ? <>{device.temperature}<span className="text-sm text-muted-foreground"> °C</span></>
                      : '—'}
                    sub={device.temperature == null ? 'Not reported' : undefined}
                  />
                  <MetricCard
                    label="Humidity"
                    value={device.humidity != null
                      ? <>{device.humidity}<span className="text-sm text-muted-foreground"> %</span></>
                      : '—'}
                    sub={device.humidity == null ? 'Not reported' : undefined}
                  />
                </div>

                {/* Time series */}
                <ChartCard title="Sensor readings — last 100">
                  {chartData.length ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={chartData} margin={{ top: 5, right: 12, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                        <XAxis dataKey="t" minTickGap={28} tick={{ fontSize: 11 }} stroke={chart.grid} />
                        <YAxis tick={{ fontSize: 11 }} stroke={chart.grid} width={34} />
                        <Tooltip />
                        <ReferenceLine y={pm25Threshold} stroke={chart.threshold} strokeDasharray="5 4" />
                        <Line type="monotone" dataKey="pm25" name="PM2.5 (µg/m³)" stroke={chart.pm25} dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="voc" name="VOC" stroke={chart.voc} dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                      No readings recorded for this device yet
                    </div>
                  )}
                </ChartCard>

                {/* Device activity (real recent logs) */}
                <ChartCard
                  title="Recent activity"
                  actions={
                    <button
                      onClick={() => navigate('/admin/logs')}
                      className="text-xs font-medium text-brand-blue hover:underline"
                    >
                      View logs
                    </button>
                  }
                >
                  {events.length ? (
                    <div className="divide-y divide-border">
                      {events.map((ev) => (
                        <div key={ev.id} className="flex items-start justify-between gap-3 py-2.5">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <ScrollText className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">{ev.title}</div>
                              {ev.description ? (
                                <div className="text-xs text-muted-foreground">{ev.description}</div>
                              ) : null}
                              <div className="mt-0.5 text-xs text-muted-foreground">{fmtTime(ev.timestamp)}</div>
                            </div>
                          </div>
                          {ev.severity ? <StatusBadge status={severityStatus(ev.severity)} /> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
                      No activity logged for this device yet
                    </div>
                  )}
                </ChartCard>
              </motion.div>

              {/* Sidebar */}
              <motion.div
                initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.75, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-4 md:space-y-6"
              >
                {/* Health */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-3 text-sm font-medium text-foreground">Device health</h3>
                  <div className="space-y-3 text-sm">
                    <HealthBar
                      icon={<Signal className="h-4 w-4" />}
                      label="Signal strength"
                      value={device.signalStrength}
                      tone={device.signalStrength < 50 ? 'warning' : 'success'}
                    />
                    <HealthBar
                      icon={<Battery className="h-4 w-4" />}
                      label="Battery"
                      value={device.battery}
                      tone={device.battery < 20 ? 'danger' : 'success'}
                    />
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <FileText className="h-4 w-4" /> Firmware
                      </span>
                      <span className="font-medium text-foreground">{device.firmware || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Activity className="h-4 w-4" /> Response time
                      </span>
                      <span className="font-medium text-foreground">{device.responseTime || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Signal className="h-4 w-4" /> Network
                      </span>
                      <span className="font-medium text-foreground">{device.networkSignal || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* API key */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
                    <KeyRound className="h-4 w-4" /> Device API key
                  </h3>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Authenticates the physical device. Rotating invalidates the old key — reflash the device.
                  </p>
                  <div className="mb-3 select-all break-all rounded-lg bg-surface-muted p-3 font-mono text-sm text-foreground">
                    {device.apiKey
                      ? (keyReveal ? device.apiKey : `ak_••••••••${device.apiKey.slice(-4)}`)
                      : '—'}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline" size="sm" className="flex-1"
                        disabled={!device.apiKey}
                        onClick={() => setKeyReveal((r) => !r)}
                      >
                        {keyReveal ? <EyeOff className="mr-1.5 h-4 w-4" /> : <Eye className="mr-1.5 h-4 w-4" />}
                        {keyReveal ? 'Hide' : 'Reveal'}
                      </Button>
                      <Button
                        variant="outline" size="sm" className="flex-1"
                        disabled={!device.apiKey}
                        onClick={() => {
                          navigator.clipboard.writeText(device.apiKey || '')
                            .then(() => toast.success('API key copied'))
                            .catch(() => toast.error('Copy failed — please copy manually'));
                        }}
                      >
                        <Copy className="mr-1.5 h-4 w-4" /> Copy
                      </Button>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="w-full text-warning" disabled={rotating}>
                          <RefreshCw className="mr-1.5 h-4 w-4" />
                          {rotating ? 'Rotating…' : 'Rotate key'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Rotate API key?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This immediately invalidates the current key. The device will stop reporting until
                            it is reflashed with the new key. The new key is shown once.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={rotating}>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleRotateKey} disabled={rotating}>
                            {rotating ? 'Rotating…' : 'Rotate key'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Controls */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                    <Settings className="h-4 w-4" /> Controls
                  </h3>
                  <div className="space-y-2">
                    <ConfirmButton
                      label="Restart device"
                      icon={<RefreshCw className="mr-2 h-4 w-4" />}
                      title="Restart device?"
                      description={`Send a restart command to ${device.name || device.id}. It will be unreachable briefly.`}
                      confirmLabel="Restart"
                      disabled={busy}
                      onConfirm={handleRestart}
                    />
                    <ConfirmButton
                      label={device.status === 'offline' ? 'Enable device' : 'Disable device'}
                      icon={<Power className="mr-2 h-4 w-4" />}
                      title={device.status === 'offline' ? 'Enable device?' : 'Disable device?'}
                      description={device.status === 'offline'
                        ? `Bring ${device.name || device.id} back online and resume monitoring.`
                        : `Stop ${device.name || device.id} from monitoring and sending alerts.`}
                      confirmLabel={device.status === 'offline' ? 'Enable' : 'Disable'}
                      destructive={device.status !== 'offline'}
                      disabled={busy}
                      onConfirm={handleToggleStatus}
                    />
                    <ConfirmButton
                      label="Recalibrate sensor"
                      icon={<Activity className="mr-2 h-4 w-4" />}
                      title="Recalibrate sensor?"
                      description={`Start sensor recalibration on ${device.name || device.id}. Readings may be unreliable until it completes.`}
                      confirmLabel="Recalibrate"
                      disabled={busy}
                      onConfirm={handleRecalibrate}
                    />
                    <Button
                      variant="outline" className="w-full justify-start"
                      disabled={busy}
                      onClick={openModify}
                    >
                      <Settings className="mr-2 h-4 w-4" /> Modify device
                    </Button>
                    <ConfirmButton
                      label="Delete device"
                      icon={<Trash2 className="mr-2 h-4 w-4" />}
                      title="Delete device?"
                      description={`Permanently delete ${device.name || device.id} from the database. This cannot be undone.`}
                      confirmLabel="Delete"
                      destructive={true}
                      disabled={busy}
                      onConfirm={async () => {
                        try {
                          setBusy(true);
                          await devicesApi.delete(device.id);
                          toast.success('Device deleted');
                          navigate('/admin/devices');
                        } catch (e) {
                          toast.error('Failed to delete device');
                          setBusy(false);
                        }
                      }}
                    />
                    <p className="pt-1 text-xs text-muted-foreground">
                      Over-the-air firmware updates are not available. Set the firmware version manually via Modify
                      after reflashing the device.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          ) : null}
        </AsyncBoundary>

        {/* Modify dialog (persists only PUT-whitelisted fields) */}
        {device && form ? (
          <Dialog open={modifyOpen} onOpenChange={setModifyOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Modify device</DialogTitle>
                <DialogDescription>
                  {device.id} — changes are saved to the backend. Only persistable fields are shown.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-4 py-1 sm:grid-cols-2">
                <Field label="Name">
                  <Input maxLength={50} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field label="Status">
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Floor">
                  <Input maxLength={50} value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
                </Field>
                <Field label="Location">
                  <Input maxLength={50} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </Field>
                <Field label="Firmware version">
                  <Input maxLength={50} value={form.firmware} onChange={(e) => setForm({ ...form, firmware: e.target.value })} />
                </Field>
                <Field label="Power status">
                  <Input maxLength={50} value={form.powerStatus} onChange={(e) => setForm({ ...form, powerStatus: e.target.value })} placeholder="e.g. Battery, Mains" />
                </Field>
                <Field label="Network signal">
                  <Input maxLength={50} value={form.networkSignal} onChange={(e) => setForm({ ...form, networkSignal: e.target.value })} placeholder="e.g. Strong, Weak" />
                </Field>
                <Field label="Battery (%)">
                  <Input maxLength={50} type="number" min="0" max="100" value={form.battery} onChange={(e) => setForm({ ...form, battery: e.target.value })} />
                </Field>
                <Field label="PM2.5 threshold (µg/m³)">
                  <Input maxLength={50} type="number" value={form.pm25Threshold} onChange={(e) => setForm({ ...form, pm25Threshold: e.target.value })} placeholder="blank = default" />
                </Field>
                <Field label="VOC threshold">
                  <Input maxLength={50} type="number" step="0.1" value={form.vocThreshold} onChange={(e) => setForm({ ...form, vocThreshold: e.target.value })} placeholder="blank = default" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Reported issue">
                    <Input maxLength={50} value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} placeholder="Leave blank for none" />
                  </Field>
                </div>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={busy}>Cancel</Button>
                </DialogClose>
                <Button
                  onClick={handleSaveModify}
                  disabled={busy}
                  className="bg-brand-blue text-white hover:bg-brand-blue-strong"
                >
                  {busy ? 'Saving…' : 'Save changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </div>
  );
};

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

interface HealthBarProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'success' | 'warning' | 'danger';
}

function HealthBar({ icon, label, value, tone }: HealthBarProps) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  const barClass = tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : 'bg-success';
  const textClass = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-success';
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground">{icon} {label}</span>
      <span className="flex items-center gap-2">
        <span className="h-2 w-20 overflow-hidden rounded-full bg-muted">
          <span className={`block h-full rounded-full ${barClass}`} style={{ width: `${safe}%` }} />
        </span>
        <span className={`w-9 text-right font-medium ${textClass}`}>{safe}%</span>
      </span>
    </div>
  );
}

interface ConfirmButtonProps {
  label: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
}

function ConfirmButton({
  label, icon, title, description, confirmLabel, destructive, disabled, onConfirm,
}: ConfirmButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start" disabled={disabled}>
          {icon}{label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={disabled}
            className={destructive ? 'bg-danger text-white hover:bg-danger/90' : undefined}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}







