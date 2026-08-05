import { db } from "@/database/db";
import type { Loan, LoanPayment } from "@/types/entities";

export const LoanRepository = {
  /** Active loans only — what the Dashboard and alerts care about.
   * Completed loans are historical records (like archived accounts). */
  async getAll(): Promise<Loan[]> {
    const all = await db.loans.toArray();
    return all.filter((l) => l.status === "active");
  },

  /** Includes completed loans — the Loans management screen needs to show
   * and revisit paid-off loans. Newest first. */
  async getAllIncludingCompleted(): Promise<Loan[]> {
    const all = await db.loans.toArray();
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getById(id: string): Promise<Loan | undefined> {
    return db.loans.get(id);
  },

  async add(loan: Loan): Promise<void> {
    await db.loans.add(loan);
  },

  async update(id: string, patch: Partial<Loan>): Promise<void> {
    await db.loans.update(id, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  },

  async delete(id: string): Promise<void> {
    await db.loans.delete(id);
  },

  /** One loan's payment history, newest first. */
  async getPayments(loanId: string): Promise<LoanPayment[]> {
    const all = await db.loan_payments.where("loanId").equals(loanId).toArray();
    return all.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  },

  /** Every loan payment across all loans, newest first — the loans store
   * loads this once and filters per loan (small table, same pattern as
   * `TransactionRepository.getRecurringGenerated`). */
  async getAllPayments(): Promise<LoanPayment[]> {
    const all = await db.loan_payments.toArray();
    return all.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  },

  async addPayment(payment: LoanPayment): Promise<void> {
    await db.loan_payments.add(payment);
  },

  async deletePayment(id: string): Promise<void> {
    await db.loan_payments.delete(id);
  },
};
