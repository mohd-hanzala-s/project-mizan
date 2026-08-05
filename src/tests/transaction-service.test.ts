import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/database/db'
import { TransactionService } from '@/services/TransactionService'
import { AccountRepository } from '@/repositories/AccountRepository'

async function cashBalance(): Promise<number> {
  const account = await AccountRepository.getById('acc-cash')
  return account!.currentBalance
}

describe('TransactionService balance math', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('rejects a zero or negative amount', async () => {
    await expect(
      TransactionService.create({
        amount: 0,
        description: 'tea',
        type: 'expense',
        categoryId: 'cat-food',
        accountId: 'acc-cash',
        transactionDate: new Date().toISOString(),
      })
    ).rejects.toThrow()
  })

  it('an expense decreases the account balance', async () => {
    await TransactionService.create({
      amount: 250,
      description: 'tea',
      type: 'expense',
      categoryId: 'cat-food',
      accountId: 'acc-cash',
      transactionDate: new Date().toISOString(),
    })
    expect(await cashBalance()).toBe(-250)
  })

  it('an income increases the account balance', async () => {
    await TransactionService.create({
      amount: 45000,
      description: 'salary',
      type: 'income',
      categoryId: 'cat-salary',
      accountId: 'acc-cash',
      transactionDate: new Date().toISOString(),
    })
    expect(await cashBalance()).toBe(45000)
  })

  it('editing an amount adjusts the balance by the difference, not the new total', async () => {
    const t = await TransactionService.create({
      amount: 250,
      description: 'tea',
      type: 'expense',
      categoryId: 'cat-food',
      accountId: 'acc-cash',
      transactionDate: new Date().toISOString(),
    })
    expect(await cashBalance()).toBe(-250)

    await TransactionService.update(t.id, {
      amount: 400,
      description: 'tea and snacks',
      type: 'expense',
      categoryId: 'cat-food',
      accountId: 'acc-cash',
      transactionDate: t.transactionDate,
    })
    expect(await cashBalance()).toBe(-400)
  })

  it('editing an account moves the balance effect to the new account', async () => {
    const t = await TransactionService.create({
      amount: 250,
      description: 'tea',
      type: 'expense',
      categoryId: 'cat-food',
      accountId: 'acc-cash',
      transactionDate: new Date().toISOString(),
    })

    await TransactionService.update(t.id, {
      amount: 250,
      description: 'tea',
      type: 'expense',
      categoryId: 'cat-food',
      accountId: 'acc-bank',
      transactionDate: t.transactionDate,
    })

    expect(await cashBalance()).toBe(0)
    const bank = await AccountRepository.getById('acc-bank')
    expect(bank!.currentBalance).toBe(-250)
  })

  it('soft-deleting reverses the balance effect, and restore reapplies it', async () => {
    const t = await TransactionService.create({
      amount: 250,
      description: 'tea',
      type: 'expense',
      categoryId: 'cat-food',
      accountId: 'acc-cash',
      transactionDate: new Date().toISOString(),
    })
    expect(await cashBalance()).toBe(-250)

    await TransactionService.softDelete(t.id)
    expect(await cashBalance()).toBe(0)
    const deleted = await db.transactions.get(t.id)
    expect(deleted?.isDeleted).toBe(true)

    await TransactionService.restore(t.id)
    expect(await cashBalance()).toBe(-250)
  })

  it('soft-deleted transactions are excluded from getAll but not from the database', async () => {
    const t = await TransactionService.create({
      amount: 250,
      description: 'tea',
      type: 'expense',
      categoryId: 'cat-food',
      accountId: 'acc-cash',
      transactionDate: new Date().toISOString(),
    })
    await TransactionService.softDelete(t.id)

    const { TransactionRepository } = await import('@/repositories/TransactionRepository')
    expect(await TransactionRepository.getAll()).toHaveLength(0)
    expect(await db.transactions.count()).toBe(1)
  })

  it('duplicate creates an independent transaction with its own balance effect', async () => {
    const t = await TransactionService.create({
      amount: 250,
      description: 'tea',
      type: 'expense',
      categoryId: 'cat-food',
      accountId: 'acc-cash',
      transactionDate: new Date().toISOString(),
    })
    const copy = await TransactionService.duplicate(t.id)

    expect(copy.id).not.toBe(t.id)
    expect(await cashBalance()).toBe(-500)
  })
})
