import { db } from '@/database/db'
import type { Transaction } from '@/types/entities'

/** §6: "within a configurable window" — one calendar day either side. */
const WINDOW_DAYS = 1
const DAY_MS = 24 * 60 * 60 * 1000

export const DuplicateDetectionService = {
  /**
   * Returns the possible duplicate, if any. Excludes `excludeId` so editing
   * a transaction doesn't flag itself.
   */
  async findPossibleDuplicate(
    candidate: Pick<Transaction, 'amount' | 'description' | 'transactionDate' | 'accountId'>,
    excludeId?: string
  ): Promise<Transaction | null> {
    const candidateDate = new Date(candidate.transactionDate).getTime()
    const description = candidate.description.trim().toLowerCase()

    const sameAccount = await db.transactions
      .where('accountId')
      .equals(candidate.accountId)
      .toArray()

    const match = sameAccount.find((t) => {
      if (t.isDeleted || t.id === excludeId) return false
      if (t.amount !== candidate.amount) return false
      if (t.description.trim().toLowerCase() !== description) return false
      const diffDays = Math.abs(new Date(t.transactionDate).getTime() - candidateDate) / DAY_MS
      return diffDays <= WINDOW_DAYS
    })

    return match ?? null
  },
}
