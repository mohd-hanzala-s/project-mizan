# Phase 7 — Calendar & Timeline: Implementation Report

Reference spec: `docs/atlas-master-spec.md` (identical to `nexus-finance-master-spec.md`)
Scope: §9 Phase 7 ("Calendar & Timeline"), §3 `CalendarView` component states, §5 `Settings` (`firstDayOfWeek`, `defaultView`), §8 roadmap (user-editable "financial events" deferred to v1.2/P2), §10 data-integrity rules.
Companion state file: `PROJECT_STATE.md`.

---

## 1. Executive Summary

Phase 7 delivers the Calendar & Timeline: a real calendar screen at
`/calendar` (replacing the Phase 5-era placeholder) with month / week / day
views, prev / next / Today navigation, a free-text search, kind filter pills
(All / Transactions / Recurring / Loans), a selected-day event panel, and
per-day grouped timelines. Every event shown is **derived on demand** from
data the app already owns — transactions, recurring rules, and loans (+
recorded EMI payments) — because §8 defers a user-editable "financial
events" entity to v1.2 (P2). This follows the exact precedent of the
non-persisted alert feeds from Phases 4/5/6.

The phase added one new service (`CalendarService`), one new feature folder
(`features/calendar/` with three presentational components and the page), and
16 new tests. Business logic lives in `CalendarService`; the components are
presentation-only; no database schema change was needed (schema stays v6).

All quality gates are green: lint (including the design-token audit),
typecheck, 166 unit/integration tests (16 of them new in Phase 7) across 21
files, and a production PWA build.

## 2. Architecture Changes

No structural/architectural change. Phase 7 follows the established
four-layer model exactly:

- **Database layer** — unchanged (schema v6). No new store: events are
  derived, not persisted.
- **Repository layer** — unchanged. CalendarService reads from the existing
  transaction / recurring / loan stores via the app's Zustand stores.
- **Service layer** — new `CalendarService` (pure derivation, no I/O):
  month / week / day event building, day summaries, and filtering.
- **UI layer** — a new `features/calendar/` feature folder: `CalendarPage`
  (state + composition) plus `CalendarView`, `WeekStrip`, `CalendarEventRow`
  (presentation only).

Key architectural principle preserved: **the calendar is a projection.** Like
alerts before it, it is computed on render from the stores' in-memory data;
there is no separate event table to keep in sync, and a new transaction,
recurring occurrence, or loan payment immediately shows up.

## 3. Folder Structure Changes

Added files (new paths in bold):

```
src/
  services/CalendarService.ts              (new)
  features/calendar/
    CalendarPage.tsx                       (rewritten — was PlaceholderPage)
    CalendarView.tsx                       (new)
    WeekStrip.tsx                          (new)
    CalendarEventRow.tsx                   (new)
  tests/
    calendar-service.test.ts               (new, 13 tests)
    calendar-page.test.tsx                 (new, 3 tests)
docs/PHASE7_REPORT.md                      (this file)
```

No folders were removed or renamed. `features/calendar/` is the only new
feature folder; the previous placeholder under `features/calendar/` was
replaced in place, so the existing `/calendar` route needed no router change.

## 4. Database Schema Changes (Dexie schema version)

**None.** Schema stays **v6** (`nexus-finance`). Phase 7 introduces no
persisted entity (§8 defers "financial events"), so no store, index, or
migration was added or changed.

## 5. New Entities

**None.** The phase introduces a derived `CalendarEvent` (interface only, in
`CalendarService`, not stored):

- `id` — stable string: `tx-<id>` / `rec-<ruleId>-<yyyy-mm-dd>` /
  `loan-due-<id>` / `loan-pay-<id>` (used as React keys; stable across
  re-derivations).
- `date` — start-of-day `Date` the event lands on.
- `kind` — `'transaction' | 'recurring' | 'loan'`.
- `title` — human-readable label (e.g. "Groceries", "Rent",
  "EMI due · Home Loan").
- `amount` — signed number; positive = money in, negative = money out.

## 6. New Repositories

None. `CalendarService` is read-only over the existing repositories through
the existing Zustand stores.

## 7. New Services

**`CalendarService`** (`src/services/CalendarService.ts`) — pure derivation
engine, namespace-exported as `CalendarService` (mirroring the
service-object convention used elsewhere):

| API | Purpose |
|-----|---------|
| `getMonthEvents(year, monthIndex, transactions, recurringRules, loans, loanPayments, reference?)` | All events in a calendar month, newest-first. `reference` = "today" (injected in tests, defaults to now). |
| `getDayEvents(events, date)` | Events on one day (start-of-day compare). |
| `getWeekEvents(events, weekStart)` | Events in a 7-day window from `weekStart`. |
| `getDaySummary(events)` | `{ count, income, expense, net }` for a day's events. |
| `filterEvents(events, query, kinds)` | Kind set + case-insensitive title search. Empty `kinds` = all. |

Internal builders:

- **`transactionEvents`** — skips soft-deleted rows, `type === 'transfer'`,
  and transfer credit legs (transfers are neither income nor expense, §10).
  Generated recurring transactions appear here as ordinary transaction
  events once paid.
- **`recurringEvents`** — strictly-future occurrences of **active** rules
  only (`computeNextExecution` then `addOccurrence` walks the window, capped
  at 62 per rule). Paused rules generate nothing. Because schedule events
  are strictly future and generated transactions appear as transaction
  events, a due occurrence never double counts.
- **`loanEvents`** — one next-EMI-due event per active loan with a positive
  balance (`nextDueDate`, strictly-after-today, from `LoanService`), plus
  every recorded EMI payment (past/current), titled `EMI paid · <loan>`.

## 8. New Zustand Stores

None. `CalendarPage` consumes the four existing stores
(`useTransactionsStore`, `useRecurringStore`, `useLoansStore`,
`useSettingsStore`), each already loaded at startup and on mount.

## 9. New Components

All presentation-only; no business logic inside components.

- **`CalendarView`** (`features/calendar/CalendarView.tsx`) — 42-cell month
  grid (6 weeks, Sunday/Saturday start from `Settings.firstDayOfWeek`).
  Per cell: kind-colored dots (`bg-text-tertiary` transactions, `bg-info`
  recurring, `bg-liability` loans), a compact net amount (`+₹1.5k` /
  `−₹2k`), and today / selected / outside-month states. The selected cell
  uses the income-subtle background per the calendar's income-positive
  identity.
- **`WeekStrip`** (`features/calendar/WeekStrip.tsx`) — 7-day strip with a
  per-day event count, today/selected states, `min-h-touch` day buttons.
- **`CalendarEventRow`** (`features/calendar/CalendarEventRow.tsx`) —
  per-kind icon (Receipt / Repeat / Landmark) with per-kind icon styles and
  a signed amount (income emerald, loan liability purple, else expense),
  tabular-nums.
- **`CalendarPage`** (rewritten) — owns `view` (`month`|`week`|`day`),
  `anchor`, `selectedDate`, `query`, `kinds`; loads all four stores on
  mount; renders the view toggle radiogroup, prev/next/Today nav, `SearchBar`
  ("Search the calendar"), filter pills, then the active view plus the
  selected-day panel (month) or grouped timeline (week/day).

## 10. Dashboard Integrations

None — the calendar is a standalone destination (`/calendar`), not wired into
the Dashboard. Dashboard metrics, alerts, and recents are untouched.

## 11. Business Rules Implemented

1. **Events are derived, never stored** (§8 v1.2 deferral).
2. **Transfers are invisible** — both legs (debit and credit) are excluded;
   transfers never appear as income or expense (§10).
3. **Soft-deleted transactions are excluded.**
4. **Recurring schedule events are strictly future** — an occurrence equal
   to today's start-of-day is pushed to the next period, and once a
   scheduled occurrence is due it materialises as a generated transaction
   event instead, so the timeline never double counts a rupee.
5. **Paused rules produce no schedule events.**
6. **One next-EMI-due event per active, positive-balance loan**, dated via
   `nextDueDate` (the same §10 due-day / month-end-clamp math as Phase 6).
7. **Recorded EMI payments always appear** (past or current), giving
   per-loan payment history on the calendar.
8. **Month events sort newest-first** so the calendar reads as a timeline;
   a single day's list is oldest-first within the day panel by construction
   (newest-first sort groups equal dates with no reordering).
9. **Week view spans month boundaries** — when a week crosses into the
   previous/next month, that month's events are merged before the 7-day
   window filter.
10. **`getDaySummary` counts income and expense from signed amounts** (a
    loan due counts as expense; income rules/transactions count as income).

## 12. Schedule Behaviour

The calendar's own navigation:

- **Month** — prev/next moves ±1 month; the 42-cell grid always shows six
  full weeks; adjacent-month cells render muted.
- **Week** — prev/next moves ±7 days; the strip anchors on
  `startOfWeek(anchor, { weekStartsOn })`; the title shows the week's date
  range.
- **Day** — prev/next moves ±1 day; title is the weekday + date; selecting a
  day in the strip re-anchors.
- **Today** — resets `anchor` and `selectedDate` to now.
- The default `anchor`/`selectedDate` is today; a selected day in the month
  grid drives the day-detail panel.

## 13. Public APIs

`CalendarService` (namespace object) exposes:

- `getMonthEvents(...)` → `CalendarEvent[]`
- `getDayEvents(events, date)` → `CalendarEvent[]`
- `getWeekEvents(events, weekStart)` → `CalendarEvent[]`
- `getDaySummary(events)` → `DaySummary`
- `filterEvents(events, query, kinds)` → `CalendarEvent[]`

Types: `CalendarEvent`, `CalendarEventKind`, `DaySummary`. No persisted data,
no new repository/store APIs.

## 14. Test Summary

166 tests, 21 files, all passing (`npm run test`). Phase 7 added **16** tests
in two new files:

- **`calendar-service.test.ts` (13)** — transaction events with correct
  signs; excluded transfer legs, credit legs, and soft-deleted rows;
  month-window boundary; recurring occurrences future-only, in-window,
  active-rules-only, paused / out-of-window / strictly-today rules produce
  nothing; weekly rule multi-occurrence; loan next-due event (active
  positive-balance, strict after today) + recorded payment event; newest-first
  sort; empty-data safety; `getDayEvents` / `getWeekEvents` / `getDaySummary`;
  `filterEvents` by kinds and by query; `CalendarService` namespace binding.
  Tests use an injected fixed `reference` (15 Jun 2026) for determinism.
- **`calendar-page.test.tsx` (3)** — month grid + empty-day message before
  data; a seeded today transaction appearing in the selected-day list; the
  view toggle switching to the day view showing the same events in a
  "Timeline". Page tests clean the Dexie DB (`db.delete(); db.open()`) and
  seed onboarding in `beforeEach`.

No pre-existing test was weakened; the loan, recurring, transaction, and
dashboard suites re-verified Phase 7's untouched surfaces.

## 15. Regression Summary

- **Baseline before Phase 7**: full suite green (150 tests, 19 files), lint +
  design-token audit clean, typecheck clean, production build + PWA green.
- **After Phase 7**: full suite green (166 tests, 21 files) with no unhandled
  errors; lint + design-token audit clean; typecheck clean; production build
  + PWA clean; live dev-server smoke test of `/calendar` returns 200.
- **Issues found and fixed during the phase**:
  1. `CalendarView` imported `getDayEvents` it never used (lint warning) —
     removed.
  2. `startOfWeek`'s `weekStartsOn` requires date-fns' literal `Day` union,
     but `Settings.firstDayOfWeek` is typed `number` — cast
     `(settings?.firstDayOfWeek ?? 0) as Day`.
  3. A calendar-service loan test built a payment against `loans()[0].id`
     where each `loans()` call minted a **new** random UUID, so the payment's
     `loanId` never matched a loan and the title fell back to "Loan". Fixed
     by hoisting shared `homeLoan`/`completedLoan` instances so ids match.
  4. A calendar-page test asserted `getByText(/500/)`, which matched both the
     grid cell's compact net amount and the event row amount — switched to
     `getAllByText(...).length > 0`.
- **Product regressions**: none observed. Balance math, transfers, budgets,
  dashboard metrics, categorization, recurring, loan, and account archive
  behaviour all re-verified by the pre-existing suites.

## 16. Build Summary

- `npm run build` → `dist/` produced cleanly. (The >500 kB single-chunk
  warning is pre-existing and unchanged; all imports remain static.)
- PWA (Workbox `generateSW`): 23 precache entries (~757 KiB), files generated
  to `dist/sw.js` + `dist/workbox-*.js`.
- Bundle: single JS chunk ~521 kB (153 kB gzip) + CSS ~21.5 kB (5.3 kB gzip).
- `npm run lint` includes the automated design-token audit
  (`scripts/check-design-tokens.mjs`) — passed (no out-of-scale spacing,
  radius, or raw-palette classes introduced).
- `npm run typecheck` (`tsc -b --noEmit`): clean.

## 17. Performance Notes

- **Derivation is a few linear passes** over in-memory arrays already held by
  the stores — no extra fetches, no N+1. The month view builds once per
  `anchor` change (`useMemo`) and week/day views slice it.
- **Occurrence expansion is bounded**: `MAX_RECURRING_OCCURRENCES = 62` per
  rule per window keeps derivation `O(rules × 62)` worst case; a daily rule
  yields ≤ the window's days.
- **Week view merges at most one adjacent month** per render (only when the
  week actually crosses a boundary) — not both neighbors every time.
- **All four store loads already happen at startup**; the page just calls the
  existing `load()` actions on mount. No new timers, polling, or hot paths.
- The grid is 42 plain buttons; rows are memoized-free but trivial.

## 18. Technical Debt

1. **Derivation on every mount** — the calendar recomputes events from
   store state; cheap now, revisit if event count grows past thousands per
   month (a persisted event table lands with §8's v1.2 anyway).
2. **`CalendarPage` bundles view/selection state + derivation + layout**
   (~290 lines). If it grows, extract the per-view panels.
3. **Adjacent-month merge logic lives in the page** — two branches
   (prev-month / next-month); fine, but a `getRangeEvents(events, start, end)`
   helper in `CalendarService` would subsume both.
4. **The form-row / pill duplication noted in Phases 4–6 remains** (filter
   pills are styled inline; `RecurringCard`/`LoanCard` still hold local
   status styles).
5. **`getDayEvents` compares by start-of-day timestamp**, which is exact for
   derived events (always start-of-day) — no DST/timezone concern today, but
   a date-keyed (yyyy-mm-dd) API would be safer if event dates ever carry
   times.

## 19. Known Limitations

- **No user-authored events.** The timeline only reflects transactions,
  recurring rules, and loans — a "remember: salary credited" note with no
  financial record can't exist yet (deferred to §8's v1.2 event entity).
- **No drag-and-drop / long-press rescheduling** — navigation is
  prev/next/Today and day selection only.
- **Kind filter pills are single-select**, not multi-select.
- **Recurring schedule events stop at the window** — a rule's next due is
  always in the current month's window because nav steps one month/week/day;
  occurrence expansion is capped defensively.
- **No OS notifications or background timers** (same PWA constraint as every
  phase) — calendar events are computed on open/render.
- No visual/manual browser QA in this sandbox (build/lint/typecheck + render
  tests + design-token audit substitute).
- INR-first; no multi-currency amounts.

## 20. Architectural Decisions

1. **No "financial events" table — the calendar is a projection.** §8
   schedules the event entity for v1.2 (P2). Building a derived engine now
   matches the Phases 4/5/6 alert precedent and avoids a store + CRUD +
   migration that would be reworked when the entity lands.
2. **Three sources, one timeline, no double counting.** Transactions are
   actuals; recurring schedule events are strictly future; loan due dates are
   the next-EMI projection plus recorded payments. A due recurring occurrence
   appears as a transaction event (the generated ledger entry), never as
   both.
3. **Transfers are excluded entirely** — both legs. §10 says transfers
   never affect income/expense totals; showing the credit leg as "income"
   would be wrong, so neither leg renders.
4. **Stable, deterministic event ids** make the derived list safe as React
   keys and diffable across re-derivations.
5. **Loan EMIs keep the §5 balance model** — the calendar reads `nextDueDate`
   / recorded payments and never mutates a loan; the loan-feature guarantee
   (balance moves only via `recordPayment`) is untouched.
6. **Reuse over re-implementation** — `computeNextExecution` /
   `addOccurrence` (RecurringService) and `nextDueDate` (LoanService) are the
   scheduling primitives; `CalendarService` only composes them. Phase 6
   report §22's open question ("should loan EMIs feed the calendar?") is
   therefore answered **yes**, at read time only.
7. **`reference` is injectable** so the service is fully deterministic under
   test, and defaults to `new Date()` in production.

## 21. Deferred Improvements

1. **§8 v1.2 "financial events" entity** — user-authored reminders/notes on
   the calendar, with its own store + migration; the derived engine slots in
   unchanged as one more source.
2. **Multi-select kind filters** (e.g. Transactions + Loans).
3. **Click-through events** — tapping a transaction event opens the
   transaction; a loan event opens the loan's payment history.
4. **Week/month summaries** — reuse `getDaySummary` to show net
   income/expense per week/month alongside the grid.
5. **`getRangeEvents` helper** to fold the page's adjacent-month merge into
   `CalendarService`.
6. **Persisted "seen" state** for reminders across phases — still the
   project-wide notification-log debt (see PROJECT_STATE §technical debt).

## 22. Recommendations before Phase 8

1. **Forecasts (§8/§9) can consume the calendar's derived timeline
   directly** — monthly net (`getDaySummary`) over a 90/180-day window is
   the natural input to projected balances. Consider exposing
   `getRangeSummary(events, start, end)`.
2. **Decide the event entity timing.** If §8's v1.2 "financial events" moves
   up, the store/migration pattern from Phases 4/6 (recurring_rules, loans)
   is the template; until then, keep the calendar derived.
3. **Watch `CalendarPage` size** as click-through and multi-select land;
   extract per-view panels (MonthPanel / WeekPanel / DayPanel) before it
   crosses ~350 lines.
4. **Manual browser QA** — month-grid day selection, week-boundary
   navigation, and the kind filter pills deserve a hands-on pass, as noted
   for every previous phase.
