import { Landmark } from 'lucide-react'
import type { BudgetStatus } from '@/services/BudgetService'
import type { Category } from '@/types/entities'
import { GLOBAL_BUDGET_CATEGORY_ID } from '@/types/entities'
import { DynamicIcon } from '@/components/common/DynamicIcon'
import { cn } from '@/utils/cn'

interface BudgetCardProps {
  status: BudgetStatus
  category: Category | undefined
  onClick?: () => void
}

const SEVERITY_BAR: Record<BudgetStatus['severity'], string> = {
  ok: 'bg-income',
  warning: 'bg-warning',
  over: 'bg-expense',
}

const SEVERITY_TEXT: Record<BudgetStatus['severity'], string> = {
  ok: 'text-text-secondary',
  warning: 'text-warning',
  over: 'text-expense',
}

export function BudgetCard({ status, category, onClick }: BudgetCardProps) {
  const isGlobal = status.budget.categoryId === GLOBAL_BUDGET_CATEGORY_ID
  const label = isGlobal ? 'Overall' : (category?.name ?? 'Uncategorized')
  const barWidth = Math.min(status.percentUsed, 100)

  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-8 rounded-md border border-border bg-surface-card p-16 text-left',
        onClick && 'transition-colors duration-fast hover:bg-neutral-100 dark:hover:bg-neutral-800'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-8 text-body font-medium text-text-primary">
          <span
            className="flex size-32 items-center justify-center rounded-full"
            style={{
              backgroundColor: isGlobal ? undefined : `${category?.color}22`,
              color: category?.color,
            }}
          >
            {isGlobal ? (
              <Landmark className="size-16" aria-hidden="true" />
            ) : category ? (
              <DynamicIcon name={category.icon} className="size-16" />
            ) : null}
          </span>
          {label}
        </span>
        <span
          className={cn('text-body-sm font-semibold tabular-nums', SEVERITY_TEXT[status.severity])}
        >
          {status.percentUsed.toFixed(0)}%
        </span>
      </div>

      <div className="h-8 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div
          className={cn(
            'h-8 rounded-full transition-[width] duration-standard',
            SEVERITY_BAR[status.severity]
          )}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-body-sm tabular-nums text-text-secondary">
        <span>
          ₹{status.spent.toLocaleString('en-IN')} of ₹{status.allocated.toLocaleString('en-IN')}
        </span>
        <span className={status.remaining < 0 ? 'text-expense' : undefined}>
          {status.remaining < 0 ? 'Over by ' : ''}₹
          {Math.abs(status.remaining).toLocaleString('en-IN')}
          {status.remaining >= 0 ? ' left' : ''}
        </span>
      </div>
    </Wrapper>
  )
}
