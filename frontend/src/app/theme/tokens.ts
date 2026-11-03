export const brand = {
  navy: '#0B1847',
  blue: '#1B44CC',
  blueStrong: '#2665D0',
  surfaceMuted: '#EEF2FE',
} as const

export const status = {
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  info: '#2563eb',
  neutral: '#6b7280',
  yellow: '#eab308',
  orange: '#f97316',
} as const

export const chart = {
  pm25: brand.blue,
  voc: '#7c3aed',
  threshold: status.danger,
  grid: '#e5e7eb',
} as const

export type StatusTone = keyof typeof status
