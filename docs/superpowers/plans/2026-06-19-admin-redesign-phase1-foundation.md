# Admin Redesign — Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared design-system foundation (brand/status tokens + reusable admin components + tested pure-logic utilities) that all later redesign phases consume.

**Architecture:** Add AeroSense brand + semantic status tokens to the existing Tailwind v4 `@theme inline` block (`src/styles/theme.css`) and mirror them as JS constants for Recharts. Build a small set of focused, reusable admin presentation components on top of the existing shadcn primitives. Extract bug-prone logic (status mapping, threshold classification, CSV escaping) into pure modules under `src/app/lib/` covered by Vitest unit tests.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`, CSS-based config), shadcn/Radix UI primitives, Recharts 2.15, Vitest (new, dev-only).

## Global Constraints

- Node 22.5+ required (backend uses `node:sqlite`); do not break this.
- `@` is the Vite alias for `src/`. Import shared UI via `@/app/components/ui/...` and the `cn` helper from `@/app/components/ui/utils`.
- `npm install` must keep `legacy-peer-deps=true` (per `.npmrc`); do not drop it.
- No test runner/linter currently configured. Scripts are only `build`, `dev`, `dev:backend`. This plan ADDS a `test` script.
- `tsconfig` is `strict: false`; apply explicit types on exported APIs by hand.
- Honesty principle: shared components must never invent values — a missing value renders an explicit empty/`—` affordance chosen by the caller, never a fabricated number.
- Brand values (verbatim): navy `#0B1847`, blue `#1B44CC`, blue-strong `#2665D0`, surface-muted `#EEF2FE`. Detection defaults: PM2.5 `35` µg/m³, VOC `0.6`.

---

### Task 0: Add Vitest + verify environment

**Files:**
- Modify: `Vape/package.json` (add devDep + `test` script)
- Create: `Vape/vitest.config.ts`
- Create: `Vape/src/app/lib/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: a working `npm test` (Vitest, node environment) used by all later tasks.

- [ ] **Step 1: Confirm node + install state**

Run: `node -v` (expect v22.5+). Run from `Vape/`: `npm ls vitest || true` to confirm it's absent.

- [ ] **Step 2: Install Vitest**

Run from `Vape/`: `npm install -D vitest@2 --legacy-peer-deps`
Expected: adds `vitest` to devDependencies, no peer-dep errors.

- [ ] **Step 3: Add the test script**

In `Vape/package.json` `scripts`, add: `"test": "vitest run"` and `"test:watch": "vitest"`.

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
```

- [ ] **Step 5: Add a smoke test**

`src/app/lib/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('vitest', () => {
  it('runs', () => { expect(1 + 1).toBe(2) })
})
```

- [ ] **Step 6: Run tests**

Run from `Vape/`: `npm test`
Expected: 1 passing test.

- [ ] **Step 7: Commit**

```bash
git add package.json vitest.config.ts src/app/lib/__tests__/smoke.test.ts package-lock.json
git commit -m "chore: add vitest for pure-logic unit tests"
```

---

### Task 1: Design tokens (brand + status)

**Files:**
- Modify: `Vape/src/styles/theme.css` (add CSS vars to `:root` and `.dark`, map in `@theme inline`)
- Create: `Vape/src/app/theme/tokens.ts`
- Test: `Vape/src/app/theme/__tests__/tokens.test.ts`

**Interfaces:**
- Produces: Tailwind utilities `bg-brand-navy`, `text-brand-blue`, `bg-surface-muted`, `text-success|warning|danger|info|neutral` (and `bg-*`); JS constants `brand`, `status`, `chart` from `@/app/theme/tokens`.

- [ ] **Step 1: Add CSS variables to `:root` in `theme.css`** (inside the existing `:root { ... }` block, before its closing brace)

```css
  --brand-navy: #0B1847;
  --brand-blue: #1B44CC;
  --brand-blue-strong: #2665D0;
  --surface-muted: #EEF2FE;
  --status-success: #16a34a;
  --status-warning: #d97706;
  --status-danger: #dc2626;
  --status-info: #2563eb;
  --status-neutral: #6b7280;
```

- [ ] **Step 2: Add dark-mode overrides to `.dark` block** (lighter status tones for contrast on dark surfaces)

```css
  --status-success: #4ade80;
  --status-warning: #fbbf24;
  --status-danger: #f87171;
  --status-info: #60a5fa;
  --status-neutral: #9ca3af;
  --surface-muted: #0e1a3a;
```

- [ ] **Step 3: Map tokens in `@theme inline`** (inside the existing `@theme inline { ... }` block)

```css
  --color-brand-navy: var(--brand-navy);
  --color-brand-blue: var(--brand-blue);
  --color-brand-blue-strong: var(--brand-blue-strong);
  --color-surface-muted: var(--surface-muted);
  --color-success: var(--status-success);
  --color-warning: var(--status-warning);
  --color-danger: var(--status-danger);
  --color-info: var(--status-info);
  --color-neutral: var(--status-neutral);
```

- [ ] **Step 4: Create `src/app/theme/tokens.ts`**

```ts
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
} as const

export const chart = {
  pm25: brand.blue,
  voc: '#7c3aed',
  threshold: status.danger,
  grid: '#e5e7eb',
} as const

export type StatusTone = keyof typeof status
```

- [ ] **Step 5: Write tokens test**

`src/app/theme/__tests__/tokens.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { brand, status, chart } from '../tokens'

describe('tokens', () => {
  it('exposes brand navy and blue', () => {
    expect(brand.navy).toBe('#0B1847')
    expect(brand.blue).toBe('#1B44CC')
  })
  it('has all five status tones', () => {
    expect(Object.keys(status)).toEqual(['success', 'warning', 'danger', 'info', 'neutral'])
  })
  it('maps pm25 chart color to brand blue and threshold to danger', () => {
    expect(chart.pm25).toBe(brand.blue)
    expect(chart.threshold).toBe(status.danger)
  })
})
```

- [ ] **Step 6: Run tests + build**

Run: `npm test` (expect tokens tests pass). Run: `npm run build` (expect Tailwind compiles with new tokens, no errors).

- [ ] **Step 7: Commit**

```bash
git add src/styles/theme.css src/app/theme/tokens.ts src/app/theme/__tests__/tokens.test.ts
git commit -m "feat: add AeroSense brand + semantic status design tokens"
```

---

### Task 2: `lib/status.ts` — status → label/tone mapping

**Files:**
- Create: `Vape/src/app/lib/status.ts`
- Test: `Vape/src/app/lib/status.test.ts`

**Interfaces:**
- Consumes: `StatusTone` from `@/app/theme/tokens`.
- Produces: `StatusMeta { label: string; tone: StatusTone }`; functions `deviceStatus(s?)`, `alertStatus(s?)`, `severityStatus(s?)`; `toneClasses: Record<StatusTone, string>` (Tailwind classes for badges).

- [ ] **Step 1: Write failing test**

`src/app/lib/status.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { deviceStatus, alertStatus, severityStatus, toneClasses } from './status'

describe('status mapping', () => {
  it('maps device online to success', () => {
    expect(deviceStatus('online')).toEqual({ label: 'Online', tone: 'success' })
  })
  it('maps device offline to danger', () => {
    expect(deviceStatus('offline').tone).toBe('danger')
  })
  it('alert status is case-insensitive', () => {
    expect(alertStatus('active').tone).toBe('danger')
    expect(alertStatus('RESOLVED').tone).toBe('success')
    expect(alertStatus('false_alarm').label).toBe('False alarm')
  })
  it('severity critical is danger', () => {
    expect(severityStatus('critical').tone).toBe('danger')
  })
  it('unknown falls back to neutral with raw label', () => {
    expect(deviceStatus('weird')).toEqual({ label: 'weird', tone: 'neutral' })
    expect(alertStatus(undefined)).toEqual({ label: 'Unknown', tone: 'neutral' })
  })
  it('exposes a class string per tone', () => {
    expect(typeof toneClasses.success).toBe('string')
    expect(Object.keys(toneClasses)).toHaveLength(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- status` → FAIL ("Cannot find module './status'").

- [ ] **Step 3: Implement `src/app/lib/status.ts`**

```ts
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
}

const SEVERITY: Record<string, StatusMeta> = {
  low: { label: 'Low', tone: 'neutral' },
  medium: { label: 'Medium', tone: 'info' },
  high: { label: 'High', tone: 'warning' },
  critical: { label: 'Critical', tone: 'danger' },
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

export const toneClasses: Record<StatusTone, string> = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  neutral: 'bg-gray-100 text-gray-600',
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- status` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/lib/status.ts src/app/lib/status.test.ts
git commit -m "feat: add shared status-to-tone mapping with tests"
```

---

### Task 3: `lib/thresholds.ts` — effective threshold + reading classification

**Files:**
- Create: `Vape/src/app/lib/thresholds.ts`
- Test: `Vape/src/app/lib/thresholds.test.ts`

**Interfaces:**
- Produces: `DEFAULT_PM25_THRESHOLD=35`, `DEFAULT_VOC_THRESHOLD=0.6`; `ThresholdSource { pm25Threshold?; vocThreshold? }`; `effectivePm25Threshold(device?, settings?)`, `effectiveVocThreshold(device?, settings?)`; `ReadingLevel = 'normal'|'warning'|'critical'`; `classifyReading(value, threshold): ReadingLevel`. Used by Devices, DeviceDetail, Dashboard, Analytics.

- [ ] **Step 1: Write failing test**

`src/app/lib/thresholds.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PM25_THRESHOLD, effectivePm25Threshold, effectiveVocThreshold, classifyReading,
} from './thresholds'

describe('thresholds', () => {
  it('prefers device threshold, then settings, then default', () => {
    expect(effectivePm25Threshold({ pm25Threshold: 50 }, 42)).toBe(50)
    expect(effectivePm25Threshold({ pm25Threshold: null }, 42)).toBe(42)
    expect(effectivePm25Threshold(null, null)).toBe(DEFAULT_PM25_THRESHOLD)
    expect(effectiveVocThreshold(null, null)).toBe(0.6)
  })
  it('classifies readings relative to threshold', () => {
    expect(classifyReading(20, 35)).toBe('normal')
    expect(classifyReading(30, 35)).toBe('warning') // >= 80% of threshold
    expect(classifyReading(40, 35)).toBe('critical') // >= threshold
  })
  it('is safe on bad input', () => {
    expect(classifyReading(NaN, 35)).toBe('normal')
    expect(classifyReading(10, 0)).toBe('normal')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- thresholds` → FAIL.

- [ ] **Step 3: Implement `src/app/lib/thresholds.ts`**

```ts
export const DEFAULT_PM25_THRESHOLD = 35
export const DEFAULT_VOC_THRESHOLD = 0.6

export interface ThresholdSource {
  pm25Threshold?: number | null
  vocThreshold?: number | null
}

function firstNum(...vals: Array<number | null | undefined>): number {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return NaN
}

export function effectivePm25Threshold(device?: ThresholdSource | null, settings?: number | null): number {
  const n = firstNum(device?.pm25Threshold, settings, DEFAULT_PM25_THRESHOLD)
  return Number.isFinite(n) ? n : DEFAULT_PM25_THRESHOLD
}

export function effectiveVocThreshold(device?: ThresholdSource | null, settings?: number | null): number {
  const n = firstNum(device?.vocThreshold, settings, DEFAULT_VOC_THRESHOLD)
  return Number.isFinite(n) ? n : DEFAULT_VOC_THRESHOLD
}

export type ReadingLevel = 'normal' | 'warning' | 'critical'

export function classifyReading(value: number, threshold: number): ReadingLevel {
  if (!Number.isFinite(value) || !Number.isFinite(threshold) || threshold <= 0) return 'normal'
  if (value >= threshold) return 'critical'
  if (value >= threshold * 0.8) return 'warning'
  return 'normal'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- thresholds` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/lib/thresholds.ts src/app/lib/thresholds.test.ts
git commit -m "feat: add threshold resolution + reading classification with tests"
```

---

### Task 4: `lib/csv.ts` — safe CSV export

**Files:**
- Create: `Vape/src/app/lib/csv.ts`
- Test: `Vape/src/app/lib/csv.test.ts`

**Interfaces:**
- Produces: `toCsv(rows, columns?): string` (pure, escaped, CRLF); `downloadCsv(filename, rows, columns?): void` (Blob-based). Replaces every `data:`-URI string-concat export across admin pages.

- [ ] **Step 1: Write failing test**

`src/app/lib/csv.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('returns empty string for no rows', () => {
    expect(toCsv([])).toBe('')
  })
  it('writes header + rows from object keys', () => {
    expect(toCsv([{ a: 1, b: 2 }])).toBe('a,b\r\n1,2')
  })
  it('escapes commas, quotes, and newlines', () => {
    const csv = toCsv([{ name: 'CR 2F, west', note: 'he said "hi"\nbye' }])
    expect(csv).toBe('name,note\r\n"CR 2F, west","he said ""hi""\nbye"')
  })
  it('respects an explicit column order and null/undefined', () => {
    expect(toCsv([{ a: 1, b: null }], ['b', 'a'])).toBe('b,a\r\n,1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- csv` → FAIL.

- [ ] **Step 3: Implement `src/app/lib/csv.ts`**

```ts
export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (!rows.length) return ''
  const cols = columns ?? Object.keys(rows[0])
  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const header = cols.map(escape).join(',')
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(',')).join('\r\n')
  return header + '\r\n' + body
}

export function downloadCsv(
  filename: string,
  rows: Array<Record<string, unknown>>,
  columns?: string[],
): void {
  const csv = toCsv(rows, columns)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- csv` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/lib/csv.ts src/app/lib/csv.test.ts
git commit -m "feat: add Blob-based CSV export with proper escaping"
```

---

### Task 5: `StatusBadge` component

**Files:**
- Create: `Vape/src/app/components/admin/StatusBadge.tsx`

**Interfaces:**
- Consumes: `Badge` from `@/app/components/ui/badge`, `cn` from `@/app/components/ui/utils`, `StatusMeta`/`toneClasses` from `@/app/lib/status`.
- Produces: `<StatusBadge status={StatusMeta} className?/>`. Callers do `alertStatus(a.status)` / `deviceStatus(d.status)` to build the `status` prop.

- [ ] **Step 1: Implement component**

```tsx
import { Badge } from '@/app/components/ui/badge'
import { cn } from '@/app/components/ui/utils'
import { toneClasses, type StatusMeta } from '@/app/lib/status'

interface StatusBadgeProps {
  status: StatusMeta
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn('border-transparent font-medium', toneClasses[status.tone], className)}>
      {status.label}
    </Badge>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build` → succeeds (or `npx tsc --noEmit`).

- [ ] **Step 3: Commit**

```bash
git add src/app/components/admin/StatusBadge.tsx
git commit -m "feat: add shared StatusBadge admin component"
```

---

### Task 6: `MetricCard` component

**Files:**
- Create: `Vape/src/app/components/admin/MetricCard.tsx`

**Interfaces:**
- Consumes: `cn` from `@/app/components/ui/utils`, `StatusTone` from `@/app/theme/tokens`.
- Produces: `<MetricCard label value sub? tone? icon? />`. `value` is a `ReactNode` the caller supplies from real data (no fabricated default). `tone` colors the value text.

- [ ] **Step 1: Implement component**

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/app/components/ui/utils'
import type { StatusTone } from '@/app/theme/tokens'

interface MetricCardProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: StatusTone
  icon?: ReactNode
}

const toneText: Record<StatusTone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  neutral: 'text-foreground',
}

export function MetricCard({ label, value, sub, tone = 'neutral', icon }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <div className={cn('mt-1 text-2xl font-medium', toneText[tone])}>{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit` (or `npm run build`) → succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/admin/MetricCard.tsx
git commit -m "feat: add MetricCard admin component"
```

---

### Task 7: `PageHeader` component

**Files:**
- Create: `Vape/src/app/components/admin/PageHeader.tsx`

**Interfaces:**
- Produces: `<PageHeader title subtitle? actions? />` — standard admin page header (title + optional subtitle + right-aligned actions slot).

- [ ] **Step 1: Implement component**

```tsx
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-medium text-foreground">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npx tsc --noEmit
git add src/app/components/admin/PageHeader.tsx
git commit -m "feat: add PageHeader admin component"
```

---

### Task 8: `AsyncBoundary` (loading / empty / error states)

**Files:**
- Create: `Vape/src/app/components/admin/AsyncBoundary.tsx`

**Interfaces:**
- Consumes: `Skeleton` from `@/app/components/ui/skeleton`, `Button` from `@/app/components/ui/button`, lucide icons.
- Produces: `<AsyncBoundary loading error? empty? emptyLabel? onRetry? children />` — renders skeleton while loading, an error panel with optional retry, an empty panel, otherwise `children`. This is the single source for the spec's "three explicit states everywhere."

- [ ] **Step 1: Implement component**

```tsx
import type { ReactNode } from 'react'
import { AlertCircle, Inbox } from 'lucide-react'
import { Skeleton } from '@/app/components/ui/skeleton'
import { Button } from '@/app/components/ui/button'

interface AsyncBoundaryProps {
  loading: boolean
  error?: string | null
  empty?: boolean
  emptyLabel?: string
  onRetry?: () => void
  children: ReactNode
}

export function AsyncBoundary({ loading, error, empty, emptyLabel = 'Nothing to show yet', onRetry, children }: AsyncBoundaryProps) {
  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12 text-center">
        <AlertCircle className="mb-3 h-8 w-8 text-danger" />
        <p className="font-medium text-foreground">Couldn’t load this</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error}</p>
        {onRetry ? <Button variant="outline" className="mt-4" onClick={onRetry}>Retry</Button> : null}
      </div>
    )
  }
  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12 text-center">
        <Inbox className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-medium text-foreground">{emptyLabel}</p>
      </div>
    )
  }
  return <>{children}</>
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npx tsc --noEmit
git add src/app/components/admin/AsyncBoundary.tsx
git commit -m "feat: add AsyncBoundary for consistent loading/empty/error states"
```

---

### Task 9: `ChartCard` wrapper

**Files:**
- Create: `Vape/src/app/components/admin/ChartCard.tsx`

**Interfaces:**
- Produces: `<ChartCard title actions? children />` — a titled card wrapper for Recharts content (used by Dashboard + Analytics in later phases).

- [ ] **Step 1: Implement component**

```tsx
import type { ReactNode } from 'react'

interface ChartCardProps {
  title: string
  actions?: ReactNode
  children: ReactNode
}

export function ChartCard({ title, actions, children }: ChartCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Type-check + build (final gate)**

Run: `npm run build` → succeeds. Run: `npm test` → all pure-logic tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/admin/ChartCard.tsx
git commit -m "feat: add ChartCard wrapper for Recharts content"
```

---

## Self-Review

**Spec coverage (Phase 1 / spec §6 + §11.1):**
- tokens → Task 1 ✓
- PageHeader → Task 7 ✓; MetricCard → Task 6 ✓; StatusBadge + lib/status → Tasks 5 + 2 ✓; AsyncBoundary → Task 8 ✓; ChartCard → Task 9 ✓; lib/csv → Task 4 ✓; lib/thresholds → Task 3 ✓; Vitest + tests → Task 0 + tests in 1–4 ✓.

**Placeholder scan:** No TBD/TODO; every code step contains complete code; every test step shows assertions.

**Type consistency:** `StatusTone` defined in Task 1 (`tokens.ts`), consumed by Tasks 2 (status), 6 (MetricCard). `StatusMeta` defined in Task 2, consumed by Task 5. `ThresholdSource`/`classifyReading` defined in Task 3, consumed in later phases. `toCsv`/`downloadCsv` defined in Task 4. Names are consistent across tasks.

**Out-of-scope guard:** No page rewrites here (those are Phases 2–7). This phase only adds new files + token CSS; it does not modify existing pages, so it cannot regress current behavior.
