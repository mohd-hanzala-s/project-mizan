import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/database/db'
import { TransactionService } from '@/services/TransactionService'
import { AccountRepository } from '@/repositories/AccountRepository'
import { TransactionRepository } from '@/repositories/TransactionRepository'
import { RecurringRepository } from '@/repositories/RecurringRepository'

const iso = (y: number, m: number, d: number) => new Date(y, m, d).toISOString()

async function cashBalance(): Promise<number> {
  const account = await AccountRepository.getById('acc-cash')
  return account!.currentBalance
}

async function seedRule(): Promise<string> {
  const rule = {
    id: crypto.randomUUID(),
    title: 'Rent',
    amount: 10000,
    type: 'expense' as const,
    categoryId: 'cat-utilities',
    accountId: 'acc-cash',
    frequency: 'monthly' as const,
    startDate: '2026-03-01',
    endDate: null,
    nextExecution: iso(2026, 4, 1),
    autoGenerate: true,
    reminderDays: 3,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await RecurringRepository.add(rule)
  return rule.id
}

describe('createScheduled (pending recurring entries)', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('creates a pending, auto-source entry with no balance effect', async () => {
    const ruleId = await seedRule()
    const t = await TransactionService.createScheduled({
      amount: 10000,
      description: 'Rent',
      type: 'expense',
      categoryId: 'cat-utilities',
      accountId: 'acc-cash',
      transactionDate: iso(2026, 4, 1),
      recurringRuleId: ruleId,
    })

    expect(t.status).toBe('pending')
    expect(t.source).toBe('auto')
    expect(t.recurringRuleId).toBe(ruleId)
    expect(t.type).toBe('expense')
    expect(await cashBalance()).toBe(0)
  })

  it('rejects a zero amount', async () => {
    const ruleId = await seedRule()
    await expect(
      TransactionService.createScheduled({
        amount: 0,
        description: 'Rent',
        type: 'expense',
        categoryId: 'cat-utilities',
        accountId: 'acc-cash',
        transactionDate: iso(2026, 4, 1),
        recurringRuleId: ruleId,
      })
    ).rejects.toThrow()
  })
})

describe('markPaid', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('applies the balance effect exactly once and flips status to paid', async () => {
    const ruleId = await seedRule()
    const t = await TransactionService.createScheduled({
      amount: 10000,
      description: 'Rent',
      type: 'expense',
      categoryId: 'cat-utilities',
      accountId: 'acc-cash',
      transactionDate: iso(2026, 4, 1),
      recurringRuleId: ruleId,
    })

    await TransactionService.markPaid(t.id)
    expect(await cashBalance()).toBe(-10000)

    // Idempotent — a second mark must not double-apply.
    await TransactionService.markPaid(t.id)
    expect(await cashBalance()).toBe(-10000)

    const paid = await db.transactions.get(t.id)
    expect(paid?.status).toBe('paid')
  })

  it('credits income pending entries on pay', async () => {
    const ruleId = await seedRule()
    const t = await TransactionService.createScheduled({
      amount: 45000,
      description: 'Salary',
      type: 'income',
      categoryId: 'cat-salary',
      accountId: 'acc-cash',
      transactionDate: iso(2026, 4, 1),
      recurringRuleId: ruleId,
    })
    await TransactionService.markPaid(t.id)
    expect(await cashBalance()).toBe(45000)
  })

  it('can mark a skipped entry paid', async () => {
    const ruleId = await seedRule()
    const t = await TransactionService.createScheduled({
      amount: 10000,
      description: 'Rent',
      type: 'expense',
      categoryId: 'cat-utilities',
      accountId: 'acc-cash',
      transactionDate: iso(2026, 4, 1),
      recurringRuleId: ruleId,
    })
    await TransactionService.updateStatus(t.id, 'skipped')
    await TransactionService.markPaid(t.id)
    expect(await cashBalance()).toBe(-10000)
  })
})

describe('updateStatus', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('sets skipped/postponed/missed and back to pending without balance effects', async () => {
    const ruleId = await seedRule()
    const t = await TransactionService.createScheduled({
      amount: 10000,
      description: 'Rent',
      type: 'expense',
      categoryId: 'cat-utilities',
      accountId: 'acc-cash',
      transactionDate: iso(2026, 4, 1),
      recurringRuleId: ruleId,
    })

    for (const status of ['skipped', 'postponed', 'missed', 'pending'] as const) {
      await TransactionService.updateStatus(t.id, status)
      const row = await db.transactions.get(t.id)
      expect(row?.status).toBe(status)
      expect(await cashBalance()).toBe(0)
    }
  })
})

describe('pending entries are balance-safe through existing flows', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('soft-deleting and restoring a pending entry never touches balances', async () => {
    const ruleId = await seedRule()
    const t = await TransactionService.createScheduled({
      amount: 10000,
      description: 'Rent',
      type: 'expense',
      categoryId: 'cat-utilities',
      accountId: 'acc-cash',
      transactionDate: iso(2026, 4, 1),
      recurringRuleId: ruleId,
    })

    await TransactionService.softDelete(t.id)
    expect(await cashBalance()).toBe(0)
    await TransactionService.restore(t.id)
    expect(await cashBalance()).toBe(0)
  })

  it('editing a pending entry does not apply a balance effect and keeps its rule link', async () => {
    const ruleId = await seedRule()
    const t = await TransactionService.createScheduled({
      amount: 10000,
      description: 'Rent',
      type: 'expense',
      categoryId: 'cat-utilities',
      accountId: 'acc-cash',
      transactionDate: iso(2026, 4, 1),
      recurringRuleId: ruleId,
    })

    const updated = await TransactionService.update(t.id, {
      amount: 11000,
      description: 'Rent (revised)',
      type: 'expense',
      categoryId: 'cat-utilities',
      accountId: 'acc-cash',
      transactionDate: iso(2026, 4, 1),
    })

    expect(await cashBalance()).toBe(0)
    expect(updated.status).toBe('pending')
    expect(updated.recurringRuleId).toBe(ruleId)
  })

  it('getRecurringGenerated returns auto entries only', async () => {
    const ruleId = await seedRule()
    await TransactionService.createScheduled({
      amount: 10000,
      description: 'Rent',
      type: 'expense',
      categoryId: 'cat-utilities',
      accountId: 'acc-cash',
      transactionDate: iso(2026, 4, 1),
      recurringRuleId: ruleId,
    })
    await TransactionService.create({
      amount: 250,
      description: 'Tea',
      type: 'expense',
      categoryId: 'cat-food',
      accountId: 'acc-cash',
      transactionDate: iso(2026, 4, 2),
    })

    const generated = await TransactionRepository.getRecurringGenerated()
    expect(generated).toHaveLength(1)
    expect(generated[0].description).toBe('Rent')
  })
})
