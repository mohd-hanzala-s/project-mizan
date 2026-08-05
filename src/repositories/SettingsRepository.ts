import { db } from '@/database/db'
import type { Settings } from '@/types/entities'

export const SettingsRepository = {
  async get(): Promise<Settings> {
    const settings = await db.settings.get('active')
    if (!settings) {
      throw new Error('Settings row missing — database was not seeded correctly.')
    }
    return settings
  },

  async update(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
    await db.settings.update('active', patch)
    return this.get()
  },
}
