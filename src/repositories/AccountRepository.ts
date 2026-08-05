import { db } from "@/database/db";
import type { Account } from "@/types/entities";

export const AccountRepository = {
  async getAll(): Promise<Account[]> {
    const all = await db.accounts.toArray();
    return all.filter((a) => !a.isArchived);
  },

  /** Includes archived accounts — the Accounts management screen needs to
   * show and unarchive them; every other consumer wants `getAll()`. */
  async getAllIncludingArchived(): Promise<Account[]> {
    return db.accounts.toArray();
  },

  async getById(id: string): Promise<Account | undefined> {
    return db.accounts.get(id);
  },

  async add(account: Account): Promise<void> {
    await db.accounts.add(account);
  },

  async update(id: string, patch: Partial<Account>): Promise<void> {
    await db.accounts.update(id, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  },

  /** Adds `delta` to an account's current balance (negative to subtract).
   * Callers are expected to run this inside a db.transaction() alongside
   * the transaction write it's balancing (see TransactionService) so the
   * two never drift out of sync. */
  async adjustBalance(accountId: string, delta: number): Promise<void> {
    const account = await db.accounts.get(accountId);
    if (!account) throw new Error(`Account ${accountId} not found`);
    await db.accounts.update(accountId, {
      currentBalance: account.currentBalance + delta,
      updatedAt: new Date().toISOString(),
    });
  },
};
