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
