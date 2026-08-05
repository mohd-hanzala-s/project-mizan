import { useEffect, useMemo, useState } from 'react'
import { PiggyBank, Plus } from 'lucide-react'
import { useBudgetsStore } from './budgetsStore'
import { useTransactionsStore } from '@/features/transactions/transactionsStore'
import { useSettingsStore } from '@/app/settingsStore'
import { BudgetService, computeBudgetStatus, type BudgetStatus } from '@/services/BudgetService'
import { BudgetCard } from '@/components/finance/BudgetCard'
import { BudgetForm } from './BudgetForm'
import { BottomSheet } from '@/components/layout/BottomSheet'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { db } from '@/database/db'
import type { Budget, Category } from '@/types/entities'

export function BudgetsPage() {
  const budgets = useBudgetsStore((s) => s.budgets)
  const loadBudgets = useBudgetsStore((s) => s.load)
  const transactions = useTransactionsStore((s) => s.transactions)
  const loadTransactions = useTransactionsStore((s) => s.load)
  const settings = useSettingsStore((s) => s.settings)

  const [categories, setCategories] = useState<Category[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | undefined>(undefined)
  const [confirmingDelete, setConfirmingDelete] = useState<Budget | null>(null)

  useEffect(() => {
    loadBudgets()
    loadTransactions()
    db.categories.toArray().then(setCategories)
  }, [loadBudgets, loadTransactions])

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const budgetMonthStart = settings?.budgetMonthStart ?? 1

  const statuses: BudgetStatus[] = useMemo(
    () => budgets.map((b) => computeBudgetStatus(b, transactions, budgetMonthStart)),
    [budgets, transactions, budgetMonthStart]
  )

  function openAdd() {
    setEditing(undefined)
    setSheetOpen(true)
  }

  function openEdit(budget: Budget) {
    setEditing(budget)
    setSheetOpen(true)
  }

  function handleSaved() {
    setSheetOpen(false)
    loadBudgets()
  }

  async function handleDelete() {
    if (!confirmingDelete) return
    await BudgetService.deactivate(confirmingDelete.id)
    setConfirmingDelete(null)
    loadBudgets()
  }

  if (budgets.length === 0) {
    return (
      <>
        <EmptyState
          icon={PiggyBank}
          title="No budgets yet"
          description="Set a monthly limit for a category, or an overall limit across everything, to see how you're tracking."
          actionLabel="Create a budget"
          onAction={openAdd}
        />
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="New Budget">
          <BudgetForm onSaved={handleSaved} onCancel={() => setSheetOpen(false)} />
        </BottomSheet>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-16 p-16 md:p-24">
      <div className="flex items-center justify-between">
        <h1 className="text-h2 text-text-primary">Budgets</h1>
        <Button variant="secondary" size="sm" onClick={openAdd}>
          <Plus className="size-16" aria-hidden="true" />
          Add
        </Button>
      </div>

      <div className="flex flex-col gap-12">
        {statuses.map((status) => (
          <BudgetCard
            key={status.budget.id}
            status={status}
            category={categoryById.get(status.budget.categoryId)}
            onClick={() => openEdit(status.budget)}
          />
        ))}
      </div>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? 'Edit Budget' : 'New Budget'}
      >
        <BudgetForm editing={editing} onSaved={handleSaved} onCancel={() => setSheetOpen(false)} />
        {editing && (
          <button
            type="button"
            onClick={() => {
              setSheetOpen(false)
              setConfirmingDelete(editing)
            }}
            className="mt-16 w-full text-center text-body-sm text-expense"
          >
            Delete this budget
          </button>
        )}
      </BottomSheet>

      <ConfirmationDialog
        open={confirmingDelete !== null}
        title="Delete this budget?"
        description="You can always set it up again later. This doesn't affect any transactions."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(null)}
      />
    </div>
  )
}
