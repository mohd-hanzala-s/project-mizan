import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { db } from '@/database/db'
import { LoanService } from '@/services/LoanService'
import { LoansPage } from '@/features/loans/LoansPage'
import { useLoansStore } from '@/features/loans/loansStore'

async function settle() {
  await waitFor(() => {
    expect(useLoansStore.getState().isLoading).toBe(false)
  })
}

describe('LoansPage', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await db.settings.update('active', { onboardingCompleted: true })
  })

  it('shows the empty state before any loans exist', async () => {
    render(<LoansPage />)
    await waitFor(() => {
      expect(screen.getByText(/no loans yet/i)).toBeInTheDocument()
    })
    await settle()
  })

  it('lists a created loan with its EMI', async () => {
    await LoanService.create({
      loanName: 'Home Loan',
      lender: 'Bank',
      originalAmount: 10000,
      monthlyEMI: 1000,
      interestRate: null,
      startDate: '2030-01-01',
      endDate: null,
      dueDay: 10,
      notes: '',
    })

    render(<LoansPage />)

    await waitFor(() => {
      expect(screen.getByText('Home Loan')).toBeInTheDocument()
    })
    expect(screen.getByText(/1,000/)).toBeInTheDocument()
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
    await settle()
  })

  it('moves a paid-off loan into the Completed section', async () => {
    const loan = await LoanService.create({
      loanName: 'Bike Loan',
      lender: 'FinCo',
      originalAmount: 1000,
      monthlyEMI: 1000,
      interestRate: null,
      startDate: '2030-01-01',
      endDate: null,
      dueDay: 10,
      notes: '',
    })
    await LoanService.recordPayment(loan.id, {
      paymentDate: '2030-01-10',
      amountPaid: 1000,
    })

    render(<LoansPage />)

    await waitFor(() => {
      expect(screen.getByText('Bike Loan')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0)
    await settle()
  })
})
