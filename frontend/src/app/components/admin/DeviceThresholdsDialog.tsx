import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { devicesApi, type Device } from '@/app/services/api'
import {
  effectivePm25Threshold, effectiveVocThreshold, DEFAULT_PM25_THRESHOLD, DEFAULT_VOC_THRESHOLD,
} from '@/app/lib/thresholds'

interface DeviceThresholdsDialogProps {
  device: Device
  onSaved: () => void
}

export function DeviceThresholdsDialog({ device, onSaved }: DeviceThresholdsDialogProps) {
  const [open, setOpen] = useState(false)
  const [pm25, setPm25] = useState('')
  const [voc, setVoc] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onOpenChange = (o: boolean) => {
    setOpen(o)
    if (o) {
      setPm25(device.pm25Threshold != null ? String(device.pm25Threshold) : '')
      setVoc(device.vocThreshold != null ? String(device.vocThreshold) : '')
      setError(null)
    }
  }

  const save = async () => {
    const pm25Val = pm25.trim() === '' ? null : Number(pm25)
    const vocVal = voc.trim() === '' ? null : Number(voc)
    if (pm25Val != null && (!Number.isFinite(pm25Val) || pm25Val <= 0)) {
      setError('PM2.5 threshold must be a positive number')
      return
    }
    if (vocVal != null && (!Number.isFinite(vocVal) || vocVal <= 0)) {
      setError('VOC threshold must be a positive number')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await devicesApi.update(device.id, { pm25Threshold: pm25Val, vocThreshold: vocVal })
      toast.success('Thresholds updated')
      onSaved()
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save thresholds')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Tune detection thresholds" onClick={(e) => e.stopPropagation()}>
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detection thresholds</DialogTitle>
          <DialogDescription>
            {device.name || device.id} — leave a field blank to use the system default.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="th-pm">PM2.5 threshold (µg/m³)</Label>
            <Input id="th-pm" type="number" value={pm25} onChange={(e) => setPm25(e.target.value)} placeholder={`${DEFAULT_PM25_THRESHOLD} (default)`} />
            <p className="text-xs text-muted-foreground">
              Currently {effectivePm25Threshold(device)} µg/m³ {device.pm25Threshold != null ? '(custom)' : '(default)'}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="th-voc">VOC threshold</Label>
            <Input id="th-voc" type="number" step="0.1" value={voc} onChange={(e) => setVoc(e.target.value)} placeholder={`${DEFAULT_VOC_THRESHOLD} (default)`} />
            <p className="text-xs text-muted-foreground">
              Currently {effectiveVocThreshold(device)} {device.vocThreshold != null ? '(custom)' : '(default)'}
            </p>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={save} disabled={saving} className="bg-brand-blue text-white hover:bg-brand-blue-strong">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
