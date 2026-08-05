import { db } from "@/database/db";
import type { Transaction } from "@/types/entities";

export const TransactionRepository = {
  async getAll(): Promise<Transaction[]> {
    const all = await db.transactions.toArray();
    return all.filter((t) => !t.isDeleted);
  },

  async getById(id: string): Promise<Transaction | undefined> {
    return db.transactions.get(id);
  },

  /** Includes soft-deleted rows — used only by undo. */
  async getByIdIncludingDeleted(id: string): Promise<Transaction | undefined> {
    return db.transactions.get(id);
  },

  async add(transaction: Transaction): Promise<void> {
    await db.transactions.add(transaction);
  },

  async update(id: string, patch: Partial<Transaction>): Promise<void> {
    await db.transactions.update(id, patch);
  },

  async recentByAccount(
    accountId: string,
    limit: number,
  ): Promise<Transaction[]> {
    const all = await db.transactions
      .where("accountId")
      .equals(accountId)
      .toArray();
    return all
      .filter((t) => !t.isDeleted)
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
      .slice(0, limit);
  },

  /** All recurring-generated entries (Phase 5 history) — `source: 'auto'`
   * is the marker the scheduler set on creation. Newest first. */
  async getRecurringGenerated(): Promise<Transaction[]> {
    const all = await db.transactions.toArray();
    return all
      .filter((t) => !t.isDeleted && t.source === "auto")
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  },

  /** History for one rule (Phase 5 per-rule history). Newest first. */
  async getByRecurringRule(ruleId: string): Promise<Transaction[]> {
    const all = await db.transactions
      .where("recurringRuleId")
      .equals(ruleId)
      .toArray();
    return all
      .filter((t) => !t.isDeleted)
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  },
};
