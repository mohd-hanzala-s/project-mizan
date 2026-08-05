import { useMemo } from 'react'
import type { CalendarEvent } from '@/services/CalendarService'
import { getDayEvents, getDaySummary } from '@/services/CalendarService'
import { cn } from '@/utils/cn'

interface WeekStripProps {
  weekStart: Date
  events: CalendarEvent[]
  selectedDate: Date | null
  onSelectDay: (date: Date) => void
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export function WeekStrip({ weekStart, events, selectedDate, onSelectDay }: WeekStripProps) {
  const today = new Date()

  const days = useMemo(() => {
    return Array.from(
      { length: 7 },
      (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)
    )
  }, [weekStart])

  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-md border border-border bg-surface-card">
      {days.map((date, i) => {
        const dayEvents = getDayEvents(events, date)
        const summary = getDaySummary(dayEvents)
        const isToday = date.toDateString() === today.toDateString()
        const isSelected =
          selectedDate !== null &&
          selectedDate.getFullYear() === date.getFullYear() &&
          selectedDate.getMonth() === date.getMonth() &&
          selectedDate.getDate() === date.getDate()

        return (
          <button
            key={date.toISOString()}
            type="button"
            onClick={() => onSelectDay(date)}
            aria-label={`${WEEKDAY_LABELS[i]} ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}`}
            className={cn(
              'flex min-h-touch flex-col items-center gap-4 py-8 transition-colors duration-fast',
              isSelected ? 'bg-income-subtle' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
            )}
          >
            <span className="text-caption font-medium text-text-tertiary">{WEEKDAY_LABELS[i]}</span>
            <span
              className={cn(
                'flex size-32 items-center justify-center rounded-full text-body font-medium tabular-nums',
                isToday ? 'bg-income text-white' : 'text-text-primary',
                isSelected && !isToday && 'text-income'
              )}
            >
              {date.getDate()}
            </span>
            <span
              className={cn(
                'text-caption tabular-nums',
                summary.net < 0
                  ? 'text-expense'
                  : summary.net > 0
                    ? 'text-income'
                    : 'text-text-tertiary'
              )}
            >
              {summary.count > 0 ? `${summary.count} evt` : '·'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
