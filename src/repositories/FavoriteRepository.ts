import { db } from '@/database/db'
import type { Favorite } from '@/types/entities'

export const FavoriteRepository = {
  /** §5: sort by usageCount then lastUsed. */
  async getAll(): Promise<Favorite[]> {
    const all = await db.favorites.toArray()
    return all.sort((a, b) => b.usageCount - a.usageCount || b.lastUsed.localeCompare(a.lastUsed))
  },

  async getById(id: string): Promise<Favorite | undefined> {
    return db.favorites.get(id)
  },

  async findByTitle(title: string): Promise<Favorite | undefined> {
    const all = await db.favorites.toArray()
    return all.find((f) => f.title.toLowerCase() === title.toLowerCase())
  },

  async add(favorite: Favorite): Promise<void> {
    await db.favorites.add(favorite)
  },

  async update(id: string, patch: Partial<Favorite>): Promise<void> {
    await db.favorites.update(id, patch)
  },

  async remove(id: string): Promise<void> {
    await db.favorites.delete(id)
  },
}
