import type { StatusTone } from '@/app/theme/tokens'

export interface StatusMeta {
  label: string
  tone: StatusTone
}

const DEVICE: Record<string, StatusMeta> = {
  online: { label: 'Online', tone: 'success' },
  offline: { label: 'Offline', tone: 'danger' },
  warning: { label: 'Warning', tone: 'warning' },
  maintenance: { label: 'Maintenance', tone: 'info' },
}

const ALERT: Record<string, StatusMeta> = {
  ACTIVE: { label: 'Active', tone: 'danger' },
  ACKNOWLEDGED: { label: 'Acknowledged', tone: 'warning' },
  RESPONDING: { label: 'Responding', tone: 'warning' },
  ESCALATED: { label: 'Escalated', tone: 'danger' },
  RESOLVED: { label: 'Resolved', tone: 'success' },
  FALSE_ALARM: { label: 'False alarm', tone: 'neutral' },
  REOPENED: { label: 'Reopened', tone: 'warning' },
}

const SEVERITY: Record<string, StatusMeta> = {
  low: { label: 'Low', tone: 'yellow' },
  medium: { label: 'Medium', tone: 'orange' },
  high: { label: 'High', tone: 'danger' },
  critical: { label: 'Critical', tone: 'danger' },
}

// Free-form log `status` strings written by the backend (alerts.js, devices, system).
const LOG: Record<string, StatusMeta> = {
  active: { label: 'Active', tone: 'danger' },
  new: { label: 'New', tone: 'danger' },
  reported: { label: 'Reported', tone: 'info' },
  acknowledged: { label: 'Acknowledged', tone: 'warning' },
  responding: { label: 'Responding', tone: 'info' },
  escalated: { label: 'Escalated', tone: 'danger' },
  reopened: { label: 'Reopened', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
  'false alarm': { label: 'False alarm', tone: 'neutral' },
  false_alarm: { label: 'False alarm', tone: 'neutral' },
  online: { label: 'Online', tone: 'success' },
  offline: { label: 'Offline', tone: 'danger' },
  warning: { label: 'Warning', tone: 'warning' },
  info: { label: 'Info', tone: 'info' },
  success: { label: 'Success', tone: 'success' },
  error: { label: 'Error', tone: 'danger' },
  failed: { label: 'Failed', tone: 'danger' },
}

function fallback(raw?: string): StatusMeta {
  return { label: raw && String(raw).trim() ? String(raw) : 'Unknown', tone: 'neutral' }
}

export function deviceStatus(s?: string): StatusMeta {
  return DEVICE[String(s).toLowerCase()] ?? fallback(s)
}

export function alertStatus(s?: string): StatusMeta {
  return ALERT[String(s).toUpperCase()] ?? fallback(s)
}

export function severityStatus(s?: string): StatusMeta {
  return SEVERITY[String(s).toLowerCase()] ?? fallback(s)
}

export function logStatus(s?: string): StatusMeta {
  if (!s || !String(s).trim()) return { label: '—', tone: 'neutral' }
  const key = String(s).toLowerCase()
  return LOG[key] ?? { label: String(s), tone: 'neutral' }
}

export const toneClasses: Record<StatusTone, string> = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  neutral: 'bg-gray-100 text-gray-600',
  yellow: 'bg-yellow-100 text-yellow-700',
  orange: 'bg-orange-100 text-orange-700',
}
