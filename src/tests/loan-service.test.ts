import { describe, it, expect, beforeEach } from 'vitest'
import { format } from 'date-fns'
import { db } from '@/database/db'
import { LoanRepository } from '@/repositories/LoanRepository'
import {
  LoanService,
  firstDueDate,
  nextDueDate,
  isOverdue,
  splitPayment,
  getPayoffForecast,
} from '@/services/LoanService'
import type { Loan, LoanPayment } from '@/types/entities'

const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    loanName: 'Home Loan',
    lender: 'Bank',
    originalAmount: 10000,
    currentBalance: 10000,
    monthlyEMI: 1000,
    interestRate: null,
    startDate: '2026-01-15',
    endDate: null,
    dueDay: 15,
    status: 'active',
    notes: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makePayment(loanId: string, paymentDate: string, overrides: Partial<LoanPayment> = {}): LoanPayment {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    loanId,
    paymentDate,
    amountPaid: 1000,
    principalPaid: 1000,
    interestPaid: 0,
    remainingBalance: 9000,
    notes: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

async function createLoan(overrides: Partial<Loan> = {}): Promise<Loan> {
  const loan = makeLoan(overrides)
  await db.loans.add(loan)
  return loan
}

describe('firstDueDate', () => {
  it('uses the due day on/after the start date', () => {
    expect(fmt(firstDueDate(makeLoan({ startDate: '2026-01-15', dueDay: 20 })))).toBe('2026-01-20')
  })

  it('rolls into the next month when the start date has passed this month\'s due day', () => {
    expect(fmt(firstDueDate(makeLoan({ startDate: '2026-01-25', dueDay: 20 })))).toBe('2026-02-20')
  })

  it('clamps day 31 to the end of short months (§10 month-end transitions)', () => {
    expect(fmt(firstDueDate(makeLoan({ startDate: '2026-02-01', dueDay: 31 })))).toBe('2026-02-28')
  })
})

describe('nextDueDate', () => {
  it('returns the first due date when no EMI is due yet', () => {
    const loan = makeLoan({ startDate: '2026-01-15', dueDay: 20 })
    expect(fmt(nextDueDate(loan, new Date(2026, 0, 10)) as Date)).toBe('2026-01-20')
  })

  it('advances strictly past the reference date', () => {
    const loan = makeLoan({ startDate: '2026-01-15', dueDay: 15 })
    expect(fmt(nextDueDate(loan, new Date(2026, 5, 20)) as Date)).toBe('2026-07-15')
  })

  it('returns null once the loan is paid off', () => {
    expect(nextDueDate(makeLoan({ currentBalance: 0 }), new Date(2026, 5, 20))).toBeNull()
  })
})

describe('isOverdue', () => {
  it('flags a loan with no payment covering the latest due cycle', () => {
    const loan = makeLoan({ startDate: '2026-06-01', dueDay: 5 })
    expect(isOverdue(loan, [], new Date(2026, 7, 3))).toBe(true)
  })

  it('does not flag a loan with a payment after the previous due date', () => {
    const loan = makeLoan({ startDate: '2026-06-01', dueDay: 5 })
    const payments = [makePayment(loan.id, '2026-07-20')]
    expect(isOverdue(loan, payments, new Date(2026, 7, 3))).toBe(false)
  })

  it('is never overdue once paid off', () => {
    const loan = makeLoan({ currentBalance: 0, status: 'completed' })
    expect(isOverdue(loan, [], new Date(2026, 7, 3))).toBe(false)
  })
})

describe('splitPayment', () => {
  it('full payoff goes entirely to principal', () => {
    const split = splitPayment(makeLoan({ currentBalance: 10000, interestRate: 12 }), 10000)
    expect(split).toEqual({ principalPaid: 10000, interestPaid: 0 })
  })

  it('charges interest on the balance first when interest is tracked', () => {
    const loan = makeLoan({ currentBalance: 10000, interestRate: 12 })
    expect(splitPayment(loan, 1000)).toEqual({ principalPaid: 900, interestPaid: 100 })
  })

  it('no-interest loans are all principal', () => {
    expect(splitPayment(makeLoan({ interestRate: null }), 1000)).toEqual({
      principalPaid: 1000,
      interestPaid: 0,
    })
  })

  it('a payment below the month\'s interest reduces no principal', () => {
    const loan = makeLoan({ currentBalance: 10000, interestRate: 12 })
    expect(splitPayment(loan, 50)).toEqual({ principalPaid: 0, interestPaid: 50 })
  })
})

describe('getPayoffForecast', () => {
  it('no-interest loans are a simple division, anchored at the next due date', () => {
    const loan = makeLoan({ currentBalance: 9000, monthlyEMI: 1000 })
    const forecast = getPayoffForecast(loan, new Date(2026, 5, 20))
    expect(forecast.progress).toBeCloseTo(0.1)
    expect(forecast.remainingEmis).toBe(9)
    expect(fmt(forecast.completionDate as Date)).toBe('2027-03-15')
  })

  it('returns zero remaining for a paid-off loan', () => {
    const forecast = getPayoffForecast(makeLoan({ currentBalance: 0, status: 'completed' }))
    expect(forecast.remainingEmis).toBe(0)
    expect(forecast.completionDate).toBeNull()
  })

  it('simulates month-by-month payoff for interest-tracked loans', () => {
    const loan = makeLoan({ currentBalance: 10000, monthlyEMI: 1000, interestRate: 12 })
    const forecast = getPayoffForecast(loan, new Date(2026, 5, 20))
    expect(forecast.remainingEmis).toBeGreaterThan(0)
    expect(forecast.completionDate).not.toBeNull()
  })

  it('signals a loan that never pays off when EMI stays below monthly interest', () => {
    const loan = makeLoan({ currentBalance: 10000, monthlyEMI: 100, interestRate: 100 })
    const forecast = getPayoffForecast(loan, new Date(2026, 5, 20))
    expect(forecast.remainingEmis).toBeNull()
    expect(forecast.completionDate).toBeNull()
  })
})

describe('LoanService CRUD', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('creates a loan with the balance equal to the original amount', async () => {
    const loan = await LoanService.create({
      loanName: 'Car Loan',
      lender: 'AutoBank',
      originalAmount: 50000,
      monthlyEMI: 5000,
      interestRate: null,
      startDate: '2026-01-01',
      endDate: null,
      dueDay: 5,
      notes: '',
    })
    expect(loan.status).toBe('active')
    expect(loan.currentBalance).toBe(50000)
    expect(await LoanRepository.getById(loan.id)).toBeDefined()
  })

  it('rejects an invalid EMI or due day', async () => {
    await expect(
      LoanService.create({
        loanName: 'Loan',
        lender: '',
        originalAmount: 50000,
        monthlyEMI: 0,
        interestRate: null,
        startDate: '2026-01-01',
        endDate: null,
        dueDay: 5,
        notes: '',
      })
    ).rejects.toThrow('Monthly EMI must be greater than 0.')

    await expect(
      LoanService.create({
        loanName: 'Loan',
        lender: '',
        originalAmount: 50000,
        monthlyEMI: 1000,
        interestRate: null,
        startDate: '2026-01-01',
        endDate: null,
        dueDay: 40,
        notes: '',
      })
    ).rejects.toThrow('Due day must be between 1 and 31.')
  })

  it('update edits editable fields and keeps the original amount fixed', async () => {
    const loan = await LoanService.create({
      loanName: 'Car Loan',
      lender: 'AutoBank',
      originalAmount: 50000,
      monthlyEMI: 5000,
      interestRate: null,
      startDate: '2026-01-01',
      endDate: null,
      dueDay: 5,
      notes: '',
    })
    await LoanService.update(loan.id, {
      loanName: 'Car Loan (refinanced)',
      lender: 'NewBank',
      monthlyEMI: 4500,
      interestRate: 9.5,
      endDate: null,
      dueDay: 12,
      notes: 'refinanced',
    })
    const updated = await LoanRepository.getById(loan.id)
    expect(updated?.loanName).toBe('Car Loan (refinanced)')
    expect(updated?.monthlyEMI).toBe(4500)
    expect(updated?.interestRate).toBe(9.5)
    expect(updated?.dueDay).toBe(12)
    expect(updated?.originalAmount).toBe(50000)
    expect(updated?.currentBalance).toBe(50000)
    expect(updated?.startDate).toBe('2026-01-01')
  })

  it('records a payment, reducing the balance and splitting interest', async () => {
    const loan = await LoanService.create({
      loanName: 'Home Loan',
      lender: 'Bank',
      originalAmount: 10000,
      monthlyEMI: 1000,
      interestRate: 12,
      startDate: '2026-01-01',
      endDate: null,
      dueDay: 5,
      notes: '',
    })
    const payment = await LoanService.recordPayment(loan.id, {
      paymentDate: '2026-02-05',
      amountPaid: 1000,
    })
    expect(payment.principalPaid).toBe(900)
    expect(payment.interestPaid).toBe(100)
    const updated = await LoanRepository.getById(loan.id)
    expect(updated?.currentBalance).toBe(9100)
  })

  it('completes the loan when the balance reaches zero and blocks further payments', async () => {
    const loan = await createLoan(makeLoan({ currentBalance: 1000, monthlyEMI: 1000 }))
    await LoanService.recordPayment(loan.id, { paymentDate: '2026-02-05', amountPaid: 1000 })
    const updated = await LoanRepository.getById(loan.id)
    expect(updated?.status).toBe('completed')
    expect(updated?.currentBalance).toBe(0)
    await expect(
      LoanService.recordPayment(loan.id, { paymentDate: '2026-03-05', amountPaid: 1000 })
    ).rejects.toThrow('This loan is already paid off.')
  })

  it('rejects a payment larger than the outstanding balance', async () => {
    const loan = await createLoan(makeLoan({ currentBalance: 1000 }))
    await expect(
      LoanService.recordPayment(loan.id, { paymentDate: '2026-02-05', amountPaid: 2000 })
    ).rejects.toThrow('Payment can\'t exceed the outstanding balance.')
  })

  it('deletePayment restores the balance by the principal and re-activates a completed loan', async () => {
    const loan = await createLoan(makeLoan({ currentBalance: 1000, monthlyEMI: 1000 }))
    const payment = await LoanService.recordPayment(loan.id, {
      paymentDate: '2026-02-05',
      amountPaid: 1000,
    })
    await LoanService.deletePayment(loan.id, payment.id)
    const restored = await LoanRepository.getById(loan.id)
    expect(restored?.status).toBe('active')
    expect(restored?.currentBalance).toBe(1000)
  })

  it('delete removes the loan and its payment history together', async () => {
    const loan = await createLoan(makeLoan())
    await LoanService.recordPayment(loan.id, { paymentDate: '2026-02-05', amountPaid: 1000 })
    await LoanService.delete(loan.id)
    expect(await LoanRepository.getById(loan.id)).toBeUndefined()
    expect(await db.loan_payments.where('loanId').equals(loan.id).count()).toBe(0)
  })
})

describe('LoanService.getAlerts', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('alerts when the EMI is due tomorrow', () => {
    const loan = makeLoan({ startDate: '2026-08-01', dueDay: 4 })
    const alerts = LoanService.getAlerts([loan], { [loan.id]: [] }, new Date(2026, 7, 3))
    expect(alerts.some((a) => a.id === `loan-due-tomorrow-${loan.id}`)).toBe(true)
    expect(alerts.find((a) => a.id === `loan-due-tomorrow-${loan.id}`)?.severity).toBe('info')
  })

  it('alerts when the loan is overdue', () => {
    const loan = makeLoan({ startDate: '2026-06-01', dueDay: 5 })
    const alerts = LoanService.getAlerts([loan], { [loan.id]: [] }, new Date(2026, 7, 3))
    expect(alerts.find((a) => a.id === `loan-overdue-${loan.id}`)?.severity).toBe('warning')
  })

  it('alerts when a recently completed loan is paid off', async () => {
    const created = await createLoan(makeLoan({ currentBalance: 1000, monthlyEMI: 1000 }))
    await LoanService.recordPayment(created.id, {
      paymentDate: '2026-08-01',
      amountPaid: 1000,
    })
    const loan = (await LoanRepository.getById(created.id)) as Loan
    const payments = await LoanRepository.getPayments(created.id)
    const alerts = LoanService.getAlerts([loan], { [loan.id]: payments }, new Date(2026, 7, 3))
    expect(alerts.find((a) => a.id === `loan-completed-${loan.id}`)).toBeDefined()
  })

  it('alerts on a recent extra payment', async () => {
    const loan = await createLoan(makeLoan({ currentBalance: 5000, monthlyEMI: 1000 }))
    const payment = await LoanService.recordPayment(loan.id, {
      paymentDate: '2026-08-01',
      amountPaid: 1200,
    })
    const alerts = LoanService.getAlerts(
      [loan],
      { [loan.id]: [payment] },
      new Date(2026, 7, 3)
    )
    expect(alerts.find((a) => a.id === `loan-extra-payment-${loan.id}`)?.message).toContain('200')
  })

  it('drops informational alerts once they are older than 30 days', async () => {
    const loan = await createLoan(makeLoan({ currentBalance: 5000, monthlyEMI: 1000 }))
    const payment = await LoanService.recordPayment(loan.id, {
      paymentDate: '2026-06-01',
      amountPaid: 1200,
    })
    const alerts = LoanService.getAlerts(
      [loan],
      { [loan.id]: [payment] },
      new Date(2026, 7, 3)
    )
    expect(alerts.some((a) => a.id === `loan-extra-payment-${loan.id}`)).toBe(false)
  })
})
