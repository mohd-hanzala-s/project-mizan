# Phase 6 — Loan Manager: Implementation Report

Reference spec: `docs/atlas-master-spec.md` (identical to `nexus-finance-master-spec.md`)
Scope: §9 Phase 6 ("Loan Manager"), §6 loans/EMI tracking, §5 `Loan`/`LoanPayment` entities, §3 `LoanCard` + confirmation dialogs, §10 data integrity & edge cases.
Companion state file: `PROJECT_STATE.md`.

---

## 1. Executive Summary

Phase 6 delivers the Loan Manager: loan creation/editing/deletion, EMI
recording with automatic principal/interest splitting, an independent
outstanding balance that moves only through recorded payments, payoff
progress with remaining-EMI and estimated-completion forecasts, per-loan
payment history with a reverse action, active + completed sections on the
Loans screen, a real Dashboard "Loans" summary card (replacing the Phase 6
placeholder), and four derived loan alerts (EMI due tomorrow, EMI overdue,
loan completed, extra payment) merged into the existing Alerts feed.

The phase was built entirely on the existing Phase 0–5 architecture — no new
patterns, no re-architecture. Business logic lives in `LoanService`; data
access is confined to `LoanRepository`; UI is presentation-only
(`LoansPage`, `LoanForm`, `PaymentForm`, `LoanCard`, Dashboard card). The
Dexie schema was extended via a proper v5 → v6 migration (§11).

All quality gates are green: lint (including the design-token audit),
typecheck, 150 unit/integration tests (33 of them new in Phase 6) across 19
files, and a production PWA build.

## 2. Architecture Changes

No structural/architectural change. Phase 6 follows the established
four-layer model exactly:

- **Database layer** (`src/database/db.ts`) — schema v6, two new stores.
- **Repository layer** — new `LoanRepository` (loans + loan_payments).
  Repositories remain data-access-only.
- **Service layer** — new `LoanService`: loan CRUD, `recordPayment` /
  `deletePayment`, and pure derivation helpers (`firstDueDate`,
  `nextDueDate`, `isOverdue`, `splitPayment`, `getPayoffForecast`,
  `getAlerts`).
- **UI layer** — a new `features/loans/` feature folder (page + loan form +
  payment form + Zustand store), a shared `components/finance/LoanCard`, and
  a Dashboard integration point.

Key architectural principle preserved: **loan money movement is
self-contained.** Recording an EMI reduces the loan's own `currentBalance`
and writes a `LoanPayment` row inside one atomic `db.transaction`; it never
posts to the ledger (the §5 `Transaction.loanId` link stays reserved). This
is why loans don't reuse the recurring engine — recurring rules are
ledger-facing (scheduled transactions), loans are balance-tracking.

## 3. Folder Structure Changes

Added files (new paths in bold):

```
src/
  database/db.ts                      (modified — schema v6: loans, loan_payments)
  types/entities.ts                   (modified — LoanStatus, Loan, LoanPayment)
  repositories/LoanRepository.ts      (new)
  services/LoanService.ts             (new)
  features/loans/
    loansStore.ts                     (new)
    LoansPage.tsx                     (rewritten — was PlaceholderPage)
    LoanForm.tsx                      (new)
    PaymentForm.tsx                   (new)
  components/finance/LoanCard.tsx     (new)
  features/dashboard/DashboardPage.tsx (modified — Loans summary card + alert merge)
  tests/
    loan-service.test.ts              (new, 30 tests)
    loan-page.test.tsx                (new, 3 tests)
docs/PHASE6_REPORT.md                 (this file)
```

No folders were removed or renamed. `features/loans/` is the only new
feature folder.

## 4. Database Schema Changes (Dexie schema version)

**Version 6** (migration from v5, via Dexie's diff-based `stores()` upgrade):

```
this.version(6).stores({
  accounts: 'id, type',
  categories: 'id, name, parentCategory',
  settings: 'id',
  transactions:
    'id, transactionDate, categoryId, accountId, amount, type, status, recurringRuleId, loanId',
  favorites: 'id, categoryId, usageCount, lastUsed',
  tags: 'id, &name',
  budgets: 'id, categoryId',
  recurring_rules: 'id, nextExecution',
  loans: 'id, dueDay, status',            // NEW
  loan_payments: 'id, loanId, paymentDate', // NEW
})
```

- New store **`loans`**, primary key `id`, indexed on `dueDay, status` per
  §5.
- New store **`loan_payments`**, primary key `id`, indexed on `loanId,
paymentDate` per §5.
- `status` is a string (`'active' | 'completed'`), not a boolean — the
  same IndexedDB constraint that kept booleans out of indexes in Phases
  0/1/5 does not apply here, so §5's `status` index is used as specified.
- The full schema for all stores is restated per version (Dexie's own
  convention).
- Existing data survives untouched; version 6 only adds two tables.
- `Transaction.loanId` needed no migration — the field was declared in the
  entity type since Phase 1 and Dexie doesn't enforce foreign keys.

## 5. New Entities

Defined in `src/types/entities.ts`:

- **`Loan`**: `id`, `loanName`, `lender`, `originalAmount`, `currentBalance`,
  `monthlyEMI`, `interestRate` (annual %, `null` = not tracked), `startDate`,
  `endDate` (`null` allowed), `dueDay` (1–31), `status` (`active` |
  `completed`), `notes`, `createdAt`, `updatedAt`.
- **`LoanPayment`**: `id`, `loanId`, `paymentDate`, `amountPaid`,
  `principalPaid`, `interestPaid`, `remainingBalance` (balance immediately
  after this payment), `notes`, `createdAt`, `updatedAt`.
- **`LoanStatus`**: `'active' | 'completed'`.

`Loan` deliberately has no `accountId` — recording an EMI reduces the loan's
own balance; it does not post to the ledger. The optional
`Transaction.loanId` link (§5) remains for manual EMI expenses and later
analysis phases.

## 6. New Repositories

`src/repositories/LoanRepository.ts` — data access only:

- `getAll()` — active loans only (what the Dashboard/alerts care about).
- `getAllIncludingCompleted()` — the management screen's full list, newest
  first.
- `getById(id)`, `add(loan)`, `update(id, patch)` (stamps `updatedAt`),
  `delete(id)`.
- `getPayments(loanId)` / `getAllPayments()` — newest first; the store loads
  all payments once and filters per loan in memory (same pattern as
  `TransactionRepository.getRecurringGenerated`).
- `addPayment(payment)`, `deletePayment(id)`.

## 7. New Services

`src/services/LoanService.ts`:

- **`firstDueDate(loan)`** — the loan's due day on/after `startDate`, clamped
  to month-end; the anchor for all schedule math.
- **`nextDueDate(loan, reference)`** — the next EMI due date strictly after
  the reference, or `null` when paid off. Computed from month index + due
  day, never `addMonths` on a clamped date (§10 month-end transitions, so
  Feb 28 → Mar 31, not Mar 28).
- **`isOverdue(loan, payments, reference)`** — a skipped-cycle heuristic: the
  latest due date on/before today vs. whether any payment is dated after the
  previous month's due date. Early/late payments within a cycle count as
  covered.
- **`splitPayment(loan, amountPaid)`** — full payoff goes entirely to
  principal; otherwise interest is charged on the balance first (when
  `interestRate` is set) and the rest is principal; a payment below the
  month's interest reduces no principal.
- **`getPayoffForecast(loan, reference)`** — progress (0–1), remaining EMIs,
  and estimated completion. No-interest loans are a pure division; interest
  loans are simulated month-by-month, bounded at `MAX_FORECAST_MONTHS = 1200`,
  with an explicit "never pays off" signal when EMI ≤ monthly interest.
- **`create` / `update` / `delete`** — CRUD with validation; `delete` hard-
  deletes the loan + its payments in one `db.transaction`.
- **`recordPayment` / `deletePayment`** — balance math inside one atomic
  transaction; the balance is never allowed below 0 (§10 data integrity).
- **`getAlerts(loans, paymentsByLoan, reference)`** — due tomorrow / overdue /
  completed / extra payment, derived on demand (30-day expiry for
  informational alerts; overdue stays until the balance clears).

## 8. New Zustand Stores

`src/features/loans/loansStore.ts` — `loans`, `payments`, `isLoading`, and a
single `load()` that fetches both lists in parallel (loans via
`getAllIncludingCompleted`, payments via `getAllPayments`). Same shape as the
Phase 5 `recurringStore`.

## 9. New Components

`src/components/finance/LoanCard.tsx` (shared, `components/finance/` like
`BudgetCard`/`RecurringCard`):

- **Header**: liability-purple (`text-liability`) Landmark icon, loan name +
  lender, monthly EMI, status pill (Active / Overdue / Completed).
- **Outstanding balance + repaid % with a progress bar** (liability fill,
  warning fill when overdue — mirroring `BudgetCard`'s severity bar).
- **Four-stat grid**: remaining EMIs, estimated completion, next due,
  interest rate (p.a. / not tracked) — §3 LoanCard fields.
- **Actions**: Edit, Record payment, Delete (Delete/Edit disabled for
  completed loans where it makes no sense; delete always confirmable).
- **Expandable payment history**: date, principal/interest split, amount,
  and a reverse (Undo) button per row.
- Built entirely from semantic design tokens; `min-h-touch` on all touch
  targets.

`LoanForm` (create/edit) and `PaymentForm` (record) follow the established
feature-form patterns (label/input rows, `CurrencyInput`, service-error
display, disabled save until valid).

## 10. Dashboard Integrations

- **Loans summary card**: replaces the Phase 6 placeholder. Shows the top 5
  loans (name, EMI/mo or "Paid off", outstanding balance) with a "See all"
  action → `/loans`, and an invite to add a loan when none exist.
- **Alert merge**: `LoanService.getAlerts(loans, paymentsByLoan)` is
  computed per render (memoized) and appended to the same alerts array that
  already merges account / budget / recurring alerts.
- **`loadLoans()`** is added to the Dashboard's mount effect alongside the
  existing stores, so the card and alerts stay fresh.

## 11. Business Rules Implemented

- **`currentBalance` starts equal to `originalAmount`** and moves only via
  `recordPayment`. `originalAmount`/`startDate` are fixed at creation
  (identity/starting point — same precedent as Phase 3 account
  type/opening balance); everything else is editable via `update`.
- **Every recorded EMI** reduces the outstanding balance, creates payment
  history, and updates payoff progress (§6). If interest is tracked, the
  payment is split into principal/interest (§6).
- **Never a negative balance** (§6/§10): `recordPayment` rejects amounts over
  the outstanding balance; `remainingBalance` is clamped at 0.
- **A payment that brings the balance to 0 completes the loan** and blocks
  further payments; reversing that payment restores the balance and flips the
  status back to active.
- **Validation**: loan name, EMI > 0, original amount > 0, due day 1–31
  integer, interest rate 0–100, valid start date, end date ≥ start date.
- **Delete confirmation is required** (§3) before deleting a loan or
  reversing a payment.
- **Alerts (§6)**: EMI due tomorrow (info), EMI overdue (warning, persists
  until resolved), loan completed (info, 30-day expiry), extra payment made
  (info, 30-day expiry).

## 12. Schedule Behaviour

- **Due dates are derived, never stored.** `firstDueDate` anchors the
  schedule; every later due date is computed from the month index + due day,
  clamping to month-end (§10). This avoids the Feb-28 → Mar-28 drift that
  `addMonths` on a clamped date would cause.
- **`isOverdue` flags skipped cycles, not late days.** A payment anywhere
  between the previous due date and the latest due date counts as covering
  the cycle; only a fully skipped cycle (no payment after the previous due
  date) is overdue.
- **The forecast is deterministic and bounded.** No-interest loans divide
  directly; interest loans simulate month-by-month up to
  `MAX_FORECAST_MONTHS = 1200` and return `remainingEmis: null` when the EMI
  wouldn't cover monthly interest (explicit "never pays off" rather than a
  nonsensical date).

## 13. Public APIs

`LoanService` (all async methods reject with `Error` messages on invalid
input):

- `LoanService.create(input: CreateLoanInput): Promise<Loan>`
- `LoanService.update(id, input: UpdateLoanInput): Promise<void>`
- `LoanService.delete(id): Promise<void>`
- `LoanService.recordPayment(loanId, input: RecordPaymentInput): Promise<LoanPayment>`
- `LoanService.deletePayment(loanId, paymentId): Promise<void>`
- `LoanService.getAlerts(loans, paymentsByLoan, reference?): DashboardAlert[]`
- Pure helpers: `LoanService.firstDueDate(loan)`,
  `LoanService.nextDueDate(loan, reference?)`,
  `LoanService.isOverdue(loan, payments, reference?)`,
  `LoanService.splitPayment(loan, amountPaid)`,
  `LoanService.getPayoffForecast(loan, reference?)`.

`RecordPaymentInput = { paymentDate, amountPaid, notes? }` — no
principal/interest inputs; the split is entirely service-owned.

## 14. Test Summary

150 tests, 19 files, all passing (`npm run test`). Phase 6 added **33** tests
in two new files:

- **`loan-service.test.ts` (30)** — `firstDueDate` (on/after start, roll into
  next month, month-end clamp), `nextDueDate` (fast path, strict advance,
  null when paid off), `isOverdue` (skipped cycle, covered cycle, paid off),
  `splitPayment` (full payoff all-principal, interest-first split, no-
  interest all-principal, below-interest → zero principal), payoff forecast
  (simple division with anchored completion, paid-off zero, interest
  simulation, never-pays-off), CRUD (create with balance = original, invalid
  EMI/due-day rejection, editable-fields update keeping original amount fixed,
  interest-splitting record, complete + block further payments, over-balance
  rejection, reverse restoration/re-activation, delete cascades payments),
  and alerts (due tomorrow, overdue, completed, extra payment, 30-day
  expiry).
- **`loan-page.test.tsx` (3)** — empty-state render, a populated render
  asserting the loan card + EMI + Active badge, and a completed loan moving
  to the Completed section.

No pre-existing test was weakened; the dashboard-populated and app-shell
suites re-verified Phase 6's Dashboard wiring.

## 15. Regression Summary

- **Baseline before Phase 6**: full suite green (117 tests, 17 files), lint +
  design-token audit clean, typecheck clean, production build + PWA green.
- **After Phase 6**: full suite green (150 tests, 19 files) with no unhandled
  errors; lint + design-token audit clean; typecheck clean; production build
  - PWA clean.
- **Issues found and fixed during the phase**:
  1. One `loan-page.test.tsx` assertion failed because "Active" appears both
     as the section header and the card's status pill — changed to the
     `getAllByText` variant. Product logic unchanged.
  2. One service test passed a stale in-memory loan (balance still 1000 after
     the paying-off payment) to `getAlerts`; re-fetched the loan + payments
     after recording (same stale-object pattern the Phase 5 suite hit).
  3. The Dashboard initially built `paymentsByLoan` as a `Map`, which doesn't
     satisfy `getAlerts`' `Record<string, LoanPayment[]>` parameter — switched
     to a plain object.
- **Product regressions**: none observed. Balance math, transfers, budgets,
  dashboard metrics, categorization, recurring, and account archive behaviour
  all re-verified by the pre-existing suites.

## 16. Build Summary

- `npm run build` → `dist/` produced cleanly. (The >500 kB single-chunk
  warning is pre-existing and unchanged; all imports remain static.)
- PWA (Workbox `generateSW`): 23 precache entries (~745 KiB), files generated
  to `dist/sw.js` + `dist/workbox-*.js`.
- Bundle: single JS chunk ~509 kB (150 kB gzip) + CSS ~21.2 kB (5.3 kB gzip).
- `npm run lint` includes the automated design-token audit
  (`scripts/check-design-tokens.mjs`) — passed (no out-of-scale spacing,
  radius, or raw-palette classes introduced).
- `npm run typecheck` (`tsc -b --noEmit`): clean.

## 17. Performance Notes

- **One fetch per page**: the Loans screen loads all loans + all payments in
  two parallel repository calls; per-loan history is a hash-filter, not N
  indexed queries.
- **`getPayoffForecast` is bounded**: the interest simulation caps at
  `MAX_FORECAST_MONTHS = 1200` and exits immediately on the "never pays off"
  branch — worst case ~1200 trivial iterations per loan card.
- **`getAlerts` is a single pass** over in-memory loans/payments, memoized
  per render via `useMemo`; alert counts are naturally small (one alert per
  condition).
- **`dueDay`/`status`/`loanId`/`paymentDate` are indexed** per §5; the
  repositories additionally filter `status === 'active'` in memory (string
  index is usable, but `getAllIncludingCompleted` needs the full table
  anyway).
- No new hot paths, timers, or polling. Loans load at app startup and on page
  mounts only.

## 18. Technical Debt

1. **`LoanService` bundles schedule math + CRUD + derivation in one file**
   (~390 lines). If it grows, extracting the pure schedule/forecast helpers
   (as `RecurringService` may also need) into a small `loanMath.ts` module is
   the cleanest split.
2. **Derived (non-persisted) loan alerts** — the same "no notification log"
   debt as recurring/budget reminders in Phases 4–5; alert expiry is computed,
   not stored.
3. **`LoanCard` holds its own status pill styles** — small; a shared pill
   helper would DRY it across `RecurringCard`/`LoanCard` if pills spread.
4. **Payment reversal restores principal only** and leaves other rows'
   `remainingBalance` snapshots intact — an explicit "fix a mistake" escape
   hatch, not a chain rewrite (see §20).
5. **Form-level duplication** — `LoanForm`/`PaymentForm` re-implement
   label/input rows like every other feature form; consistent, not new.

## 19. Known Limitations

- **No OS-level notifications or background timers.** Loan alerts are
  computed on app open / screen render (PWA constraint; same as every phase).
- **Loan EMIs don't post to the ledger.** Recording an EMI reduces only the
  loan's balance; the `Transaction.loanId`-linked "EMI as an expense" flow
  (§5's optional link) is not built yet — manual EMI expenses can still be
  logged as ordinary transactions.
- **`endDate` is validated and stored but not enforced** by the schedule
  math (a due date beyond `endDate` still displays) — same gap as Phase 5's
  recurring `endDate`.
- **Overdue detection is a heuristic**, tuned for genuinely skipped cycles;
  an extremely irregular but not-skipped payment history is judged "covered".
- **Interest is simple annual interest split monthly**, not amortized per the
  loan contract — the spec (§6) says "if interest is tracked, split payment
  into principal/interest"; this is a reasonable, deterministic
  interpretation, not full amortization math.
- No visual/manual browser QA in this sandbox (build/lint/typecheck + render
  tests + design-token audit substitute).
- INR-first; no multi-currency amounts.

## 20. Architectural Decisions

1. **Loans are self-contained, not ledger events.** A recorded EMI writes a
   `LoanPayment` row and reduces the loan's own balance; it never creates a
   transaction. This is why Phase 5 report §22's "should loans reuse the
   recurring engine?" question was answered **no**: recurring rules exist to
   generate ledger transactions; loans exist to track an independent
   outstanding balance (§5's `Loan` entity has no `accountId`). The two
   features coexist cleanly.
2. **No principal/interest inputs at payment time.** `RecordPaymentInput` is
   `{ paymentDate, amountPaid, notes? }`; the split is entirely
   service-owned (`splitPayment`), so users can't enter a split that breaks
   the balance.
3. **`originalAmount`/`startDate` fixed at creation.** They define the loan's
   identity; `currentBalance` is the only amount that should move, and it
   moves only through payments.
4. **Alerts derived on demand** with 30-day expiry for informational ones and
   overdue persisting until resolved — the same decision, and reasoning, as
   Phases 4/5.
5. **Delete cascades, reverse doesn't.** Deleting a loan hard-deletes its
   payment history together (nothing else references it, and the UI confirms
   first); reversing one payment restores only its principal to keep history
   append-mostly and auditable.
6. **Month-index based due-date math** rather than `addMonths` on clamped
   dates — Feb 28 can't drift into Mar 28; day-31 loans clamp per month (§10).

## 21. Deferred Improvements

1. **Linked EMI expenses** — a "post this EMI as an expense" flow that
   writes a `Transaction` with `loanId` set (and the reverse: picking an
   expense transaction to mark as a loan payment).
2. **Amortization-style interest** with configurable compounding/frequency if
   simple monthly interest proves insufficient.
3. **`endDate`-enforced schedule** — stop showing due dates past `endDate`
   (closes the Phase 5 gap too).
4. **Editable due-day with retroactive re-scheduling** — currently due dates
   are derived from the current due day; changing it shifts future dates
   only.
5. **Loan calendar events** — Phase 7's Calendar screen is the natural home
   for next-due / overdue loan events.
6. **Loan analytics in Reports/Insights** — reduction curves, total interest
   paid, per-lender rollups (Phase 8/9).

## 22. Recommendations before Phase 7

1. **Decide whether loan due dates feed Phase 7's Calendar** (they should —
   `nextDueDate` is already derived and shareable) and whether overdue loans
   surface as calendar events or stay as dashboard alerts only.
2. **Consider a shared notification-log entity before adding more alert
   types.** Three phases (budgets, recurring, loans) now derive alerts on
   demand; a single persisted seen-state would let any of them become
   dismissable, which §7 implies ("informational ones expire automatically").
3. **Revisit the `endDate` gap** now that two features (recurring rules and
   loans) both store-but-don't-enforce it — a shared "schedule until"
   helper would close both at once.
4. **Watch `LoanService`'s size** as forecast/insight features land in
   Phase 8; extract `loanMath.ts` if it grows.
5. **Manual browser QA** — the bottom-sheet forms, card expansion, and
   reverse-payment flow on the Loans screen deserve a hands-on pass, as
   noted for every previous phase.
