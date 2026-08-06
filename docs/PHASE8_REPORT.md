# Phase 8 — Forecasts: Implementation Report

Reference spec: `docs/atlas-master-spec.md`
Scope: §6 "Forecasts" ("month-end spending, expected balance, upcoming obligations, expected savings — combining historical averages, recurring rules, pending payments, current-month trend. State explicitly when confidence is low."), §3 `ForecastCard`, §9 roadmap (the forecast-dashboard portion of the "Analytics" phase), §10 data-integrity rules.
Companion state file: `PROJECT_STATE.md`.

---

## 1. Executive Summary

Phase 8 delivers **Forecasts**: a `ForecastService` that projects month-end
spending, expected balance, upcoming obligations and expected savings for the
current budget period, surfaced on the Dashboard through a new
`ForecastCard` and through the existing alert feed (negative projected
balance / projected overspend — §6's "negative balance forecast" is a
**critical** priority item).

The projection is **derived on demand** — nothing is persisted, following the
exact precedent of the Phases 4/5/6 alert feeds and Phase 7's
`CalendarService`. It combines the three sources §6 names:

- **recurring rules** — future auto-generating occurrences;
- **pending payments** — unpaid pending transactions dated on/after today;
- **current-month trend** — a paid ordinary-spend run-rate (spent per elapsed
  day × remaining days), the same shape as §6's budget forecast.

Confidence (`high` / `medium` / `low`) is computed and its reason is always
shown, per "state explicitly when confidence is low."

The phase added one new service, one new Dashboard card, dashboard wiring,
and 20 tests. No database schema change (schema stays **v6**).

All quality gates are green: lint (including the design-token audit),
typecheck, 186 unit/integration tests (20 of them new in Phase 8) across 22
files, and a production PWA build.

## 2. Architecture Changes

No structural change. Phase 8 follows the four-layer model exactly:

- **Database layer** — unchanged (schema v6). The forecast is derived from
  already-stored data; no new store.
- **Repository layer** — unchanged. `ForecastService` is pure and takes
  in-memory data (via the existing Zustand stores) as arguments.
- **Service layer** — new `ForecastService` (pure derivation, no I/O):
  period shape, actuals, obligations, run-rate, confidence, and alerts.
- **UI layer** — new `ForecastCard` (presentation only) + wiring in
  `DashboardPage`.

Key architectural principle preserved: **the forecast is a projection.** Like
alerts and the calendar before it, it is computed on render from data the app
already holds; a new transaction, recurring occurrence, or loan payment
immediately changes the projection.

## 3. Folder Structure Changes

Added files (new paths in bold):

```
src/
  services/ForecastService.ts              (new)
  components/finance/ForecastCard.tsx      (new)
  tests/forecast-service.test.ts           (new, 20 tests)
  features/dashboard/DashboardPage.tsx     (modified — forecast card + alerts)
  tests/dashboard-populated.test.tsx       (modified — +1 render assertion)
docs/PHASE8_REPORT.md                      (this file)
```

`.gitignore` gained a `dist/` entry (build artifact hygiene — it was being
picked up by `prettier --check` and `git status`; CI builds fresh, so nothing
depends on it being tracked).

## 4. Database Schema Changes (Dexie schema version)

**None.** Schema stays **v6** (`mizan`). Phase 8 introduces no persisted
entity; the forecast is recomputed on demand, so no store, index, or
migration was added or changed.

## 5. New Entities

**None.** The phase introduces a derived `Forecast` (interface only, in
`ForecastService`, not stored):

- `period` — the current budget period (`DateRange` from
  `DashboardService.getCurrentPeriod`, honouring `Settings.budgetMonthStart`).
- `daysInPeriod` / `daysElapsed` / `remainingDays` — period shape for the
  projection and for UI copy.
- `actualIncome` / `actualExpense` — _paid_ income/expense in the period.
- `futureIncome` / `futureExpense` — projected cashflow for the rest of the
  period (obligations + run-rate remainder).
- `monthEndIncome` / `monthEndExpense` — actuals + future.
- `expectedSavings` — `monthEndIncome − monthEndExpense`.
- `expectedBalance` — sum of non-archived account balances + projected net.
- `obligations` — the certain-future set, each `{ id, title, amount (signed),
date, source }` with `source: 'pending' | 'recurring' | 'loan'`.
- `confidence` (`high` / `medium` / `low`) and `confidenceReason` — always
  shown, never implied.

## 6. New Repositories

None. `ForecastService` is a pure function over in-memory data.

## 7. New Services

**`ForecastService`** (`src/services/ForecastService.ts`):

| API                                                                                            | Purpose                                                                                    |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `getForecast({ transactions, accounts, recurringRules, loans, budgetMonthStart, reference? })` | The full month-end projection (see §5). `reference` is injectable for deterministic tests. |
| `getForecastAlerts(forecast)`                                                                  | Derived warnings: negative projected balance + projected overspend (spec §6 critical).     |

Internal builders:

- **`pendingObligations`** — unpaid pending transactions dated on/after
  today. Auto-generated pendings for a _still-active_ rule are skipped (their
  occurrence is the same event the schedule projects); auto pendings for
  paused/missing rules are kept (nothing else projects them).
- **`recurringObligations`** — future occurrences of **active,
  auto-generating** rules from today through period end, computed from the
  schedule (`computeNextExecution` + `addOccurrence`, capped at 62/rule).
  Remind-only rules (`autoGenerate: false`) project nothing — their manual
  payments are ordinary spend, already captured by the run-rate.
- **`loanObligations`** — loan EMIs due from today through period end via
  `nextDueDate` (anchored one day back so an EMI due _today_ counts as
  upcoming; loop bounded at 6). Completed / zero-balance loans produce
  nothing.
- **`ordinaryRunRates`** — paid, non-recurring-generated income/expense per
  elapsed day (the "current-month trend"), used to extrapolate the uncertain
  remainder.
- **`assessConfidence`** — low when there's no activity or fewer than 3
  elapsed days; medium below half the period; high otherwise.

## 8. New Zustand Stores

None. `DashboardPage` already loads all four inputs (`useTransactionsStore`,
`useAccountsStore`, `useRecurringStore`, `useLoansStore`); the forecast is a
`useMemo` over them.

## 9. New Components

- **`ForecastCard`** (`components/finance/ForecastCard.tsx`) — presentation
  only. Renders: a confidence pill in the card header (`high` → income tint,
  `medium` → info, `low` → warning), three stat tiles (projected balance,
  expected savings, days left), an expected income / expected expense
  breakdown, the top 4 upcoming obligations (with dates and signed amounts,
  "+N more" overflow), and the always-visible confidence reason.
  Spacing/colour classes are all on the design-token scale (the Phase 2
  automated audit enforces this).

## 10. Dashboard Integrations

- `ForecastCard` sits between the metric grid and `QuickAdd`.
- `getForecastAlerts` output is merged into the existing Alerts feed (after
  the loan alerts), so a negative projected balance or projected overspend
  surfaces as a warning card at the top of the Dashboard.

## 11. Business Rules Implemented

1. **The forecast is derived, never stored** (same precedent as alerts and
   CalendarService).
2. **Actuals match the Dashboard metrics** — only `paid` income/expense
   inside the current budget period (transfers and transfer credit legs
   excluded, §10).
3. **Each scheduled occurrence is counted exactly once**:
   - auto-generated pending for an active rule → dropped in favour of the
     projected schedule entry;
   - remind-only rules → no schedule projection (their payments are ordinary
     spend);
   - paused rules → no schedule projection, but their lingering auto pending
     rows are kept.
4. **The run-rate excludes unpaid entries, transfers, and recurring-generated
   transactions**, so nothing double-counts.
5. **Obligations respect the period boundary** — an occurrence equal to or
   past `period.end` is excluded (a monthly rule starting today never leaks a
   next-month occurrence into this month's projection).
6. **A loan EMI due today still counts as upcoming.**
7. **Confidence is stated explicitly with a reason**, per §6; it reflects
   how much observed trend the run-rate has to lean on.
8. **Negative projected balance / overspend surface as critical-derived
   warnings** in the alert feed (§6's critical priority list).

## 12. Schedule Behaviour

No new schedule machinery. The phase composes existing primitives:

- `getCurrentPeriod` (DashboardService) — period boundaries per
  `budgetMonthStart`.
- `computeNextExecution` / `addOccurrence` (RecurringService) — next and
  subsequent occurrences.
- `nextDueDate` (LoanService) — next EMI due date (with §10 due-day /
  month-end clamping).

## 13. Public APIs

`ForecastService` (namespace object) exposes:

- `getForecast(input: ForecastInput): Forecast`
- `getForecastAlerts(forecast: Forecast): DashboardAlert[]`

Types: `Forecast`, `ForecastInput`, `ForecastObligation`,
`ForecastObligationSource`, `ForecastConfidence`. No persisted data, no new
repository/store APIs.

## 14. Test Summary

186 tests, 22 files, all passing (`npm run test`). Phase 8 added **20** tests:

- **`forecast-service.test.ts` (20)** — period shape and days math; full
  projection (rent + EMI obligations, run-rate extrapolation, month-end
  totals, expected balance) with exact integer fixtures; mid-month
  `budgetMonthStart` period bounds (obligations clipped to period end);
  confidence bands (no activity → low + reason, <3 elapsed days → low,
  mid-month → medium, well-observed → high); obligation sources
  (manual pending, auto-pending-not-double-counted, paused-rule pending kept,
  remind-only not projected, income rules, EMI due today, paid-off loans
  ignored); run-rate hygiene (transfers excluded, unpaid excluded,
  recurring-generated not extrapolated but still an actual); and
  `getForecastAlerts` (negative balance, negative savings, healthy silence).
- **`dashboard-populated.test.tsx`** — the existing seeded-Dashboard render
  test now also asserts the "Month-End Forecast" card and its projected
  balance stat appear.

Tests use an injected fixed `reference` for full determinism. No pre-existing
test was weakened; the full suite re-verified every prior phase's surface.

## 15. Regression Summary

- **Baseline before Phase 8**: full suite green (166 tests, 21 files), lint +
  design-token audit clean, typecheck clean, production build + PWA green.
- **After Phase 8**: full suite green (186 tests, 22 files) with no unhandled
  errors; lint + design-token audit clean; typecheck clean; production build
  - PWA clean.
- **Issues found and fixed during the phase**:
  1. The first `ForecastCard` draft used `mt-2` (a 2px spacing not in the
     §2 scale) — the automated design-token audit caught it; changed to
     `mt-4`.
  2. `prettier --check` flagged the freshly built `dist/` artifact — added
     `dist` to `.gitignore` (Prettier respects it), which is also correct
     repo hygiene since the artifact was untracked.
  3. Design pass on double counting: the initial projection model would have
     counted a due-today recurring occurrence twice (once as its pending row,
     once as its schedule entry) — fixed with the auto-pending-for-active-rule
     skip and the remind-only / paid-only run-rate rules (see §11, §20).
  4. Two unhandled `DatabaseClosedError` rejections in the full suite from
     the dashboard render test mounting `<App/>` twice: the second render's
     async store loads raced the next test's `db.delete()` teardown. Fixed by
     merging the forecast-card assertion into the existing single-mount test
     (one render, no teardown race); the full suite now reports zero unhandled
     errors.
- **Product regressions**: none observed. Balance math, transfers, budgets,
  dashboard metrics, categorization, recurring, loan, and calendar suites all
  re-verified.

## 16. Build Summary

- `npm run build` → `dist/` produced cleanly (pre-existing >500 kB
  single-chunk warning unchanged).
- PWA (Workbox `generateSW`): 23 precache entries, files generated to
  `dist/sw.js` + `dist/workbox-*.js`.
- `npm run lint` includes the automated design-token audit — passed.
- `npm run typecheck` (`tsc -b --noEmit`): clean.
- `npm run format:check`: clean.

## 17. Performance Notes

- **Derivation is a few linear passes** over the stores' in-memory arrays —
  no extra fetches, no N+1. `DashboardPage` memoizes the forecast on its five
  inputs.
- **Occurrence expansion is bounded** (`MAX_OBLIGATIONS_PER_RULE = 62`), so
  worst case is `O(rules × 62)`; loan EMI iteration is capped at 6 per loan.
- No timers, polling, or hot paths added.

## 18. Technical Debt

1. **Run-rate is a naive linear pace.** §6 mentions "historical averages";
   a hybrid that weights the previous period would smooth volatile first
   weeks (tracked in `PROJECT_STATE.md`).
2. **Forecast derivation runs on every Dashboard render** (memoized, cheap);
   a persisted projection would matter only at very large data volumes.
3. The standing Phase 4/5/6 debts (derived, non-persisted alerts; no
   notification log; status-style maps in `RecurringCard`/`LoanCard`) remain.

## 19. Known Limitations

- **Payments are assumed on schedule.** Missed/overdue items are surfaced by
  the recurring and loan alerts, not subtracted from the projection.
- **Confidence reflects observed trend only** — a day-2 forecast of a known
  rent bill is still "low".
- **No per-category forecast and no projected-balance chart** across the
  remaining days — deferred to the wider analytics work (spec §9 "Analytics").
- No visual/manual browser QA in this sandbox (build/lint/typecheck + render
  tests + design-token audit substitute).
- INR-first; no multi-currency amounts.

## 20. Architectural Decisions

1. **No forecast table — the forecast is a projection.** §5 has no forecast
   entity and §9's Phase 8 is about analytics surfaced from existing data;
   building a store + migration + sync would be reworked when a real
   projections table ever lands. Same precedent as alerts and Calendar.
2. **Phase 8 = "Forecasts" (PROJECT_STATE roadmap), not the spec §9
   "Analytics" label.** Implemented the §6 Forecasts capability in full — the
   "forecast dashboard" piece of the Analytics bullet. The wider analytics
   (category / cash-flow / savings charts, heatmap, YoY comparison) remains
   for a later phase alongside Phase 9. This is documented in
   `PROJECT_STATE.md` and `CHANGELOG.md` so the deviation is explicit, per
   §11 "flagged, not silently assumed."
3. **No double counting.** The three obligation sources are mutually
   exclusive by construction (auto-pending-for-active-rule skip, remind-only
   rules excluded, schedule vs. pending parity), and the run-rate counts only
   paid, ordinary, non-recurring-generated activity. A rupee moves through
   the projection exactly once.
4. **`reference` is injectable** so the service is fully deterministic under
   test and defaults to `new Date()` in production.
5. **`expectedBalance` is account-level, `expectedSavings` is period-level.**
   `expectedBalance` = current balances + projected net for the rest of the
   period (past net is already in the balances); `expectedSavings` is the
   full-period income − expense projection. They're different quantities and
   both are shown, so the card never conflates them.
6. **Reuse over re-implementation** — the projection composes
   `getCurrentPeriod`, `computeNextExecution` / `addOccurrence`, and
   `nextDueDate` rather than re-deriving schedule math (Phase 7 report §22
   anticipated exactly this reuse).

## 21. Deferred Improvements

1. **Hybrid run-rate** — blend the current month's pace with the previous
   period's averages (§6 "historical averages").
2. **Projected-balance chart** (line/area across the remaining days) once
   the analytics phase adds charts.
3. **Per-category forecast** — combine budget statuses with the monthly
   projection.
4. **Missed-payment awareness** — fold unpaid overdue pending/EMIs into the
   projection rather than leaving them to the alert feed.
5. **Persisted "seen" state** for alerts across phases — still the
   project-wide notification-log debt (see `PROJECT_STATE.md` §technical
   debt).

## 22. Recommendations before Phase 9

1. **The wider §9 "Analytics" scope** (charts, heatmap, YoY, per-category
   analysis) is still open and pairs naturally with Phase 9's insights —
   consider folding them together or explicitly re-ordering.
2. **Consider `getRangeSummary` in CalendarService** (flagged by Phase 7) —
   a rolling net-income series over 90/180 days is the natural input to a
   smoothed run-rate.
3. **Revisit the notification-log debt** before Phase 9's
   "notify once per threshold" and recommendation mechanics — a persisted,
   dedup'd seen-state would unify alerts, budgets, loans, and now forecasts.
4. **Manual browser QA** — the ForecastCard's low-confidence state, its
   overflow row, and the projected-balance tinting deserve a hands-on pass,
   as noted for every previous phase.
