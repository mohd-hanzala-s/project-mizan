import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { db } from '@/database/db'
import { CalendarPage } from '@/features/calendar/CalendarPage'
import { useTransactionsStore } from '@/features/transactions/transactionsStore'
import { useRecurringStore } from '@/features/recurring/recurringStore'
import { useLoansStore } from '@/features/loans/loansStore'
import { useSettingsStore } from '@/app/settingsStore'
import type { Transaction } from '@/types/entities'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function addTransaction(overrides: Partial<Transaction> = {}) {
  const now = new Date().toISOString()
  const txn: Transaction = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    transactionDate: todayIso(),
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
  await db.transactions.add(txn)
  return txn
}

async function settle() {
  await waitFor(() => {
    expect(useTransactionsStore.getState().isLoading).toBe(false)
    expect(useRecurringStore.getState().isLoading).toBe(false)
    expect(useLoansStore.getState().isLoading).toBe(false)
    expect(useSettingsStore.getState().isLoading).toBe(false)
  })
}

describe('CalendarPage', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await db.settings.update('active', { onboardingCompleted: true })
  })

  it('renders the month grid and an empty day message before any data', async () => {
    render(<CalendarPage />)
    await waitFor(() => {
      expect(screen.getByText('Calendar')).toBeInTheDocument()
    })
    expect(screen.getByRole('radiogroup', { name: 'Calendar view' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/No events for this day/i)).toBeInTheDocument()
    })
    await settle()
  })

  it("shows today's transaction in the selected-day list", async () => {
    await addTransaction()
    render(<CalendarPage />)
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument()
    })
    expect(screen.getAllByText(/500/).length).toBeGreaterThan(0)
    await settle()
  })

  it('switches to the day view and shows the same events', async () => {
    await addTransaction({ description: 'Coffee', amount: 250 })
    render(<CalendarPage />)
    await waitFor(() => {
      expect(screen.getByText('Coffee')).toBeInTheDocument()
    })
    const dayButton = screen.getByRole('radio', { name: 'day' })
    dayButton.click()
    await waitFor(() => {
      expect(screen.getByText('Timeline')).toBeInTheDocument()
    })
    expect(screen.getAllByText(/Coffee/).length).toBeGreaterThan(0)
    await settle()
  })
})
