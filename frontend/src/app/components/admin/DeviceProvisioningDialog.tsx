import { useState } from 'react'
import { Plus, Copy, Eye, EyeOff, KeyRound, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { devicesApi, type Device } from '@/app/services/api'

interface DeviceProvisioningDialogProps {
  onCreated: () => void
}

interface FormState {
  apiKey: string
  name: string
  location: string
  floor: string
  pm25Threshold: string
  vocThreshold: string
}

const EMPTY_FORM: FormState = { apiKey: '', name: '', location: '', floor: '', pm25Threshold: '', vocThreshold: '' }

export function DeviceProvisioningDialog({ onCreated }: DeviceProvisioningDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'form' | 'key'>('form')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [created, setCreated] = useState<(Device & { apiKey: string }) | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  const reset = () => {
    setStep('form')
    setForm(EMPTY_FORM)
    setCreated(null)
    setError(null)
    setRevealed(false)
    setSubmitting(false)
  }

  const set = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async () => {
    if (!form.name.trim()) {
      setError('Device name is required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload: { name: string; location?: string; floor?: string; pm25Threshold?: number; vocThreshold?: number; apiKey?: string } = {
        name: form.name.trim(),
      }
      if (form.location.trim()) payload.location = form.location.trim()
      if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim()
      if (form.floor.trim()) payload.floor = form.floor.trim()
      if (form.pm25Threshold.trim()) payload.pm25Threshold = Number(form.pm25Threshold)
      if (form.vocThreshold.trim()) payload.vocThreshold = Number(form.vocThreshold)
      const device = await devicesApi.create(payload)
      setCreated(device)
      setStep('key')
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create device')
    } finally {
      setSubmitting(false)
    }
  }

  const copyKey = async () => {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.apiKey)
      toast.success('API key copied to clipboard')
    } catch {
      toast.error('Copy failed — select and copy manually')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="bg-brand-blue text-white hover:bg-brand-blue-strong">
          <Plus className="mr-1.5 h-4 w-4" /> Add device
        </Button>
      </DialogTrigger>
      <DialogContent>
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>Add a device</DialogTitle>
              <DialogDescription>Register a new ESP32 sensor node. You&rsquo;ll get a one-time API key to flash onto it.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-1">
                            <div className="space-y-1.5">
                <Label htmlFor="dp-name">Device name <span className="text-danger">*</span></Label>
                <Input maxLength={50} id="dp-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. CR 2F" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dp-key">Node ID / Custom API Key (Optional)</Label>
                <Input maxLength={50} id="dp-key" value={form.apiKey} onChange={(e) => set('apiKey', e.target.value)} placeholder="e.g. NODE-MB-2F-FCR01" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="dp-floor">Floor</Label>
                  <Input id="dp-floor" value={form.floor} onChange={(e) => set('floor', e.target.value)} placeholder="2nd Floor" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dp-loc">Location</Label>
                  <Input id="dp-loc" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Boys restroom" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="dp-pm">PM2.5 threshold</Label>
                  <Input id="dp-pm" type="number" value={form.pm25Threshold} onChange={(e) => set('pm25Threshold', e.target.value)} placeholder="35 (default)" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dp-voc">VOC threshold</Label>
                  <Input id="dp-voc" type="number" step="0.1" value={form.vocThreshold} onChange={(e) => set('vocThreshold', e.target.value)} placeholder="0.6 (default)" />
                </div>
              </div>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={submit} disabled={submitting} className="bg-brand-blue text-white hover:bg-brand-blue-strong">
                {submitting ? 'Creating…' : 'Create device'}
              </Button>
            </DialogFooter>
          </>
        ) : created ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-success" /> Device created
              </DialogTitle>
              <DialogDescription>
                <span className="font-medium text-foreground">{created.name}</span> ({created.id}) is registered.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-1">
              <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3">
                <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
                <p className="text-sm text-foreground">
                  This API key is shown <span className="font-medium">once</span>. Copy it now and flash it onto the device — you can&rsquo;t retrieve it later (only rotate it).
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Device API key</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 truncate rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm">
                    {revealed ? created.apiKey : '•'.repeat(24)}
                  </code>
                  <Button variant="outline" size="icon" onClick={() => setRevealed((r) => !r)} aria-label={revealed ? 'Hide key' : 'Reveal key'}>
                    {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={copyKey} aria-label="Copy key">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>ESP32 setup</Label>
                <pre className="overflow-x-auto rounded-md border border-border bg-muted p-3 text-xs leading-relaxed text-foreground">
{`Connect ESP32 to EMQX Cloud (MQTT):
  Host: z7a0aa0f.ala.asia-southeast1.emqxsl.com (Port 8883)

Publish telemetry payload to:
  aerosense/nodes/${revealed ? created.apiKey : '<node-id>'}/telemetry

Publish alert payload to:
  aerosense/nodes/${revealed ? created.apiKey : '<node-id>'}/alert`}
                </pre>
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button className="bg-brand-blue text-white hover:bg-brand-blue-strong">Done</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}







