import type { LucideIcon } from 'lucide-react'
import { TrendIndicator } from '@/components/charts/TrendIndicator'
import { cn } from '@/utils/cn'

interface MetricCardProps {
  label: string
  amount: number
  icon: LucideIcon
  /** Semantic tint — reuse the app's meaning-carrying accents (§2), never
   * decorative color. */
  tone: 'income' | 'expense' | 'neutral'
  trend?: number | null
  trendPositiveDirection?: 'up' | 'down'
}

const TONE_CLASSES: Record<MetricCardProps['tone'], string> = {
  income: 'bg-income-subtle text-income',
  expense: 'bg-expense-subtle text-expense',
  neutral: 'bg-neutral-100 text-text-secondary dark:bg-neutral-800',
}

export function MetricCard({
  label,
  amount,
  icon: Icon,
  tone,
  trend,
  trendPositiveDirection = 'up',
}: MetricCardProps) {
  return (
    <div className="flex flex-col gap-12 rounded-lg border border-border bg-surface-card p-16 shadow-card">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'flex size-32 items-center justify-center rounded-full',
            TONE_CLASSES[tone]
          )}
        >
          <Icon className="size-16" aria-hidden="true" />
        </span>
        {trend !== undefined && (
          <TrendIndicator value={trend} positiveDirection={trendPositiveDirection} />
        )}
      </div>
      <div>
        <p className="text-body-sm text-text-secondary">{label}</p>
        <p className="text-h2 tabular-nums text-text-primary">
          {amount < 0 ? '−' : ''}₹{Math.abs(amount).toLocaleString('en-IN')}
        </p>
      </div>
    </div>
  )
}
