import { addDays, addMonths, startOfDay } from "date-fns";
import { db } from "@/database/db";
import { LoanRepository } from "@/repositories/LoanRepository";
import type { DashboardAlert } from "@/services/DashboardService";
import type { Loan, LoanPayment, LoanStatus } from "@/types/entities";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Safety bound on the interest-payoff simulation — 100 years of monthly
 * EMIs is far beyond any real loan, and the "never pays off" branch exits
 * far sooner (see `getPayoffForecast`). */
const MAX_FORECAST_MONTHS = 1200;

function parseDay(dateStr: string): Date {
  return startOfDay(new Date(`${dateStr}T00:00:00`));
}

/** Day `dueDay` in a given month, clamped to the month's last day (§10
 * month-end transitions) — dueDay 31 in February lands on the 28th/29th. */
function dueDateForMonth(
  dueDay: number,
  year: number,
  monthIndex: number,
): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(dueDay, lastDay));
}

/** The first scheduled EMI date: the loan's dueDay on/after its startDate.
 * Also the anchor for all later due-date math (due dates are computed from
 * the month index, never by addMonths on a clamped date, so month-end
 * clamping can't drift — Feb 28 followed by Mar 31, not Mar 28). */
export function firstDueDate(loan: Loan): Date {
  const start = parseDay(loan.startDate);
  const due = dueDateForMonth(
    loan.dueDay,
    start.getFullYear(),
    start.getMonth(),
  );
  if (due.getTime() < start.getTime()) {
    const next = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return dueDateForMonth(loan.dueDay, next.getFullYear(), next.getMonth());
  }
  return due;
}

/** The next EMI due date strictly after `reference`, or null when the loan
 * is already paid off. */
export function nextDueDate(loan: Loan, reference = new Date()): Date | null {
  if (loan.currentBalance <= 0) return null;
  const anchor = startOfDay(reference);
  let cursor = new Date(
    firstDueDate(loan).getFullYear(),
    firstDueDate(loan).getMonth(),
    1,
  );
  let due = firstDueDate(loan);
  while (due.getTime() <= anchor.getTime()) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    due = dueDateForMonth(loan.dueDay, cursor.getFullYear(), cursor.getMonth());
  }
  return due;
}

/** Latest scheduled due date on or before `reference` (and on/after the
 * loan's first due date), or null if no EMI is due yet. */
function latestDueDateOnOrBefore(loan: Loan, reference: Date): Date | null {
  const anchor = startOfDay(reference);
  const first = firstDueDate(loan);
  if (first.getTime() > anchor.getTime()) return null;
  let cursor = new Date(first.getFullYear(), first.getMonth(), 1);
  let latest = first;
  for (;;) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const candidate = dueDateForMonth(
      loan.dueDay,
      next.getFullYear(),
      next.getMonth(),
    );
    if (candidate.getTime() > anchor.getTime()) break;
    latest = candidate;
    cursor = next;
  }
  return latest;
}

/**
 * Heuristic "EMI overdue" detection: a loan is overdue when a full EMI
 * cycle has elapsed with no payment at all since the *previous* due date.
 * Concretely — the latest due date on/before today is `latest`; if no
 * recorded payment is dated after the previous month's due date, the latest
 * cycle was skipped. Early and late payments within a cycle both count as
 * "covered", so this flags genuinely skipped cycles rather than payments
 * made a few days late.
 */
export function isOverdue(
  loan: Loan,
  payments: LoanPayment[],
  reference = new Date(),
): boolean {
  if (loan.currentBalance <= 0) return false;
  const latest = latestDueDateOnOrBefore(loan, reference);
  if (!latest) return false;
  const previous = new Date(latest.getFullYear(), latest.getMonth() - 1, 1);
  const previousDue = dueDateForMonth(
    loan.dueDay,
    previous.getFullYear(),
    previous.getMonth(),
  );
  return !payments.some(
    (p) => parseDay(p.paymentDate).getTime() > previousDue.getTime(),
  );
}

/** Split a payment into principal and interest. Full payoffs go entirely to
 * principal (the balance must be able to reach 0). When interest is
 * tracked, interest is charged on the current balance first and the rest is
 * principal; a payment smaller than the month's interest reduces nothing. */
export function splitPayment(
  loan: Loan,
  amountPaid: number,
): { principalPaid: number; interestPaid: number } {
  if (amountPaid >= loan.currentBalance) {
    return { principalPaid: loan.currentBalance, interestPaid: 0 };
  }
  if (!loan.interestRate || loan.interestRate <= 0) {
    return { principalPaid: amountPaid, interestPaid: 0 };
  }
  const monthlyRate = loan.interestRate / 12 / 100;
  const interestPaid = Math.round(loan.currentBalance * monthlyRate);
  const principalPaid = amountPaid - interestPaid;
  if (principalPaid < 0) return { principalPaid: 0, interestPaid: amountPaid };
  return { principalPaid, interestPaid };
}

export interface PayoffForecast {
  /** 0–1: fraction of the original amount repaid. */
  progress: number;
  /** EMIs remaining at the current EMI + interest, or null if the loan
   * would never pay off at this rate (EMI below the monthly interest). */
  remainingEmis: number | null;
  /** Estimated completion date, or null when already paid off / never. */
  completionDate: Date | null;
}

/** §9 Phase 6 "payoff forecast" + §3 LoanCard "remaining EMIs, estimated
 * completion". No-interest loans are a pure division; interest-tracked loans
 * are simulated month-by-month (interest on the balance, EMI covers the
 * rest), bounded and with an explicit "never pays off" signal. */
export function getPayoffForecast(
  loan: Loan,
  reference = new Date(),
): PayoffForecast {
  const progress =
    loan.originalAmount > 0
      ? Math.min(
          1,
          Math.max(
            0,
            (loan.originalAmount - loan.currentBalance) / loan.originalAmount,
          ),
        )
      : 0;

  if (loan.currentBalance <= 0) {
    return { progress, remainingEmis: 0, completionDate: null };
  }

  const anchor = nextDueDate(loan, reference) ?? startOfDay(reference);
  const monthlyRate = loan.interestRate ? loan.interestRate / 12 / 100 : 0;

  if (monthlyRate <= 0) {
    const remainingEmis = Math.max(
      1,
      Math.ceil(loan.currentBalance / loan.monthlyEMI),
    );
    return {
      progress,
      remainingEmis,
      completionDate: addMonths(anchor, remainingEmis - 1),
    };
  }

  let balance = loan.currentBalance;
  let months = 0;
  while (balance > 0 && months < MAX_FORECAST_MONTHS) {
    const interest = balance * monthlyRate;
    if (interest >= loan.monthlyEMI) {
      return { progress, remainingEmis: null, completionDate: null };
    }
    balance -= loan.monthlyEMI - interest;
    months++;
  }
  if (balance > 0)
    return { progress, remainingEmis: null, completionDate: null };
  return {
    progress,
    remainingEmis: months,
    completionDate: addMonths(anchor, months - 1),
  };
}

export interface CreateLoanInput {
  loanName: string;
  lender: string;
  originalAmount: number;
  monthlyEMI: number;
  /** Annual % — null = interest not tracked. */
  interestRate: number | null;
  startDate: string;
  endDate: string | null;
  dueDay: number;
  notes: string;
}

/** `originalAmount` and `startDate` are set at creation (they define the
 * loan's identity and starting point — same reason Phase 3 fixes an
 * account's type/opening balance); `currentBalance` is driven only by
 * recorded payments. Everything else is editable. */
export type UpdateLoanInput = Omit<
  CreateLoanInput,
  "originalAmount" | "startDate"
>;

export interface RecordPaymentInput {
  paymentDate: string;
  amountPaid: number;
  notes?: string;
}

function validateSchedule(
  input: Pick<
    CreateLoanInput,
    "loanName" | "monthlyEMI" | "interestRate" | "dueDay" | "endDate"
  >,
  startDate: string,
): void {
  if (!input.loanName.trim()) throw new Error("Loan name is required.");
  if (!(input.monthlyEMI > 0))
    throw new Error("Monthly EMI must be greater than 0.");
  if (
    input.interestRate !== null &&
    (input.interestRate < 0 || input.interestRate > 100)
  ) {
    throw new Error("Interest rate must be between 0 and 100.");
  }
  if (
    !Number.isInteger(input.dueDay) ||
    input.dueDay < 1 ||
    input.dueDay > 31
  ) {
    throw new Error("Due day must be between 1 and 31.");
  }
  if (!Number.isFinite(parseDay(startDate).getTime()))
    throw new Error("Start date is required.");
  if (
    input.endDate &&
    parseDay(input.endDate).getTime() < parseDay(startDate).getTime()
  ) {
    throw new Error("End date must be on or after the start date.");
  }
}

export const LoanService = {
  firstDueDate,
  nextDueDate,
  isOverdue,
  splitPayment,
  getPayoffForecast,

  /** §9 Phase 6 loans. Every loan starts active with `currentBalance`
   * equal to `originalAmount`; the balance moves only via `recordPayment`. */
  async create(input: CreateLoanInput): Promise<Loan> {
    validateSchedule(input, input.startDate);
    if (!(input.originalAmount > 0))
      throw new Error("Original amount must be greater than 0.");

    const now = new Date().toISOString();
    const loan: Loan = {
      id: crypto.randomUUID(),
      loanName: input.loanName.trim(),
      lender: input.lender.trim(),
      originalAmount: input.originalAmount,
      currentBalance: input.originalAmount,
      monthlyEMI: input.monthlyEMI,
      interestRate: input.interestRate,
      startDate: input.startDate,
      endDate: input.endDate,
      dueDay: input.dueDay,
      status: "active",
      notes: input.notes.trim(),
      createdAt: now,
      updatedAt: now,
    };
    await LoanRepository.add(loan);
    return loan;
  },

  async update(id: string, input: UpdateLoanInput): Promise<void> {
    const existing = await LoanRepository.getById(id);
    if (!existing) throw new Error("Loan not found.");
    validateSchedule(input, existing.startDate);

    await LoanRepository.update(id, {
      loanName: input.loanName.trim(),
      lender: input.lender.trim(),
      monthlyEMI: input.monthlyEMI,
      interestRate: input.interestRate,
      endDate: input.endDate,
      dueDay: input.dueDay,
      notes: input.notes.trim(),
    });
  },

  /** Hard-deletes the loan and its payment history together (the loans
   * screen confirms first — §3 "Confirmation dialogs required before: delete
   * loan"). Generated history isn't referenced elsewhere, unlike recurring
   * transactions. */
  async delete(id: string): Promise<void> {
    const existing = await LoanRepository.getById(id);
    if (!existing) throw new Error("Loan not found.");
    await db.transaction("rw", db.loans, db.loan_payments, async () => {
      await db.loan_payments.where("loanId").equals(id).delete();
      await LoanRepository.delete(id);
    });
  },

  /** §6: "Every recorded EMI reduces outstanding balance, creates payment
   * history, updates payoff progress; if interest is tracked, split payment
   * into principal/interest." Never lets the balance go negative (§6 data
   * integrity). A payment that brings the balance to 0 completes the loan. */
  async recordPayment(
    loanId: string,
    input: RecordPaymentInput,
  ): Promise<LoanPayment> {
    if (!(input.amountPaid > 0))
      throw new Error("Payment amount must be greater than 0.");
    if (!Number.isFinite(parseDay(input.paymentDate).getTime())) {
      throw new Error("Payment date is required.");
    }
    const loan = await LoanRepository.getById(loanId);
    if (!loan) throw new Error("Loan not found.");
    if (loan.status === "completed" || loan.currentBalance <= 0) {
      throw new Error("This loan is already paid off.");
    }
    if (input.amountPaid > loan.currentBalance) {
      throw new Error("Payment can't exceed the outstanding balance.");
    }

    const { principalPaid, interestPaid } = splitPayment(
      loan,
      input.amountPaid,
    );
    const remainingBalance = Math.max(0, loan.currentBalance - principalPaid);
    const status: LoanStatus = remainingBalance <= 0 ? "completed" : "active";

    const now = new Date().toISOString();
    const payment: LoanPayment = {
      id: crypto.randomUUID(),
      loanId: loan.id,
      paymentDate: input.paymentDate,
      amountPaid: input.amountPaid,
      principalPaid,
      interestPaid,
      remainingBalance,
      notes: (input.notes ?? "").trim(),
      createdAt: now,
      updatedAt: now,
    };

    await db.transaction("rw", db.loans, db.loan_payments, async () => {
      await LoanRepository.addPayment(payment);
      await LoanRepository.update(loan.id, {
        currentBalance: remainingBalance,
        status,
      });
    });
    return payment;
  },

  /** Reverses a payment: restores the loan balance by the payment's
   * principal (for accidental entries). If that un-completes the loan, its
   * status flips back to active. Note: other payment rows keep their stored
   * `remainingBalance` snapshots — history is append-mostly; this is the
   * explicit "fix a mistake" escape hatch, not a rewrite of the chain. */
  async deletePayment(loanId: string, paymentId: string): Promise<void> {
    const loan = await LoanRepository.getById(loanId);
    if (!loan) throw new Error("Loan not found.");
    const payment = await db.loan_payments.get(paymentId);
    if (!payment || payment.loanId !== loanId)
      throw new Error("Payment not found.");

    const restored = loan.currentBalance + payment.principalPaid;
    const status: LoanStatus = restored > 0 ? "active" : "completed";

    await db.transaction("rw", db.loans, db.loan_payments, async () => {
      await LoanRepository.deletePayment(paymentId);
      await LoanRepository.update(loan.id, {
        currentBalance: restored,
        status,
      });
    });
  },

  /** §6 loan alerts: EMI due tomorrow, EMI overdue, loan completed, extra
   * payment made. Derived on demand (same decision as recurring + budget
   * alerts — no notification log exists, see CHANGELOG). Completion and
   * extra-payment alerts are informational and expire after 30 days (§7
   * "informational ones expire automatically"); overdue stays visible until
   * resolved (§10 "critical ones stay visible"). */
  getAlerts(
    loans: Loan[],
    paymentsByLoan: Record<string, LoanPayment[]>,
    reference = new Date(),
  ): DashboardAlert[] {
    const alerts: DashboardAlert[] = [];
    const today = startOfDay(reference);
    const recentCutoff = addDays(today, -30);

    for (const loan of loans) {
      const payments = paymentsByLoan[loan.id] ?? [];
      const latest = payments[0];

      if (loan.currentBalance <= 0) {
        if (loan.status === "completed" && latest) {
          const paidOn = parseDay(latest.paymentDate);
          if (paidOn.getTime() >= recentCutoff.getTime()) {
            alerts.push({
              id: `loan-completed-${loan.id}`,
              message: `${loan.loanName} is fully paid off.`,
              severity: "info",
            });
          }
        }
        continue;
      }

      const next = nextDueDate(loan, today);
      if (next) {
        const daysUntil = Math.round(
          (next.getTime() - today.getTime()) / DAY_MS,
        );
        if (daysUntil === 1) {
          alerts.push({
            id: `loan-due-tomorrow-${loan.id}`,
            message: `${loan.loanName} EMI of ₹${loan.monthlyEMI.toLocaleString("en-IN")} is due tomorrow.`,
            severity: "info",
          });
        }
      }

      if (isOverdue(loan, payments, today)) {
        alerts.push({
          id: `loan-overdue-${loan.id}`,
          message: `${loan.loanName} EMI is overdue.`,
          severity: "warning",
        });
      }

      if (latest) {
        const paidOn = parseDay(latest.paymentDate);
        if (
          paidOn.getTime() >= recentCutoff.getTime() &&
          latest.amountPaid > loan.monthlyEMI
        ) {
          const extra = latest.amountPaid - loan.monthlyEMI;
          alerts.push({
            id: `loan-extra-payment-${loan.id}`,
            message: `Extra payment of ₹${extra.toLocaleString("en-IN")} made on ${loan.loanName}.`,
            severity: "info",
          });
        }
      }
    }

    return alerts;
  },
};
