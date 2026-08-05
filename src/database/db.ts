import Dexie, { type EntityTable } from "dexie";
import type {
  Account,
  Category,
  Settings,
  Transaction,
  Favorite,
  Tag,
  Budget,
  RecurringRule,
  Loan,
  LoanPayment,
} from "@/types/entities";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
} from "@/constants/seed-data";

/**
 * §5 DATA ARCHITECTURE — IndexedDB via Dexie, versioned schema, automatic
 * migrations. Each phase that needs a new store adds it via
 * `db.version(N).stores({...})` — per §11 "never modify schema without
 * migration" — restating the full desired schema for that version (Dexie's
 * own convention; it diffs against the previous version automatically). See
 * CHANGELOG.md for the store(s) each version added.
 */
class NexusFinanceDB extends Dexie {
  accounts!: EntityTable<Account, "id">;
  categories!: EntityTable<Category, "id">;
  settings!: EntityTable<Settings, "id">;
  transactions!: EntityTable<Transaction, "id">;
  favorites!: EntityTable<Favorite, "id">;
  tags!: EntityTable<Tag, "id">;
  budgets!: EntityTable<Budget, "id">;
  recurring_rules!: EntityTable<RecurringRule, "id">;
  loans!: EntityTable<Loan, "id">;
  loan_payments!: EntityTable<LoanPayment, "id">;

  constructor() {
    super("nexus-finance");

    // §5 lists `isArchived` as an index on Account, but IndexedDB doesn't
    // accept `boolean` as a valid key type — Dexie would throw a DataError
    // writing the index entry. Left unindexed; these tables stay small
    // (dozens of rows) so repositories filter in memory instead.
    this.version(1).stores({
      accounts: "id, type",
      categories: "id, name, parentCategory",
      settings: "id",
    });

    // Phase 1 — Core Transaction Engine. Indexes exactly match §5's list for
    // Transaction (transactionDate, categoryId, accountId, amount, type,
    // status, recurringRuleId, loanId); `isFavorite`/`isDeleted` are
    // booleans and, as above, can't be indexed — filtered in memory.
    this.version(2).stores({
      accounts: "id, type",
      categories: "id, name, parentCategory",
      settings: "id",
      transactions:
        "id, transactionDate, categoryId, accountId, amount, type, status, recurringRuleId, loanId",
      favorites: "id, categoryId, usageCount, lastUsed",
      tags: "id, &name",
    });

    // Phase 3 — Accounts. No index changes (Transaction.transferDirection
    // is a new unindexed field — IndexedDB doesn't require every stored
    // property to be declared), but bumping the version anyway to mark the
    // checkpoint in the migration history, per §11.
    this.version(3).stores({
      accounts: "id, type",
      categories: "id, name, parentCategory",
      settings: "id",
      transactions:
        "id, transactionDate, categoryId, accountId, amount, type, status, recurringRuleId, loanId",
      favorites: "id, categoryId, usageCount, lastUsed",
      tags: "id, &name",
    });

    // Phase 4 — Budgets. Adds `budgets`, indexed on categoryId per §5
    // (GLOBAL_BUDGET_CATEGORY_ID is a plain string, so it indexes fine —
    // see the comment on that constant for why it isn't null).
    this.version(4).stores({
      accounts: "id, type",
      categories: "id, name, parentCategory",
      settings: "id",
      transactions:
        "id, transactionDate, categoryId, accountId, amount, type, status, recurringRuleId, loanId",
      favorites: "id, categoryId, usageCount, lastUsed",
      tags: "id, &name",
      budgets: "id, categoryId",
    });

    // Phase 5 — Recurring Engine. Adds `recurring_rules`, indexed on
    // nextExecution per §5. §5 also lists `active` as an index, but it's a
    // boolean — not a valid IndexedDB key type (same problem `isArchived`
    // caused in Phase 0), so it's filtered in memory; rules are a small
    // table (scalability target: 100+).
    this.version(5).stores({
      accounts: "id, type",
      categories: "id, name, parentCategory",
      settings: "id",
      transactions:
        "id, transactionDate, categoryId, accountId, amount, type, status, recurringRuleId, loanId",
      favorites: "id, categoryId, usageCount, lastUsed",
      tags: "id, &name",
      budgets: "id, categoryId",
      recurring_rules: "id, nextExecution",
    });

    // Phase 6 — Loan Manager. Adds `loans` (indexed on dueDay, status per
    // §5 — both plain strings/numbers, so no boolean-key problem) and
    // `loan_payments` (indexed on loanId, paymentDate per §5).
    this.version(6).stores({
      accounts: "id, type",
      categories: "id, name, parentCategory",
      settings: "id",
      transactions:
        "id, transactionDate, categoryId, accountId, amount, type, status, recurringRuleId, loanId",
      favorites: "id, categoryId, usageCount, lastUsed",
      tags: "id, &name",
      budgets: "id, categoryId",
      recurring_rules: "id, nextExecution",
      loans: "id, dueDay, status",
      loan_payments: "id, loanId, paymentDate",
    });

    this.on("populate", () => this.seed());
  }

  /** First-run seed data (§9 Phase 0): default categories, five default
   * accounts, settings row with budgetMonthStart defaulting to the 1st. */
  private async seed() {
    await this.accounts.bulkAdd(DEFAULT_ACCOUNTS);
    await this.categories.bulkAdd(DEFAULT_CATEGORIES);
    await this.settings.add(DEFAULT_SETTINGS);
  }
}

export const db = new NexusFinanceDB();
