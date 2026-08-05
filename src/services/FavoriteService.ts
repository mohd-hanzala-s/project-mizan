import { db } from '@/database/db'
import { FavoriteRepository } from '@/repositories/FavoriteRepository'
import type { Favorite, Transaction } from '@/types/entities'

export const FavoriteService = {
  /** Toggles Transaction.isFavorite and keeps a matching Favorite template
   * (by description/title) in sync — created on first favorite, removed if
   * no other transaction still uses that title. */
  async toggle(transaction: Transaction): Promise<void> {
    const nextIsFavorite = !transaction.isFavorite
    await db.transactions.update(transaction.id, { isFavorite: nextIsFavorite })

    const existing = await FavoriteRepository.findByTitle(transaction.description)

    if (nextIsFavorite && !existing) {
      const favorite: Favorite = {
        id: crypto.randomUUID(),
        title: transaction.description,
        amount: transaction.amount,
        categoryId: transaction.categoryId,
        usageCount: 1,
        lastUsed: new Date().toISOString(),
      }
      await FavoriteRepository.add(favorite)
    } else if (!nextIsFavorite && existing) {
      await FavoriteRepository.remove(existing.id)
    }
  },

  /** Bumps usage stats when a favorite is used for one-tap re-entry from
   * Smart Entry. */
  async recordUsage(favoriteId: string): Promise<void> {
    const favorite = await FavoriteRepository.getById(favoriteId)
    if (!favorite) return
    await FavoriteRepository.update(favoriteId, {
      usageCount: favorite.usageCount + 1,
      lastUsed: new Date().toISOString(),
    })
  },
}
