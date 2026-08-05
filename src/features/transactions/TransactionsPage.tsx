import { useEffect, useMemo, useState } from 'react'
import { Receipt } from 'lucide-react'
import { useTransactionsStore } from './transactionsStore'
import { TransactionCard } from './TransactionCard'
import { SearchBar } from '@/components/forms/SearchBar'
import { FilterBar, type TypeFilter } from '@/components/forms/FilterBar'
import { EmptyState } from '@/components/common/EmptyState'
import { db } from '@/database/db'
import { isTransferCreditLeg } from '@/utils/transactions'
import type { Account, Category, Transaction } from '@/types/entities'

function groupByDate(transactions: Transaction[]): [string, Transaction[]][] {
  const groups = new Map<string, Transaction[]>()
  for (const t of transactions) {
    const key = new Date(t.transactionDate).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  return [...groups.entries()]
}

/** §6 broad search: description, amount, category name, account name,
 * tags, notes — case-insensitive substring match. */
function matchesSearch(
  t: Transaction,
  query: string,
  category: Category | undefined,
  account: Account | undefined
): boolean {
  if (!query) return true
  const haystack = [
    t.description,
    t.notes,
    String(t.amount),
    category?.name,
    account?.name,
    ...t.tags,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query.toLowerCase())
}

export function TransactionsPage() {
  const transactions = useTransactionsStore((s) => s.transactions)
  const isLoading = useTransactionsStore((s) => s.isLoading)
  const load = useTransactionsStore((s) => s.load)
  const openAddSheet = useTransactionsStore((s) => s.openAddSheet)
  const openEditSheet = useTransactionsStore((s) => s.openEditSheet)
  const deleteTransaction = useTransactionsStore((s) => s.deleteTransaction)
  const duplicateTransaction = useTransactionsStore((s) => s.duplicateTransaction)

  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    load()
    db.categories.toArray().then(setCategories)
    db.accounts.toArray().then(setAccounts)
  }, [load])

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  // Not a real category choice (every transfer gets it automatically), so
  // filtering by it in the chip row wouldn't mean anything to the user.
  const filterableCategories = useMemo(
    () => categories.filter((c) => c.id !== 'cat-transfers'),
    [categories]
  )

  const filtered = useMemo(() => {
    return (
      transactions
        // §6: "the user sees one transfer" — only the debit leg represents
        // it in a cross-account list; the credit leg only matters when
        // viewing the destination account's own history.
        .filter((t) => !isTransferCreditLeg(t))
        .filter((t) => (typeFilter === 'all' ? true : t.type === typeFilter))
        .filter((t) =>
          selectedCategoryIds.size === 0 ? true : selectedCategoryIds.has(t.categoryId)
        )
        .filter((t) =>
          matchesSearch(t, query, categoryById.get(t.categoryId), accountById.get(t.accountId))
        )
        .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
    )
  }, [transactions, typeFilter, selectedCategoryIds, query, categoryById, accountById])

  const grouped = useMemo(() => groupByDate(filtered), [filtered])

  function toggleCategory(categoryId: string) {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  if (isLoading) return null

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No transactions yet"
        description='Tap the + button and try something like "250 tea" to log your first one.'
        actionLabel="Add a transaction"
        onAction={openAddSheet}
      />
    )
  }

  return (
    <div className="flex flex-col gap-16 p-16 md:p-24">
      <SearchBar value={query} onChange={setQuery} />
      <FilterBar
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        categories={filterableCategories}
        selectedCategoryIds={selectedCategoryIds}
        onToggleCategory={toggleCategory}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No matches"
          description="Try a different search term or filter."
        />
      ) : (
        <div className="flex flex-col gap-24">
          {grouped.map(([dateLabel, items]) => (
            <div key={dateLabel} className="flex flex-col gap-8">
              <h2 className="text-overline text-text-tertiary">{dateLabel}</h2>
              <div className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-md border border-border">
                {items.map((t) => (
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
