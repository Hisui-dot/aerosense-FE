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
