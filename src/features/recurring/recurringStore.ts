import { create } from 'zustand'
import { RecurringRepository } from '@/repositories/RecurringRepository'
import { TransactionRepository } from '@/repositories/TransactionRepository'
import { RecurringService } from '@/services/RecurringService'
import type { RecurringRule, Transaction } from '@/types/entities'

interface RecurringState {
  /** Active and paused rules, so the page can show and manage both. */
  rules: RecurringRule[]
  /** Every recurring-generated transaction, newest first (per-rule history
   * is derived from this by filtering on `recurringRuleId`). */
  generated: Transaction[]
  isLoading: boolean
  load: () => Promise<void>
}

export const useRecurringStore = create<RecurringState>((set) => ({
  rules: [],
  generated: [],
  isLoading: true,

  /** Runs the generation pass first (creating any due pending entries),
   * then refreshes rules + generated history. `generateDue` is single-flight
   * and idempotent, so this is safe alongside AppShell's startup call. */
  load: async () => {
    set({ isLoading: true })
    await RecurringService.generateDue()
    const [rules, generated] = await Promise.all([
      RecurringRepository.getAllIncludingInactive(),
      TransactionRepository.getRecurringGenerated(),
    ])
    set({ rules, generated, isLoading: false })
  },
}))
