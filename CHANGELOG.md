# Changelog

All notable changes to this project are documented here, grouped by phase
(see `docs/atlas-master-spec.md` §9 for phase definitions).

## Phase 8 — Forecasts

### Added

- `ForecastService` — a pure, derived month-end projection built from data
  the app already owns (accounts, transactions, recurring rules, loans).
  Nothing is persisted: like the alert feeds and `CalendarService` before it,
  the forecast is recomputed on demand each render (no forecast table exists
  in the schema).
  - `getForecast({ transactions, accounts, recurringRules, loans,
budgetMonthStart, reference? })` → a complete `Forecast`:
    - **Period shape** — the current budget period (`getCurrentPeriod`),
      `daysInPeriod` / `daysElapsed` / `remainingDays`.
    - **Actuals** — paid income/expense inside the period (matches
      `DashboardService.computeMetrics`).
    - **Future cashflows** — the union of three mutually exclusive
      obligation sets (unpaid pending transactions dated on/after today,
      active auto-generating recurring-rule occurrences, loan EMIs due from
      today through the period end), plus a **run-rate** extrapolation
      (paid ordinary spend-per-day-so-far × remaining days — the same shape
      as §6's budget "current pace × remaining days").
    - **Month-end totals** — `monthEndIncome` / `monthEndExpense`,
      `expectedSavings` (income − expense), `expectedBalance` (current
      account balance + projected net).
    - **Confidence** — `high` / `medium` / `low` with an explicit
      `confidenceReason`, per §6 "state explicitly when confidence is low"
      (no activity yet, or fewer than 3 elapsed days → low).
  - `getForecastAlerts(forecast)` — derived warnings for a **negative
    projected balance** (spec §6's critical priority list) and a projected
    overspend, merged into the Dashboard's existing alert feed.
- `ForecastCard` (§3 Financial component) — a "Month-End Forecast"
  Dashboard card showing projected balance / expected savings / days left,
  expected income & expense, the top 4 upcoming obligations (pending /
  recurring / loan, with dates and signed amounts), and the confidence pill
  - reason.
- Dashboard integration: the card sits between the metric grid and Quick Add;
  forecast alerts join the `getAlerts` feed.
- `.gitignore` now includes `dist/` (a build artifact that was being picked
  up by `prettier --check` and `git status`; CI builds fresh so nothing
  depends on it being tracked).
- 20 new tests: `forecast-service.test.ts` (20) covering period shape,
  projection math (mid-month period bounds), confidence bands, obligation
  sources and the double-count guards, run-rate hygiene (transfers / unpaid /
  recurring-generated excluded), and forecast alerts; the existing
  `dashboard-populated` render test now also asserts the new card renders on
  a populated Dashboard.

### Decisions & deviations from the spec

- **Phase 8 = "Forecasts" per `PROJECT_STATE.md`'s roadmap, not the spec's
  §9 "Analytics" bullet.** §9's Phase 8 is labelled "Analytics" (charts,
  heatmap, YoY, forecast dashboard); the project's own roadmap and Phase 7
  report recommended "Forecasts". Implemented the §6 Forecasts capability in
  full — month-end spending, expected balance, upcoming obligations,
  expected savings, explicit low-confidence — which is the "forecast
  dashboard" piece of the Analytics bullet. The wider analytics (category /
  cash-flow / savings charts, heatmap, YoY) remains for a future phase.
- **No new persisted entity — the forecast is a projection.** Same precedent
  as the alert feeds and `CalendarService`; schema stays **v6**.
- **Each scheduled occurrence is counted exactly once.** An auto-generated
  pending row for a still-active rule is dropped in favour of its projected
  schedule entry; remind-only rules (`autoGenerate: false`) project nothing
  because their hand-entered payments already appear as ordinary spend in
  the run-rate. Paused rules generate no obligations, but their lingering
  auto pending rows are kept (nothing else projects them).
- **Run-rate counts paid, ordinary, non-recurring-generated activity only**,
  so unpaid entries and the projected schedule never leak into the trend and
  double-count a rupee.
- **Confidence is purely about observed trend**, not about the obligation
  set — a day-2 forecast of a known rent bill is still "low" because the
  run-rate has nothing to lean on.
- **`dist/` gitignore** is a small repo-hygiene fix, not a spec item.

### Known gaps intentionally deferred

- Same visual/manual QA caveat as every previous phase — the ForecastCard
  layout and its low-confidence state deserve a hands-on pass.
- The run-rate is a naive linear pace (no smoothing against the previous
  month's history); §6 mentions "historical averages" — a hybrid
  (previous-period weighting) is a natural later refinement.
- No line/area chart of the projected balance across the remaining days
  (Phase 9/analytics work), and no per-category forecast.
- Loan projections assume the standard EMI is paid on time; the interplay
  between an overdue loan and the projected balance is left to the loan
  alerts.

## Phase 7 — Calendar & Timeline

### Added

- `CalendarService` — a derived financial-event engine that builds a unified
  timeline from three existing sources (transactions, recurring rules,
  loans + recorded payments). Event kinds: `transaction`, `recurring`,
  `loan`. No new persisted entity: §8 defers a user-editable "financial
  events" table to v1.2 (P2), so events are derived on demand like the
  Phase 4/5/6 alert feeds.
  - `getMonthEvents` / `getWeekEvents` (7-day window) / `getDayEvents` /
    `getDaySummary` (count + income + expense + net) / `filterEvents`
    (query + kind set)
  - Transaction events exclude soft-deleted rows, `transfer` type, and
    transfer credit legs (transfers never affect income/expense, §10).
  - Recurring schedule events are strictly future (after today's start of
    day) so generated transactions don't double-count once due; paused
    rules and rules whose next due falls outside the window produce
    nothing; per-window occurrence cap (62).
  - Loan events = next EMI due (active loans with balance > 0) + every
    recorded payment (past/current), reusing `nextDueDate`/`firstDueDate`.
- `features/calendar/` — a real Calendar page replacing the placeholder:
  - `CalendarView` — 42-cell month grid (6-week, Sunday/Saturday start per
    `Settings.firstDayOfWeek`), kind-colored dots, compact net amounts per
    cell, today/selected/outside-month states, income-subtle selected cell.
  - `WeekStrip` — 7-day strip with per-day event counts for the week view.
  - `CalendarEventRow` — per-kind icon + signed amount rows (income emerald,
    loan liability purple, else expense).
  - `CalendarPage` — month / week / day view toggle, prev/next/Today
    navigation, `SearchBar` ("Search the calendar"), kind filter pills
    (All / Transactions / Recurring / Loans), a selected-day detail panel in
    month view, and grouped per-day timelines in week/day views.
- New `src/tests/calendar-service.test.ts` (13 tests) and
  `src/tests/calendar-page.test.tsx` (3 tests): event building/signs/
  exclusions, future-only recurring, paused/out-of-window/today rules,
  loan due + payment events, newest-first sort, empty-data safety, day/
  week/summary helpers, filtering, namespace binding, and page render +
  view-switch behavior.

### Decisions & deviations from the spec

- **No "financial events" table.** §8 schedules a user-editable event entity
  for v1.2 (P2), so Phase 7 keeps the calendar purely derived — same
  precedent as the non-persisted alert feeds in Phases 4/5/6.
- **Three event sources, no double counting.** Once a recurring due date
  passes, the occurrence materialises as a generated transaction; the
  schedule event is strictly-future so the same day isn't counted twice.
- **Transfers are invisible.** §10 treats transfers as neither income nor
  expense, so both transfer legs are excluded from the timeline (the credit
  leg would otherwise look like income).
- **EMI due is a single event per loan.** Only the next due date (per the
  §10 due-day + month-end clamp) is scheduled; completed loans and
  zero-balance loans produce no upcoming due. Recorded payments always
  appear, giving payment history on the calendar.
- **Stable event ids**: `tx-<id>`, `rec-<ruleId>-<yyyy-mm-dd>`,
  `loan-due-<id>`, `loan-pay-<id>`.
- **Week view crosses month boundaries** by merging the window's events and
  starting the strip from `startOfWeek(anchor, { weekStartsOn })`.

### Known gaps intentionally deferred

- No user-authored events (dates with no linked financial record) — §8
  v1.2.
- No drag-and-drop rescheduling; calendar navigation is prev/next/Today.
- Kind filter pills are single-select (All/Transactions/Recurring/Loans),
  not multi-select.

## Phase 6 — Loan Manager

### Added

- Dexie schema v6: `loans` store (indexed `dueDay, status`) and
  `loan_payments` store (indexed `loanId, paymentDate`) per §5
- `LoanService` — loan CRUD, `recordPayment`/`deletePayment`, and pure
  derivation helpers: `firstDueDate`/`nextDueDate` (due-day anchors with
  §10 month-end clamping, never `addMonths` on a clamped date), `isOverdue`
  (heuristic skipped-cycle detection), `splitPayment` (interest on the
  balance first, full payoff all-principal, below-interest → zero
  principal), `getPayoffForecast` (progress + remaining EMIs + estimated
  completion, month-by-month simulation bounded at 1200 months with an
  explicit "never pays off" signal), and `getAlerts` (due tomorrow /
  overdue / completed / extra payment)
- `LoanRepository` — `getAll` (active) / `getAllIncludingCompleted` /
  `getById` / `add` / `update` / `delete` / `getPayments` /
  `getAllPayments` / `addPayment` / `deletePayment` (§4 layering: data
  access only)
- `LoansPage` — Active + Completed sections, create/edit `LoanForm`
  (name, lender, original amount, monthly EMI, optional interest rate,
  start/end dates, due day, notes), `PaymentForm` (date + amount + notes),
  expandable per-loan payment history with a reverse action, and
  `ConfirmationDialog` before delete and before reversing a payment
- `LoanCard` + `loansStore` (Zustand, loads loans + all payments once)
- Dashboard: "Loans" summary card (top 5 active loans, outstanding balances,
  "See all" → /loans, replacing the Phase 6 placeholder) and loan alerts
  merged into the existing Alerts feed
- 33 new tests across two files: schedule math (first/next due dates,
  month-end clamping, overdue heuristic), payment splitting, payoff
  forecast incl. the never-pays-off branch, CRUD validation, balance
  integrity (no negative balances, complete/block-on-zero, reverse
  restoration), delete cascades payments, alert windowing/expiry, and a
  LoansPage render test

### Decisions & deviations from the spec

- **`currentBalance` starts equal to `originalAmount` and moves only via
  `recordPayment`.** `originalAmount` and `startDate` are fixed at creation
  (they define the loan's identity and starting point — same precedent as
  Phase 3 fixing an account's type/opening balance); everything else is
  editable through `LoanService.update`.
- **Payments carry no principal/interest inputs.** `RecordPaymentInput` is
  just `{ paymentDate, amountPaid, notes? }`; §6's "if interest is tracked,
  split payment into principal/interest" logic lives in `LoanService.splitPayment`.
- **No `accountId` on `Loan`.** Recording an EMI reduces the loan's own
  balance and writes a `LoanPayment` row; it does not post to the ledger.
  The optional `Transaction.loanId` link (reserved by §5) stays available
  for manual EMI expenses and later analysis phases.
- **EMI due dates are computed from month index + due day, not `addMonths`
  on clamped dates** — Feb 28 can't drift into Mar 28; day 31 clamps per
  month (§10 month-end transitions).
- **`isOverdue` is a skipped-cycle heuristic**: the latest due date on/before
  today vs. whether any payment is dated after the previous month's due date.
  Early/late payments within a cycle count as covered, so it flags genuinely
  skipped cycles rather than payments made a few days late.
- **Alerts are derived on demand, never persisted.** Same reasoning as
  Phases 4/5 — no notification entity exists, and §7's "informational ones
  expire automatically / critical stay visible" is expressed as 30-day
  expiry for completed/extra-payment info alerts while overdue stays until
  the balance clears.
- **`delete` hard-deletes the loan + its payments in one transaction** (the
  Loans screen confirms first — §3). Unlike recurring rules, loan payments
  aren't referenced elsewhere.
- **`deletePayment` restores the balance by that payment's principal only**
  and may re-activate a completed loan; other payment rows keep their stored
  `remainingBalance` snapshots. History is append-mostly; reverse is the
  explicit "fix a mistake" escape hatch, not a rewrite of the chain.
- **Loan EMIs do NOT reuse the recurring engine** (Phase 5 report §22's open
  question). Recurring rules post to the ledger via scheduled transactions;
  loans track an independent outstanding balance by design (§5 entity has no
  `accountId`). The two coexist.

### Known gaps intentionally deferred

- Same visual/manual QA caveat as every previous phase — bottom-sheet
  interactions and card expansion on LoansPage are worth a hands-on check.
- No `Transaction.loanId`-linked EMI expenses or loan analysis in Reports/
  Insights (later phases own those).
- Sample-data seeding does not add sample loans (the Phase 0 flag keeps its
  transaction-only semantics).

## Phase 5 — Recurring

### Added

- Dexie schema v5: `recurring_rules` store, indexed on `nextExecution` per §5
- `RecurringService` — schedule math (`computeNextExecution` with month-end
  clamping via date-fns `addMonths`), `create`/`update`/`pause`/`resume`/
  `skipNext`/`remove`, single-flight `generateDue` (bounded catch-up at 366
  occurrences, skips generating into archived accounts while still advancing
  the schedule), plus pure derivation helpers `getUpcomingObligations`
  (30-day horizon) and `getRecurringAlerts` (upcoming/missed)
- `RecurringRepository` — `getAll` / `getAllIncludingInactive` / `getById` /
  `add` / `update` / `delete` (§4 layering: no business logic here)
- Generated entries via `TransactionService.createScheduled` —
  `status: 'pending'`, `source: 'auto'`, linked by `recurringRuleId`, with a
  no-balance-effect guard so pending rows never move money until
  `markPaid` (idempotent, applies the balance once); `softDelete`/`restore`/
  `update` refuse pending rows for the same reason
- `RecurringPage` — Active/Paused sections, create/edit `RecurringForm`
  (frequency grid incl. custom interval, start/end dates, autoGenerate,
  reminderDays), expandable per-rule history with Mark paid / Skip / Postpone
  (missed) / Delete actions, `ConfirmationDialog` before delete
- `RecurringCard` + `RecurringStore` (Zustand, loads rules + generated history
  after running the generation pass)
- Dashboard: "Upcoming Payments" card (`getUpcomingObligations`, top 5, "See
  all" → /recurring) and recurring upcoming/missed alerts merged into the
  existing Alerts feed
- AppShell startup runs `RecurringService.generateDue().then(() => load())`
  as §4's background processing
- 39 new tests across three files: schedule math (incl. month-end clamping
  and custom interval), CRUD validation, catch-up generation, pause/resume
  re-arm (no backfill), skip/remove, pending→paid balance semantics,
  alerts windowing, upcoming obligations ordering, and a RecurringPage
  render test

### Decisions & deviations from the spec

- **`RecurringRule.type` ('expense' | 'income') added**, not in §5's field
  list, but required for `generateDue` to create correctly-signed entries —
  same precedent as `transferDirection` in Phase 3.
- **Reminders (upcoming/missed) are derived per render, never persisted.**
  Same reasoning as Phase 4's budget thresholds: §5 has no notification
  entity, no phase in §9 owns one, and persisting seen-state is exactly the
  "notify once" infrastructure that isn't built yet. `getRecurringAlerts`
  computes on demand and the Dashboard merges the result into its existing
  alert feed.
- **Pause keeps `nextExecution`; resume re-arms from today with no backfill.**
  A rule paused across months does not generate a pile of backdated pending
  entries on resume — the schedule restarts at the next occurrence on/after
  the resume date.
- **`nextExecution` indexed; `active` is not.** IndexedDB rejects boolean
  keys (same problem as `isArchived` in Phase 0); repositories filter active/
  paused in memory over a small table.
- **Generated entries stay `pending` and apply no balance until marked paid** —
  an explicit transaction-creation decision consistent with Phase 1's balance
  math ownership living in `TransactionService`, so no other code path can
  accidentally spend a not-yet-paid subscription.
- **`skipNext` advances one occurrence; `remove` deletes only the rule** —
  generated transactions keep their `recurringRuleId` and history, so
  deleting a rule never silently deletes past money movement.

### Known gaps intentionally deferred

- Same visual/manual QA caveat as every previous phase — the swipe and
  bottom-sheet interactions on RecurringPage are worth a hands-on check.
- No calendar-day visualization of recurring occurrences (Phase 7's Calendar
  screen will naturally surface those) and no notification/reminder
  persistence (see Decisions).

## Phase 4 — Budgets

### Added

- Dexie schema v4: `budgets` store, indexed on `categoryId` per §5
- `BudgetService.computeStatus` — pure, tested math: allocated − spent =
  remaining (§6), rollover (including negative rollover if the previous
  period was overspent — a genuine rolling balance, not floored at 0),
  linear-pace forecast, and ok/warning/over severity bands
- `BudgetCard`, `BudgetForm` (category fixed after creation, like
  `Account.type`), and a real `BudgetsPage` — create, edit limit/rollover/
  threshold, deactivate (soft, via `active: false`, with confirmation)
- Global budgets (across all categories combined), alongside per-category
  ones — §6 explicitly calls for this despite §5's schema only showing a
  single `categoryId` field
- Dashboard's Budgets section now shows real progress cards (top 3, with a
  link to the full page) instead of Phase 2's placeholder; over-budget
  items also surface in the top Alerts feed
- 12 new tests: allocated/spent/remaining math, income/transfer exclusion,
  refund reducing spend, rollover (positive and negative), severity bands,
  forecast, and CRUD validation (one budget per category, global allowed
  alongside)
- Regression pass across Phases 0-3 before starting this phase (per
  instruction) — found and fixed one flaky test (see Known gaps), no
  product regressions

### Decisions & deviations from the spec

- **`categoryId` uses a sentinel string (`GLOBAL_BUDGET_CATEGORY_ID`), not
  `null`, for global budgets.** §5's schema doesn't show `categoryId` as
  nullable, but §6 requires an "optional global monthly budget." IndexedDB
  can't index a `null` key — same problem Phase 0 hit with booleans — so a
  plain string sidesteps it while staying indexable and spec-faithful to
  the literal `Index: categoryId`.
- **§6's "notify once per threshold" (50/75/90/100/110%, no repeat spam)
  is not implemented as a persisted notification log.** That needs
  infrastructure — something tracking which thresholds have already
  surfaced a notification per budget per period — that isn't in §5's
  schema and isn't clearly owned by any phase in §9 (no phase is named
  "Notifications"). What's built instead: Budget cards show live,
  continuous status (not discrete notification events) via color, and the
  Dashboard's Alerts feed shows one alert per over-budget item (the 100%+
  band only) rather than the full graduated ladder — surfacing every
  50/75/90% crossing as a separate Dashboard alert would work against the
  "reduces cognitive load" rule more than serve it. Revisit if a
  Notification entity/log gets built later (Phase 9 or a dedicated phase).
- **Refund reduces effective budget spend** (`spent = expense − refund`
  within the period). §6 doesn't address this explicitly for budgets (only
  says Expense affects them, Income doesn't), but it's the same reasoning
  already applied to account balances in Phase 1 — money coming back from
  a purchase isn't still "spent." Not exercised yet since Refund isn't
  creatable through any UI (same status as Phase 1/3 noted).
- **Rollover is a true rolling balance, not floored at zero.** Overspending
  a rollover-enabled budget reduces next period's effective limit rather
  than resetting to just `monthlyLimit`. §6 doesn't specify the rollover
  formula; this was the more mathematically defensible reading and is
  documented clearly in code and tests in case it should go the other way.

### Known gaps intentionally deferred

- Same visual/manual QA caveat as every previous phase.
- Fixed a flaky integration test (`dashboard-populated.test.tsx`) found
  during this phase's regression pass — not a product bug, a weak
  assertion that happened to pass under light load and fail under the full
  suite's. Confirmed stable across 3 consecutive full-suite runs after the
  fix.

## Phase 3 — Accounts

### Added

- Dexie schema v3 — no index changes, but `Transaction` gains
  `transferDirection` (see Decisions). Bumped anyway to mark the checkpoint
  in the migration history per §11
- `TransactionService.createTransfer()` — §6's linked-entry model: two
  `Transaction` rows (debit + credit) joined by `linkedTransactionId`,
  opposite balance effects, auto-categorized to the `cat-transfers`
  category (set up for exactly this back in Phase 0), atomic in one
  `db.transaction`
- `softDelete`/`restore` are now transfer-aware — deleting or restoring
  either leg cascades to both, so "the user sees one transfer" (§6) holds
  for deletion too, not just creation
- `update`/`duplicate` now explicitly refuse transfers (see Decisions)
  rather than silently corrupting the linked pair
- `TransferForm` + `TransactionEntrySheet` (Expense/Income vs. Transfer
  mode tabs) — the FAB now supports both entry types
- `TransactionCard` is transfer-aware: neutral info-colored amount (not
  expense/income red/green — a transfer is neither), edit/duplicate
  gestures disabled (right-swipe clamped to 0, long-press no-ops), delete
  still works and cascades correctly
- Full account management: `AccountService` (create/update/archive/
  unarchive, with a guard against archiving the last active account),
  `AccountForm`, real `AccountsPage` (list, add, archived section with
  restore), `AccountDetailPage` (§9 "account history" — full transaction
  history for one account, including both transfer legs since both are
  meaningful from a single account's perspective)
- `accountsStore` (Zustand) — Dashboard now reads accounts reactively
  instead of its own local fetch; account cards on both Dashboard and
  Accounts navigate to the new detail page
- `ConfirmationDialog` (§3 Utility component) — required before archiving
  an account (see Decisions)
- Global transaction lists (`TransactionsPage`, Dashboard's Recent
  Activity) now exclude a transfer's credit leg via a shared
  `isTransferCreditLeg` helper, so a transfer appears once, not twice
- `FilterBar` gained a Transfer type filter; the Transfers category is
  excluded from the category filter chips (it's not a real user
  categorization choice)
- 15 new tests: transfer balance math, linked create/delete/restore
  cascading, edit/duplicate refusal, and the account archive guard

### Decisions & deviations from the spec

- **`transferDirection` field added to `Transaction`, not in §5's list.**
  §6 says a transfer's two linked entries are joined via
  `linkedTransactionId`, but nothing distinguishes which leg is which —
  needed for (a) knowing which leg to hide from a cross-account list and
  (b) which direction to reverse on delete. Optional, undefined on any
  transaction created before Phase 3 (none of which are transfers anyway).
- **Editing a transfer isn't supported yet** — `TransactionService.update()`
  now explicitly throws for transfer transactions rather than silently
  doing the wrong thing. Changing which accounts are involved in an
  existing transfer is a materially different operation (more like
  delete-and-recreate) than editing a single-entry expense/income; scoped
  out of Phase 3 rather than rushed. Duplicating a transfer is refused for
  the same reason — copying one leg alone would break the pair.
- **Account archiving requires confirmation**, even though §6's explicit
  confirmation list only names "delete category," not accounts. Reasoned
  that an account carrying real transaction history is at least as
  consequential as a category, so the same ceremony applies. Archiving
  itself (not hard delete) was already Phase 0's design — reversible via
  unarchive, transaction history stays intact.
- **Can't archive the last active account.** Not spec-mandated, but Smart
  Entry would have nowhere to post a transaction if every account were
  archived — a data-integrity guard in the spirit of §6's "reject before
  writing to DB," not visible UI ceremony.
- **Account type and opening balance are fixed after creation** — editing
  only touches name/icon/color. Changing type after transactions exist
  would make history semantically inconsistent; changing opening balance
  after the fact would need recalculating currentBalance from full
  history, not worth the complexity for what's meant to be a one-time
  starting point.
- **`size-20` guardrail worked as designed** — `npm run lint` caught a
  fresh instance in `AccountForm.tsx` automatically (the checker added in
  Phase 2) instead of needing another manual audit pass.

### Known gaps intentionally deferred

- Same visual/manual QA caveat as every prior phase — swipe-gesture
  clamping for transfers in particular is worth a hands-on check.
- No bulk "merge duplicate accounts" or account reordering — not
  mentioned in §9's Phase 3 scope, not built.

## Phase 2 — Dashboard

### Added

- `DashboardService` — pure, easily-tested functions computing metrics from
  already-loaded data: total balance, this-period income/expense/net
  savings, trend vs. the previous period, 7-day spending timeline, and
  negative-balance alerts. "This period" respects `Settings.budgetMonthStart`
  (§5) rather than the calendar month, so it won't silently disagree with
  however Phase 4 ends up defining a budget cycle
- 4 `MetricCard`s (Total Balance, This Month's Income/Expense, Net Savings)
  with `TrendIndicator` (§3 Visualization component) showing % change vs.
  the previous period
- `QuickAdd` — true one-tap re-entry from Favorites (no sheet, no
  confirmation step), same undo pattern as everything else
- `SpendingTimeline` (§3 Visualization component) — CSS-only 7-day bar
  chart, no charting library needed for 7 bars
- `AccountCard` (§3, `[NEW]`) and an Account Balances section
- Recent Activity section reusing Phase 1's `TransactionCard` directly (no
  duplicate list-rendering logic)
- `AlertCard` (§3) + a real (if minimal) alert: negative account balance,
  excluding Credit Card (negative is normal/expected there)
- Honest placeholder sections for Budgets and Loans — see Decisions
- Automated design-token audit (`scripts/check-design-tokens.mjs`), wired
  into `npm run lint` and therefore CI — see Decisions
- 18 new tests: period-boundary math (including mid-month
  `budgetMonthStart` and year rollover), transfer exclusion from
  income/expense, alert conditions, and a populated-Dashboard render test

### Decisions & deviations from the spec

- **Budget summary, loan summary, and most of "alerts" are placeholders,
  not real features**, despite being listed in Phase 2's scope. §9's Phase
  2 bullet lists them alongside metric cards and recent activity, but
  Budgets (Phase 4), Loans (Phase 6), and Recurring (Phase 5) — the data
  those sections summarize — don't exist yet. Building fake summaries
  against data that doesn't exist would violate the "never fake it"
  principle more than shipping an honest "arrives in Phase 4" note does.
  Alerts currently has exactly one real trigger (negative balance); it'll
  gain overspend/due-date/missed-payment triggers as those phases land —
  the mechanism (`getAlerts`, `AlertCard`) is real and extensible now.
- **"Timeline" (§9's Phase 2 bullet) implemented as `SpendingTimeline`**,
  a 7-day bar chart — distinct from "recent activity" (a list) and
  distinct from Phase 7's full Calendar & Timeline screen. Reasoned this
  gives the bullet real meaning now rather than treating it as a duplicate
  of "recent activity" or deferring it entirely.
- **`size-20` recurred — twice now.** Found the same invalid-utility bug
  from Phase 1 (§ Phase 1 Decisions) again in `AccountCard`, caught by
  re-running the same manual grep audit. Rather than rely on remembering to
  do that by hand every phase, wrote `scripts/check-design-tokens.mjs` and
  wired it into `npm run lint` (and therefore CI) — it checks every
  spacing/radius utility in `src/` against `tailwind.config.js`'s
  restricted scale and flags raw Tailwind palette classes bypassing the
  semantic tokens. Should make this whole bug class impossible to land
  silently again, starting now.
- **No accounts Zustand store added.** Dashboard fetches accounts once via
  `AccountRepository.getAll()` in a `useEffect`, same pattern
  `TransactionsPage` already used for categories/accounts in Phase 1,
  rather than building a reactive `accountsStore` — that's more naturally
  Phase 3's (Accounts) to introduce, once there's an actual reason
  (in-page account editing) for other screens to see live updates.

### Known gaps intentionally deferred

- Same visual/manual QA caveat as Phase 0 and 1 — no browser automation
  tool available in this sandbox. The design-token audit substitutes for
  the "did this actually render right" check to the extent it can.

## Phase 1 — Core Transaction Engine

### Added

- Dexie schema v2: `transactions`, `favorites`, `tags` stores, added via a
  proper migration (v1's stores are unchanged)
- `TransactionService` — the only code that writes to both `transactions`
  and `accounts`, keeping balance math atomic (wrapped in `db.transaction`)
  and correct across create/edit (including account-to-account moves)/
  soft-delete/restore/duplicate
- `CategorizationService` — §6's priority chain (exact description match →
  favorite match → learned historical match → keyword dictionary), each
  tier mapped to §7's confidence bands (>0.9 auto-assign, 0.7–0.89 assign +
  confirm, <0.7 ask the user). The "AI suggestion" tier is deliberately not
  implemented — see Decisions below
- `SmartEntryParser` — parses free text ("250 tea", "₹1,250 groceries",
  "8000 EMI") into amount/description/inferred type, live as the user types
- `DuplicateDetectionService` — same amount + description + account within
  a 1-day window
- `FavoriteService` — marking a transaction favorite creates/removes a
  matching quick-entry template; usage tracked for §5's usageCount/lastUsed
  sort order
- Undo (§6, ~10s window) for add/edit/delete/duplicate, via a shared
  `transactionsStore` (Zustand) and a toast rendered at the AppShell level
  so it's visible regardless of which screen triggered the action
- `SmartEntryInput` wired to the FAB (previously a "coming in Phase 1"
  placeholder) via a `BottomSheet`, with live parsing feedback, category
  suggestion, duplicate warning, and manual correction before save
- `TransactionCard` — swipe left to delete (undoable), swipe right to edit,
  long-press to duplicate, via custom pointer-event handling (no gesture
  library dependency)
- Real `TransactionsPage`: search (description/notes/amount/category/
  account/tags, case-insensitive), type + category filters, grouped by date
- `SampleDataService` fulfills Phase 0's deferred `sampleDataRequested`
  flag — reuses `TransactionService.create()` so seeded transactions get
  correct balance effects for free
- 28 new tests: balance math (the highest-stakes logic in this phase),
  categorization priority chain, duplicate detection, free-text parsing,
  sample-data seeding

### Decisions & deviations from the spec

- **"AI suggestion" tier not implemented.** §7 states the Intelligence
  Engine "runs entirely on local data; no internet, no cloud processing, no
  external AI services in v1.0," and Categorization is itself listed as an
  Intelligence Engine module (Phase 9) with its own confidence machinery.
  Phase 1 implements the deterministic tiers (exact/favorite/historical/
  keyword) and asks the user when none clear the confidence bar; Phase 9 is
  the natural place for a genuine learned/AI tier.
- **Transfer, adjustment, and reversal transaction types are not
  creatable** through Phase 1's UI, though the schema supports them.
  Transfers are explicitly Phase 3's linked-entry model; adjustment/
  reversal have no defined balance-effect semantics in the spec yet — see
  the comment on `balanceEffect()` in `TransactionService.ts`. Whichever
  phase first needs them should implement their balance effect there rather
  than something being silently guessed at now.
- **Category color palette invented in Phase 0** turned out to double as
  useful signal here — e.g. EMI/Loans reusing the liability accent made
  keyword-dictionary categorization for "EMI" read correctly at a glance.
  No change, just noting it held up.
- **Bottom-nav "5 primary destinations" pick (flagged in Phase 0)**
  unchanged — Transactions' real functionality landing here didn't surface
  a reason to revisit which 5.
- **`onboardingCompleted`/`appLockPinHash`/`sampleDataRequested` (Phase 0's
  added Settings fields)** — no changes needed; `sampleDataRequested` is
  now fulfilled and cleared exactly as planned.

### Known gaps intentionally deferred

- No visual/manual QA pass in a real browser was possible in this sandbox,
  same limitation as Phase 0. Swipe-gesture and long-press interactions in
  particular are worth a hands-on check on an actual touch device before
  relying on them — pointer-event math was reasoned through and unit
  testing covers the business logic underneath, but not the gesture feel.
- Tag _management_ (renaming, browsing all tags) has no dedicated UI yet —
  tags are created on the fly and stored correctly, but there's no tag list
  screen. Not blocking since no phase in §9 explicitly owns one either.

## Phase 0 — Foundation

### Added

- Project scaffold: Vite + React 19 + TypeScript, path-aliased (`@/*` → `src/*`)
- Tailwind CSS configured to §2's exact design tokens: 8-point spacing scale
  (only 4/8/12/16/24/32/40/48/64/80/96 exist as utilities — verified via a
  full audit of every spacing/radius class used in this phase), 3-level
  elevation, type scale, light/dark color tokens as CSS variables
- shadcn/ui-style `Button` primitive, hand-authored (see Decisions)
- Dexie (IndexedDB) database, schema v1: `accounts`, `categories`, `settings`
  stores, with first-run seed data (5 default accounts, 11 default
  categories, 1 settings row)
- Repository/service layers for Settings and Accounts (§4 layering: no
  business logic in repositories)
- App-lock scaffold: SHA-256-hashed PIN (never stored in plaintext), setup
  flow in onboarding and Settings, unlock gate on launch
- Onboarding flow: 3 screens (theme + number format → app lock → sample-data
  opt-in), gated by `settings.onboardingCompleted`
- AppShell: navigation rail (landscape/desktop, all 10 destinations) +
  bottom nav (portrait, 5 primary + "More" sheet for the rest), top app bar,
  FAB
- All 10 primary routes wired, 9 of them as honest placeholders naming the
  phase that implements them; Dashboard's empty state is the real Phase 0
  deliverable
- PWA: manifest, offline app-shell precaching via Workbox, custom icon set
  (192/512/512-maskable/apple-touch), GitHub Pages SPA 404-redirect fallback
- ESLint (flat config, typescript-eslint + react-hooks + react-refresh) and
  Prettier, both wired into CI
- Vitest + Testing Library, 8 tests covering seed data, PIN hashing, and
  first-launch onboarding gating
- GitHub Actions CI: lint → format check → typecheck → test → build on every
  push/PR; separate deploy job to GitHub Pages on `main`

### Decisions & deviations from the spec (flagged, not silently assumed)

- **GitHub Pages base path — resolved.** Confirmed against
  [mohdhanzalas-dev/project-atlas](https://github.com/mohdhanzalas-dev/project-atlas);
  `vite.config.ts`'s `VITE_BASE_PATH` fallback, `.env.example`,
  `public/404.html`'s comment, and CI's `VITE_BASE_PATH` variable default
  were all updated to `/project-atlas/`. This was the one item Phase 0
  explicitly deferred — see the original flag preserved below for context.
- **shadcn components are hand-authored, not CLI-generated.**
  `ui.shadcn.com` isn't reachable from this sandbox's network allowlist.
  `components.json` is still present and standard, so `npx shadcn add ...`
  will work normally from a machine with normal network access.
- **`isArchived` is not a Dexie index** despite §5 listing it as one.
  IndexedDB doesn't accept `boolean` as a valid key type — indexing it would
  throw at write time. Left unindexed; repositories filter in memory
  (accounts/categories are small tables, so this has no practical cost).
- **Two fields added to `Settings`, not in §5's list**: `appLockPinHash`
  (§4 says the app-lock setting "lives in Settings" but only the boolean is
  enumerated — the PIN needed storage somewhere) and `onboardingCompleted`
  (needed to gate onboarding vs. Dashboard on repeat launches).
- **`sampleDataRequested` field added.** Onboarding's "load sample data"
  toggle (§9) can't act immediately — the `transactions` store doesn't
  exist until Phase 1. This flag records intent; Phase 1 should read and
  clear it once it can actually seed sample transactions, then remove the
  TODO in `SampleDataStep.tsx`.
- **Category color palette invented** — §5 doesn't define one (the 5 named
  accents are reserved for income/expense/warning/info/liability). Three
  categories that ARE one of those concepts reuse the matching accent
  (EMI/Loans → liability purple, Salary → income emerald, Transfers → info
  blue); the rest get distinct, non-colliding hues. Easy to revise — see
  `src/constants/seed-data.ts`.
- **Bottom nav shows 5 of 10 destinations directly + a "More" sheet** for
  the rest. §2 says "never hide primary destinations in nested menus," but
  §3 also calls for a _compact_ bottom nav — 10 items don't fit at a
  48px-minimum touch target on phone width. Treated "More" as a flat,
  one-tap list (not a nested hierarchy) as the least-bad reconciliation.
  Worth confirming which 5 items should be primary — current pick is
  Dashboard, Transactions, Accounts, Budgets, Insights.
- **`features/calendar/` added** — §4's folder structure omits it from the
  `features/` list, but §1 and §9 (Phase 7) both treat Calendar as a full
  primary screen. Added pragmatically since routing needs it.
- **No phase in §9 owns the Settings screen itself**, despite it being one
  of the 10 primary screens in §1. Phase 0 ships the two capabilities it
  actually built (theme, app lock) on that screen; worth deciding which
  phase should own the rest (currency, categories, backups, etc.) —
  possibly its own phase, or split across the phases that introduce each
  setting.
- **`react-router-dom` pinned to 6.30.4**, not 7.x. 7.x carries a `high`
  severity advisory (RSC-mode CSRF bypass) that doesn't apply to this
  client-only SPA but would show up in every future `npm audit`. 6.30.4 has
  2 `moderate` advisories (open redirect via backslash in `<Link>`, SSR
  hydration deserialization) that are also inapplicable here (no SSR, no
  redirect targets built from untrusted input). Revisit if the project ever
  adds SSR.
- **Did not install the `geist` npm package** for the Geist fallback font —
  it transitively pulls in Next.js and Sharp, disproportionate for a font
  that's second in the fallback chain behind bundled Inter. The CSS
  `font-family` stack still names `Geist`, which only matters if a user's
  OS happens to have it installed.

### Known gaps intentionally deferred

- No visual/manual QA pass in a real browser was possible in this sandbox
  (no browser automation tool available with a permitted network target) —
  verification here is build/lint/typecheck/test passing plus a manual
  audit of every spacing/color/radius class against the design tokens.
  Recommend a quick look in an actual browser before relying on this.
