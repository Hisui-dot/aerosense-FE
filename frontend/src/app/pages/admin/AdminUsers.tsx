import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Users, Shield, UserCog, CircleCheck, Ban, Download, Search,
  Pencil, Power, Trash2, UserPlus, MoreHorizontal, UserCheck, UserX,
} from 'lucide-react';
import { toast } from 'sonner';
import { usersApi, type UserRecord } from '@/app/services/api';
import { PageHeader } from '@/app/components/admin/PageHeader';
import { MetricCard } from '@/app/components/admin/MetricCard';
import { AsyncBoundary } from '@/app/components/admin/AsyncBoundary';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/app/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/app/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/app/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle,
  AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/app/components/ui/alert-dialog';
import { toneClasses } from '@/app/lib/status';
import { downloadCsv } from '@/app/lib/csv';

// Three user levels (panel request): Admin · Supervisor · Guard. Admin runs the console;
// Supervisor + Guard are personnel who use the security module.
const ROLES = ['admin', 'supervisor', 'security'] as const;
type Role = (typeof ROLES)[number];

// Three account states with distinct meaning:
//  active      — can sign in
//  suspended   — temporary hold, reversible (kept on roster)
//  deactivated — switched off / decommissioned (e.g. left the org), reversible
const STATUSES = ['active', 'suspended', 'deactivated'] as const;
type Status = (typeof STATUSES)[number];

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', supervisor: 'Supervisor', security: 'Guard' };
const roleLabel = (role: string) => ROLE_LABEL[role] ?? (role || 'Unknown');
const roleTone = (role: string) =>
  role === 'admin' ? toneClasses.info : role === 'supervisor' ? toneClasses.warning : toneClasses.neutral;

const STATUS_LABEL: Record<string, string> = { active: 'Active', suspended: 'Suspended', deactivated: 'Deactivated' };
const statusLabel = (s: string) => STATUS_LABEL[s] ?? (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Unknown');
const statusTone = (s: string) =>
  s === 'active' ? toneClasses.success : s === 'suspended' ? toneClasses.warning : toneClasses.neutral;

interface UserFormState {
  name: string;
  username: string;
  email: string;
  contact: string;
  role: Role;
  status: Status;
  password: string;
}

const EMPTY_FORM: UserFormState = {
  name: '', username: '', email: '', contact: '', role: 'security', status: 'active', password: '',
};

export const AdminUsers = () => {
  const [users, setUsers] = useState<UserRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [deleting, setDeleting] = useState<UserRecord | null>(null);
  const [statusChange, setStatusChange] = useState<{ user: UserRecord; status: Status } | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setUsers(await usersApi.getAll());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const stats = useMemo(() => {
    const list = users ?? [];
    return {
      total: list.length,
      admins: list.filter((u) => u.role === 'admin').length,
      personnel: list.filter((u) => u.role !== 'admin').length,
      active: list.filter((u) => u.status === 'active').length,
      suspended: list.filter((u) => u.status === 'suspended').length,
      deactivated: list.filter((u) => u.status === 'deactivated').length,
    };
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users ?? []).filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (q && !`${u.name ?? ''} ${u.username ?? ''} ${u.email ?? ''} ${u.badge ?? ''}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const exportCsv = () => {
    downloadCsv(
      'users.csv',
      filtered.map((u) => ({
        id: u.id, name: u.name, username: u.username, email: u.email,
        badge: u.badge, role: u.role, status: u.status, contact: u.contact,
        createdAt: u.createdAt,
      })),
    );
  };

  const openAdd = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (u: UserRecord) => {
    setEditing(u);
    setEditorOpen(true);
  };

  // Quick status change (reactivate / suspend / deactivate) — a real persisted update.
  const changeStatus = async (u: UserRecord, status: Status) => {
    try {
      await usersApi.update(u.id, { status });
      setUsers((prev) => (prev ? prev.map((x) => (x.id === u.id ? { ...x, status } : x)) : prev));
      toast.success(`${u.name || u.username} set to ${statusLabel(status).toLowerCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status');
    }
  };

  // Reactivation is safe and immediate; suspend/deactivate need an explicit confirm
  // so the admin understands the difference between the two.
  const requestStatus = (u: UserRecord, status: Status) => {
    if (status === 'active') {
      changeStatus(u, status);
    } else {
      setStatusChange({ user: u, status });
    }
  };

  const confirmStatusChange = async () => {
    if (!statusChange) return;
    await changeStatus(statusChange.user, statusChange.status);
    setStatusChange(null);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    try {
      await usersApi.remove(target.id);
      setUsers((prev) => (prev ? prev.filter((x) => x.id !== target.id) : prev));
      toast.success(`${target.name || target.username} deleted`);
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete user');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="admin-page-container w-full max-w-7xl mx-auto space-y-4 md:space-y-6">
        <PageHeader
          title="Users"
          subtitle={users ? `${users.length} account${users.length === 1 ? '' : 's'}` : undefined}
          actions={
            <>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
                <Download className="mr-1.5 h-4 w-4" /> Export
              </Button>
              <Button size="sm" onClick={openAdd} className="bg-brand-blue text-white hover:bg-brand-blue-strong">
                <UserPlus className="mr-1.5 h-4 w-4" /> Add user
              </Button>
            </>
          }
        />

        <AsyncBoundary loading={loading && !users} error={error} onRetry={load}>
          {users ? (
            <div className="space-y-4 md:space-y-6">
              {/* KPI row */}
              <motion.div
                initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.75, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
              >
                <MetricCard label="Total" value={stats.total} icon={<Users className="h-4 w-4" />} />
                <MetricCard label="Admins" value={stats.admins} tone="info" icon={<Shield className="h-4 w-4" />} />
                <MetricCard label="Personnel" value={stats.personnel} icon={<UserCog className="h-4 w-4" />} />
                <MetricCard label="Active" value={stats.active} tone="success" icon={<CircleCheck className="h-4 w-4" />} />
                <MetricCard label="Suspended" value={stats.suspended} tone={stats.suspended ? 'warning' : 'neutral'} icon={<Ban className="h-4 w-4" />} />
                <MetricCard label="Deactivated" value={stats.deactivated} tone="neutral" icon={<Power className="h-4 w-4" />} />
              </motion.div>

              {/* Toolbar */}
              <motion.div
                initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.75, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-wrap items-center gap-2"
              >
                <div className="relative w-full sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, username, email, or badge"
                    className="pl-9"
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="security">Guard</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="deactivated">Deactivated</SelectItem>
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
                      <th className="py-2.5 px-4 font-medium">User</th>
                      <th className="py-2.5 px-3 font-medium">Badge</th>
                      <th className="py-2.5 px-3 font-medium">Role</th>
                      <th className="py-2.5 px-3 font-medium">Status</th>
                      <th className="py-2.5 px-3 font-medium">Contact</th>
                      <th className="py-2.5 px-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-muted-foreground">
                          {users.length === 0 ? 'No users yet — add one to get started.' : 'No users match your filters.'}
                        </td>
                      </tr>
                    ) : (
                      filtered.map((u) => (
                        <tr key={u.id} className="border-b border-border/60 last:border-0 hover:bg-surface-muted/60">
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-foreground">{u.name || u.username}</div>
                            <div className="text-xs text-muted-foreground">
                              {u.username}{u.email ? ` · ${u.email}` : ''}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">{u.badge || '—'}</td>
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className={`border-transparent font-medium ${roleTone(u.role)}`}>
                              {roleLabel(u.role)}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className={`border-transparent font-medium ${statusTone(u.status)}`}>
                              {statusLabel(u.status)}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">{u.contact || '—'}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" aria-label="User actions">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem onClick={() => openEdit(u)}>
                                    <Pencil className="mr-2 h-4 w-4" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {u.status !== 'active' ? (
                                    <DropdownMenuItem onClick={() => requestStatus(u, 'active')}>
                                      <UserCheck className="mr-2 h-4 w-4 text-success" /> Reactivate
                                    </DropdownMenuItem>
                                  ) : null}
                                  {u.status !== 'suspended' ? (
                                    <DropdownMenuItem onClick={() => requestStatus(u, 'suspended')}>
                                      <Ban className="mr-2 h-4 w-4 text-warning" /> Suspend
                                    </DropdownMenuItem>
                                  ) : null}
                                  {u.status !== 'deactivated' ? (
                                    <DropdownMenuItem onClick={() => requestStatus(u, 'deactivated')}>
                                      <UserX className="mr-2 h-4 w-4" /> Deactivate
                                    </DropdownMenuItem>
                                  ) : null}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setDeleting(u)} className="text-danger focus:text-danger">
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
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

      <UserEditorDialog
        open={editorOpen}
        user={editing}
        onOpenChange={setEditorOpen}
        onSaved={(saved) => {
          setUsers((prev) => {
            if (!prev) return [saved];
            return prev.some((x) => x.id === saved.id)
              ? prev.map((x) => (x.id === saved.id ? saved : x))
              : [...prev, saved];
          });
          load().catch(() => {});
        }}
      />

      {/* Suspend / Deactivate confirmation — explains the difference (P35) */}
      <AlertDialog open={statusChange !== null} onOpenChange={(o) => { if (!o) setStatusChange(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusChange?.status === 'suspended' ? 'Suspend' : 'Deactivate'}{' '}
              {statusChange ? (statusChange.user.name || statusChange.user.username) : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusChange?.status === 'suspended'
                ? 'Suspend = a temporary hold. The account stays on the roster but cannot sign in for 14 days or until you reactivate it. Use for short-term holds.'
                : 'Deactivate = switched off / decommissioned. The account cannot sign in. Use when someone leaves the organization. You can reactivate it later.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange}>
              {statusChange?.status === 'suspended' ? 'Suspend' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <Dialog open={deleting !== null} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              {deleting
                ? `Permanently delete ${deleting.name || deleting.username}? This cannot be undone.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button className="bg-danger text-white hover:bg-danger/90" onClick={confirmDelete}>
              Delete user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface UserEditorDialogProps {
  open: boolean;
  user: UserRecord | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (user: UserRecord) => void;
}

function UserEditorDialog({ open, user, onOpenChange, onSaved }: UserEditorDialogProps) {
  const isEdit = user !== null;
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      user
        ? {
            name: user.name ?? '',
            username: user.username ?? '',
            email: user.email ?? '',
            contact: user.contact ?? '',
            role: (ROLES as readonly string[]).includes(user.role) ? (user.role as Role) : 'security',
            status: (STATUSES as readonly string[]).includes(user.status) ? (user.status as Status) : 'active',
            password: '',
          }
        : EMPTY_FORM,
    );
  }, [open, user]);

  const set = <K extends keyof UserFormState>(key: K, value: UserFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!form.username.trim()) {
      setError('Username is required');
      return;
    }
    if (!form.email.trim()) {
      setError('Email is required');
      return;
    }
    if (!isEdit && !form.password) {
      setError('A password is required for a new user');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit && user) {
        // Only send fields the backend persists. Password optional on edit.
        const payload: Partial<UserRecord & { password: string }> = {
          name: form.name.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
          contact: form.contact.trim(),
          role: form.role,
          status: form.status,
        };
        if (form.password) payload.password = form.password;
        const saved = await usersApi.update(user.id, payload);
        onSaved(saved);
        toast.success('User updated');
      } else {
        const created = await usersApi.create({
          name: form.name.trim() || undefined,
          username: form.username.trim(),
          email: form.email.trim(),
          contact: form.contact.trim() || undefined,
          role: form.role,
          password: form.password,
        });
        onSaved(created);
        // The backend forces new accounts to 'active'. If a non-default status was picked,
        // apply it as a real follow-up update rather than pretending it took on create.
        if (form.status !== 'active') {
          try {
            const updated = await usersApi.update(created.id, { status: form.status });
            onSaved(updated);
          } catch {
            toast.warning('User created as active — status change did not apply');
          }
        }
        toast.success('User created');
      }
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit user' : 'Add user'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this account. Leave password blank to keep the current one.'
              : 'Create a new console account. Username and password are required.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="u-name">Full name</Label>
              <Input maxLength={50} id="u-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Jane Dela Cruz" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-username">Username <span className="text-danger">*</span></Label>
              <Input maxLength={50} id="u-username" value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="jdelacruz" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="u-email">Email <span className="text-danger">*</span></Label>
              <Input maxLength={50} id="u-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="jane@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-contact">Contact</Label>
              <Input maxLength={50} id="u-contact" value={form.contact} onChange={(e) => set('contact', e.target.value)} placeholder="+63 ..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="u-role">Role</Label>
              <Select value={form.role} onValueChange={(v) => set('role', v as Role)}>
                <SelectTrigger id="u-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="security">Guard</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v as Status)}>
                <SelectTrigger id="u-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="deactivated">Deactivated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-password">
              Password {isEdit
                ? <span className="font-normal text-muted-foreground">(leave blank to keep current)</span>
                : <span className="text-danger">*</span>}
            </Label>
            <Input
              id="u-password"
              type="password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder={isEdit ? 'Set a new password' : 'Create a password'}
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} disabled={submitting} className="bg-brand-blue text-white hover:bg-brand-blue-strong">
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


