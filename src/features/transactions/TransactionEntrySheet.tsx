import { useState } from 'react'
import { SmartEntryInput } from './SmartEntryInput'
import { TransferForm } from './TransferForm'
import { useTransactionsStore } from './transactionsStore'
import { cn } from '@/utils/cn'

export function TransactionEntrySheet() {
  const editingTransaction = useTransactionsStore((s) => s.editingTransaction)
  const handleSaved = useTransactionsStore((s) => s.handleSaved)
  const [mode, setMode] = useState<'entry' | 'transfer'>('entry')

  const isEditing = Boolean(editingTransaction)

  return (
    <div className="flex flex-col gap-16">
      {!isEditing && (
        <div className="inline-flex self-start rounded-md bg-neutral-100 p-4 dark:bg-neutral-800">
          {(['entry', 'transfer'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'min-h-touch rounded-sm px-16 text-body-sm font-medium transition-colors duration-fast',
                mode === m ? 'bg-surface-card text-text-primary shadow-card' : 'text-text-secondary'
              )}
            >
              {m === 'entry' ? 'Expense / Income' : 'Transfer'}
            </button>
          ))}
        </div>
      )}

      {mode === 'transfer' && !isEditing ? (
        <TransferForm onSaved={(t) => handleSaved(t, false)} />
      ) : (
        <SmartEntryInput
          key={editingTransaction?.id ?? 'new'}
          editingId={editingTransaction?.id}
          initial={
            editingTransaction
              ? {
                  amount: editingTransaction.amount,
                  description: editingTransaction.description,
                  type: editingTransaction.type === 'income' ? 'income' : 'expense',
                  categoryId: editingTransaction.categoryId,
                  accountId: editingTransaction.accountId,
                }
              : undefined
          }
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
