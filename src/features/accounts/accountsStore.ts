import { create } from 'zustand'
import { AccountRepository } from '@/repositories/AccountRepository'
import type { Account } from '@/types/entities'

interface AccountsState {
  accounts: Account[]
  archivedAccounts: Account[]
  isLoading: boolean
  load: () => Promise<void>
}

export const useAccountsStore = create<AccountsState>((set) => ({
  accounts: [],
  archivedAccounts: [],
  isLoading: true,

  load: async () => {
    set({ isLoading: true })
    const all = await AccountRepository.getAllIncludingArchived()
    set({
      accounts: all.filter((a) => !a.isArchived),
      archivedAccounts: all.filter((a) => a.isArchived),
      isLoading: false,
    })
  },
}))
