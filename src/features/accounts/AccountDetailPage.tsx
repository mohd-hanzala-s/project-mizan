import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Archive, WalletCards } from 'lucide-react'
import { useAccountsStore } from './accountsStore'
import { useTransactionsStore } from '@/features/transactions/transactionsStore'
import { AccountForm } from './AccountForm'
import { DynamicIcon } from '@/components/common/DynamicIcon'
import { TransactionCard } from '@/features/transactions/TransactionCard'
import { EmptyState } from '@/components/common/EmptyState'
import { BottomSheet } from '@/components/layout/BottomSheet'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { Button } from '@/components/ui/button'
import { AccountService } from '@/services/AccountService'
import { db } from '@/database/db'
import type { Category } from '@/types/entities'

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const accounts = useAccountsStore((s) => s.accounts)
  const archivedAccounts = useAccountsStore((s) => s.archivedAccounts)
  const loadAccounts = useAccountsStore((s) => s.load)
  const transactions = useTransactionsStore((s) => s.transactions)
  const loadTransactions = useTransactionsStore((s) => s.load)
  const openEditSheet = useTransactionsStore((s) => s.openEditSheet)
  const deleteTransaction = useTransactionsStore((s) => s.deleteTransaction)
  const duplicateTransaction = useTransactionsStore((s) => s.duplicateTransaction)

  const [categories, setCategories] = useState<Category[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)

  useEffect(() => {
    loadAccounts()
    loadTransactions()
    db.categories.toArray().then(setCategories)
  }, [loadAccounts, loadTransactions])

  const account = [...accounts, ...archivedAccounts].find((a) => a.id === id)
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const history = useMemo(
    () =>
      transactions
        .filter((t) => t.accountId === id)
        .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)),
    [transactions, id]
  )

  if (!account) {
    return (
      <EmptyState
        icon={WalletCards}
        title="Account not found"
        description="It may have been removed."
      />
    )
  }

  async function handleArchive() {
    setArchiveError(null)
    try {
      await AccountService.archive(account!.id)
      setArchiveConfirmOpen(false)
      loadAccounts()
      navigate('/accounts')
    } catch (e) {
      setArchiveError(e instanceof Error ? e.message : 'Could not archive this account.')
    }
  }

  return (
    <div className="flex flex-col gap-24 p-16 md:p-24">
      <button
        onClick={() => navigate('/accounts')}
        className="flex items-center gap-4 self-start text-body-sm font-medium text-text-secondary"
      >
        <ArrowLeft className="size-16" aria-hidden="true" /> Accounts
      </button>

      <div className="flex items-center gap-16 rounded-lg border border-border bg-surface-card p-16">
        <span
          className="flex size-48 items-center justify-center rounded-full"
          style={{ backgroundColor: `${account.color}22`, color: account.color }}
        >
          <DynamicIcon name={account.icon} className="size-24" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-h3 text-text-primary">{account.name}</p>
          <p
            className={`tabular-nums text-body-lg font-semibold ${account.currentBalance < 0 ? 'text-expense' : 'text-text-primary'}`}
          >
            {account.currentBalance < 0 ? '−' : ''}₹
            {Math.abs(account.currentBalance).toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {!account.isArchived && (
        <div className="flex gap-8">
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-16" aria-hidden="true" /> Edit
          </Button>
          <Button variant="tertiary" size="sm" onClick={() => setArchiveConfirmOpen(true)}>
            <Archive className="size-16" aria-hidden="true" /> Archive
          </Button>
        </div>
      )}
      {archiveError && <p className="text-body-sm text-expense">{archiveError}</p>}

      <div className="flex flex-col gap-8">
        <h2 className="text-overline text-text-tertiary">History</h2>
        {history.length === 0 ? (
          <p className="text-body-sm text-text-secondary">No transactions on this account yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-md border border-border">
            {history.map((t) => (
              <TransactionCard
                key={t.id}
                transaction={t}
                category={categoryById.get(t.categoryId)}
                onDelete={() => deleteTransaction(t)}
                onEdit={() => openEditSheet(t)}
                onDuplicate={() => duplicateTransaction(t)}
              />
            ))}
          </div>
        )}
      </div>

      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title="Edit Account">
        <AccountForm
          existing={account}
          onSaved={() => {
            setEditOpen(false)
            loadAccounts()
          }}
          onCancel={() => setEditOpen(false)}
        />
      </BottomSheet>

      <ConfirmationDialog
        open={archiveConfirmOpen}
        title={`Archive ${account.name}?`}
        description="You can restore it anytime from the Accounts screen. Its transaction history stays intact."
        confirmLabel="Archive"
        onConfirm={handleArchive}
        onCancel={() => setArchiveConfirmOpen(false)}
      />
    </div>
  )
}
