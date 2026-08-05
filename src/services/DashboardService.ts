import { isTransferCreditLeg } from '@/utils/transactions'
import type { Account, Transaction } from '@/types/entities'

export interface DateRange {
  start: Date
  end: Date
}

/**
 * "This month" per Settings.budgetMonthStart (§5), not the calendar month —
 * keeps Dashboard's numbers consistent with however Phase 4's Budgets ends
 * up defining a period, rather than the two silently disagreeing later.
 */
export function getCurrentPeriod(budgetMonthStart: number, reference = new Date()): DateRange {
  const day = reference.getDate()
  const anchorMonth = day >= budgetMonthStart ? reference.getMonth() : reference.getMonth() - 1
  const start = new Date(reference.getFullYear(), anchorMonth, budgetMonthStart)
  const end = new Date(reference.getFullYear(), anchorMonth + 1, budgetMonthStart)
  return { start, end }
}

export function getPreviousPeriod(budgetMonthStart: number, reference = new Date()): DateRange {
  const current = getCurrentPeriod(budgetMonthStart, reference)
  const start = new Date(
    current.start.getFullYear(),
    current.start.getMonth() - 1,
    budgetMonthStart
  )
  return { start, end: current.start }
}

function inRange(dateStr: string, range: DateRange): boolean {
  const t = new Date(dateStr).getTime()
  return t >= range.start.getTime() && t < range.end.getTime()
}

/** §10: "transfers never affect income/expense totals." No transfers exist
 * yet (Phase 3 builds them), but this stays correct once they do. */
function sumByType(
  transactions: Transaction[],
  type: 'income' | 'expense',
  range: DateRange
): number {
  return transactions
    .filter((t) => !t.isDeleted && t.type === type && inRange(t.transactionDate, range))
    .reduce((sum, t) => sum + t.amount, 0)
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null // undefined % change from zero
  return ((current - previous) / previous) * 100
}

export interface DashboardMetrics {
  totalBalance: number
  monthIncome: number
  monthExpense: number
  netSavings: number
  monthIncomeTrend: number | null
  monthExpenseTrend: number | null
}

export function computeMetrics(
  transactions: Transaction[],
  accounts: Account[],
  budgetMonthStart: number,
  reference = new Date()
): DashboardMetrics {
  const current = getCurrentPeriod(budgetMonthStart, reference)
  const previous = getPreviousPeriod(budgetMonthStart, reference)

  const monthIncome = sumByType(transactions, 'income', current)
  const monthExpense = sumByType(transactions, 'expense', current)
  const prevIncome = sumByType(transactions, 'income', previous)
  const prevExpense = sumByType(transactions, 'expense', previous)

  return {
    totalBalance: accounts
      .filter((a) => !a.isArchived)
      .reduce((sum, a) => sum + a.currentBalance, 0),
    monthIncome,
    monthExpense,
    netSavings: monthIncome - monthExpense,
    monthIncomeTrend: percentChange(monthIncome, prevIncome),
    monthExpenseTrend: percentChange(monthExpense, prevExpense),
  }
}

export function getRecentTransactions(transactions: Transaction[], limit: number): Transaction[] {
  return [...transactions]
    .filter((t) => !t.isDeleted && !isTransferCreditLeg(t))
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
    .slice(0, limit)
}

export interface DayTotal {
  date: Date
  total: number
}

/** Expense-only, one bucket per calendar day — the SpendingTimeline
 * visualization (§3) reads outflow, not net. */
export function getSpendingTimeline(
  transactions: Transaction[],
  days: number,
  reference = new Date()
): DayTotal[] {
  const buckets: DayTotal[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(reference)
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)
    const next = new Date(date)
    next.setDate(next.getDate() + 1)
    buckets.push({ date, total: sumByType(transactions, 'expense', { start: date, end: next }) })
  }
  return buckets
}

export interface DashboardAlert {
  id: string
  message: string
  severity: 'warning' | 'info'
}

/** Alerts computable with only Accounts/Transactions data (Phase 2). Budget
 * overspend, loan due dates, and missed recurring payments all need their
 * own phase's data first — see CHANGELOG for how this expands later. */
export function getAlerts(accounts: Account[]): DashboardAlert[] {
  return accounts
    .filter((a) => !a.isArchived && a.type !== 'creditCard' && a.currentBalance < 0)
    .map((a) => ({
      id: `negative-balance-${a.id}`,
      message: `${a.name} balance is negative (₹${a.currentBalance.toLocaleString('en-IN')}).`,
      severity: 'warning' as const,
    }))
}
