import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-16 px-24 py-96 text-center">
      <div className="flex size-64 items-center justify-center rounded-full bg-neutral-100 text-text-tertiary dark:bg-neutral-800">
        <Icon className="size-24" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="text-h3 text-text-primary">{title}</h2>
        <p className="max-w-[320px] text-body text-text-secondary">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction} className="mt-8">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
