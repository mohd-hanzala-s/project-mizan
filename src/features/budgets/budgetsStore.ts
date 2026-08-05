import { create } from "zustand";
import { BudgetRepository } from "@/repositories/BudgetRepository";
import type { Budget } from "@/types/entities";

interface BudgetsState {
  budgets: Budget[];
  isLoading: boolean;
  load: () => Promise<void>;
}

export const useBudgetsStore = create<BudgetsState>((set) => ({
  budgets: [],
  isLoading: true,

  load: async () => {
    set({ isLoading: true });
    const budgets = await BudgetRepository.getAll();
    set({ budgets, isLoading: false });
  },
}));
