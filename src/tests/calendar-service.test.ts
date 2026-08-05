import { describe, it, expect } from 'vitest'
import { startOfDay } from 'date-fns'
import {
  CalendarService,
  getMonthEvents,
  getDayEvents,
  getWeekEvents,
  getDaySummary,
  filterEvents,
  type CalendarEvent,
} from '@/services/CalendarService'
import type { Loan, LoanPayment, RecurringRule, Transaction } from '@/types/entities'

const REF = new Date(2026, 5, 15) // 15 Jun 2026

const iso = (y: number, m: number, d: number) => startOfDay(new Date(y, m, d))

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    transactionDate: '2026-06-05',
    type: 'expense',
    amount: 500,
    currency: 'INR',
    description: 'Groceries',
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

function makeRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    title: 'Rent',
    amount: 10000,
    type: 'expense',
    categoryId: 'cat-home',
    accountId: 'acc-bank',
    frequency: 'monthly',
    startDate: '2026-05-20',
    endDate: null,
    nextExecution: '2026-06-20',
    autoGenerate: true,
    reminderDays: 3,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    loanName: 'Home Loan',
    lender: 'Bank',
    originalAmount: 100000,
    currentBalance: 100000,
    monthlyEMI: 20000,
    interestRate: null,
    startDate: '2026-06-01',
    endDate: null,
    dueDay: 20,
    status: 'active',
    notes: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makePayment(loanId: string, overrides: Partial<LoanPayment> = {}): LoanPayment {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    loanId,
    paymentDate: '2026-06-10',
    amountPaid: 10000,
    principalPaid: 10000,
    interestPaid: 0,
    remainingBalance: 90000,
    notes: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function buildEvents(): CalendarEvent[] {
  return getMonthEvents(2026, 5, transactions(), rules(), loans(), payments(), REF)
}

function transactions(): Transaction[] {
  return [
    makeTransaction({
      transactionDate: '2026-06-05',
      type: 'expense',
      amount: 500,
      description: 'Groceries',
    }),
    makeTransaction({
      transactionDate: '2026-06-03',
      type: 'income',
      amount: 1000,
      description: 'Freelance',
    }),
    // Outside the month → excluded.
    makeTransaction({
      transactionDate: '2026-05-30',
      type: 'expense',
      amount: 200,
      description: 'Old',
    }),
    // Soft-deleted → excluded.
    makeTransaction({
      transactionDate: '2026-06-08',
      type: 'expense',
      amount: 300,
      description: 'Deleted',
      isDeleted: true,
    }),
    // Transfer legs → excluded (not income/expense).
    makeTransaction({
      transactionDate: '2026-06-07',
      type: 'transfer',
      amount: 900,
      description: 'Transfer',
      transferDirection: 'debit',
    }),
  ]
}

function rules(): RecurringRule[] {
  return [
    // Monthly, next after 15 Jun is 20 Jun → in month.
    makeRule({
      title: 'Rent',
      amount: 10000,
      type: 'expense',
      frequency: 'monthly',
      startDate: '2026-05-20',
    }),
    // Weekly → 19 Jun and 26 Jun.
    makeRule({
      title: 'Gym',
      amount: 500,
      type: 'expense',
      frequency: 'weekly',
      startDate: '2026-05-01',
    }),
    // Paused → excluded.
    makeRule({
      title: 'Netflix',
      amount: 649,
      type: 'expense',
      frequency: 'monthly',
      startDate: '2026-01-10',
      active: false,
    }),
    // Next due is 1 Jul → outside the month.
    makeRule({
      title: 'Salary',
      amount: 50000,
      type: 'income',
      frequency: 'monthly',
      startDate: '2026-06-01',
    }),
    // Next due is exactly today → strictly-future rule pushes it to Jul.
    makeRule({
      title: 'Internet',
      amount: 799,
      type: 'expense',
      frequency: 'monthly',
      startDate: '2026-06-15',
    }),
  ]
}

const homeLoan = makeLoan({
  loanName: 'Home Loan',
  currentBalance: 100000,
  monthlyEMI: 20000,
  startDate: '2026-06-01',
  dueDay: 20,
})
const completedLoan = makeLoan({
  loanName: 'Bike Loan',
  currentBalance: 0,
  status: 'completed',
  startDate: '2026-06-01',
  dueDay: 20,
})

function loans(): Loan[] {
  return [homeLoan, completedLoan]
}

function payments(): LoanPayment[] {
  return [makePayment(homeLoan.id, { paymentDate: '2026-06-10', amountPaid: 10000 })]
}

describe('getMonthEvents', () => {
  it('builds transaction events with correct signs and excludes transfers/deleted', () => {
    const events = buildEvents()
    const txn = events.filter((e) => e.kind === 'transaction')
    const groceries = txn.find((e) => e.title === 'Groceries')
    const freelance = txn.find((e) => e.title === 'Freelance')
    expect(groceries?.amount).toBe(-500)
    expect(freelance?.amount).toBe(1000)
    expect(iso(2026, 5, 5).getTime()).toBe(groceries?.date.getTime())
    expect(txn).toHaveLength(2)
  })

  it('includes future recurring occurrences only, for active rules, within the month', () => {
    const events = buildEvents()
    const rec = events.filter((e) => e.kind === 'recurring')
    const rent = rec.find((e) => e.title === 'Rent')
    expect(rent?.date.getTime()).toBe(iso(2026, 5, 20).getTime())
    expect(rent?.amount).toBe(-10000)
    const gym = rec.filter((e) => e.title === 'Gym').map((e) => e.date)
    expect(gym).toHaveLength(2)
    expect(gym.some((d) => d.getTime() === iso(2026, 5, 19).getTime())).toBe(true)
    expect(gym.some((d) => d.getTime() === iso(2026, 5, 26).getTime())).toBe(true)
    // Paused, next-outside-month, and strictly-today rules produce nothing.
    expect(rec.find((e) => e.title === 'Netflix')).toBeUndefined()
    expect(rec.find((e) => e.title === 'Salary')).toBeUndefined()
    expect(rec.find((e) => e.title === 'Internet')).toBeUndefined()
  })

  it('includes loan EMI due dates and recorded payments', () => {
    const events = buildEvents()
    const loans = events.filter((e) => e.kind === 'loan')
    const due = loans.find((e) => e.title === 'EMI due · Home Loan')
    expect(due?.date.getTime()).toBe(iso(2026, 5, 20).getTime())
    expect(due?.amount).toBe(-20000)
    const paid = loans.find((e) => e.title === 'EMI paid · Home Loan')
    expect(paid?.date.getTime()).toBe(iso(2026, 5, 10).getTime())
    expect(paid?.amount).toBe(-10000)
  })

  it('sorts events newest-first', () => {
    const dates = buildEvents().map((e) => e.date.getTime())
    const sorted = [...dates].sort((a, b) => b - a)
    expect(dates).toEqual(sorted)
  })

  it('returns an empty array for empty data', () => {
    expect(getMonthEvents(2026, 5, [], [], [], [], REF)).toEqual([])
  })
})

describe('day/week helpers', () => {
  it("getDayEvents returns only that day's events", () => {
    const day = getDayEvents(buildEvents(), iso(2026, 5, 5))
    expect(day.map((e) => e.title)).toEqual(['Groceries'])
  })

  it('getWeekEvents returns only events in the 7-day window', () => {
    const weekStart = iso(2026, 5, 14)
    const week = getWeekEvents(buildEvents(), weekStart)
    expect(week.length).toBeGreaterThan(0)
    for (const e of week) {
      expect(e.date.getTime()).toBeGreaterThanOrEqual(weekStart.getTime())
      expect(e.date.getTime()).toBeLessThan(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    }
  })
})

describe('getDaySummary', () => {
  it('sums income/expense/net and counts events', () => {
    const summary = getDaySummary([
      { id: 'a', date: iso(2026, 5, 1), kind: 'transaction', title: 'a', amount: -500 },
      { id: 'b', date: iso(2026, 5, 1), kind: 'transaction', title: 'b', amount: 1000 },
      { id: 'c', date: iso(2026, 5, 1), kind: 'loan', title: 'c', amount: -20000 },
    ])
    expect(summary).toEqual({ count: 3, income: 1000, expense: 20500, net: -19500 })
  })

  it('returns zeros for an empty day', () => {
    expect(getDaySummary([])).toEqual({ count: 0, income: 0, expense: 0, net: 0 })
  })
})

describe('filterEvents', () => {
  const events: CalendarEvent[] = [
    { id: 't1', date: iso(2026, 5, 1), kind: 'transaction', title: 'Groceries', amount: -500 },
    { id: 'r1', date: iso(2026, 5, 2), kind: 'recurring', title: 'Rent', amount: -10000 },
    { id: 'l1', date: iso(2026, 5, 3), kind: 'loan', title: 'EMI due · Home Loan', amount: -20000 },
  ]

  it('filters by kind', () => {
    expect(filterEvents(events, '', ['loan']).map((e) => e.id)).toEqual(['l1'])
    expect(filterEvents(events, '', ['transaction', 'recurring']).map((e) => e.id)).toEqual([
      't1',
      'r1',
    ])
  })

  it('empty kinds means all', () => {
    expect(filterEvents(events, '', [])).toHaveLength(3)
  })

  it('filters by case-insensitive query on the title', () => {
    expect(filterEvents(events, 'rent', []).map((e) => e.id)).toEqual(['r1'])
    expect(filterEvents(events, 'HOME', []).map((e) => e.id)).toEqual(['l1'])
    expect(filterEvents(events, 'zzz', [])).toEqual([])
  })
})

describe('CalendarService namespace', () => {
  it('exposes all helpers', () => {
    expect(CalendarService.getMonthEvents).toBe(getMonthEvents)
    expect(CalendarService.getDayEvents).toBe(getDayEvents)
    expect(CalendarService.getWeekEvents).toBe(getWeekEvents)
    expect(CalendarService.getDaySummary).toBe(getDaySummary)
    expect(CalendarService.filterEvents).toBe(filterEvents)
  })
})
