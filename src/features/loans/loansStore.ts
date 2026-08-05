import { create } from "zustand";
import { LoanRepository } from "@/repositories/LoanRepository";
import type { Loan, LoanPayment } from "@/types/entities";

interface LoansState {
  /** Active + completed loans, newest first (the management page shows both;
   * active-only filtering for the Dashboard is derived here). */
  loans: Loan[];
  /** Every recorded payment across all loans, newest first — per-loan
   * history is derived by filtering on `loanId` (same pattern as
   * `TransactionRepository.getRecurringGenerated`). */
  payments: LoanPayment[];
  isLoading: boolean;
  load: () => Promise<void>;
}

export const useLoansStore = create<LoansState>((set) => ({
  loans: [],
  payments: [],
  isLoading: true,

  load: async () => {
    set({ isLoading: true });
    const [loans, payments] = await Promise.all([
      LoanRepository.getAllIncludingCompleted(),
      LoanRepository.getAllPayments(),
    ]);
    set({ loans, payments, isLoading: false });
  },
}));
