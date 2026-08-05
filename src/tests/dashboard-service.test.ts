import { describe, it, expect } from 'vitest'
import {
  getCurrentPeriod,
  getPreviousPeriod,
  computeMetrics,
  getRecentTransactions,
  getSpendingTimeline,
  getAlerts,
} from '@/services/DashboardService'
import type { Account, Transaction } from '@/types/entities'

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    transactionDate: now,
    type: 'expense',
    amount: 100,
    currency: 'INR',
    description: 'test',
    categoryId: 'cat-food',
    accountId: 'acc-cash',
    recurringRuleId: null,
    loanId: null,
    budgetId: null,
    tags: [],
    notes: '',
    status: 'paid',
    source: 'manual',
    isFavorite: false,
    isDeleted: false,
    version: 1,
    linkedTransactionId: null,
    ...overrides,
  }
}

function makeAccount(overrides: Partial<Account>): Account {
  const now = new Date().toISOString()
  return {
    id: 'acc-cash',
    name: 'Cash',
    type: 'cash',
    icon: 'Banknote',
    color: '#000',
    openingBalance: 0,
    currentBalance: 0,
    isDefault: true,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('getCurrentPeriod / getPreviousPeriod', () => {
  it('calendar-month period when budgetMonthStart is 1', () => {
    const reference = new Date(2026, 2, 15) // March 15, 2026
    const period = getCurrentPeriod(1, reference)
    expect(period.start).toEqual(new Date(2026, 2, 1))
    expect(period.end).toEqual(new Date(2026, 3, 1))
  })

  it('respects a mid-month budgetMonthStart before the anchor day', () => {
    const reference = new Date(2026, 2, 10) // before the 15th
    const period = getCurrentPeriod(15, reference)
    expect(period.start).toEqual(new Date(2026, 1, 15)) // Feb 15
    expect(period.end).toEqual(new Date(2026, 2, 15)) // Mar 15
  })

  it('respects a mid-month budgetMonthStart after the anchor day', () => {
    const reference = new Date(2026, 2, 20) // after the 15th
    const period = getCurrentPeriod(15, reference)
    expect(period.start).toEqual(new Date(2026, 2, 15)) // Mar 15
    expect(period.end).toEqual(new Date(2026, 3, 15)) // Apr 15
  })

  it('handles year rollover', () => {
    const reference = new Date(2026, 0, 10) // Jan 10, budgetMonthStart 15
    const period = getPreviousPeriod(15, reference)
    expect(period.start).toEqual(new Date(2025, 10, 15)) // Nov 15, 2025
  })
})

describe('computeMetrics', () => {
  it('sums income and expense within the current period only', () => {
    const reference = new Date(2026, 2, 15)
    const transactions = [
      makeTransaction({
        type: 'income',
        amount: 1000,
        transactionDate: new Date(2026, 2, 5).toISOString(),
      }),
      makeTransaction({
        type: 'expense',
        amount: 300,
        transactionDate: new Date(2026, 2, 10).toISOString(),
      }),
      // outside the current period (previous month)
      makeTransaction({
        type: 'expense',
        amount: 9999,
        transactionDate: new Date(2026, 1, 1).toISOString(),
      }),
    ]
    const metrics = computeMetrics(transactions, [], 1, reference)
    expect(metrics.monthIncome).toBe(1000)
    expect(metrics.monthExpense).toBe(300)
    expect(metrics.netSavings).toBe(700)
  })

  it('excludes transfers from income/expense totals (§10)', () => {
    const reference = new Date(2026, 2, 15)
    const transactions = [
      makeTransaction({
        type: 'transfer',
        amount: 5000,
        transactionDate: new Date(2026, 2, 5).toISOString(),
      }),
    ]
    const metrics = computeMetrics(transactions, [], 1, reference)
    expect(metrics.monthIncome).toBe(0)
    expect(metrics.monthExpense).toBe(0)
  })

  it('sums current balances across non-archived accounts', () => {
    const accounts = [
      makeAccount({ id: 'a1', currentBalance: 1000 }),
      makeAccount({ id: 'a2', currentBalance: -200 }),
      makeAccount({ id: 'a3', currentBalance: 500, isArchived: true }),
    ]
    const metrics = computeMetrics([], accounts, 1)
    expect(metrics.totalBalance).toBe(800)
  })

  it('returns null trend when the previous period was zero and current is also zero', () => {
    const metrics = computeMetrics([], [], 1, new Date(2026, 2, 15))
    expect(metrics.monthIncomeTrend).toBe(0)
  })
})

describe('getRecentTransactions', () => {
  it('excludes soft-deleted and respects the limit, newest first', () => {
    const transactions = [
      makeTransaction({ id: '1', transactionDate: new Date(2026, 0, 1).toISOString() }),
      makeTransaction({ id: '2', transactionDate: new Date(2026, 0, 3).toISOString() }),
      makeTransaction({
        id: '3',
        transactionDate: new Date(2026, 0, 2).toISOString(),
        isDeleted: true,
      }),
    ]
    const recent = getRecentTransactions(transactions, 5)
    expect(recent.map((t) => t.id)).toEqual(['2', '1'])
  })
})

describe('getSpendingTimeline', () => {
  it('returns one bucket per day, expense-only', () => {
    const reference = new Date(2026, 2, 10, 12, 0, 0)
    const transactions = [
      makeTransaction({ type: 'expense', amount: 100, transactionDate: reference.toISOString() }),
      makeTransaction({ type: 'income', amount: 5000, transactionDate: reference.toISOString() }),
    ]
    const timeline = getSpendingTimeline(transactions, 7, reference)
    expect(timeline).toHaveLength(7)
    expect(timeline[6].total).toBe(100) // today, income excluded
  })
})

describe('getAlerts', () => {
  it('flags a negative-balance non-credit-card account', () => {
    const accounts = [makeAccount({ id: 'a1', type: 'cash', currentBalance: -50 })]
    expect(getAlerts(accounts)).toHaveLength(1)
  })

  it('does not flag a negative credit card balance (expected/normal)', () => {
    const accounts = [makeAccount({ id: 'a1', type: 'creditCard', currentBalance: -500 })]
    expect(getAlerts(accounts)).toHaveLength(0)
  })

  it('does not flag a positive balance', () => {
    const accounts = [makeAccount({ id: 'a1', currentBalance: 500 })]
    expect(getAlerts(accounts)).toHaveLength(0)
  })
})
