import type { Transaction } from '@/types/entities'

/** True for a transfer's credit (destination) leg — the one that should be
 * hidden from any list that spans multiple accounts, since the debit leg
 * already represents "the transfer" to the user. Only relevant when
 * viewing a single account's own history (Phase 3 Account Detail), where
 * both legs matter. */
export function isTransferCreditLeg(t: Transaction): boolean {
  return t.transferDirection === 'credit'
}
