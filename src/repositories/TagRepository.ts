import { db } from "@/database/db";
import type { Tag } from "@/types/entities";

export const TagRepository = {
  async getAll(): Promise<Tag[]> {
    return db.tags.orderBy("name").toArray();
  },

  async findByName(name: string): Promise<Tag | undefined> {
    const all = await db.tags.toArray();
    return all.find((t) => t.name.toLowerCase() === name.toLowerCase());
  },

  /** Returns the existing tag if one matches case-insensitively, otherwise
   * creates it. Keeps `Transaction.tags[]` referencing real, deduplicated
   * tag names. */
  async findOrCreate(name: string): Promise<Tag> {
    const trimmed = name.trim();
    const existing = await this.findByName(trimmed);
    if (existing) return existing;

    const tag: Tag = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: new Date().toISOString(),
    };
    await db.tags.add(tag);
    return tag;
  },
};
