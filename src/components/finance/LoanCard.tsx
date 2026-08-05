import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronDown, ChevronUp, Landmark, Pencil, Plus, Trash2, Undo2 } from 'lucide-react'
import type { Loan, LoanPayment } from '@/types/entities'
import {
  getPayoffForecast,
  isOverdue,
  nextDueDate,
} from '@/services/LoanService'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

interface LoanCardProps {
  loan: Loan
  payments: LoanPayment[]
  onEdit: () => void
  onRecordPayment: () => void
  onDelete: () => void
  onReversePayment: (payment: LoanPayment) => void
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

export function LoanCard({
  loan,
  payments,
  onEdit,
  onRecordPayment,
  onDelete,
  onReversePayment,
}: LoanCardProps) {
  const [expanded, setExpanded] = useState(false)
  const overdue = isOverdue(loan, payments)
  const next = nextDueDate(loan)
  const forecast = getPayoffForecast(loan)
  const repaidPercent = Math.min(100, Math.round(forecast.progress * 100))

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-border bg-surface-card">
      <div className="flex flex-col gap-12 p-16">
        <div className="flex items-start justify-between gap-8">
          <div className="min-w-0">
            <div className="flex items-center gap-8">
              <span className="flex size-32 shrink-0 items-center justify-center rounded-full bg-liability-subtle text-liability">
                <Landmark className="size-16" aria-hidden="true" />
              </span>
              <p className="truncate text-body font-medium text-text-primary">{loan.loanName}</p>
            </div>
            <p className="mt-8 truncate text-body-sm text-text-secondary">
              {loan.lender || 'Unknown lender'}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-4">
            <span className="text-body-lg font-semibold tabular-nums text-liability">
              {inr(loan.monthlyEMI)}
              <span className="text-caption font-normal text-text-tertiary"> /mo</span>
            </span>
            <span
              className={cn(
                'rounded-full px-8 py-4 text-caption font-medium',
                loan.status === 'completed'
                  ? 'bg-income-subtle text-income'
                  : overdue
                    ? 'bg-expense-subtle text-expense'
                    : 'bg-neutral-100 text-text-secondary dark:bg-neutral-800'
              )}
            >
              {loan.status === 'completed' ? 'Completed' : overdue ? 'Overdue' : 'Active'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-body-sm text-text-secondary">
          <span className="tabular-nums">{inr(loan.currentBalance)} outstanding</span>
          <span className="tabular-nums">{repaidPercent}% repaid</span>
        </div>
        <div className="h-8 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
          <div
            className={cn(
              'h-8 rounded-full transition-[width] duration-standard',
              overdue ? 'bg-warning' : 'bg-liability'
            )}
            style={{ width: `${repaidPercent}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-8 text-body-sm">
          <div>
            <p className="text-overline text-text-tertiary">Remaining EMIs</p>
            <p className="mt-4 font-medium tabular-nums text-text-primary">
              {forecast.remainingEmis === null ? '—' : forecast.remainingEmis}
            </p>
          </div>
          <div>
            <p className="text-overline text-text-tertiary">Estimated completion</p>
            <p className="mt-4 font-medium tabular-nums text-text-primary">
              {forecast.completionDate ? format(forecast.completionDate, 'd MMM yyyy') : '—'}
            </p>
          </div>
          <div>
            <p className="text-overline text-text-tertiary">Next due</p>
            <p className="mt-4 font-medium tabular-nums text-text-primary">
              {next ? format(next, 'd MMM yyyy') : '—'}
            </p>
          </div>
          <div>
            <p className="text-overline text-text-tertiary">Interest</p>
            <p className="mt-4 font-medium tabular-nums text-text-primary">
              {loan.interestRate ? `${loan.interestRate}% p.a.` : 'Not tracked'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-8 border-t border-border-subtle pt-12">
          <Button variant="tertiary" size="sm" onClick={onEdit} disabled={loan.status === 'completed'}>
            <Pencil className="size-16" aria-hidden="true" />
            Edit
          </Button>
          <Button variant="secondary" size="sm" onClick={onRecordPayment} disabled={loan.status === 'completed'}>
            <Plus className="size-16" aria-hidden="true" />
            Record payment
          </Button>
          <Button variant="tertiary" size="sm" onClick={onDelete}>
            <Trash2 className="size-16 text-expense" aria-hidden="true" />
            Delete
          </Button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto flex min-h-touch items-center gap-4 text-body-sm font-medium text-text-primary"
          >
            {payments.length > 0 ? `${payments.length} payments` : 'No payments yet'}
            {expanded ? (
              <ChevronUp className="size-16" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-16" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col divide-y divide-border-subtle border-t border-border bg-neutral-50 dark:bg-neutral-900">
          {payments.length === 0 ? (
            <p className="p-16 text-body-sm text-text-tertiary">
              No payments recorded yet. Record the first EMI to start paying down the loan.
            </p>
          ) : (
            payments.map((p) => (
              <div key={p.id} className="flex flex-col gap-8 px-16 py-12">
                <div className="flex items-center justify-between gap-8">
                  <div className="min-w-0">
                    <p className="text-body-sm text-text-secondary">
                      {format(new Date(`${p.paymentDate}T00:00:00`), 'd MMM yyyy')}
                    </p>
                    <p className="mt-4 text-caption text-text-tertiary">
                      Principal {inr(p.principalPaid)} · Interest {inr(p.interestPaid)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-8">
                    <span className="text-body-sm font-semibold tabular-nums text-text-primary">
                      {inr(p.amountPaid)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onReversePayment(p)}
                      aria-label={`Reverse payment of ${inr(p.amountPaid)}`}
                      className="flex size-32 items-center justify-center rounded-md text-text-tertiary transition-colors duration-fast hover:bg-neutral-100 hover:text-expense dark:hover:bg-neutral-800"
                    >
                      <Undo2 className="size-16" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
