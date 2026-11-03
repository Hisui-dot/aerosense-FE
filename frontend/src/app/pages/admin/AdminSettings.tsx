import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { SlidersHorizontal, Save, Trash2, Info, Loader2 } from 'lucide-react'
import { settingsApi, logsApi } from '@/app/services/api'
import { PageHeader } from '@/app/components/admin/PageHeader'
import { AsyncBoundary } from '@/app/components/admin/AsyncBoundary'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Switch } from '@/app/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/components/ui/dialog'
import {
  DEFAULT_PM25_THRESHOLD,
  DEFAULT_VOC_THRESHOLD,
} from '@/app/lib/thresholds'

// Only the fields the backend persists AND a real consumer reads. Everything
// else the old page exposed was write-only decoration and has been removed.
type SensitivityLevel = 'low' | 'medium' | 'high'

interface SettingsForm {
  pm25Threshold: string
  vocThreshold: string
  sensitivityLevel: SensitivityLevel
  requireBothSensors: boolean
  logRetention: string
}

const SENSITIVITY_VALUES: readonly SensitivityLevel[] = ['low', 'medium', 'high']

const DEFAULT_FORM: SettingsForm = {
  pm25Threshold: String(DEFAULT_PM25_THRESHOLD),
  vocThreshold: String(DEFAULT_VOC_THRESHOLD),
  sensitivityLevel: 'medium',
  requireBothSensors: true,
  logRetention: '30',
}

function asSensitivity(value: unknown): SensitivityLevel {
  return typeof value === 'string' && (SENSITIVITY_VALUES as readonly string[]).includes(value)
    ? (value as SensitivityLevel)
    : 'medium'
}

function numericString(value: unknown, fallback: string): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback
}

// Map the untyped settings record returned by the backend onto our form,
// falling back to defaults for anything not yet persisted.
function toForm(data: Record<string, unknown>): SettingsForm {
  return {
    pm25Threshold: numericString(data.pm25Threshold, DEFAULT_FORM.pm25Threshold),
    vocThreshold: numericString(data.vocThreshold, DEFAULT_FORM.vocThreshold),
    sensitivityLevel: asSensitivity(data.sensitivityLevel),
    requireBothSensors:
      typeof data.requireBothSensors === 'boolean' ? data.requireBothSensors : DEFAULT_FORM.requireBothSensors,
    logRetention: numericString(data.logRetention, DEFAULT_FORM.logRetention),
  }
}

interface FieldErrors {
  pm25Threshold?: string
  vocThreshold?: string
  logRetention?: string
}

function positiveNumberError(raw: string, label: string): string | undefined {
  const trimmed = raw.trim()
  if (trimmed === '') return `${label} is required`
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return `${label} must be a number`
  if (n <= 0) return `${label} must be greater than 0`
  return undefined
}

function validate(form: SettingsForm): FieldErrors {
  return {
    pm25Threshold: positiveNumberError(form.pm25Threshold, 'PM2.5 threshold'),
    vocThreshold: positiveNumberError(form.vocThreshold, 'VOC threshold'),
    logRetention: positiveNumberError(form.logRetention, 'Log retention'),
  }
}

export const AdminSettings = () => {
  const [saved, setSaved] = useState<SettingsForm | null>(null)
  const [form, setForm] = useState<SettingsForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setError(null)
      const data = await settingsApi.get()
      const next = toForm(data)
      setSaved(next)
      setForm(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const errors = useMemo(() => (form ? validate(form) : {}), [form])
  const hasErrors = Object.values(errors).some(Boolean)
  const dirty = useMemo(
    () => !!form && !!saved && JSON.stringify(form) !== JSON.stringify(saved),
    [form, saved],
  )

  const update = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleSave = async () => {
    if (!form || hasErrors || !dirty) return
    setSaving(true)
    try {
      const payload = {
        pm25Threshold: Number(form.pm25Threshold),
        vocThreshold: Number(form.vocThreshold),
        sensitivityLevel: form.sensitivityLevel,
        requireBothSensors: form.requireBothSensors,
        logRetention: Number(form.logRetention),
      }
      const result = await settingsApi.save(payload)
      const next = toForm(result)
      setSaved(next)
      setForm(next)
      toast.success('Settings saved')
    } catch (e) {
      // Surface the real failure — never show a success toast on a failed write.
      toast.error(e instanceof Error ? e.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="admin-page-container w-full max-w-7xl mx-auto space-y-4 md:space-y-6">
        <PageHeader
          title="Settings"
          subtitle="Global detection defaults and data retention"
          actions={
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!dirty || hasErrors || saving || !form}
              className="bg-brand-blue hover:bg-brand-blue-strong"
            >
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </Button>
          }
        />

        <AsyncBoundary loading={loading && !form} error={error} onRetry={load}>
          {form ? (
            <div className="space-y-4 md:space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.75, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              >
                <GlobalDefaultsNote />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.75, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                <DetectionThresholdsCard form={form} errors={errors} onChange={update} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.75, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <DataRetentionCard form={form} errors={errors} onChange={update} onCleared={load} />
              </motion.div>
            </div>
          ) : null}
        </AsyncBoundary>
      </div>
    </div>
  )
}

function GlobalDefaultsNote() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-muted/60 px-4 py-3 text-sm text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-info" />
      <span>
        These are <span className="font-medium text-foreground">global defaults</span>. A device with its own
        threshold overrides them — set per-device values on the Devices page.
      </span>
    </div>
  )
}

interface FieldProps {
  form: SettingsForm
  errors: FieldErrors
  onChange: <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => void
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-danger">{message}</p>
}

function DetectionThresholdsCard({ form, errors, onChange }: FieldProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-brand-blue" />
        <h2 className="text-base font-medium text-foreground">Detection thresholds</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Thresholds used to flag a reading when a device has no override of its own.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pm25Threshold" className="text-sm text-foreground">
            PM2.5 threshold (µg/m³)
          </Label>
          <Input
            id="pm25Threshold"
            type="number"
            min={0}
            step="1"
            value={form.pm25Threshold}
            aria-invalid={!!errors.pm25Threshold}
            onChange={(e) => onChange('pm25Threshold', e.target.value)}
            className="mt-1.5"
          />
          <FieldError message={errors.pm25Threshold} />
        </div>

        <div>
          <Label htmlFor="vocThreshold" className="text-sm text-foreground">
            VOC threshold (ppm)
          </Label>
          <Input
            id="vocThreshold"
            type="number"
            min={0}
            step="0.01"
            value={form.vocThreshold}
            aria-invalid={!!errors.vocThreshold}
            onChange={(e) => onChange('vocThreshold', e.target.value)}
            className="mt-1.5"
          />
          <FieldError message={errors.vocThreshold} />
        </div>

        <div>
          <Label htmlFor="sensitivityLevel" className="text-sm text-foreground">
            Sensitivity level
          </Label>
          <Select
            value={form.sensitivityLevel}
            onValueChange={(v) => onChange('sensitivityLevel', v as SensitivityLevel)}
          >
            <SelectTrigger id="sensitivityLevel" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <div className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-muted/50 px-3 py-2.5">
            <div className="pr-3">
              <Label htmlFor="requireBothSensors" className="text-sm text-foreground">
                Require both sensors
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Flag only when PM2.5 and VOC both exceed threshold.
              </p>
            </div>
            <Switch
              id="requireBothSensors"
              checked={form.requireBothSensors}
              onCheckedChange={(v) => onChange('requireBothSensors', v)}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

interface RetentionCardProps extends FieldProps {
  onCleared: () => void
}

function DataRetentionCard({ form, errors, onChange, onCleared }: RetentionCardProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Trash2 className="h-4 w-4 text-brand-blue" />
        <h2 className="text-base font-medium text-foreground">Data retention</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">How long activity logs are kept before cleanup.</p>

      <div className="max-w-xs">
        <Label htmlFor="logRetention" className="text-sm text-foreground">
          Log retention (days)
        </Label>
        <Input
          id="logRetention"
          type="number"
          min={1}
          step="1"
          value={form.logRetention}
          aria-invalid={!!errors.logRetention}
          onChange={(e) => onChange('logRetention', e.target.value)}
          className="mt-1.5"
        />
        <FieldError message={errors.logRetention} />
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Clear all logs</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Permanently delete every log entry. This cannot be undone.
          </p>
        </div>
        <ClearLogsDialog onCleared={onCleared} />
      </div>
    </section>
  )
}

function ClearLogsDialog({ onCleared }: { onCleared: () => void }) {
  const [open, setOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  const handleClear = async () => {
    setClearing(true)
    try {
      await logsApi.clear()
      toast.success('All logs cleared')
      setOpen(false)
      onCleared()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to clear logs')
    } finally {
      setClearing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !clearing && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="flex-shrink-0">
          <Trash2 className="mr-1.5 h-4 w-4" />
          Clear all logs
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear all logs?</DialogTitle>
          <DialogDescription>
            This permanently deletes every log entry, including detection, device, and audit records. This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={clearing}>
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleClear} disabled={clearing}>
            {clearing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
            {clearing ? 'Clearing…' : 'Clear all logs'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

