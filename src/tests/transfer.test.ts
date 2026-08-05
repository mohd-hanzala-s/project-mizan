import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/database/db'
import { TransactionService } from '@/services/TransactionService'
import { AccountRepository } from '@/repositories/AccountRepository'

async function balanceOf(accountId: string): Promise<number> {
  const account = await AccountRepository.getById(accountId)
  return account!.currentBalance
}

describe('TransactionService.createTransfer', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('rejects a zero or negative amount', async () => {
    await expect(
      TransactionService.createTransfer({
        fromAccountId: 'acc-cash',
        toAccountId: 'acc-bank',
        amount: 0,
        transactionDate: new Date().toISOString(),
      })
    ).rejects.toThrow()
  })

  it('rejects transferring an account to itself', async () => {
    await expect(
      TransactionService.createTransfer({
        fromAccountId: 'acc-cash',
        toAccountId: 'acc-cash',
        amount: 100,
        transactionDate: new Date().toISOString(),
      })
    ).rejects.toThrow()
  })

  it('moves money: source decreases, destination increases, by the same amount', async () => {
    await TransactionService.createTransfer({
      fromAccountId: 'acc-cash',
      toAccountId: 'acc-bank',
      amount: 500,
      transactionDate: new Date().toISOString(),
    })
    expect(await balanceOf('acc-cash')).toBe(-500)
    expect(await balanceOf('acc-bank')).toBe(500)
  })

  it('never affects income/expense totals (§10) — both legs are type transfer', async () => {
    await TransactionService.createTransfer({
      fromAccountId: 'acc-cash',
      toAccountId: 'acc-bank',
      amount: 500,
      transactionDate: new Date().toISOString(),
    })
    const all = await db.transactions.toArray()
    expect(all.every((t) => t.type === 'transfer')).toBe(true)
  })

  it('creates two linked entries with opposite transferDirection, joined by linkedTransactionId', async () => {
    const debit = await TransactionService.createTransfer({
      fromAccountId: 'acc-cash',
      toAccountId: 'acc-bank',
      amount: 500,
      transactionDate: new Date().toISOString(),
    })
    const all = await db.transactions.toArray()
    expect(all).toHaveLength(2)

    const credit = all.find((t) => t.id === debit.linkedTransactionId)!
    expect(debit.transferDirection).toBe('debit')
    expect(credit.transferDirection).toBe('credit')
    expect(credit.linkedTransactionId).toBe(debit.id)
    expect(credit.accountId).toBe('acc-bank')
    expect(debit.accountId).toBe('acc-cash')
  })

  it('auto-assigns the Transfers category to both legs', async () => {
    const debit = await TransactionService.createTransfer({
      fromAccountId: 'acc-cash',
      toAccountId: 'acc-bank',
      amount: 500,
      transactionDate: new Date().toISOString(),
    })
    const all = await db.transactions.toArray()
    expect(all.every((t) => t.categoryId === 'cat-transfers')).toBe(true)
    expect(debit.description).toBe('Transfer to Bank Account')
  })

  it('deleting either leg cascades to both, reversing both balances', async () => {
    const debit = await TransactionService.createTransfer({
      fromAccountId: 'acc-cash',
      toAccountId: 'acc-bank',
      amount: 500,
      transactionDate: new Date().toISOString(),
    })

    await TransactionService.softDelete(debit.id)

    expect(await balanceOf('acc-cash')).toBe(0)
    expect(await balanceOf('acc-bank')).toBe(0)
    const all = await db.transactions.toArray()
    expect(all.every((t) => t.isDeleted)).toBe(true)
  })

  it('restoring either leg cascades to both, reapplying both balances', async () => {
    const debit = await TransactionService.createTransfer({
      fromAccountId: 'acc-cash',
      toAccountId: 'acc-bank',
      amount: 500,
      transactionDate: new Date().toISOString(),
    })
    await TransactionService.softDelete(debit.id)
    await TransactionService.restore(debit.id)

    expect(await balanceOf('acc-cash')).toBe(-500)
    expect(await balanceOf('acc-bank')).toBe(500)
    const all = await db.transactions.toArray()
    expect(all.every((t) => !t.isDeleted)).toBe(true)
  })

  it('refuses to edit or duplicate a transfer leg', async () => {
    const debit = await TransactionService.createTransfer({
      fromAccountId: 'acc-cash',
      toAccountId: 'acc-bank',
      amount: 500,
      transactionDate: new Date().toISOString(),
    })

    await expect(
      TransactionService.update(debit.id, {
        amount: 600,
        description: 'x',
        type: 'expense',
        categoryId: 'cat-food',
        accountId: 'acc-cash',
        transactionDate: debit.transactionDate,
      })
    ).rejects.toThrow()

    await expect(TransactionService.duplicate(debit.id)).rejects.toThrow()
  })
})
