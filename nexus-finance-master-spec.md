# NEXUS FINANCE — MASTER SPECIFICATION (Project Atlas, Consolidated v1.1)

This document merges and supersedes the original 12-volume Project Atlas spec.
All prior inconsistencies between volumes have been resolved directly in the
text below — this is the single source of truth. Where a decision needed to be
made that no volume covered (currency, app lock, PWA manifest, etc.), that
decision is included inline and marked **[NEW]**.

---

## 1. PRODUCT VISION & SCOPE

**Product**: Nexus Finance — a tablet-first, offline-first Personal Finance
Operating System (PFOS). Combines expense tracking, budgeting, loan/EMI
management, recurring payments, analytics, forecasting, and local AI-driven
insights into one application.

**North Star**: "Know exactly where every rupee goes, in under thirty seconds."

**Values**: Simplicity (logging an expense is faster than sending a text) ·
Clarity (never overwhelm; key info always visible) · Ownership (no accounts, no
subscriptions, no cloud dependency, no telemetry) · Intelligence (remember,
predict, suggest, warn, explain) · Reliability (accuracy over feature count).

**Design motto**: "Calm. Fast. Intelligent. Private."

**Core pillars**: Capture money → Understand money → Plan money → Improve money.

**Daily habit target**: 30-second morning dashboard check · 5-second expense
logging throughout the day · end-of-month review/export.

**Golden rules**:
1. Never sacrifice usability for feature count.
2. Never ask users for information the app can infer.
3. Every repetitive task should eventually automate.
4. Every screen reduces cognitive load.
5. Data integrity beats visual polish.
6. Premium quality comes from consistency, not decoration.
7. The app feels equally comfortable at 10 transactions or 100,000.

**Version 1.0 scope includes**: Dashboard, Transactions, Categories, Accounts
**[NEW — see §5]**, Budgets, Loans/EMI tracking, Recurring payments, Calendar,
Timeline, Reports, Analytics, Insights, Search, Filters, Backup/Restore,
Offline support, PWA, GitHub Pages deployment.

**Explicitly excluded from v1.0** (architecture must stay ready for these):
bank sync, UPI import, SMS parsing, email statement import, receipt OCR,
investment portfolio management, multi-user/family accounts, cloud sync,
native Android app, conversational AI chat assistant.

**Primary screens** (9 + Accounts): Dashboard · Transactions · Accounts
**[NEW]** · Calendar · Budgets · Loans · Recurring Payments · Reports · Insights
· Settings. Each screen answers one question (e.g. Dashboard → "How am I
doing?", Budgets → "Am I within limits?", Loans → "What do I still owe?").

**Quality bar for every feature**: useful, fast, discoverable, understandable,
reversible where possible, consistent, accessible, offline-compatible.

---

## 2. DESIGN SYSTEM

**Personality**: intersection of Apple Health, Apple Wallet, Linear, Arc
Browser, Notion, Monzo. Minimal, spacious, elegant, quiet, professional,
touch-first. Never crowded, playful, or corporate.

**Color system** — neutral grayscale surfaces; accent colors only carry
meaning:
- Primary/Income: Emerald 500 `#10B981`
- Expense: Coral 500 `#F97360`
- Warning: Amber 500 `#F59E0B`
- Information: Blue 500 `#3B82F6`
- Liability (loans/EMI): Purple 500 `#8B5CF6`
- Full neutral scale 50–950 for backgrounds/borders/cards/text.

**Themes**: Light (warm off-white bg, soft gray cards, subtle borders, high
contrast text) and Dark (deep charcoal bg, slightly lighter cards, soft white
text) — avoid pure black/white in dark mode.

**Typography**: Inter → Geist → system UI fallback. Scale: Display, H1–H3,
Body Large/Body/Body Small, Caption, Overline. Tabular numerals for dashboard
figures.

**Spacing**: 8-point system — 4/8/12/16/24/32/40/48/64/80/96 only, no
arbitrary values.

**Radius**: Small 8px · Medium 12px · Large 16px · XL 24px · Pills fully
rounded.

**Elevation**: 3 levels only — flat, default cards, dialogs/sheets/floating.

**Grid**: 12-col landscape tablet/desktop, 8-col portrait tablet, generous
margins/gutters.

**Navigation**: permanent nav rail in landscape/desktop; compact + bottom nav
for primary destinations in portrait. Never hide primary destinations in
nested menus. Nav includes all 10 screens from §1, including Accounts.

**Buttons**: Primary/Secondary/Tertiary/Destructive/Icon/FAB — states Default/
Hover/Pressed/Focused/Disabled/Loading. Hierarchy via size/emphasis, not color
overload.

**Cards**: primary surface; each has Title, Primary value, optional secondary
info/trend/action — never cluttered.

**Motion**: Fast 150ms · Standard 200ms · Slow 300ms. Natural easing;
reinforces interaction, doesn't decorate.

**Empty states**: icon/illustration + short explanation + one primary action
(e.g. "No expenses recorded today." → "Add Expense").

**Accessibility**: 48×48px minimum touch target, sufficient contrast, never
color-only status indicators, keyboard nav on desktop.

**Design rules**: one primary action per screen · one responsibility per
component · every animation has a purpose · every color conveys meaning ·
every interaction gives feedback · tablet-first layout · understandable within
5 seconds.

---

## 3. COMPONENT LIBRARY

No new UI pattern may be created without being added here first. Every
component: reusable, accessible, touch-friendly, theme-aware, responsive,
consistent, single-responsibility.

**Foundation**: AppShell · NavigationRail · BottomNavigation · TopAppBar ·
FloatingActionButton · BottomSheet · ModalDialog · Toast · Snackbar · Divider ·
Chip · Badge · Avatar (future) · Tooltip.

**Form**: CurrencyInput · SmartEntryInput · TextInput · TextArea · DatePicker ·
MonthPicker · Toggle · Switch · Checkbox · RadioButton · Dropdown · SearchBar ·
FilterBar · CategorySelector · TagSelector.

**Financial**: DashboardCard · MetricCard · TransactionCard · AccountCard
**[NEW]** · BudgetCard · LoanCard · RecurringCard · InsightCard · AlertCard ·
ForecastCard · FinancialHealthCard.

**Visualization**: LineChart · AreaChart · BarChart · DonutChart ·
ProgressRing · ProgressBar · HeatMap · CalendarView · SpendingTimeline ·
TrendIndicator.

**Utility**: EmptyState · ErrorState · LoadingSkeleton · ConfirmationDialog ·
BackupStatus · SyncStatus (future) · ImportWizard · ExportWizard ·
OnboardingCarousel **[NEW]** · AppLockScreen **[NEW]**.

**Key component behaviors**:
- **AppShell**: permanent layout (nav + content + FAB + global search +
  notifications). Gated by AppLockScreen on launch if app-lock is enabled
  **[NEW]**.
- **FAB**: primary entry to add a transaction → opens Bottom Sheet with
  SmartEntryInput focused.
- **SmartEntryInput**: the most important component. Parses free text like
  "250 tea", "900 petrol", "8000 EMI" → amount, inferred type, suggested
  category (with live parsing feedback and manual correction before save).
- **TransactionCard**: shows amount, description, category, date, status,
  recurring/note indicators. Swipe left = delete (undoable), swipe right =
  edit, long press = duplicate.
- **AccountCard [NEW]**: shows account name, type icon, current balance,
  optional recent-activity sparkline.
- **BudgetCard**: name, allocated, spent, remaining, progress bar, forecast,
  status (Healthy/Near Limit/Exceeded).
- **LoanCard**: name, outstanding balance, progress, monthly EMI, remaining
  EMIs, next due date, estimated completion.
- **InsightCard**: headline + explanation + recommended action + priority —
  never raw stats without interpretation.
- **Confirmation dialogs required before**: delete loan, delete category,
  restore backup, reset application.
- **Component states** (every interactive component): Default, Hover, Pressed,
  Focused, Disabled, Loading, Success, Warning, Error, Selected.

**Acceptance checklist per component**: light + dark mode, responsive, tablet
optimized, accessible, animated consistently, no console errors, reusable,
documented, integrated into design system.

---

## 4. TECHNICAL ARCHITECTURE

**Principles**: frontend-only, offline-first, local-first, component-driven,
service-oriented, modular, testable. No business logic inside UI components.

**Stack**:
- Core: React, TypeScript, Vite
- Styling: Tailwind CSS, CSS variables, design tokens
- UI: shadcn/ui, Lucide icons
- Charts: Recharts
- Animation: Framer Motion
- Storage: IndexedDB via Dexie.js
- PWA: vite-plugin-pwa
- Utilities: date-fns, zod, clsx
- Testing: Vitest, React Testing Library
- Linting: ESLint, Prettier
- i18n **[NEW]**: lightweight Vite-compatible i18n library, wired up even
  though only English ships in v1.0 (Settings already has a `language` field)

**Layering** (strict, one responsibility per layer):
`UI Components → Feature Modules → Business Services → Repository Layer → IndexedDB`

**Folder structure**:
```
src/
├── app/            ├── assets/           ├── components/
│                                          │   ├── common/ dashboard/ forms/
│                                          │   ├── charts/ finance/ layout/
├── features/
│   ├── dashboard/ transactions/ accounts/ budgets/ loans/
│   ├── recurring/ reports/ insights/ settings/
├── services/  ├── repositories/  ├── database/  ├── hooks/
├── utils/     ├── constants/     ├── types/     ├── theme/
├── workers/   ├── routes/        └── tests/
```
(`accounts/` added to `features/` — see §5 correction.)

**State management**: Zustand, one store per feature, no duplicated state,
derived values computed not stored.

**Data flow**: User Action → Validation → Business Service → Repository →
IndexedDB → State Update → UI Refresh.

**Repositories** (one per collection): TransactionRepository,
AccountRepository **[NEW]**, BudgetRepository, LoanRepository,
CategoryRepository, SettingsRepository, etc.

**Services** (all business rules live here, never in UI): TransactionService,
AccountService **[NEW]**, BudgetService, LoanService, ForecastService,
InsightService, RecurringService, BackupService.

**Validation**: Zod schemas. Amounts positive, dates valid, categories/accounts
must exist, loan balances never negative.

**Error handling**: every operation returns Success / Validation Error /
Storage Error / Unknown Error. Friendly messages only, never expose internals.

**Background processing** (non-blocking): recurring transaction generation,
financial health calc, monthly summaries, forecast updates, backup creation.

**Performance rules**: avoid unnecessary renders, lazy-load non-critical
screens, virtualize long transaction lists, debounce search, memoize/cache
expensive calculations.

**Scalability targets**: 100,000+ transactions, 100+ budgets, 100+ recurring
rules, 50+ loans, multiple years of history — no noticeable degradation on
modern tablets.

**PWA requirements [NEW — not in original spec]**: manifest with
`name: "Nexus Finance"`, `short_name: "Nexus"`, icons at 192px and 512px plus
one maskable icon, `theme_color`/`background_color` from design tokens above,
and a correctly configured Vite `base` + manifest `start_url` matching this
project's actual GitHub Pages repo path (confirm the exact repo name before
hardcoding — a wrong base path is the most common cause of GitHub Pages PWAs
failing to install or 404ing on refresh).

**CI/CD [NEW]**: GitHub Actions workflow running lint, type-check, unit tests,
and build on every push; deploy-to-Pages job on merge to main.

**Versioning [NEW]**: maintain `CHANGELOG.md` with semver tags, updated at the
end of every development phase.

**Naming conventions**: Components PascalCase · Services PascalCase+"Service"
· Repositories PascalCase+"Repository" · Hooks camelCase+"use" · Constants
UPPER_SNAKE_CASE.

**Security**: never execute imported data directly; validate all imported
backups; never store credentials.

**App lock [NEW]**: optional PIN or biometric gate. Setting stored in
Settings, enforced by AppShell at launch. Off by default; offered during
onboarding (§9).

**Offline rule**: every core feature (add/edit/delete transaction, reports,
loans, budgets, calendar, insights, backup) must work with zero network
access — no exceptions in v1.0.

---

## 5. DATA ARCHITECTURE (corrected)

**Storage**: IndexedDB via Dexie.js, versioned schema, automatic migrations,
manual recovery supported. Never optimize for cloud sync at the expense of
local performance.

**Object stores**: `transactions` · `accounts` **[CORRECTED — promoted from
"future field" to a full store; see rationale below]** · `categories` ·
`recurring_rules` · `budgets` · `loans` · `loan_payments` · `favorites` ·
`tags` · `settings` · `goals` · `notifications` · `insights_cache` ·
`backups` · `audit_log`.

> **Correction rationale**: Full account management (multiple accounts,
> transfers, balances) is a required v1.0 feature per the Business Rules
> (§6) and Functional Requirements (§10), and has its own development phase
> (§9, Phase 3). It cannot remain a "future" schema field — it needs a real
> object store and entity from day one.

**Account Entity [NEW/CORRECTED]**:
`id · name · type (cash/bank/creditCard/upiWallet/emergencyFund/other) · icon
· color · openingBalance · currentBalance · isDefault · isArchived · createdAt
· updatedAt`. Indexes: `type`, `isArchived`.

**Transaction Entity** (corrected):
`id · createdAt · updatedAt · transactionDate · type · amount · currency ·
description · categoryId · accountId (required, not future) ·
recurringRuleId (optional) · loanId (optional) · budgetId (optional) · tags[]
· notes · status · source (manual/auto/import) · isFavorite · isDeleted
(soft delete) · version · linkedTransactionId (optional) **[CORRECTED — added
so the two internal entries of a Transfer can be linked and displayed to the
user as one transaction; see §6]**`.
> `subcategoryId` removed **[CORRECTED]** — redundant with `Category.parentCategory`
> hierarchy (see Category Entity below); do not model the hierarchy two ways.

Indexes: `transactionDate, categoryId, accountId, amount, type, status,
recurringRuleId, loanId`.

**Category Entity**: `id · name · icon · color · parentCategory ·
displayOrder · isDefault · isArchived · createdAt · updatedAt`. Indexes:
`name, parentCategory`. (Hierarchy lives here via `parentCategory`; a
transaction's `categoryId` always points to the most specific category.)

**Budget Entity**: `id · categoryId · monthlyLimit · rolloverEnabled ·
warningThreshold · createdAt · updatedAt · active`. Index: `categoryId`.

**Loan Entity**: `id · loanName · lender · originalAmount · currentBalance ·
monthlyEMI · interestRate · startDate · endDate · dueDay · status · notes`.
Indexes: `dueDay, status`.

**Loan Payment Entity**: `id · loanId · paymentDate · amountPaid ·
principalPaid · interestPaid · remainingBalance · notes`. Indexes: `loanId,
paymentDate`.

**Recurring Rule Entity**: `id · title · amount · categoryId · accountId
[NEW] · frequency · startDate · endDate · nextExecution · autoGenerate ·
reminderDays · active`. Indexes: `nextExecution, active`.

**Favorite Entity**: `id · title · amount · categoryId · usageCount ·
lastUsed`. Sort by usageCount then lastUsed.

**Savings Goal Entity**: `id · goalName · targetAmount · currentAmount ·
targetDate · priority · status`.

**Notification Entity**: `id · type · title · message · priority · createdAt
· expiresAt · read`.

**Settings Entity** (corrected — single active record):
`theme · currency (default "INR") · currencyDisplay (default lakh/crore
grouping) [NEW] · dateFormat (default "DD/MM/YYYY") [NEW] · language ·
defaultView · budgetMonthStart (default 1) · backupFrequency ·
firstDayOfWeek · animationEnabled · hapticFeedback (future) · compactMode ·
appLockEnabled [NEW] · developerMode (default false) [CORRECTED — referenced
in §7 for showing category-confidence scores, but never had a home in the
schema until now]`.

**Relationships** (corrected):
- Transactions → Category: many-to-one
- Transactions → Account: many-to-one (required) **[CORRECTED]**
- Transactions → Loan: many-to-one (optional)
- Transactions → Tags: many-to-many **[CORRECTED — was missing entirely
  despite the `tags[]` field and `tags` store both existing]**
- Category → Budget: **one-to-many** **[CORRECTED from "one-to-one" — a
  category has one budget row per month, i.e. many over time]**
- Recurring Rule → Transactions: one-to-many
- Category → Favorites: one-to-many
- Account → Transactions: one-to-many **[NEW]**

**Soft delete**: financial records marked `isDeleted = true`, hidden from
normal views, purged only through maintenance tools.

**Versioning**: every record has a `version` field; increment on structural
change.

**Migrations**: preserve data, validate integrity, back up before migrating,
roll back safely on failure. Never destructive without confirmation.

**Import**: accept JSON/CSV. Steps — schema validation → duplicate detection
→ category mapping → account mapping **[NEW]** → loan mapping → preview →
user confirmation → import.

**Export**: JSON = complete state; CSV = transactions only (default).
**Backup encryption [NEW]**: JSON export supports an optional passphrase to
encrypt the file (opt-in; default export stays unencrypted for simplicity),
consistent with the product's privacy-first stance.

**Data integrity rules**: amounts never null, no negative expenses, loan
balances never negative, valid dates, categories/accounts must exist,
recurring rules can't reference deleted categories, budgets can't reference
archived categories.

**Backup format includes** (corrected): metadata, DB version, timestamp, user
settings, transactions, categories, **accounts [CORRECTED — added]**,
budgets, loans, loan payments, recurring rules, favorites, goals, **tags
[CORRECTED — added]**.

**Future schema reservations** (don't design against these): multi-account
sync, bank sync, investments, shared budgets, multi-currency, tax reports,
attachments, receipt OCR, AI memory.

---

## 6. BUSINESS RULES ENGINE (corrected)

The UI is a visual layer only — every calculation, recommendation, forecast,
alert, and automation lives in Business Services. If the app recommends
something, it must be able to explain why.

**Accounts** (corrected — core v1.0, not future): every transaction belongs to
exactly one account. Default accounts: Cash, Bank Account, Credit Card, UPI
Wallet, Emergency Fund. Future: Investment, Business, Joint, Foreign Currency.

**Transaction types**: Expense, Income, Transfer, Adjustment, Refund,
Reversal — each with distinct accounting behavior.

- **Expense**: reduces account balance, affects budgets/analytics/forecasts/
  trends. Never increases income or affects transfers.
- **Income**: increases balance, updates cash flow and savings calc. Does not
  consume budget.
- **Transfer** (corrected): moves money between accounts; never affects
  spending/income/savings rate. Internally creates two linked entries (debit +
  credit) joined via `linkedTransactionId` **[CORRECTED — field added in §5
  so this is actually implementable]**; the user sees one transfer.

**Smart categorization priority**: exact description match → favorite
transaction match → learned historical match → keyword dictionary → AI
suggestion → manual selection. System learns from corrections (confidence up
for corrected category, down for rejected one; after repeated confirmation,
auto-apply).

**Duplicate detection**: same amount + description + date (within
configurable window) + account → "Possible duplicate transaction" warning,
user may keep both.

**Recurring transactions**: Daily/Weekly/Monthly/Quarterly/Half-Yearly/Yearly/
Custom. Generated entries start Pending; user marks Paid/Skipped/Postponed/
Missed. Missed-expense detection learns typical timing (e.g. internet bill
usually 2nd–5th; if absent by the 8th, prompt a reminder) with confidence
increasing as the pattern solidifies.

**Budgets**: per month, per category, optional global monthly budget.
Calculation: allocated − spent = remaining. Forecast: current pace × remaining
days. Alert thresholds: 50/75/90/100/110%, notify once per threshold (no
repeat spam).

**Forecasts**: month-end spending, expected balance, upcoming obligations,
expected savings — combining historical averages, recurring rules, pending
payments, current-month trend. State explicitly when confidence is low.

**Loans**: original amount, outstanding, monthly EMI, interest rate (optional),
due date. Every recorded EMI reduces outstanding balance, creates payment
history, updates payoff progress; if interest is tracked, split payment into
principal/interest. Alerts: EMI due tomorrow, EMI overdue, loan completed,
extra payment made.

**Savings**: Savings = Income − Expenses; Savings Rate = Savings ÷ Income
(shown monthly and yearly).

**Financial Health Score** (0–100, canonical factors — corrected to resolve
the §7 wording mismatch): Savings rate 25% · Budget adherence 20% · Debt ratio
20% · Consistency 15% · Forecast 10% · Missed obligations 10%. Weights
configurable. Always show top strength, top concern, and recommended next
action alongside the number — never the number alone.

**Anomaly detection**: largest purchase, unusual category growth, unexpected
merchant, sudden spike, large cash withdrawal, repeated impulse purchases —
always with an explanation.

**Impulse-purchase rule**: several discretionary purchases within a short
window (e.g. coffee + snacks + shopping + entertainment within 2 hours) →
neutral, non-judgmental notice.

**Recommendation engine**: every recommendation must be relevant, actionable,
evidence-based, and estimate financial impact where possible. Priority order:
Critical (missed EMI, negative balance forecast, loan overdue) → High (budget
near exhausted, upcoming insurance, rapid spending rise) → Medium (dining
trend, subscription review) → Low (monthly summary, savings milestone).

**Search**: natural language, dates, amounts, categories, loan names, tags,
statuses — case-insensitive, partial match.

**Archives**: month-based (never per-transaction); browsable by
month/quarter/year, remains searchable.

**Backups**: prompt before schema migration, bulk import, or database reset;
never overwrite without confirmation.

**Undo**: available for add/delete/edit/restore, ~10 second window.

**Data integrity**: never allow negative loan balance, invalid dates, missing
categories/accounts, broken references, duplicate IDs, corrupted imports —
reject before writing to DB.

---

## 7. INTELLIGENCE ENGINE

Advisory only — the user always makes the final decision. Runs entirely on
local data; no internet, no cloud processing, no external AI services in
v1.0.

**Modules**: Categorization · Pattern Recognition · Forecast · Recommendation
· Budget Intelligence · Loan Intelligence · Spending Behaviour · Notification
Prioritization · Financial Health (see §6 for canonical scoring) · Trend
Analysis.

**Categorization confidence**: >90% auto-assign · 70–89% assign + confirm ·
<70% ask the user. Confidence scores are hidden by default; only visible when
`developerMode` is enabled in Settings **[CORRECTED — now has a schema home,
see §5]**.

**Behaviour learning**: typical spending days, monthly habits, preferred
categories, common descriptions, favourite amounts, frequent accounts,
time-of-day patterns. Never rewrites historical records.

**Monthly behaviour profile**: highest spending category, average daily
spend, most active day, largest transaction, most-used category, recurring
payment count, budget performance, savings achieved, loan reduction, month-
over-month comparison.

**Explainability format** (every insight must follow this): Observation →
Reason → Recommendation → Expected Impact. Example: fuel spending up 28% over
3-month average → review recent travel/maintenance → cutting fuel 10% could
save ~₹500/month.

**Duplicate/missed-expense detection**: see §6 — same logic, surfaced as
insights here.

**Notification limits**: max 5 recommendations shown on Dashboard at once,
ordered Critical → High → Medium → Low; informational ones expire
automatically.

**User feedback loop**: Helpful / Not Helpful / Dismiss on every
recommendation, used to reprioritize future insights.

**Data retention**: learning data stays local; "Reset Learning" available in
Settings without deleting financial records.

**Reserved for v2.x**: conversational assistant, NL queries, receipt OCR, bank
statement analysis, voice entry, predictive budgeting, investment insights,
tax prep.

---

## 8. PRODUCT IDENTITY & ROADMAP

**Tagline**: "Know every rupee. Plan every tomorrow."

**Positioning**: between simple expense trackers and enterprise accounting
software — deeper insight than a tracker, without accounting-software
complexity.

**Note on "workspaces" [CORRECTED]**: earlier product-identity language
described "Daily/Planning/Debt/Analysis/Archive Workspace" groupings — this
was marketing framing only, not a real information architecture. The actual
navigation is the 10 screens in §1 (9 original + Accounts).

**Roadmap**:
- **v1.0**: everything in §1's scope list.
- **v1.1**: goals, advanced filters, widget customization, improved
  forecasting, performance work.
- **v1.2**: financial events, net worth tracking, yearly review, enhanced
  recommendations.
- **v2.0**: optional cloud sync, bank/UPI/SMS import, receipt OCR, native
  Android.
- **v3.0**: investments, retirement planning, tax prep, AI assistant, voice
  entry, household/business modes.

**Success metrics**: daily logging becomes habitual, dashboard answers status
in ≤30s, unnecessary spending identifiable without manual math, loan progress
always visible, budget overruns caught before month-end, stays responsive
with years of data.

**Every new feature must improve** at least one of: speed, simplicity,
clarity, insight, automation, reliability — or it doesn't ship.

---

## 9. DEVELOPMENT PLAN

**Philosophy**: incremental; every completed phase leaves a fully working,
deployable app. Never break core functionality while waiting on future
phases.

**Before any phase**: read this entire document, analyze the existing
codebase (never assume — inspect), understand current architecture/debt,
verify DB and design consistency.

**Universal rules per phase**: preserve existing data, avoid unnecessary
refactors, reuse existing components, keep business logic out of UI, maintain
offline function and tablet-first layout, keep performance ≥ previous phase.

### Phase 0 — Foundation
Init project; configure Vite/React/TS/Tailwind/shadcn/Dexie/Zustand/PWA/
ESLint/Prettier/Vitest/routing/theme provider; build AppShell, Navigation,
design tokens, reusable layout components.
**Also in scope [NEW]**: PWA manifest (§4), seed data (below), onboarding flow
(below), app-lock scaffold (§4/§5), CI workflow (§4), CHANGELOG.md (§4).
Acceptance: offline-capable, light/dark theme working, navigation complete
(including Accounts destination), no console errors, GitHub Pages compatible.

**Seed data on first run [NEW]**: default categories with icons/colors (Food,
Fuel, Shopping, Utilities, Food Delivery, Health, Entertainment, EMI/Loans,
Salary, Transfers, Other); the five default accounts (§6); budget month start
defaulting to the 1st.

**Onboarding flow [NEW]**: max 3 screens before the empty Dashboard —
currency/theme pick, optional app-lock setup, optional "load sample data."
Keep it fast, consistent with the product's speed ethos.

### Phase 1 — Core Transaction Engine
Smart Entry, add/edit/delete/undo/duplicate, search, filters, categories,
favorites, smart categorization, transaction history. Target: <5s average
entry time.

### Phase 2 — Dashboard
Metric cards, recent activity, account balances, budget summary, loan
summary, alerts, timeline, Quick Add. Target: understandable in <5s.

### Phase 3 — Accounts
Full account management per §5/§6 (already promoted to core, not future):
default accounts, transfers (linked-entry model), balance calculations,
account history.

### Phase 4 — Budgets
Monthly + category budgets, forecasts, alerts, analytics, overspend
detection.

### Phase 5 — Recurring Engine
Rules, auto-generation, reminders, missed-payment detection, pause/resume/
skip, history.

### Phase 6 — Loan Manager
Loans, EMIs, outstanding balances, timeline, payment history, progress,
payoff forecast.

### Phase 7 — Calendar & Timeline
Financial calendar, timeline, daily/weekly/monthly views, financial events,
search, filters.

### Phase 8 — Analytics
Charts, category/budget/cash-flow/savings/loan analysis, heatmap, YoY
comparison, forecast dashboard.

### Phase 9 — Intelligence
Learning engine, recommendations, Financial Health Score, pattern
recognition, duplicate/missed-expense detection, savings suggestions,
behaviour analysis.

### Phase 10 — Reports
Monthly/quarterly/yearly reports, archive, CSV/JSON export, backup/restore
(with optional passphrase encryption per §5), print layout.

### Phase 11 — Production Hardening
Performance profiling, accessibility review, offline validation, regression
testing, bug fixing, UI consistency audit, animation review, code cleanup,
docs review, GitHub Pages deployment validation.

**Regression checklist (run every phase)**: Dashboard, Transactions,
Categories, Accounts, Budgets, Loans, Recurring, Calendar, Timeline,
Analytics, Reports, Backup, Restore, Search, Filters, Theme, Offline mode,
PWA installation.

**Performance targets**: cold start <2s, dashboard render <500ms, near-instant
save, search <100ms on common datasets, 60fps scrolling.

**Definition of done (every phase)**: all planned functionality works,
nothing existing breaks, no console errors, offline mode works, tablet
layouts verified, migrations validated, backup/restore succeed, docs updated,
visual consistency maintained, performance within target.

---

## 10. FUNCTIONAL REQUIREMENTS SUMMARY

Priority levels: **P0** critical (transactions, storage, dashboard, backup,
search) · **P1** required for v1.0 (budgets, loans, reports, insights,
recurring, **accounts [CORRECTED — was implicitly P3/future, is actually
P1]**) · **P2** improves experience (financial events, widget customization,
advanced reports) · **P3** future (bank sync, OCR, AI chat, investments).

Key acceptance criteria per module:
- **Smart Entry**: <5s average completion; low-confidence → show category
  suggestions; amount required and >0.
- **Transactions**: create/edit/delete/undo/duplicate/archive/search/filter/
  sort with zero data loss.
- **Accounts [CORRECTED to P1]**: transfers never affect income/expense
  totals.
- **Budgets**: calculations stay accurate after edits/deletions.
- **Loans**: every EMI updates remaining balance correctly.
- **Recurring**: entries generate automatically per schedule.
- **Dashboard**: loads <500ms via cached summaries.
- **Analytics**: charts reflect data immediately after transaction changes.
- **Search**: fast on common datasets, case-insensitive, partial match.
- **Backup**: imported data matches exported data after validation.
- **Intelligence**: every recommendation references supporting data.
- **Notifications**: critical ones stay visible until resolved.
- **Settings**: persist after restart.

**Edge cases to handle**: zero transactions, very large datasets, leap years,
month-end transitions, negative balances, deleted categories/accounts/
recurring rules, loan completion, restoring backups to a newer schema
version, duplicate imports.

**Accessibility**: touch targets ≥48×48px, keyboard nav on desktop, sufficient
contrast, semantic HTML, screen-reader-friendly labels.

---

## 11. AI DEVELOPMENT PLAYBOOK

**Your role while building this**: senior product engineer + UX engineer +
architect + QA engineer + performance engineer + code reviewer +
documentation engineer, simultaneously.

**Workflow per task**: read this spec → analyze existing project (never
assume, always inspect) → determine what exists/must change/can be reused →
plan → implement → validate → regression test → optimize → update docs →
stop. Do not continue into unrelated work.

**Never**: remove working functionality · redesign completed UI without
instruction · duplicate logic or components · ignore existing architecture ·
hardcode values that belong in config · leave TODOs · introduce breaking
changes without migration · silently discard user data · compromise offline
capability.

**Code standards**: small focused functions, single-responsibility
components, services hold only business logic, repositories only data
access, utilities stateless, readability over cleverness.

**Database rules**: never modify schema without migration, always validate
imports, preserve history, use soft deletes where defined, keep indexes
optimized.

**Documentation**: after every phase update architecture, database,
components, business rules, CHANGELOG, known issues, future improvements.
Documentation is part of the feature, not an afterthought.

**Git**: one logical objective per commit; conventional prefixes
(feat/fix/refactor/docs/test/perf/style/chore).

**Self-review before marking anything done** — answer honestly: Did I reuse
existing components? Preserve backward compatibility? Follow this spec?
Avoid unnecessary complexity? Would another developer understand this code?
Does it scale? Would I ship this to a paying customer? Any "no" → keep
improving.

**Final principle**: quality is measured by how well features integrate, not
by how many ship. When choices compete, prefer the one that's easiest to
maintain, easiest to understand, and most consistent with this document.
