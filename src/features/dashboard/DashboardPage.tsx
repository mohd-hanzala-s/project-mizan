import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Landmark,
} from 'lucide-react'
import { useTransactionsStore } from '@/features/transactions/transactionsStore'
import { useAccountsStore } from '@/features/accounts/accountsStore'
import { useBudgetsStore } from '@/features/budgets/budgetsStore'
import { useRecurringStore } from '@/features/recurring/recurringStore'
import { useLoansStore } from '@/features/loans/loansStore'
import { useSettingsStore } from '@/app/settingsStore'
import { db } from '@/database/db'
import {
  computeMetrics,
  getRecentTransactions,
  getSpendingTimeline,
  getAlerts,
} from '@/services/DashboardService'
import { BudgetService, computeBudgetStatus } from '@/services/BudgetService'
import { getRecurringAlerts, getUpcomingObligations } from '@/services/RecurringService'
import { LoanService } from '@/services/LoanService'
import { DashboardCard } from '@/components/finance/DashboardCard'
import { MetricCard } from '@/components/finance/MetricCard'
import { AccountCard } from '@/components/finance/AccountCard'
import { AlertCard } from '@/components/finance/AlertCard'
import { BudgetCard } from '@/components/finance/BudgetCard'
import { TransactionCard } from '@/features/transactions/TransactionCard'
import { SpendingTimeline } from './SpendingTimeline'
import { QuickAdd } from './QuickAdd'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import type { Category, LoanPayment } from '@/types/entities'

export function DashboardPage() {
  const transactions = useTransactionsStore((s) => s.transactions)
  const load = useTransactionsStore((s) => s.load)
  const openAddSheet = useTransactionsStore((s) => s.openAddSheet)
  const openEditSheet = useTransactionsStore((s) => s.openEditSheet)
  const deleteTransaction = useTransactionsStore((s) => s.deleteTransaction)
  const duplicateTransaction = useTransactionsStore((s) => s.duplicateTransaction)
  const settings = useSettingsStore((s) => s.settings)
  const accounts = useAccountsStore((s) => s.accounts)
  const loadAccounts = useAccountsStore((s) => s.load)
  const budgets = useBudgetsStore((s) => s.budgets)
  const loadBudgets = useBudgetsStore((s) => s.load)
  const recurringRules = useRecurringStore((s) => s.rules)
  const loadRecurring = useRecurringStore((s) => s.load)
  const loans = useLoansStore((s) => s.loans)
  const loanPayments = useLoansStore((s) => s.payments)
  const loadLoans = useLoansStore((s) => s.load)
  const navigate = useNavigate()

  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    load()
    loadAccounts()
    loadBudgets()
    loadRecurring()
    loadLoans()
    db.categories.toArray().then(setCategories)
  }, [load, loadAccounts, loadBudgets, loadRecurring, loadLoans])

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const budgetMonthStart = settings?.budgetMonthStart ?? 1

  const metrics = useMemo(
    () => computeMetrics(transactions, accounts, budgetMonthStart),
    [transactions, accounts, budgetMonthStart]
  )
  const recent = useMemo(() => getRecentTransactions(transactions, 5), [transactions])
  const timeline = useMemo(() => getSpendingTimeline(transactions, 7), [transactions])
  const budgetStatuses = useMemo(
    () => budgets.map((b) => computeBudgetStatus(b, transactions, budgetMonthStart)),
    [budgets, transactions, budgetMonthStart]
  )
  const obligations = useMemo(() => getUpcomingObligations(recurringRules), [recurringRules])
  const recurringAlerts = useMemo(
    () => getRecurringAlerts(recurringRules, transactions),
    [recurringRules, transactions]
  )
  const loanPaymentsByLoan = useMemo(() => {
    const map: Record<string, LoanPayment[]> = {}
    for (const p of loanPayments) {
      const list = map[p.loanId] ?? []
      list.push(p)
      map[p.loanId] = list
    }
    return map
  }, [loanPayments])
  const loanAlerts = useMemo(
    () => LoanService.getAlerts(loans, loanPaymentsByLoan),
    [loans, loanPaymentsByLoan]
  )
  const alerts = useMemo(
    () => [
      ...getAlerts(accounts),
      ...BudgetService.getAlerts(budgetStatuses, categories),
      ...recurringAlerts,
      ...loanAlerts,
    ],
    [accounts, budgetStatuses, categories, recurringAlerts, loanAlerts]
  )

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={LayoutDashboard}
        title="No activity yet"
        description="Your dashboard will come alive with balances, budgets, and insights as you start logging transactions."
        actionLabel="Add your first transaction"
        onAction={openAddSheet}
      />
    )
  }

  return (
    <div className="flex flex-col gap-24 p-16 md:p-24">
      {alerts.length > 0 && (
        <div className="flex flex-col gap-8">
          {alerts.map((a) => (
            <AlertCard key={a.id} alert={a} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-16 md:grid-cols-4">
        <MetricCard
          label="Total Balance"
          amount={metrics.totalBalance}
          icon={Wallet}
          tone="neutral"
        />
        <MetricCard
          label="This Month's Income"
          amount={metrics.monthIncome}
          icon={TrendingUp}
          tone="income"
          trend={metrics.monthIncomeTrend}
          trendPositiveDirection="up"
        />
        <MetricCard
          label="This Month's Expense"
          amount={metrics.monthExpense}
          icon={TrendingDown}
          tone="expense"
          trend={metrics.monthExpenseTrend}
          trendPositiveDirection="down"
        />
        <MetricCard
          label="Net Savings"
          amount={metrics.netSavings}
          icon={PiggyBank}
          tone="neutral"
        />
      </div>

      <QuickAdd />

      <DashboardCard title="Last 7 Days">
        <SpendingTimeline days={timeline} />
      </DashboardCard>

      <DashboardCard title="Recent Activity">
        <div className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-md border border-border">
          {recent.map((t) => (
            <TransactionCard
              key={t.id}
              transaction={t}
              category={categoryById.get(t.categoryId)}
              onDelete={() => deleteTransaction(t)}
              onEdit={() => openEditSheet(t)}
              onDuplicate={() => duplicateTransaction(t)}
            />
          ))}
        </div>
      </DashboardCard>

      <DashboardCard
        title="Upcoming Payments"
        action={
          recurringRules.length > 0 && (
            <Button variant="tertiary" size="sm" onClick={() => navigate('/recurring')}>
              See all
            </Button>
          )
        }
      >
        {obligations.length === 0 ? (
          <p className="text-body-sm text-text-secondary">
            No recurring payments due in the next month.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-md border border-border">
            {obligations.slice(0, 5).map((o) => (
              <div key={o.ruleId} className="flex items-center justify-between gap-8 px-16 py-12">
                <div className="min-w-0">
                  <p className="truncate text-body font-medium text-text-primary">{o.title}</p>
                  <p className="text-body-sm text-text-secondary">{format(o.date, 'd MMM yyyy')}</p>
                </div>
                <span
                  className={
                    o.type === 'income'
                      ? 'shrink-0 tabular-nums text-body-lg font-semibold text-income'
                      : 'shrink-0 tabular-nums text-body-lg font-semibold text-expense'
                  }
                >
                  {o.type === 'income' ? '+' : '−'}₹{o.amount.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>

      <DashboardCard title="Account Balances">
        <div className="flex flex-col gap-8">
          {accounts.map((a) => (
            <button key={a.id} onClick={() => navigate(`/accounts/${a.id}`)} className="text-left">
              <AccountCard account={a} />
            </button>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard
        title="Budgets"
        action={
          budgetStatuses.length > 0 && (
            <Button variant="tertiary" size="sm" onClick={() => navigate('/budgets')}>
              See all
            </Button>
          )
        }
      >
        {budgetStatuses.length === 0 ? (
          <p className="text-body-sm text-text-secondary">
            Set up a budget to see how you're tracking here.
          </p>
        ) : (
          <div className="flex flex-col gap-8">
            {budgetStatuses.slice(0, 3).map((status) => (
              <BudgetCard
                key={status.budget.id}
                status={status}
                category={categoryById.get(status.budget.categoryId)}
              />
            ))}
          </div>
        )}
      </DashboardCard>

      <DashboardCard
        title="Loans"
        action={
          loans.length > 0 && (
            <Button variant="tertiary" size="sm" onClick={() => navigate('/loans')}>
              See all
            </Button>
          )
        }
      >
        {loans.length === 0 ? (
          <p className="flex items-center gap-8 text-body-sm text-text-secondary">
            <Landmark className="size-16 shrink-0" aria-hidden="true" />
            Track home, car, and personal loans — add one to start tracking your EMI payoff.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-md border border-border">
            {loans.slice(0, 5).map((loan) => (
              <button
                key={loan.id}
                onClick={() => navigate('/loans')}
                className="flex items-center justify-between gap-8 px-16 py-12 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-body font-medium text-text-primary">{loan.loanName}</p>
                  <p className="text-body-sm text-text-secondary">
                    {loan.status === 'completed'
                      ? 'Paid off'
                      : `${loan.monthlyEMI.toLocaleString('en-IN')} EMI/mo`}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums text-body-lg font-semibold text-liability">
                  ₹{loan.currentBalance.toLocaleString('en-IN')}
                </span>
              </button>
            ))}
          </div>
        )}
      </DashboardCard>
    </div>
  )
}
