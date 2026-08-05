import { db } from '@/database/db'
import type { Budget } from '@/types/entities'

export const BudgetRepository = {
  async getAll(): Promise<Budget[]> {
    const all = await db.budgets.toArray()
    return all.filter((b) => b.active)
  },

  async getById(id: string): Promise<Budget | undefined> {
    return db.budgets.get(id)
  },

  async findByCategory(categoryId: string): Promise<Budget | undefined> {
    const all = await db.budgets.toArray()
    return all.find((b) => b.active && b.categoryId === categoryId)
  },

  async add(budget: Budget): Promise<void> {
    await db.budgets.add(budget)
  },

  async update(id: string, patch: Partial<Budget>): Promise<void> {
    await db.budgets.update(id, { ...patch, updatedAt: new Date().toISOString() })
  },
}
