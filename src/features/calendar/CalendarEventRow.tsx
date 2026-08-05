import { format } from 'date-fns'
import { Landmark, Receipt, Repeat } from 'lucide-react'
import type { CalendarEvent, CalendarEventKind } from '@/services/CalendarService'
import { cn } from '@/utils/cn'

interface CalendarEventRowProps {
  event: CalendarEvent
}

const ICON: Record<CalendarEventKind, typeof Receipt> = {
  transaction: Receipt,
  recurring: Repeat,
  loan: Landmark,
}

const ICON_STYLE: Record<CalendarEventKind, string> = {
  transaction: 'bg-neutral-100 text-text-secondary dark:bg-neutral-800',
  recurring: 'bg-info-subtle text-info',
  loan: 'bg-liability-subtle text-liability',
}

export function CalendarEventRow({ event }: CalendarEventRowProps) {
  const Icon = ICON[event.kind]
  const isIn = event.amount > 0
  return (
    <div className="flex items-center justify-between gap-8 px-16 py-12">
      <div className="flex min-w-0 items-center gap-12">
        <span
          className={cn(
            'flex size-32 shrink-0 items-center justify-center rounded-full',
            ICON_STYLE[event.kind]
          )}
        >
          <Icon className="size-16" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-body font-medium text-text-primary">{event.title}</p>
          <p className="text-body-sm text-text-secondary">{format(event.date, 'd MMM yyyy')}</p>
        </div>
      </div>
      <span
        className={cn(
          'shrink-0 text-body font-semibold tabular-nums',
          isIn ? 'text-income' : event.kind === 'loan' ? 'text-liability' : 'text-expense'
        )}
      >
        {isIn ? '+' : '−'}₹{Math.abs(event.amount).toLocaleString('en-IN')}
      </span>
    </div>
  )
}
