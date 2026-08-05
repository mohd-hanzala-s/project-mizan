import { db } from "@/database/db";
import { AccountRepository } from "@/repositories/AccountRepository";
import { TagRepository } from "@/repositories/TagRepository";
import type {
  Transaction,
  TransactionStatus,
  TransactionType,
} from "@/types/entities";

/** Transfers always land here (§6 Categorization doesn't apply to them —
 * they never affect budgets/spending analysis), set up for exactly this in
 * Phase 0's seed data. */
const TRANSFER_CATEGORY_ID = "cat-transfers";

/** Whether a transaction currently has a live account-balance effect.
 * Only `paid` rows do — `pending` recurring-generated entries (§6: "Generated
 * entries start Pending; user marks Paid/…") are placeholders that must not
 * move money until the user confirms them, and skipped/postponed/missed
 * never do. Transfers are always created `paid`, so a status check alone is
 * sufficient. Used to guard delete/restore/edit balance reversals so a
 * balance-less row can't inject or remove money by accident. */
function affectsBalance(t: Transaction): boolean {
  return t.status === "paid";
}

/**
 * §6 balance effect per single-account transaction type. Transfers are
 * handled separately (see `applyBalanceEffect`/`reverseBalanceEffect`
 * below) since one transfer touches two accounts in opposite directions —
 * this function only ever applies to the single-account types.
 * `adjustment` and `reversal` intentionally return 0 and should be
 * implemented properly by whichever phase first creates them, rather than
 * guessed at now. `refund` is treated as money coming back (same direction
 * as income).
 */
function balanceEffect(type: TransactionType, amount: number): number {
  switch (type) {
    case "expense":
      return -amount;
    case "income":
    case "refund":
      return amount;
    default:
      return 0;
  }
}

/** A transfer's debit leg reduces its account; the credit leg increases
 * its account — same amount, opposite sign, per `transferDirection`. */
async function applyBalanceEffect(t: Transaction): Promise<void> {
  if (t.type === "transfer") {
    await AccountRepository.adjustBalance(
      t.accountId,
      t.transferDirection === "credit" ? t.amount : -t.amount,
    );
  } else {
    await AccountRepository.adjustBalance(
      t.accountId,
      balanceEffect(t.type, t.amount),
    );
  }
}

async function reverseBalanceEffect(t: Transaction): Promise<void> {
  if (t.type === "transfer") {
    await AccountRepository.adjustBalance(
      t.accountId,
      t.transferDirection === "credit" ? -t.amount : t.amount,
    );
  } else {
    await AccountRepository.adjustBalance(
      t.accountId,
      -balanceEffect(t.type, t.amount),
    );
  }
}

export interface CreateTransactionInput {
  amount: number;
  description: string;
  type: "expense" | "income";
  categoryId: string;
  accountId: string;
  transactionDate: string;
  notes?: string;
  tags?: string[];
  source?: Transaction["source"];
}

export interface CreateTransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description?: string;
  transactionDate: string;
  notes?: string;
}

/** Input for a recurring-generated entry (§6: "Generated entries start
 * Pending"). Deliberately narrower than `CreateTransactionInput` — no tags,
 * no notes, fixed source `auto` — because these rows are created by the
 * scheduler, not the user. */
export interface CreateScheduledTransactionInput {
  amount: number;
  description: string;
  type: "expense" | "income";
  categoryId: string;
  accountId: string;
  transactionDate: string;
  recurringRuleId: string;
}

function newTransactionId() {
  return crypto.randomUUID();
}

export const TransactionService = {
  async create(input: CreateTransactionInput): Promise<Transaction> {
    if (!(input.amount > 0)) {
      throw new Error("Amount is required and must be greater than 0.");
    }

    const tagObjects = await Promise.all(
      (input.tags ?? []).map((t) => TagRepository.findOrCreate(t)),
    );
    const now = new Date().toISOString();

    const transaction: Transaction = {
      id: newTransactionId(),
      createdAt: now,
      updatedAt: now,
      transactionDate: input.transactionDate,
      type: input.type,
      amount: input.amount,
      currency: "INR",
      description: input.description,
      categoryId: input.categoryId,
      accountId: input.accountId,
      recurringRuleId: null,
      loanId: null,
      budgetId: null,
      tags: tagObjects.map((t) => t.name),
      notes: input.notes ?? "",
      status: "paid",
      source: input.source ?? "manual",
      isFavorite: false,
      isDeleted: false,
      version: 1,
      linkedTransactionId: null,
    };

    await db.transaction("rw", db.transactions, db.accounts, async () => {
      await db.transactions.add(transaction);
      await applyBalanceEffect(transaction);
    });

    return transaction;
  },

  /** §6: a Transfer "internally creates two linked entries (debit +
   * credit) joined via linkedTransactionId; the user sees one transfer."
   * Both accounts must exist and differ. Never categorized by the user —
   * always TRANSFER_CATEGORY_ID, since transfers don't affect
   * budgets/spending analysis. */
  async createTransfer(input: CreateTransferInput): Promise<Transaction> {
    if (!(input.amount > 0)) {
      throw new Error("Amount is required and must be greater than 0.");
    }
    if (input.fromAccountId === input.toAccountId) {
      throw new Error("Choose two different accounts.");
    }

    const [fromAccount, toAccount] = await Promise.all([
      AccountRepository.getById(input.fromAccountId),
      AccountRepository.getById(input.toAccountId),
    ]);
    if (!fromAccount || !toAccount) throw new Error("Account not found.");

    const now = new Date().toISOString();
    const debitId = newTransactionId();
    const creditId = newTransactionId();

    const shared = {
      createdAt: now,
      updatedAt: now,
      transactionDate: input.transactionDate,
      type: "transfer" as const,
      amount: input.amount,
      currency: "INR",
      categoryId: TRANSFER_CATEGORY_ID,
      recurringRuleId: null,
      loanId: null,
      budgetId: null,
      tags: [],
      notes: input.notes ?? "",
      status: "paid" as const,
      source: "manual" as const,
      isFavorite: false,
      isDeleted: false,
      version: 1,
    };

    const debit: Transaction = {
      ...shared,
      id: debitId,
      description: input.description || `Transfer to ${toAccount.name}`,
      accountId: input.fromAccountId,
      linkedTransactionId: creditId,
      transferDirection: "debit",
    };
    const credit: Transaction = {
      ...shared,
      id: creditId,
      description: input.description || `Transfer from ${fromAccount.name}`,
      accountId: input.toAccountId,
      linkedTransactionId: debitId,
      transferDirection: "credit",
    };

    await db.transaction("rw", db.transactions, db.accounts, async () => {
      await db.transactions.add(debit);
      await db.transactions.add(credit);
      await applyBalanceEffect(debit);
      await applyBalanceEffect(credit);
    });

    return debit;
  },

  /** Full replace of the editable fields. Reverses the old balance effect
   * and applies the new one — correct even if amount, type, or account
   * changed. Not for transfers — see `createTransfer`; editing a transfer's
   * accounts/amount isn't supported in Phase 3 (delete and recreate). */
  async update(
    id: string,
    input: CreateTransactionInput,
  ): Promise<Transaction> {
    if (!(input.amount > 0)) {
      throw new Error("Amount is required and must be greater than 0.");
    }

    const existing = await db.transactions.get(id);
    if (!existing) throw new Error(`Transaction ${id} not found`);
    if (existing.type === "transfer") {
      throw new Error(
        "Transfers can\u2019t be edited yet — delete and recreate instead.",
      );
    }

    const tagObjects = await Promise.all(
      (input.tags ?? []).map((t) => TagRepository.findOrCreate(t)),
    );

    const updated: Transaction = {
      ...existing,
      transactionDate: input.transactionDate,
      type: input.type,
      amount: input.amount,
      description: input.description,
      categoryId: input.categoryId,
      accountId: input.accountId,
      tags: tagObjects.map((t) => t.name),
      notes: input.notes ?? existing.notes,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    };

    await db.transaction("rw", db.transactions, db.accounts, async () => {
      // Reverse the old effect on the old account, then apply the new
      // effect on the (possibly different) new account. A `pending`
      // recurring-generated row never applied an effect in the first place,
      // so editing it must not reverse/re-apply one (it stays pending).
      if (affectsBalance(existing)) await reverseBalanceEffect(existing);
      if (affectsBalance(updated)) await applyBalanceEffect(updated);
      await db.transactions.put(updated);
    });

    return updated;
  },

  /** Soft delete (§5) — reverses the balance effect immediately. For a
   * transfer, cascades to the linked leg so both disappear together, per
   * §6 ("the user sees one transfer"). Pair with `restore()` for the ~10s
   * undo window (§6). */
  async softDelete(id: string): Promise<void> {
    const existing = await db.transactions.get(id);
    if (!existing || existing.isDeleted) return;

    const linked =
      existing.type === "transfer" && existing.linkedTransactionId
        ? await db.transactions.get(existing.linkedTransactionId)
        : undefined;

    await db.transaction("rw", db.transactions, db.accounts, async () => {
      const now = new Date().toISOString();
      // Pending recurring-generated rows have no balance effect to undo.
      if (affectsBalance(existing)) await reverseBalanceEffect(existing);
      await db.transactions.update(id, { isDeleted: true, updatedAt: now });
      if (linked && !linked.isDeleted) {
        await reverseBalanceEffect(linked);
        await db.transactions.update(linked.id, {
          isDeleted: true,
          updatedAt: now,
        });
      }
    });
  },

  async restore(id: string): Promise<void> {
    const existing = await db.transactions.get(id);
    if (!existing || !existing.isDeleted) return;

    const linked =
      existing.type === "transfer" && existing.linkedTransactionId
        ? await db.transactions.get(existing.linkedTransactionId)
        : undefined;

    await db.transaction("rw", db.transactions, db.accounts, async () => {
      const now = new Date().toISOString();
      if (affectsBalance(existing)) await applyBalanceEffect(existing);
      await db.transactions.update(id, { isDeleted: false, updatedAt: now });
      if (linked && linked.isDeleted) {
        await applyBalanceEffect(linked);
        await db.transactions.update(linked.id, {
          isDeleted: false,
          updatedAt: now,
        });
      }
    });
  },

  /** Creates a new, independent transaction with the same details (today's
   * date), applying its own balance effect — this is a real new entry, not
   * a reference to the original (§3: TransactionCard long-press =
   * duplicate). Not for transfers — duplicating one leg alone would break
   * the linked-entry model. */
  async duplicate(id: string): Promise<Transaction> {
    const existing = await db.transactions.get(id);
    if (!existing) throw new Error(`Transaction ${id} not found`);
    if (existing.type === "transfer") {
      throw new Error(
        "Transfers can\u2019t be duplicated — create a new transfer instead.",
      );
    }

    return this.create({
      amount: existing.amount,
      description: existing.description,
      type: existing.type === "income" ? "income" : "expense",
      categoryId: existing.categoryId,
      accountId: existing.accountId,
      transactionDate: new Date().toISOString(),
      notes: existing.notes,
      tags: existing.tags,
    });
  },

  /** §6 recurring auto-generation: creates a `pending`, `source: 'auto'`
   * entry for one scheduled occurrence. Deliberately applies NO balance
   * effect — a pending entry is a placeholder until the user marks it Paid
   * (`markPaid`), at which point the effect lands. Links the row to its
   * rule via `recurringRuleId` so the Recurring page can show per-rule
   * history and the TransactionCard can render the recurring indicator. */
  async createScheduled(
    input: CreateScheduledTransactionInput,
  ): Promise<Transaction> {
    if (!(input.amount > 0)) {
      throw new Error("Amount is required and must be greater than 0.");
    }

    const now = new Date().toISOString();
    const transaction: Transaction = {
      id: newTransactionId(),
      createdAt: now,
      updatedAt: now,
      transactionDate: input.transactionDate,
      type: input.type,
      amount: input.amount,
      currency: "INR",
      description: input.description,
      categoryId: input.categoryId,
      accountId: input.accountId,
      recurringRuleId: input.recurringRuleId,
      loanId: null,
      budgetId: null,
      tags: [],
      notes: "",
      status: "pending",
      source: "auto",
      isFavorite: false,
      isDeleted: false,
      version: 1,
      linkedTransactionId: null,
    };

    await db.transactions.add(transaction);
    return transaction;
  },

  /** User confirms a pending recurring entry (§6: "user marks Paid").
   * Applies the balance effect exactly once — idempotent for rows already
   * paid (including ordinary manually-entered ones, which never reach here
   * in practice but would be a safe no-op). */
  async markPaid(id: string): Promise<void> {
    const existing = await db.transactions.get(id);
    if (!existing) throw new Error(`Transaction ${id} not found`);
    if (existing.status === "paid") return;

    await db.transaction("rw", db.transactions, db.accounts, async () => {
      await applyBalanceEffect(existing);
      await db.transactions.update(id, {
        status: "paid",
        updatedAt: new Date().toISOString(),
      });
    });
  },

  /** Marks a recurring-generated entry Skipped/Postponed/Missed (or back to
   * Pending — status changes among the non-paid states are reversible).
   * None of these apply a balance effect. `paid` is deliberately excluded:
   * that transition is `markPaid`, which owns the balance math. */
  async updateStatus(
    id: string,
    status: Exclude<TransactionStatus, "paid">,
  ): Promise<void> {
    const existing = await db.transactions.get(id);
    if (!existing) throw new Error(`Transaction ${id} not found`);

    await db.transactions.update(id, {
      status,
      updatedAt: new Date().toISOString(),
    });
  },
};
