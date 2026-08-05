import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { FavoriteRepository } from '@/repositories/FavoriteRepository'
import { FavoriteService } from '@/services/FavoriteService'
import { TransactionService } from '@/services/TransactionService'
import { useTransactionsStore } from '@/features/transactions/transactionsStore'
import type { Favorite } from '@/types/entities'

export function QuickAdd() {
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const load = useTransactionsStore((s) => s.load)
  const showUndo = useTransactionsStore((s) => s.showUndo)

  useEffect(() => {
    FavoriteRepository.getAll().then((all) => setFavorites(all.slice(0, 8)))
  }, [])

  async function handleTap(favorite: Favorite) {
    const transaction = await TransactionService.create({
      amount: favorite.amount,
      description: favorite.title,
      type: 'expense',
      categoryId: favorite.categoryId,
      accountId: 'acc-cash',
      transactionDate: new Date().toISOString(),
    })
    await FavoriteService.recordUsage(favorite.id)
    load()
    showUndo(`Added "${favorite.title}"`, async () => {
      await TransactionService.softDelete(transaction.id)
      load()
    })
  }

  if (favorites.length === 0) return null

  return (
    <div className="flex flex-col gap-8">
      <h2 className="flex items-center gap-4 text-overline text-text-tertiary">
        <Sparkles className="size-12" aria-hidden="true" /> Quick Add
      </h2>
      <div className="flex gap-8 overflow-x-auto pb-4">
        {favorites.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => handleTap(f)}
            className="min-h-touch shrink-0 rounded-full border border-border bg-surface-card px-16 text-body-sm font-medium text-text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {f.title} · ₹{f.amount.toLocaleString('en-IN')}
          </button>
        ))}
      </div>
    </div>
  )
}
