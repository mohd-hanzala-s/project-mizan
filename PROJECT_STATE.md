# PROJECT_STATE.md

Living summary of Nexus Finance's current state. Detail for the current
phase is in `docs/PHASE7_REPORT.md`; phase-by-phase history is in
`CHANGELOG.md`; the product spec is `docs/atlas-master-spec.md`.

## Current project version

`0.0.0` (package.json — the project has not shipped a release; phases are
the meaningful version markers).

## Current phase

**Phase 7 — Calendar & Timeline** (complete)

## Completed phases

| Phase | Name                    | Status      |
| ----- | ----------------------- | ----------- |
| 0     | Foundation              | Complete    |
| 1     | Core Transaction Engine | Complete    |
| 2     | Dashboard               | Complete    |
| 3     | Accounts                | Complete    |
| 4     | Budgets                 | Complete    |
| 5     | Recurring               | Complete    |
| 6     | Loans                   | Complete    |
| 7     | Calendar & Timeline     | Complete    |
| 8     | Forecasts               | Not started |
| 9     | Intelligence & Insights | Not started |

## Database schema version

**v6** (Dexie, db name `nexus-finance`).

- v1 — accounts, categories, settings
- v2 — + transactions, favorites, tags (Phase 1)
- v3 — no store changes; migration checkpoint (Phase 3)
- v4 — + budgets (Phase 4)
- v5 — + recurring_rules (Phase 5)
- v6 — + loans, loan_payments (Phase 6)

Stores: `accounts`, `categories`, `settings`, `transactions`, `favorites`,
`tags`, `budgets`, `recurring_rules`, `loans`, `loan_payments`.

## Services inventory

| Service                   | File                                        | Owns                                                                          |
| ------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| AccountService            | `src/services/AccountService.ts`            | account create/update/archive                                                 |
| BudgetService             | `src/services/BudgetService.ts`             | budget CRUD, computeStatus, alerts                                            |
| CalendarService           | `src/services/CalendarService.ts`           | **derived financial-event timeline (transactions + recurring + loans)**       |
| CategorizationService     | `src/services/CategorizationService.ts`     | §6 category suggestion chain                                                  |
| DashboardService          | `src/services/DashboardService.ts`          | metrics, timeline, alerts, recents                                            |
| DuplicateDetectionService | `src/services/DuplicateDetectionService.ts` | 1-day duplicate detection                                                     |
| FavoriteService           | `src/services/FavoriteService.ts`           | favorite ↔ quick-entry templates                                              |
| LoanService               | `src/services/LoanService.ts`               | **loan CRUD, EMI schedule math, payoff forecast, payment split, loan alerts** |
| RecurringService          | `src/services/RecurringService.ts`          | **schedule math, lifecycle, generateDue, alerts/obligations**                 |
| SampleDataService         | `src/services/SampleDataService.ts`         | sample-data seeding (Phase 0 flag)                                            |
| SettingsService           | `src/services/SettingsService.ts`           | settings CRUD + PIN                                                           |
| SmartEntryParser          | `src/services/SmartEntryParser.ts`          | free-text parsing                                                             |
| TransactionService        | `src/services/TransactionService.ts`        | transaction/transfer balance math, pending lifecycle, markPaid/updateStatus   |

## Repository inventory

| Repository            | File                                        | Table(s)             |
| --------------------- | ------------------------------------------- | -------------------- |
| AccountRepository     | `src/repositories/AccountRepository.ts`     | accounts             |
| BudgetRepository      | `src/repositories/BudgetRepository.ts`      | budgets              |
| FavoriteRepository    | `src/repositories/FavoriteRepository.ts`    | favorites            |
| LoanRepository        | `src/repositories/LoanRepository.ts`        | loans, loan_payments |
| RecurringRepository   | `src/repositories/RecurringRepository.ts`   | recurring_rules      |
| SettingsRepository    | `src/repositories/SettingsRepository.ts`    | settings             |
| TagRepository         | `src/repositories/TagRepository.ts`         | tags                 |
| TransactionRepository | `src/repositories/TransactionRepository.ts` | transactions         |

## Component inventory

- Layout: `AppShell`, `NavigationRail`, `BottomNavigation`, `TopAppBar`,
  `FloatingActionButton`, `MoreSheet`, `BottomSheet`
- Finance: `AccountCard`, `AlertCard`, `BudgetCard`, `CalendarEventRow`,
  `DashboardCard`, `LoanCard`, `MetricCard`, `RecurringCard`
- Calendar: `CalendarView`, `WeekStrip`
- Charts: `TrendIndicator`
- Forms: `AccountSelector`, `CategorySelector`, `CurrencyInput`, `FilterBar`,
  `PinInput`, `SearchBar`
- Common: `AppLockScreen`, `ConfirmationDialog`, `DynamicIcon`, `EmptyState`,
  `LoadingScreen`, `PlaceholderPage`, `Toast`
- UI: `Button`

## Routes

| Path            | Screen                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `/`             | Dashboard (metric cards, timeline, recents, Upcoming Payments, balances, budgets, loans summary) |
| `/transactions` | Transactions (search/filter/group, swipe gestures)                                               |
| `/accounts`     | Accounts list + archived section                                                                 |
| `/accounts/:id` | Account detail / history                                                                         |
| `/budgets`      | Budgets (real)                                                                                   |
| `/loans`        | Loans: active + completed, EMI payments, payoff forecast (real, Phase 6)                         |
| `/recurring`    | Recurring rules + generated history (real, Phase 5)                                              |
| `/calendar`     | Calendar & timeline: month/week/day views, search, kind filters (real, Phase 7)                  |
| `/reports`      | Placeholder                                                                                      |
| `/insights`     | Placeholder                                                                                      |
| `/settings`     | Settings (theme, app lock)                                                                       |

## Test count

**166 tests across 21 files** (all passing):

- account-service (6), app (1), app-shell (1), budget-service (12),
  calendar-page (3), calendar-service (13), categorization-service (4),
  dashboard-populated (1), dashboard-service (13), database (3),
  duplicate-detection (5), loan-page (3), loan-service (30),
  recurring-page (2), recurring-service (28), sample-data (3),
  settings-service (4), smart-entry-parser (8), transaction-service (8),
  transaction-status (9), transfer (9).

Phase 7 added 16 tests (calendar-service 13, calendar-page 3).

## Current technical debt

1. `RecurringService` monolith (~400 lines) — schedule math, lifecycle,
   generation, derivation in one file; split if it grows.
2. `LoanService` similarly bundles schedule math + CRUD + derivation; split
   if it grows.
3. Derived (non-persisted) reminders for recurring, budget, and loan alerts —
   needs a notification log/seen-state that no phase owns.
4. Local status-style/label maps in `RecurringCard`/`LoanCard` — DRY if
   pills spread.
5. In-memory active/paused + archived filtering (IndexedDB can't index
   booleans) — accepted for small tables.
6. Form row markup duplicated across feature forms (consistent, not new).
7. Loan payment reversal restores only principal and keeps other rows'
   stored `remainingBalance` snapshots — an explicit escape hatch, not a
   chain rewrite.
8. The whole calendar timeline is derived on render from three stores (no
   persisted events) — fine at this scale, revisit when §8's v1.2 event
   entity lands.

## Known limitations

- No OS notifications / background timers — reminders computed on open/render.
- Reminders not persisted or dismissable.
- No manual `nextExecution` editing; Postpone changes status, not the date.
- Custom interval is days-only (1–365).
- Archived-account occurrences skipped (schedule still advances).
- `endDate` validated and stored but not enforced by the generation loop.
- Loan EMIs don't post to the ledger (by design — loans track an independent
  balance); no `Transaction.loanId`-linked EMI expenses yet.
- No user-authored calendar events; the timeline is derived from
  transactions, recurring rules, and loans only (§8 defers an event entity).
- Calendar navigation is prev/next/Today; no drag-and-drop or day
  long-press rescheduling.
- No visual/manual browser QA in this sandbox (build/lint/typecheck + render
  tests + design-token audit substitute).
- INR-first; no multi-currency amounts.

## Next planned phase

**Phase 8 — Forecasts** (§9).
