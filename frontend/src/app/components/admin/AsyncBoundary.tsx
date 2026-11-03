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

export function AsyncBoundary({
  loading,
  error,
  empty,
  emptyLabel = 'Nothing to show yet',
  onRetry,
  children,
}: AsyncBoundaryProps) {
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
        <p className="font-medium text-foreground">Couldn&rsquo;t load this</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error}</p>
        {onRetry ? (
          <Button variant="outline" className="mt-4" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
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
