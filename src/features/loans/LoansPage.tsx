import { useEffect, useMemo, useState } from 'react'
import { Landmark, Plus } from 'lucide-react'
import { useLoansStore } from './loansStore'
import { LoanService } from '@/services/LoanService'
import { LoanCard } from '@/components/finance/LoanCard'
import { LoanForm } from './LoanForm'
import { PaymentForm } from './PaymentForm'
import { BottomSheet } from '@/components/layout/BottomSheet'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/useToast'
import type { Loan, LoanPayment } from '@/types/entities'

type Sheet =
  | { kind: 'add' }
  | { kind: 'edit'; loan: Loan }
  | { kind: 'payment'; loan: Loan }

export function LoansPage() {
  const loans = useLoansStore((s) => s.loans)
  const payments = useLoansStore((s) => s.payments)
  const load = useLoansStore((s) => s.load)

  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<Loan | null>(null)
  const [confirmingReverse, setConfirmingReverse] = useState<{
    loan: Loan
    payment: LoanPayment
  } | null>(null)
  const { show } = useToast()

  useEffect(() => {
    load()
  }, [load])

  const paymentsByLoan = useMemo(() => {
    const map = new Map<string, LoanPayment[]>()
    for (const p of payments) {
      const list = map.get(p.loanId) ?? []
      list.push(p)
      map.set(p.loanId, list)
    }
    return map
  }, [payments])

  const activeLoans = loans.filter((l) => l.status === 'active')
  const completedLoans = loans.filter((l) => l.status === 'completed')

  async function refresh() {
    await load()
  }

  async function handleSaved() {
    setSheet(null)
    await refresh()
    show(sheet?.kind === 'edit' ? 'Loan updated' : sheet?.kind === 'payment' ? 'Payment recorded' : 'Loan created')
  }

  async function handleDelete() {
    if (!confirmingDelete) return
    await LoanService.delete(confirmingDelete.id)
    setConfirmingDelete(null)
    await refresh()
    show('Loan deleted')
  }

  async function handleReverse() {
    if (!confirmingReverse) return
    const { loan, payment } = confirmingReverse
    await LoanService.deletePayment(loan.id, payment.id)
    setConfirmingReverse(null)
    await refresh()
    show('Payment reversed')
  }

  if (loans.length === 0) {
    return (
      <>
        <EmptyState
          icon={Landmark}
          title="No loans yet"
          description="Track home loans, car loans, or EMIs — record payments, watch the balance shrink, and see when you'll be debt-free."
          actionLabel="Add a loan"
          onAction={() => setSheet({ kind: 'add' })}
        />
        <BottomSheet open={sheet !== null} onClose={() => setSheet(null)} title="New Loan">
          {sheet?.kind === 'add' && (
            <LoanForm onSaved={handleSaved} onCancel={() => setSheet(null)} />
          )}
        </BottomSheet>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-16 p-16 md:p-24">
      <div className="flex items-center justify-between">
        <h1 className="text-h2 text-text-primary">Loans</h1>
        <Button variant="secondary" size="sm" onClick={() => setSheet({ kind: 'add' })}>
          <Plus className="size-16" aria-hidden="true" />
          Add
        </Button>
      </div>

      {activeLoans.length > 0 && (
        <section className="flex flex-col gap-12">
          <h2 className="text-overline text-text-tertiary">Active</h2>
          {activeLoans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              payments={paymentsByLoan.get(loan.id) ?? []}
              onEdit={() => setSheet({ kind: 'edit', loan })}
              onRecordPayment={() => setSheet({ kind: 'payment', loan })}
              onDelete={() => setConfirmingDelete(loan)}
              onReversePayment={(payment) => setConfirmingReverse({ loan, payment })}
            />
          ))}
        </section>
      )}

      {completedLoans.length > 0 && (
        <section className="flex flex-col gap-12">
          <h2 className="text-overline text-text-tertiary">Completed</h2>
          {completedLoans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              payments={paymentsByLoan.get(loan.id) ?? []}
              onEdit={() => setSheet({ kind: 'edit', loan })}
              onRecordPayment={() => setSheet({ kind: 'payment', loan })}
              onDelete={() => setConfirmingDelete(loan)}
              onReversePayment={(payment) => setConfirmingReverse({ loan, payment })}
            />
          ))}
        </section>
      )}

      <BottomSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        title={
          sheet?.kind === 'edit'
            ? 'Edit Loan'
            : sheet?.kind === 'payment'
              ? 'Record Payment'
              : 'New Loan'
        }
      >
        {sheet?.kind === 'add' && (
          <LoanForm onSaved={handleSaved} onCancel={() => setSheet(null)} />
        )}
        {sheet?.kind === 'edit' && (
          <LoanForm
            editing={sheet.loan}
            onSaved={handleSaved}
            onCancel={() => setSheet(null)}
          />
        )}
        {sheet?.kind === 'payment' && (
          <PaymentForm
            loan={sheet.loan}
            onSaved={handleSaved}
            onCancel={() => setSheet(null)}
          />
        )}
      </BottomSheet>

      <ConfirmationDialog
        open={confirmingDelete !== null}
        title="Delete this loan?"
        description="This permanently removes the loan and its full payment history."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(null)}
      />

      <ConfirmationDialog
        open={confirmingReverse !== null}
        title="Reverse this payment?"
        description="The loan balance is restored by this payment's principal. Other payments keep their stored balance snapshots."
        confirmLabel="Reverse"
        onConfirm={handleReverse}
        onCancel={() => setConfirmingReverse(null)}
      />
    </div>
  )
}
