import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { Shield, Mail, Phone, IdCard, LogOut, KeyRound, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/app/context/AuthContext'
import { usersApi, type UserRecord } from '@/app/services/api'
import { PageHeader } from '@/app/components/admin/PageHeader'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Badge } from '@/app/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose,
} from '@/app/components/ui/dialog'

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2.5 last:border-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</span>
      <span className="text-sm font-medium text-foreground">{value || '—'}</span>
    </div>
  )
}

export const Profile = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [record, setRecord] = useState<UserRecord | null>(null)

  // Full account record (badge/contact/status/createdAt) is only readable by admins
  // (the /api/users routes are admin-only). Security users see the session fields only.
  useEffect(() => {
    if (user?.role === 'admin') {
      usersApi.getById(user.id).then(setRecord).catch(() => {})
    }
  }, [user])

  if (!user) return null

  const displayName = record?.name || user.name || user.username
  const roleLabel = user.role === 'admin' ? 'Administrator' : 'Security personnel'
  const initials = displayName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      logout();
      navigate('/login');
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8">
      <div className="admin-page-container w-full max-w-3xl mx-auto space-y-4 md:space-y-6">
        <PageHeader title="Profile" subtitle="Your account" />

        {/* Identity */}
        <motion.div
          initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.75, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue text-lg font-medium text-white">
              {initials}
            </div>
            <div>
              <div className="text-lg font-bold text-[#071126]">{displayName}</div>
              <Badge variant="secondary" className="mt-1">{roleLabel}</Badge>
            </div>
          </div>
        </motion.div>

        {/* Account info */}
        <motion.div
          initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.75, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5"
        >
          <h3 className="mb-2 text-sm font-bold text-[#071126]">Account information</h3>
          <InfoRow icon={<UserRound className="h-4 w-4" />} label="Username" value={user.username} />
          <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={record?.email || user.email || "No email set"} />
          <InfoRow icon={<Shield className="h-4 w-4" />} label="Role" value={roleLabel} />
          {record ? (
            <>
              <InfoRow icon={<IdCard className="h-4 w-4" />} label="Badge" value={record.badge} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Contact" value={record.contact} />
              <InfoRow icon={<Shield className="h-4 w-4" />} label="Status" value={record.status} />
            </>
          ) : null}
        </motion.div>

        {/* Security */}
        <motion.div
          initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.75, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5"
        >
          <h3 className="mb-3 text-sm font-bold text-[#071126]">Security</h3>
          {user.role === 'admin' ? (
            <ChangePasswordDialog userId={user.id} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Password changes are managed by an administrator.
            </p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.75, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <Button variant="outline" onClick={handleLogout} className="text-danger">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </motion.div>
      </div>
    </div>
  )
}

function ChangePasswordDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onOpenChange = (o: boolean) => {
    setOpen(o)
    if (!o) {
      setNext('')
      setConfirm('')
      setError(null)
    }
  }

  const save = async () => {
    if (next.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (next !== confirm) {
      setError('Passwords do not match')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await usersApi.update(userId, { password: next })
      toast.success('Password updated')
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound className="mr-1.5 h-4 w-4" /> Change password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>Set a new password for your account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">New password</Label>
            <Input maxLength={50} id="pw-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-confirm">Confirm password</Label>
            <Input maxLength={50} id="pw-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={save} disabled={saving} className="bg-brand-blue text-white hover:bg-brand-blue-strong">
            {saving ? 'Saving…' : 'Update password'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}



