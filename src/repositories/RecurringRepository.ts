import { db } from "@/database/db";
import type { RecurringRule } from "@/types/entities";

export const RecurringRepository = {
  /** Active rules only — the schedule that's actually running. Paused
   * (inactive) rules are invisible to generation and most consumers. */
  async getAll(): Promise<RecurringRule[]> {
    const all = await db.recurring_rules.toArray();
    return all.filter((r) => r.active);
  },

  /** Includes paused rules — the management screen needs to list and
   * resume them. */
  async getAllIncludingInactive(): Promise<RecurringRule[]> {
    return db.recurring_rules.toArray();
  },

  async getById(id: string): Promise<RecurringRule | undefined> {
    return db.recurring_rules.get(id);
  },

  async add(rule: RecurringRule): Promise<void> {
    await db.recurring_rules.add(rule);
  },

  async update(id: string, patch: Partial<RecurringRule>): Promise<void> {
    await db.recurring_rules.update(id, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  },

  async delete(id: string): Promise<void> {
    await db.recurring_rules.delete(id);
  },
};
