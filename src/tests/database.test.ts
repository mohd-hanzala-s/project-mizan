import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/database/db'

describe('database seeding', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('seeds the five default accounts (§6)', async () => {
    const accounts = await db.accounts.toArray()
    expect(accounts).toHaveLength(5)
    expect(accounts.map((a) => a.name).sort()).toEqual(
      ['Bank Account', 'Cash', 'Credit Card', 'Emergency Fund', 'UPI Wallet'].sort()
    )
    accounts.forEach((a) => expect(a.currentBalance).toBe(0))
  })

  it('seeds default categories', async () => {
    const categories = await db.categories.toArray()
    expect(categories.length).toBeGreaterThan(0)
    expect(categories.every((c) => c.isDefault)).toBe(true)
  })

  it('seeds one settings row with budgetMonthStart on the 1st', async () => {
    const settings = await db.settings.get('active')
    expect(settings).toBeDefined()
    expect(settings?.budgetMonthStart).toBe(1)
    expect(settings?.onboardingCompleted).toBe(false)
    expect(settings?.currency).toBe('INR')
  })
})
