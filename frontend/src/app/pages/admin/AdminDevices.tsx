import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { Download, Radio, CircleCheck, CircleX, TriangleAlert, BatteryLow, WifiOff } from 'lucide-react'
import { devicesApi, type Device } from '@/app/services/api'
import { PageHeader } from '@/app/components/admin/PageHeader'
import { MetricCard } from '@/app/components/admin/MetricCard'
import { AsyncBoundary } from '@/app/components/admin/AsyncBoundary'
import { StatusBadge } from '@/app/components/admin/StatusBadge'
import { DeviceProvisioningDialog } from '@/app/components/admin/DeviceProvisioningDialog'
import { DeviceThresholdsDialog } from '@/app/components/admin/DeviceThresholdsDialog'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { deviceStatus } from '@/app/lib/status'
import { classifyReading, effectivePm25Threshold } from '@/app/lib/thresholds'
import { downloadCsv } from '@/app/lib/csv'
import { cn } from '@/app/components/ui/utils'

function pm25Class(device: Device): string {
  const level = classifyReading(device.pm25, effectivePm25Threshold(device))
  return level === 'critical' ? 'text-danger font-medium' : level === 'warning' ? 'text-warning font-medium' : 'text-foreground'
}

export const AdminDevices = () => {
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [floorFilter, setFloorFilter] = useState('all')
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      setError(null)
      setDevices(await devicesApi.getAll())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load devices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [load])

  const floors = useMemo(
    () => Array.from(new Set((devices ?? []).map((d) => d.floor).filter(Boolean))).sort(),
    [devices],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (devices ?? []).filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (floorFilter !== 'all' && d.floor !== floorFilter) return false
      if (q && !`${d.id} ${d.name} ${d.location ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [devices, statusFilter, floorFilter, search])

  const stats = useMemo(() => {
    const list = devices ?? []
    return {
      total: list.length,
      online: list.filter((d) => d.status === 'online').length,
      offline: list.filter((d) => d.status === 'offline').length,
      warning: list.filter((d) => d.status === 'warning').length,
      lowBattery: list.filter((d) => (d.battery ?? 100) < 20).length,
      weakSignal: list.filter((d) => (d.signalStrength ?? 100) < 50).length,
    }
  }, [devices])

  const exportCsv = () => {
    downloadCsv(
      'devices.csv',
      filtered.map((d) => ({
        id: d.id, name: d.name, floor: d.floor, location: d.location,
        status: d.status, pm25: d.pm25, voc: d.voc, battery: d.battery,
        signal: d.signalStrength, firmware: d.firmware,
        pm25Threshold: d.pm25Threshold ?? '', vocThreshold: d.vocThreshold ?? '',
        lastSeen: d.lastSeen,
      })),
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="admin-page-container w-full max-w-7xl mx-auto space-y-4 md:space-y-6">
        <PageHeader
          title="Devices"
          subtitle={devices ? `${devices.length} sensor${devices.length === 1 ? '' : 's'}` : undefined}
          actions={
            <>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={!devices?.length}>
                <Download className="mr-1.5 h-4 w-4" /> Export
              </Button>
              <DeviceProvisioningDialog onCreated={load} />
            </>
          }
        />

        <AsyncBoundary loading={loading && !devices} error={error} onRetry={load}>
          {devices ? (
            <div className="space-y-4 md:space-y-6">
              {/* KPI row */}
              <motion.div
                initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.75, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
              >
                <MetricCard label="Total" value={stats.total} icon={<Radio className="h-4 w-4" />} />
                <MetricCard label="Online" value={stats.online} tone="success" icon={<CircleCheck className="h-4 w-4" />} />
                <MetricCard label="Offline" value={stats.offline} tone={stats.offline ? 'danger' : 'neutral'} icon={<CircleX className="h-4 w-4" />} />
                <MetricCard label="Warning" value={stats.warning} tone={stats.warning ? 'warning' : 'neutral'} icon={<TriangleAlert className="h-4 w-4" />} />
                <MetricCard label="Low battery" value={stats.lowBattery} tone={stats.lowBattery ? 'danger' : 'neutral'} icon={<BatteryLow className="h-4 w-4" />} />
                <MetricCard label="Weak signal" value={stats.weakSignal} tone={stats.weakSignal ? 'warning' : 'neutral'} icon={<WifiOff className="h-4 w-4" />} />
              </motion.div>

              {/* Toolbar */}
              <motion.div
                initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.75, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-wrap items-center gap-2"
              >
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by id, name, or location"
                  className="w-full sm:max-w-xs"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={floorFilter} onValueChange={setFloorFilter}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Floor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All floors</SelectItem>
                    {floors.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>

              {/* Table */}
              <motion.div
                initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.75, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-x-auto"
              >
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2.5 px-4 font-medium">Device</th>
                      <th className="py-2.5 px-3 font-medium">Location</th>
                      <th className="py-2.5 px-3 font-medium">Status</th>
                      <th className="py-2.5 px-3 font-medium">PM2.5</th>
                      <th className="py-2.5 px-3 font-medium">VOC</th>
                      <th className="py-2.5 px-3 font-medium">Battery</th>
                      <th className="py-2.5 px-3 font-medium">Signal</th>
                      <th className="py-2.5 px-3 font-medium">last active</th>
                      <th className="py-2.5 px-3 font-medium text-right">Thresholds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-muted-foreground">
                          {devices.length === 0 ? 'No devices yet — add one to get started.' : 'No devices match your filters.'}
                        </td>
                      </tr>
                    ) : (
                      filtered.map((d) => (
                        <tr
                          key={d.id}
                          onClick={() => navigate(`/admin/devices/${d.id}`)}
                          className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-muted/60"
                        >
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-foreground">{d.name || d.id}</div>
                            <div className="text-xs text-muted-foreground">{d.id}</div>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {[d.floor, d.location].filter(Boolean).join(' — ') || '—'}
                          </td>
                          <td className="py-2.5 px-3"><StatusBadge status={deviceStatus(d.status)} /></td>
                          <td className={cn('py-2.5 px-3', pm25Class(d))}>{d.status === 'offline' ? '—' : d.pm25}</td>
                          <td className="py-2.5 px-3 text-foreground">{d.status === 'offline' ? '—' : d.voc}</td>
                          <td className={cn('py-2.5 px-3', (d.battery ?? 100) < 20 ? 'text-danger font-medium' : 'text-foreground')}>{d.battery ?? '—'}%</td>
                          <td className={cn('py-2.5 px-3', (d.signalStrength ?? 100) < 50 ? 'text-warning font-medium' : 'text-foreground')}>{d.signalStrength ?? '—'}%</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{d.lastSeen || '—'}</td>
                          <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <DeviceThresholdsDialog device={d} onSaved={load} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </motion.div>
            </div>
          ) : null}
        </AsyncBoundary>
      </div>
    </div>
  )
}


