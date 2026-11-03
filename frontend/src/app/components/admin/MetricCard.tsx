import type { ReactNode } from 'react'
import { cn } from '@/app/components/ui/utils'
import type { StatusTone } from '@/app/theme/tokens'
import { AnimatedCounter } from '@/app/components/ui/AnimatedCounter'

interface MetricCardProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: StatusTone
  icon?: ReactNode
}

export function MetricCard({ label, value, sub, icon }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-600">{label}</span>
        {icon ? <span className="text-slate-400">{icon}</span> : null}
      </div>
      <div className={cn('mt-1.5 text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums')}>
        {typeof value === 'number' ? <AnimatedCounter value={value} duration={1200} /> : value}
      </div>
      {sub ? <div className="mt-0.5 text-xs font-medium text-slate-400">{sub}</div> : null}
    </div>
  )
}
