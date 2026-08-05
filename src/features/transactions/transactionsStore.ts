import { create } from 'zustand'
import { TransactionRepository } from '@/repositories/TransactionRepository'
import { TransactionService } from '@/services/TransactionService'
import { FavoriteService } from '@/services/FavoriteService'
import type { Transaction } from '@/types/entities'

const UNDO_WINDOW_MS = 10_000

interface PendingUndo {
  message: string
  onUndo: () => void
}

interface TransactionsState {
  transactions: Transaction[]
  isLoading: boolean
  sheetOpen: boolean
  editingTransaction: Transaction | null
  pendingUndo: PendingUndo | null

  load: () => Promise<void>
  openAddSheet: () => void
  openEditSheet: (transaction: Transaction) => void
  closeSheet: () => void

  /** Called by SmartEntryInput after a successful save. Reads the
   * pre-edit snapshot from `editingTransaction` itself (captured before
   * `closeSheet()` clears it) rather than requiring the caller to track it. */
  handleSaved: (transaction: Transaction, wasEdit: boolean) => void

  deleteTransaction: (transaction: Transaction) => Promise<void>
  duplicateTransaction: (transaction: Transaction) => Promise<void>
  toggleFavorite: (transaction: Transaction) => Promise<void>

  showUndo: (message: string, onUndo: () => void) => void
  dismissUndo: () => void
}

let undoTimeout: ReturnType<typeof setTimeout> | undefined

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  transactions: [],
  isLoading: true,
  sheetOpen: false,
  editingTransaction: null,
  pendingUndo: null,

  load: async () => {
    set({ isLoading: true })
    const transactions = await TransactionRepository.getAll()
    set({ transactions, isLoading: false })
  },

  openAddSheet: () => set({ sheetOpen: true, editingTransaction: null }),
  openEditSheet: (transaction) => set({ sheetOpen: true, editingTransaction: transaction }),
  closeSheet: () => set({ sheetOpen: false, editingTransaction: null }),

  handleSaved: (transaction, wasEdit) => {
    const previousSnapshot = get().editingTransaction
    get().closeSheet()
    get().load()

    if (wasEdit && previousSnapshot) {
      get().showUndo('Transaction updated', async () => {
        await TransactionService.update(previousSnapshot.id, {
          amount: previousSnapshot.amount,
          description: previousSnapshot.description,
          type: previousSnapshot.type === 'income' ? 'income' : 'expense',
          categoryId: previousSnapshot.categoryId,
          accountId: previousSnapshot.accountId,
          transactionDate: previousSnapshot.transactionDate,
          notes: previousSnapshot.notes,
          tags: previousSnapshot.tags,
        })
        get().load()
      })
    } else if (!wasEdit) {
      get().showUndo('Transaction added', async () => {
        await TransactionService.softDelete(transaction.id)
        get().load()
      })
    }
  },

  deleteTransaction: async (transaction) => {
    await TransactionService.softDelete(transaction.id)
    get().load()
    get().showUndo('Transaction deleted', async () => {
      await TransactionService.restore(transaction.id)
      get().load()
    })
  },

  duplicateTransaction: async (transaction) => {
    const copy = await TransactionService.duplicate(transaction.id)
    get().load()
    get().showUndo('Transaction duplicated', async () => {
      await TransactionService.softDelete(copy.id)
      get().load()
    })
  },

  toggleFavorite: async (transaction) => {
    await FavoriteService.toggle(transaction)
    get().load()
  },

  showUndo: (message, onUndo) => {
    clearTimeout(undoTimeout)
    set({ pendingUndo: { message, onUndo } })
    undoTimeout = setTimeout(() => set({ pendingUndo: null }), UNDO_WINDOW_MS)
  },

  dismissUndo: () => {
    clearTimeout(undoTimeout)
    set({ pendingUndo: null })
  },
}))
