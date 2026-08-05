import { create } from 'zustand'
import { SettingsRepository } from '@/repositories/SettingsRepository'
import type { Settings } from '@/types/entities'

interface SettingsState {
  settings: Settings | null
  isLoading: boolean
  load: () => Promise<void>
  update: (patch: Partial<Omit<Settings, 'id'>>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  isLoading: true,

  load: async () => {
    set({ isLoading: true })
    const settings = await SettingsRepository.get()
    set({ settings, isLoading: false })
  },

  update: async (patch) => {
    const settings = await SettingsRepository.update(patch)
    set({ settings })
  },
}))
