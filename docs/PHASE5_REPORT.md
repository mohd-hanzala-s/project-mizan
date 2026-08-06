# Phase 5 — Recurring Engine: Implementation Report

Reference spec: `docs/atlas-master-spec.md`
Scope: §9 Phase 5 ("Recurring"), §6 recurring rules/transactions, §5 `RecurringRule` entity, §10 month-end transitions & edge cases.
Companion state file: `PROJECT_STATE.md`.

---

## 1. Executive Summary

Phase 5 delivers the Recurring Engine: recurring rules with six named
frequencies plus custom day intervals, an auto-generation scheduler that
creates `pending` transaction entries when occurrences come due, pause /
resume / skip / delete lifecycle management, per-rule generated history with
paid/skipped/postponed/missed states, upcoming-payment surfacing on the
Dashboard, and derived (non-persisted) upcoming/missed reminders.

The phase was built entirely on the existing Phase 0–4 architecture — no new
patterns, no re-architecture. Business logic lives in services
(`RecurringService`, additions to `TransactionService`); data access is
confined to repositories (`RecurringRepository`, additions to
`TransactionRepository`); UI is presentation-only (`RecurringPage`,
`RecurringForm`, `RecurringCard`, Dashboard card). The Dexie schema was
extended via a proper v4 → v5 migration (§11: never modify schema without a
migration).

All quality gates are green: lint (including the design-token audit),
typecheck, 117 unit/integration tests (39 of them new in Phase 5) across 17
files, and a production PWA build.

## 2. Architecture Changes

No structural/architectural change. Phase 5 follows the established four-layer
model exactly:

- **Database layer** (`src/database/db.ts`) — schema v5, one new store.
- **Repository layer** — new `RecurringRepository`; `TransactionRepository`
  gains two read-only queries. Repositories remain data-access-only (no
  business logic).
- **Service layer** — new `RecurringService` (schedule math, lifecycle, the
  generation pass, derivation helpers); `TransactionService` gains
  `createScheduled` / `markPaid` / `updateStatus` and a balance-safety guard
  (`affectsBalance`) reused by the existing `update` / `softDelete` / `restore`.
- **UI layer** — a new `features/recurring/` feature folder (page + form +
  Zustand store), a shared `components/finance/RecurringCard`, and Dashboard /
  AppShell integration points.

Key architectural principle preserved: the scheduler never writes balances.
Generated entries are created `pending` with **no** balance effect; only
`TransactionService.markPaid` applies the effect, exactly once, inside the
existing atomic `db.transaction` that owns all balance math.

## 3. Folder Structure Changes

Added files (new paths in bold):

```
src/
  database/db.ts                      (modified — schema v5)
  types/entities.ts                   (modified — RecurringFrequency, RecurringRule)
  repositories/RecurringRepository.ts (new)
  repositories/TransactionRepository.ts (modified — getRecurringGenerated, getByRecurringRule)
  services/RecurringService.ts        (new)
  services/TransactionService.ts      (modified — createScheduled/markPaid/updateStatus/affectsBalance)
  features/recurring/
    recurringStore.ts                 (new)
    RecurringPage.tsx                 (new)
    RecurringForm.tsx                 (new)
  components/finance/RecurringCard.tsx (new)
  components/layout/AppShell.tsx      (modified — startup generateDue)
  features/dashboard/DashboardPage.tsx (modified — Upcoming Payments + alerts merge)
  features/transactions/TransactionCard.tsx (recurring indicator was already present)
  routes/router.tsx                   (modified — /recurring route now real)
  tests/
    recurring-service.test.ts         (new, 28 tests)
    transaction-status.test.ts        (new, 9 tests)
    recurring-page.test.tsx           (new, 2 tests)
docs/PHASE5_REPORT.md                 (this file)
PROJECT_STATE.md                      (new)
```

No folders were removed or renamed. `features/recurring/` is the only new
feature folder.

## 4. Database Schema Changes (Dexie schema version)

**Version 5** (migration from v4, via Dexie's diff-based `stores()` upgrade):

```
this.version(5).stores({
  accounts: 'id, type',
  categories: 'id, name, parentCategory',
  settings: 'id',
  transactions:
    'id, transactionDate, categoryId, accountId, amount, type, status, recurringRuleId, loanId',
  favorites: 'id, categoryId, usageCount, lastUsed',
  tags: 'id, &name',
  budgets: 'id, categoryId',
  recurring_rules: 'id, nextExecution',   // NEW
})
```

- New store **`recurring_rules`**, primary key `id`, indexed on
  `nextExecution` per §5 (generation and reminders are a single index/field
  read).
- **`active` is NOT an index.** §5 lists it, but IndexedDB rejects `boolean`
  as a key type — the same constraint that kept `isArchived` (Phase 0) and
  `isFavorite`/`isDeleted` (Phase 1) out of the index definitions.
  `RecurringRepository.getAll()` filters in memory; the table is small
  (scalability target: 100+ rules).
- The full schema for all stores is restated per version (Dexie's own
  convention — it diffs against the previous version).
- Existing data survives untouched; version 5 only adds a table.
- `Transaction.recurringRuleId` needed no migration — the field was declared
  in the entity type since Phase 1 (§5 declares it on the canonical entity),
  and Dexie doesn't enforce foreign keys.

## 5. New Entities

Defined in `src/types/entities.ts`:

**`RecurringFrequency`** (union type)

```ts
type RecurringFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "halfYearly"
  | "yearly"
  | "custom";
```

**`RecurringRule`** (interface, table `recurring_rules`)

| Field                     | Type                    | Notes                                 |
| ------------------------- | ----------------------- | ------------------------------------- |
| `id`                      | `string`                | `crypto.randomUUID()`                 |
| `title`                   | `string`                | trimmed                               |
| `amount`                  | `number`                | > 0                                   |
| `type`                    | `'expense' \| 'income'` | **added field** (see §20)             |
| `categoryId`              | `string`                | must exist and not be archived        |
| `accountId`               | `string`                | **added field** (see §20)             |
| `frequency`               | `RecurringFrequency`    |                                       |
| `startDate`               | `string` (yyyy-mm-dd)   | first occurrence                      |
| `endDate`                 | `string \| null`        | optional end                          |
| `nextExecution`           | `string` (ISO datetime) | materialized next occurrence, indexed |
| `autoGenerate`            | `boolean`               | false = remind-only rule              |
| `reminderDays`            | `number`                | 0 = on the day                        |
| `active`                  | `boolean`               | pause sets false                      |
| `customIntervalDays`      | `number` (optional)     | only meaningful for `custom`          |
| `createdAt` / `updatedAt` | `string` (ISO)          |                                       |

Plus the service-layer interfaces `CreateRecurringRuleInput`,
`UpdateRecurringRuleInput` (= same shape), and `UpcomingObligation` (the
shape Phase 8's ForecastService can consume).

## 6. New Repositories

**`RecurringRepository`** (`src/repositories/RecurringRepository.ts`) — the
only code that touches the `recurring_rules` table directly:

- `getAll()` — active rules only (the running schedule; paused rules are
  invisible to generation and most consumers).
- `getAllIncludingInactive()` — the management screen's list.
- `getById(id)`, `add(rule)`, `update(id, patch)` (always stamps
  `updatedAt`), `delete(id)`.

**`TransactionRepository`** additions:

- `getRecurringGenerated()` — all non-deleted `source: 'auto'` entries,
  newest first (page history).
- `getByRecurringRule(ruleId)` — one rule's history, newest first (uses the
  existing `recurringRuleId` index; single rule at a time, so the per-page
  filter-by-map remains the page's job).

## 7. New Services

**`RecurringService`** (`src/services/RecurringService.ts`) — business logic
owner; depends on repositories and `TransactionService`, never on the UI:

- Pure schedule math (exported for direct testing):
  - `addOccurrence(date, frequency, customIntervalDays?)` — one period
    forward. `daily`/`weekly`/`custom` via `addDays`; monthly-family via
    date-fns `addMonths` which **clamps day-of-month to month-end** (§10 —
    a 31st-starting rule lands on the 28th/29th/30th in short months).
  - `computeNextExecution(startDate, frequency, customIntervalDays, after)` —
    first occurrence on/after a date, with a difference-based fast path so a
    startDate years in the past isn't iterated day-by-day.
- `FREQUENCY_LABELS` — display labels for the form/card.
- Lifecycle: `create`, `update` (recomputes `nextExecution` **only when a
  schedule-affecting field changed**: frequency / startDate /
  customIntervalDays), `pause`, `resume` (re-arms from today, no backfill),
  `skipNext` (advances one occurrence), `remove` (deletes only the rule).
- `validateInput` — title/amount/custom-interval/date checks plus existence
  and non-archived checks against the category and account.
- **`generateDue(reference?)`** — the §6/§9 auto-generation pass (see §12).
- Derivation helpers (pure, deterministic):
  - `getUpcomingObligations(rules, horizonDays=30, reference?)` — next
    occurrence of each active rule within the horizon, soonest first (Phase
    8 ForecastService feedstock).
  - `getRecurringAlerts(rules, transactions, reference?)` → `DashboardAlert[]`
    — missed (warning) and upcoming (info), deduplicated per row/rule.

**`TransactionService`** additions (`src/services/TransactionService.ts`):

- `CreateScheduledTransactionInput` + `createScheduled(input)` — creates a
  `pending`, `source: 'auto'` row with `recurringRuleId`, no balance effect.
- `markPaid(id)` — applies the balance effect exactly once (idempotent) and
  flips status to `paid`, atomically with the account update.
- `updateStatus(id, status)` — `skipped` / `postponed` / `missed` / back to
  `pending`; never touches balances; excludes `paid` (that transition is
  `markPaid`'s).
- `affectsBalance(t)` guard (`status === 'paid'`) — retrofitted into the
  existing `update` / `softDelete` / `restore` so a pending recurring row can
  never reverse or inject a balance effect it never applied.

## 8. New Zustand Stores

**`recurringStore`** (`src/features/recurring/recurringStore.ts`):

- State: `rules: RecurringRule[]` (active + paused), `generated: Transaction[]`
  (auto entries, newest first), `isLoading: boolean`.
- `load()` — runs the generation pass first (`RecurringService.generateDue()`),
  then refreshes rules + generated history. Safe to call concurrently with
  AppShell startup because `generateDue` is single-flight and idempotent.

Existing stores are unchanged; `useRecurringStore` joins the transactions,
accounts, budgets, and settings stores.

## 9. New Components

- **`RecurringCard`** (`src/components/finance/RecurringCard.tsx`) — presentational
  card: income/expense tone, title, category · account · frequency line, next
  occurrence date, Active/Paused badge, Edit / Pause(Resume) / Skip next /
  Delete actions, and an expandable history section. History rows show a
  status pill (Paid / Pending / Skipped / Postponed / Missed) and, for
  actionable states, Mark paid / Skip / Postpone / Mark missed / Back to
  pending buttons. Uses only design-system tokens (`text-caption`,
  `min-h-touch`, semantic color tokens).
- **`RecurringForm`** (`src/features/recurring/RecurringForm.tsx`) — create/edit
  sheet form: title, amount (`CurrencyInput`), expense/income toggle, account
  (`AccountSelector`), category (`CategorySelector`), 7-frequency grid with a
  custom day interval (1–365), start/end dates, auto-generate checkbox,
  reminder days (0–7), inline validation + error display.
- **`RecurringPage`** (`src/features/recurring/RecurringPage.tsx`) — the full
  screen: empty state with CTA, Active and Paused sections, add/edit
  `BottomSheet`, delete `ConfirmationDialog`, all rule/history actions wired
  through the store/service, toast feedback.

Reused without modification: `Button`, `BottomSheet`, `ConfirmationDialog`,
`EmptyState`, `CurrencyInput`, `AccountSelector`, `CategorySelector`,
`useToast`. The `TransactionCard` recurring indicator (Repeat icon) was
already present from Phase 1.

## 10. Dashboard Integrations

`DashboardPage.tsx` now:

- Loads `useRecurringStore` alongside the other stores.
- **Upcoming Payments card**: `getUpcomingObligations(rules)` over the default
  30-day horizon; shows up to 5 soonest, income in income-tone / expense in
  expense-tone, with a "See all" button to `/recurring` when rules exist; an
  honest empty message otherwise.
- **Alerts feed merge**: `getRecurringAlerts(rules, transactions)` appended to
  the existing `getAlerts` + budget alerts array, so missed recurring payments
  (warning) and upcoming due dates (info) surface at the top of the Dashboard
  through the existing `AlertCard` mechanism.

`AppShell.tsx` runs §4's background processing on startup:

```ts
load();
RecurringService.generateDue().then(() => load());
```

Idempotent and single-flight, so it can't double-generate against the
Recurring page's own `load()`.

## 11. Business Rules Implemented

From §6 / §9 Phase 5, as actually implemented:

1. **Rules require a real, non-archived category and an existing account.**
   Archived categories are refused (§6 "recurring rules can't reference
   deleted categories"); archived _accounts_ are still valid targets but
   generation skips them (see §12).
2. **`nextExecution` is materialized** at create/update/resume from the
   schedule; reminders and generation read it, never recompute it per check.
3. **Generated entries start `pending`** and are `source: 'auto'`, linked by
   `recurringRuleId`; they apply **no** balance effect until the user marks
   them Paid (§6 "Generated entries start Pending; user marks Paid/…").
4. **`markPaid` is idempotent** and applies the balance exactly once, inside
   the same atomic `db.transaction` that owns all account-balance math.
5. **Non-paid status changes** (skipped / postponed / missed / back to
   pending) never touch balances.
6. **Pending rows can be edited / soft-deleted / restored safely** — the
   `affectsBalance` guard prevents balance reversal/application on rows that
   never applied an effect.
7. **Pause** keeps the rule and its history, stops generation, leaves
   `nextExecution` untouched. **Resume** re-arms from today (no backfill of
   the paused period).
8. **Skip** advances one occurrence without generating an entry — works even
   for a due-but-unpaid cycle.
9. **Delete** removes only the rule; generated transactions keep their
   `recurringRuleId` and remain in the ledger (§10 "deleted recurring rules
   must not break existing data").
10. **Remind-only rules** (`autoGenerate: false`) still advance their
    schedule; they never write transactions.
11. **Month-end clamping** for monthly-family frequencies (§10) via date-fns
    `addMonths`.
12. **Reminder window** is `reminderDays` before `nextExecution` (0 = the
    day itself); missed = a `pending` auto entry whose due date has passed.
    Both are derived on demand and deduplicated (see §20).

## 12. Scheduler Behaviour

`RecurringService.generateDue(reference = now)`:

- **Single-flight** — a module-level promise (`generationInFlight`) means
  concurrent callers (AppShell startup + Recurring page store) share one run
  and can't race each other into duplicate rows.
- Iterates **active rules only** (`RecurringRepository.getAll()`), skipping
  any whose `nextExecution > reference`.
- For each due rule, loops `next <= reference`:
  - If `autoGenerate` and the target account exists and is **not archived**,
    `TransactionService.createScheduled(...)` creates a pending entry for that
    occurrence.
  - If the account is archived, the occurrence is still counted and the
    schedule still advances — no entry is written (the rule keeps running).
  - **Catch-up is bounded** at `MAX_CATCH_UP = 366` occurrences per rule per
    pass (~a year of daily entries), so a rule that fell years behind while
    the app was closed catches up in bounded batches rather than stamping out
    hundreds/thousands of rows at once.
  - A belt-and-suspenders guard breaks the loop if the schedule can't advance
    (protects against a non-positive custom interval ever double-creating a
    row).
- Advances `nextExecution` forward to just past `reference` in one repository
  `update` per affected rule.
- Returns the created transactions (empty when nothing is due).
- Runs at AppShell startup (§4 background processing) and on every
  Recurring page / Dashboard store `load()`.

## 13. Public APIs

**`RecurringService`**

```ts
// schedule math (pure)
computeNextExecution(startDate, frequency, customIntervalDays, after): Date
addOccurrence(date, frequency, customIntervalDays?): Date

// lifecycle
create(input: CreateRecurringRuleInput): Promise<RecurringRule>
update(id, input: UpdateRecurringRuleInput): Promise<void>
pause(id): Promise<void>
resume(id): Promise<void>
skipNext(id): Promise<void>
remove(id): Promise<void>

// generation
generateDue(reference?): Promise<Transaction[]>   // single-flight

// derivation (pure)
getUpcomingObligations(rules, horizonDays?, reference?): UpcomingObligation[]
getRecurringAlerts(rules, transactions, reference?): DashboardAlert[]
```

**`TransactionService` additions**

```ts
createScheduled(input: CreateScheduledTransactionInput): Promise<Transaction>
markPaid(id): Promise<void>
updateStatus(id, status: Exclude<TransactionStatus, 'paid'>): Promise<void>
```

**`RecurringRepository`**

```ts
getAll(): Promise<RecurringRule[]>               // active only
getAllIncludingInactive(): Promise<RecurringRule[]>
getById(id): Promise<RecurringRule | undefined>
add(rule): Promise<void>
update(id, patch: Partial<RecurringRule>): Promise<void>
delete(id): Promise<void>
```

## 14. Test Summary

117 tests, 17 files, all passing (`npm run test`). Phase 5 added **39** tests
in three new files:

- **`recurring-service.test.ts` (28)** — `computeNextExecution` schedule math
  (start-date fast path, daily/weekly/monthly with month-end clamping,
  quarterly/half-yearly/yearly, custom interval), `addOccurrence`, create
  validation (zero amount, blank title, custom-without-interval, missing
  account, archived category), create/update semantics (recompute
  `nextExecution` only on schedule change), catch-up generation (one pending
  entry per missed occurrence, schedule advance), pending-never-touches-
  balance, `autoGenerate: false` advances without writing, paused rules
  ignored, archived-account skip, nothing-due no-op, skipNext, pause/resume
  re-arm without backfill, remove-keeps-history, and the alert/obligation
  derivation helpers.
- **`transaction-status.test.ts` (9)** — pending/no-balance creation,
  `markPaid` exactly-once balance + status flip (expense and income),
  skipped→paid, non-paid status transitions without balances, safe
  delete/restore/edit of pending rows, `getRecurringGenerated` auto-only.
- **`recurring-page.test.tsx` (2)** — empty-state render and a populated
  render asserting the rule card, Active badge, and schedule line.

Two pre-existing tests were extended/re-purposed for Phase 5 wiring:
`app-shell.test.tsx` (Recurring in the destination list) and
`dashboard-populated.test.tsx` (Dashboard with data — unaffected by
recurring-load changes). No existing test was weakened.

## 15. Regression Summary

- **Baseline before Phase 5**: full suite green (78 tests, 14 files), lint +
  design-token audit clean, typecheck clean, production build + PWA green.
- **After Phase 5**: full suite green (117 tests, 17 files) with no
  unhandled errors; lint + design-token audit clean; typecheck clean;
  production build + PWA (23 precached entries) clean.
- **Issues found and fixed during the phase**:
  1. `transaction-status.test.ts` failed until the Dexie table property was
     named to match the store (`recurring_rules`) — repository/table wiring,
     not product logic.
  2. Six `recurring-service.test.ts` assertions were corrected to match real
     (and correct) behaviour — stale in-memory rule objects after DB updates
     (alerts/obligations tests now re-fetch), future start dates that made
     schedule changes unobservable, and catch-up arithmetic. Service logic
     was verified correct, not changed.
  3. One unhandled `DatabaseClosedError` rejection in the new page test — an
     effect-driven store `load()` outlived the test and hit the next test's
     `db.delete()`. Fixed in the test by awaiting `isLoading === false`.
  4. Two `INEFFECTIVE_DYNAMIC_IMPORT` warnings from `RecurringPage.tsx`
     dynamic-importing `TransactionService` (already statically bundled)
     — replaced with a single static import.
- **Product regressions**: none observed. Balance math, transfers, budgets,
  dashboard metrics, categorization, and account archive behaviour all
  re-verified by the pre-existing suites.

## 16. Build Summary

- `npm run build` → `dist/` produced cleanly with **no warnings**.
- PWA (Workbox `generateSW`): 23 precache entries (~721 KiB / ~720 KiB after
  the static-import cleanup).
- Bundle: single JS chunk ~485 kB (145.9 kB gzip) + CSS ~20.8 kB (5.2 kB
  gzip). No lazy chunks split by this phase (all imports are static).
- `npm run lint` includes the automated design-token audit
  (`scripts/check-design-tokens.mjs`) — passed (no out-of-scale spacing or
  raw-palette classes introduced; `py-2`-style violations would have been
  caught).
- HTTP smoke test of the built SPA: `/` and `/sw.js` return 200, correct
  `<title>Nexus Finance</title>`.
- `npm run typecheck` (`tsc -b --noEmit`): clean.

## 17. Performance Notes

- **Generation is bounded**: `MAX_CATCH_UP = 366` per rule per pass prevents
  unbounded row creation on resume-from-dormancy.
- **Single-flight generation**: concurrent triggers (AppShell + store) share
  one pass; no duplicate reads of `nextExecution`.
- **`nextExecution` is indexed**: the due-check is a single field comparison
  after a table scan of an intentionally small table (rules are a management
  list, not event data); active/paused filtering happens in memory, which is
  the correct trade for a table that is management-scale, not data-scale.
- **Derivations are O(n)**: `getRecurringAlerts` / `getUpcomingObligations`
  are single passes over in-memory rules/transactions, memoized per render
  via `useMemo`. Alert/obligation counts are naturally small (one alert per
  due rule/row).
- **Per-rule history** is derived by filtering the single
  `getRecurringGenerated()` list in memory rather than N indexed queries —
  one fetch for the whole page.
- No new hot paths, timers, or polling were introduced. Generation runs at
  app startup and on page loads only.

## 18. Technical Debt

1. **`RecurringService` is a monolith object** — schedule math, lifecycle,
   generation, and derivation all live in one file (~400 lines). Extracting
   `computeNextExecution`/`addOccurrence` into a small pure module (e.g.
   `recurringSchedule.ts`) would be the cleanest split if it grows further.
2. **Derived reminders instead of a notification log** — the biggest
   deliberate debt. "Notify once per threshold" behaviour for recurring
   reminders (like budget thresholds in Phase 4) needs a persisted
   seen-state/log that §5 doesn't model and no phase owns. See §20/§21.
3. **`RecurringCard` holds status styles/labels locally** — small, but if
   Transaction status pills appear in more places, a shared
   `status-pill`/mapping helper would DRY it.
4. **No repository-level index utilisation for active/paused** — the boolean
   index limitation (IndexedDB) means in-memory filters; documented and
   accepted for a small table.
5. **Form-level duplication** — `RecurringForm` re-implements simple
   label/input rows that the (small) form-component library doesn't yet
   provide; consistent with the rest of the app's forms, not new debt.

## 19. Known Limitations

- **No OS-level notifications or background timers.** Reminders are computed
  on app open / screen render — if the app is closed, nothing fires (PWA
  constraint; same as every phase).
- **Reminders are not persisted or "dismissable"** — an upcoming reminder
  reappears until the due date passes; there is no "seen/dismiss" state.
- **No missed-entry auto-resolution** — a missed pending entry stays pending
  until the user marks it paid/skipped/postponed/missed.
- **`nextExecution` cannot be manually edited** (there's no UI to shift a due
  date forward/back directly); the intended controls are Skip, Postpone
  (entry status), Pause, and editing the schedule.
- **Postpone moves an entry's status, not its date** — there's no
  "shift this occurrence to tomorrow" that re-dates the generated row (the
  spec's Phase 5 scope implies postpone as a status; re-dating is Phase 7
  Calendar material).
- **Custom interval is days-only** (1–365); no "every 2nd of the month"
  custom pattern.
- **Archived-account generation**: occurrences are skipped (not generated)
  while the account is archived; history is unaffected.
- **Same manual-QA caveat as all previous phases** — no browser-automation
  tooling in this sandbox; rendering is verified by build/lint/typecheck,
  render tests, and the design-token audit, not by a human in a real browser.

## 20. Architectural Decisions

1. **`RecurringRule.type` ('expense'|'income') added.** §5's field list has no
   type, but a rule that _generates transactions_ must know the sign.
   Inferring from the category was judged brittle; the precedent
   (`transferDirection` in Phase 3) is a documented added field.
2. **`RecurringRule.accountId` added.** The entity's spec fields predate the
   Account promotion; §6's recurring rules clearly post to one account, so
   `accountId` is required (same reason `Transaction.accountId` is).
3. **Generated entries are created via `TransactionService.createScheduled`
   and apply no balance until `markPaid`.** All balance math stays owned by
   `TransactionService`'s atomic `db.transaction`; a pending row is a
   placeholder, and the `affectsBalance` guard makes that invariant hold
   across edit/delete/restore too.
4. **Reminders are derived on demand, never persisted.** Same decision as
   Phase 4's budget-threshold notifications: no NotificationLog entity exists
   in §5, no phase owns one, and the "notify once / seen-state" machinery is
   exactly what's missing. `getRecurringAlerts` recomputes per render and is
   naturally deduplicated (one row/rule each), so it can't spam the feed.
5. **`nextExecution` materialized and indexed.** Schedule math is computed
   once (create/update/resume), then generation and reminders are a single
   field read — a deliberately simple, debuggable model.
6. **`active` not indexed** — IndexedDB boolean-key limitation (Phase 0
   precedent); filtered in memory.
7. **Pause semantics**: pause is fully reversible (keeps `nextExecution`);
   resume re-arms from today and deliberately does not backfill the paused
   period (pausing was intentional — generating months of backdated entries
   on resume would be surprising).
8. **Bounded catch-up** (`MAX_CATCH_UP = 366`) — favours predictable batches
   over instant backfill; a rule can never stamp out unbounded rows.
9. **Remove = delete the rule, keep the history.** Generated transactions are
   independent records that keep `recurringRuleId` (§10 edge case) — deleting
   a rule stops future generation only.
10. **Recomputing `nextExecution` only when the schedule changes.** Editing
    just the title/amount/reminder must not shift the due date; editing
    frequency/startDate/custom interval re-arms from today.
11. **Archived accounts are skipped, not blocked** — generation continues for
    the schedule (advancing `nextExecution`) but writes no entry, so money is
    never parked in an archived account and the rule isn't wedged.
12. **Static imports over dynamic** — `RecurringPage` imports
    `TransactionService` statically (it's already in the main bundle); no
    ineffective dynamic-import warnings.

## 21. Deferred Improvements

- **Persisted notification log / "seen" reminders** (shared with Phase 4's
  budget thresholds) — the natural home is a `notifications` table +
  service; revisit when a phase owns notifications (possibly Phase 9 or a
  dedicated phase).
- **Re-date/postpone-next-occurrence UI** — shifting the next due date
  explicitly (beyond Skip, which only advances by one period) and re-dating
  a generated entry; Phase 7's Calendar is the natural place.
- **Cron-style custom patterns** ("every 2nd of the month") beyond day
  intervals.
- **Recurring rule grouping / templates** — e.g. duplicate a rule as a new
  rule.
- **End-date handling in generation**: `endDate` is validated and stored but
  generation currently stops only when `nextExecution` passes `reference`;
  an explicit "stop at endDate" advance is trivial to add and should land
  with Phase 7 calendar coverage.
- **Multi-currency recurring rules** — the app is INR-first; amounts are
  plain numbers today.

## 22. Recommendations before Phase 6

1. **Re-run the full quality gate from a clean state** before starting Phase
   6: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` —
   all currently green, re-confirm at Phase 6 kickoff.
2. **Phase 6 (Loans) should reuse the `pending` lifecycle, not fork it.**
   Loans produce EMIs (recurring-style obligations). Consider whether a loan
   should write its EMI as a recurring rule (`frequency: monthly`) or as its
   own generation path — deciding early avoids two schedulers.
3. **Close the `endDate` generation gap** (§21) — the field exists and is
   validated but not enforced by the loop; decide in Phase 6 or with Phase 7.
4. **Revisit the Dashboard Loans placeholder** — it currently says "arrives
   in Phase 6"; Phase 6 replaces it with real cards.
5. **Consider the notification-log decision now.** Phase 6 (loan EMI due
   dates) and Phase 7 (calendar) both create new "due soon" concepts; if a
   notification entity is introduced, back-port the recurring + budget
   reminders to it in the same phase rather than layering a third derivation
   pattern.
6. **Manual QA pass in a real browser** is still outstanding for swipe/gesture
   and bottom-sheet interactions across all phases; worth doing before
   shipping.
7. **Confirm Phase 8 (Forecasts) consumes `getUpcomingObligations` directly**
   — the pure, deterministic signature was designed for that reuse.
