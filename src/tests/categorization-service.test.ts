import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/database/db'
import { TransactionService } from '@/services/TransactionService'
import { CategorizationService } from '@/services/CategorizationService'

describe('CategorizationService', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('falls back to the keyword dictionary when there is no history', async () => {
    const suggestion = await CategorizationService.suggest('evening tea')
    expect(suggestion.categoryId).toBe('cat-food')
    expect(suggestion.source).toBe('keyword')
    expect(suggestion.confidence).toBeLessThan(0.7) // keyword tier asks the user, per §7
  })

  it('returns no suggestion for text matching nothing', async () => {
    const suggestion = await CategorizationService.suggest('xyzzyplugh')
    expect(suggestion.source).toBe('none')
  })

  it('prefers an exact historical match over the keyword dictionary', async () => {
    // "tea" alone matches the keyword dictionary, but if the user has
    // logged this exact description before under a different category,
    // that history should win.
    await TransactionService.create({
      amount: 100,
      description: 'tea',
      type: 'expense',
      categoryId: 'cat-entertainment', // deliberately not cat-food
      accountId: 'acc-cash',
      transactionDate: new Date().toISOString(),
    })

    const suggestion = await CategorizationService.suggest('tea')
    expect(suggestion.categoryId).toBe('cat-entertainment')
    expect(suggestion.source).toBe('exact')
    expect(suggestion.confidence).toBe(1)
  })

  it('prefers a favorite match over the keyword dictionary (with no matching transaction history)', async () => {
    const { FavoriteRepository } = await import('@/repositories/FavoriteRepository')
    await FavoriteRepository.add({
      id: 'fav-1',
      title: 'Office lunch',
      amount: 500,
      categoryId: 'cat-entertainment',
      usageCount: 1,
      lastUsed: new Date().toISOString(),
    })

    const suggestion = await CategorizationService.suggest('office lunch')
    expect(suggestion.categoryId).toBe('cat-entertainment')
    expect(suggestion.source).toBe('favorite')
    expect(suggestion.confidence).toBeGreaterThanOrEqual(0.9)
  })
})
