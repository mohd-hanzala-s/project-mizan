# CONTINUE_DEVELOPMENT.md

Instruction for the next AI coding agent (or developer) continuing
**Mizan by Mikarsh**. This file is the handoff between the agent that built
Phases 0–8 and whoever works on the remaining phases. Read it fully, then
read the references it points to, before writing any code.

---

## 1. Purpose

This project is a client-only, offline-first PWA (React 19 + TypeScript +
Vite + Tailwind + Dexie/IndexedDB + Zustand) that tracks personal finance:
accounts, transactions, budgets, recurring rules, loans, a calendar, and
month-end forecasts. All data lives in the browser's IndexedDB.

Everything through **Phase 8 (Forecasts)** is complete and verified. Your job
is to implement the **remaining phases** following the same conventions. Do
not redesign or re-architect what exists; extend it. Do not remove working
functionality.

## 2. Authoritative references (read in this order)

| File                                         | Role                                                                                                                                                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/atlas-master-spec.md`                  | **The single source of truth.** Spec, data model (§5), business rules (§6), design system (§2/§3), layering (§4), roadmap (§9), playbook (§11). A root-level duplicate spec was removed — only this file exists. |
| `PROJECT_STATE.md`                           | Living state: current phase, schema version, service/repository/component inventories, routes, test count, technical debt, known limitations.                                                                    |
| `CHANGELOG.md`                               | Phase-by-phase history. Each phase adds a section here.                                                                                                                                                          |
| `docs/PHASE8_REPORT.md`                      | The most recent phase report — the format to follow for every future phase. Also contains the most current recommendations.                                                                                      |
| `docs/PHASE7_REPORT.md`                      | Calendar phase report; §22 has recommendations the next phases should consume.                                                                                                                                   |
| `src/theme/tokens.css`, `tailwind.config.js` | The design tokens. Never bypass them (see §4.3).                                                                                                                                                                 |
| `scripts/check-design-tokens.mjs`            | The automated design-token audit wired into `npm run lint`.                                                                                                                                                      |

## 3. Current state snapshot (as of this handoff)

- **Product**: Mizan by Mikarsh (renamed from "Nexus Finance"; the repo moved
  from `project-atlas` to `project-mizan`). Any "nexus"/"atlas" strings you
  find are historical references in old phase reports — leave them, or clean
  them only if you are also updating that report.
- **Phase complete**: 0 Foundation · 1 Core Transaction Engine · 2 Dashboard ·
  3 Accounts · 4 Budgets · 5 Recurring · 6 Loans · 7 Calendar & Timeline ·
  8 Forecasts.
- **DB schema**: **v6**, Dexie db name `mizan`. Stores: `accounts`,
  `categories`, `settings`, `transactions`, `favorites`, `tags`, `budgets`,
  `recurring_rules`, `loans`, `loan_payments`.
- **Tests**: **186 tests across 22 files**, all passing.
- **Routes live**: `/` dashboard, `/transactions`, `/accounts` (+`/:id`),
  `/budgets`, `/loans`, `/recurring`, `/calendar`, `/settings`.
  `/reports` and `/insights` are **placeholders** naming their future phase.
- **Build/deploy**: GitHub Actions on `main` builds with base path
  `/project-mizan/` and deploys to GitHub Pages. See §7.

## 4. Non-negotiable conventions

### 4.1 Architecture (four layers — §4 of the spec)

```
UI (features + components + Zustand stores)   → presentation only
services (src/services)                        → ALL business logic
repositories (src/repositories)                → data access only
database (src/database/db.ts)                  → Dexie schema + migrations
```

- Business calculations, alerts, and derivations live in **services** as
  pure, deterministic functions (see `DashboardService`,
  `RecurringService`, `LoanService`, `BudgetService`, `CalendarService`,
  `ForecastService`). Services take data as arguments and return results;
  only CRUD services touch repositories.
- **Components are presentational** — no business logic, no direct `db.*`
  calls. Screens read from Zustand stores (see `src/features/*/*Store.ts`).
- **Derived data is computed on demand, never persisted** unless the phase
  explicitly adds a store. Alerts, the calendar timeline, and the forecast
  all follow this precedent — a new transaction immediately updates them.
- Reuse over re-implementation. The scheduling primitives are
  `computeNextExecution`/`addOccurrence` (RecurringService) and
  `nextDueDate`/`firstDueDate` (LoanService); period math is
  `getCurrentPeriod`/`getPreviousPeriod` (DashboardService). Do not rewrite
  these.

### 4.2 Rules from the spec's playbook (§11)

- Workflow per task: read the spec → analyze existing code (never assume,
  always inspect) → plan → implement → validate → regression test →
  optimize → update docs → **stop**. Do not continue into unrelated work.
- Never: remove working functionality · redesign completed UI without
  instruction · duplicate logic or components · ignore the existing
  architecture · hardcode values that belong in config · leave TODOs ·
  introduce breaking changes without a migration · silently discard user
  data · compromise offline capability.
- Database rules: never modify the schema without a migration; preserve
  history; use soft deletes where defined; keep indexes optimized.
- Self-review before marking anything done (§11): reuse? backwards compat?
  spec-faithful? simple? understandable? scalable? would you ship it?
- Git: one logical objective per commit; conventional prefixes
  (feat/fix/refactor/docs/test/perf/style/chore).

### 4.3 Design tokens (enforced automatically)

- Spacing scale is exactly `0, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96`
  (plus `px`). Classes like `mt-2`, `p-6`, `gap-20` are **invalid**.
- Radius scale is exactly `none, sm, md, lg, xl, full`.
- **No raw Tailwind palette colors** (no `bg-red-500`, `text-gray-200`, …).
  Use only the semantic tokens: `surface`/`surface-card`/`surface-raised`,
  `border`/`border-subtle`, `text-primary`/`text-secondary`/`text-tertiary`,
  `income`(+`-subtle`), `expense`(+`-subtle`), `warning`(+`-subtle`),
  `info`(+`-subtle`), `liability`(+`-subtle`).
- `scripts/check-design-tokens.mjs` audits every source class and runs as
  part of `npm run lint` — treat a failure as a build-breaking bug.

### 4.4 Testing conventions

- Vitest + Testing Library + `fake-indexeddb/auto`.
- Pure service logic is tested with **injected fixed `reference` dates** for
  determinism (see `src/tests/forecast-service.test.ts`,
  `src/tests/calendar-service.test.ts`).
- Page/component tests clean the DB in `beforeEach`
  (`await db.delete(); await db.open();`), seed onboarding
  (`db.settings.update("active", { onboardingCompleted: true })`), and
  render `<App />`. **Render `<App />` at most once per test** — a second
  mount leaves async store-loads racing the next test's `db.delete()` and
  produces unhandled `DatabaseClosedError` rejections.
- Use local factory helpers (`makeTransaction`, `makeAccount`, …) matching
  the ones already in each test file; do not invent a new factory module.

### 4.5 Quality gates (run ALL before finishing any phase)

```bash
npm ci

# ESLint + automated design-token audit
npm run lint

# Prettier (fix with: npx prettier --write <files>)
npm run format:check

# TypeScript
npm run typecheck

# Full test suite
npm run test

# Production build + PWA
npm run build
```

All must pass. `node_modules` is not committed; run `npm ci` first. Do not
modify `dist/`; it is a build artifact and is gitignored.

## 5. Remaining roadmap

The spec's §9 roadmap is the canonical order. The project already pulled the
"forecast dashboard" piece out of the spec's Phase 8 "Analytics" and shipped
it as **Phase 8 — Forecasts** (documented deviation in `PROJECT_STATE.md`,
`CHANGELOG.md`, and `docs/PHASE8_REPORT.md`). Proceed with the remaining
Analytics scope, then the spec's Phases 9–11. For each step, update
`PROJECT_STATE.md` (phase table, inventories, test count, next phase),
`CHANGELOG.md`, and write `docs/PHASE<step>_REPORT.md` following
`docs/PHASE8_REPORT.md`'s structure.

### Step A — Analytics (completes the spec's §9 "Phase 8 — Analytics")

Spec scope: "Charts, category/budget/cash-flow/savings/loan analysis, heatmap,
YoY comparison, forecast dashboard."

- Build a real **Analytics/Insights destination** (either the existing
  `/insights` route or a new `/analytics` route; decide and wire navigation).
- Deliverables: category-spending breakdown, budget adherence summary,
  cash-flow trend (income vs expense over time), savings-rate line, loan
  payoff trend, a monthly spending heatmap, and YoY comparison where data
  allows.
- Reuse: `getSpendingTimeline`, `computeMetrics`, `getCurrentPeriod`/
  `getPreviousPeriod`, `getForecast`, `CalendarService.getDaySummary`,
  `BudgetService.computeBudgetStatus`, `LoanService.getPayoffForecast`.
- Charts: implement lightweight SVG/CSS charts in
  `src/components/charts/` (follow the existing `TrendIndicator` and
  `SpendingTimeline` precedent — no charting library unless justified). The
  spec's §3 lists `LineChart · AreaChart · BarChart · DonutChart ·
ProgressRing · ProgressBar · HeatMap`.
- "Analytics: charts reflect data immediately after transaction changes" is
  an acceptance criterion — derive from the stores, memoize, no refetch.
- Guidance: `docs/PHASE7_REPORT.md` §22 recommends a `getRangeSummary`
  / `getRangeEvents` helper in `CalendarService` — add it and use it for the
  cash-flow trend.

### Step B — Intelligence & Insights (spec §9 "Phase 9 — Intelligence")

Spec scope: "Learning engine, recommendations, Financial Health Score, pattern
recognition, duplicate/missed-expense detection, savings suggestions,
behaviour analysis."

- **Financial Health Score (0–100)** — the spec §6 defines canonical factors:
  Savings rate 25% · Budget adherence 20% · Debt ratio 20% · Consistency 15%
  · Forecast 10% · Missed obligations 10% (weights configurable). **Always
  show top strength, top concern, and recommended next action alongside the
  number — never the number alone.** `ForecastService.getForecast` feeds the
  forecast factor; `getForecastAlerts` feeds "negative balance forecast".
- **Recommendations** must be relevant, actionable, evidence-based, and
  reference their supporting data. Priority order (spec §6): Critical
  (missed EMI, negative balance forecast, loan overdue) → High (budget
  overrun, savings-rate below target) → Medium.
- **Pattern recognition**: largest purchase, unusual category growth,
  unexpected merchant, sudden spike, large cash withdrawal, repeated impulse
  purchases — always with an explanation. Impulse-purchase rule: several
  discretionary purchases in a short window → neutral, non-judgmental notice.
- **Missed-expense detection** (already partly surfaced by
  `RecurringService.getRecurringAlerts`): learn typical timing, prompt if a
  usual bill is absent past its window.
- **Local-only**: §7 requires the engine to run entirely on local data — no
  internet, no cloud, no external AI services in v1.0. Do not wire any
  third-party API key into the project; if an LLM/API is ever added, use
  user-supplied keys via environment placeholders, never environment
  credentials.
- Implement the real screen on the existing `/insights` route (replace the
  `PlaceholderPage`). Add the spec §3 `InsightCard` and `FinancialHealthCard`
  components.

### Step C — Reports (spec §9 "Phase 10 — Reports")

Spec scope: "Monthly/quarterly/yearly reports, archive, CSV/JSON export,
backup/restore (with optional passphrase encryption per §5), print layout."

- Reports: monthly/quarterly/yearly summaries built from the same derived
  logic as Analytics (reuse `CalendarService`/`DashboardService` period math).
- Export: CSV and JSON of transactions (and per report), plus full
  backup/restore of all Dexie stores. Validate imports against the current
  schema; reject mismatched schema versions with a clear message (spec §10
  edge case: "restoring backups to a newer schema version").
- Optional passphrase encryption for backups per §5 (Web Crypto AES-GCM is
  the natural primitive; derive a key from the passphrase).
- Confirmation dialog before restore and before reset (spec §3).
- Implement on the existing `/reports` route (replace the `PlaceholderPage`).

### Step D — Production Hardening (spec §9 "Phase 11")

Spec scope: "Performance profiling, accessibility review, offline validation,
regression testing, bug fixing, UI consistency audit, animation review, code
cleanup, docs review, GitHub Pages deployment validation."

- Run the full §9 regression checklist (Dashboard, Transactions, Categories,
  Accounts, Budgets, Loans, Recurring, Calendar, Timeline, Analytics,
  Reports, Backup, Restore, Search, Filters, Theme, Offline mode, PWA
  installation).
- Verify performance targets: cold start <2s, dashboard render <500ms,
  near-instant save, search <100ms on common datasets, 60fps scrolling.
- Accessibility: touch targets ≥48×48px, keyboard nav, sufficient contrast,
  semantic HTML, screen-reader-friendly labels.
- Validate the GitHub Pages deployment end to end (see §7).

## 6. Cross-cutting debt to resolve (as you go)

Tracked in `PROJECT_STATE.md` §technical debt; the most consequential:

1. **Notification log / "seen" state** — recurring, budget, loan, and
   forecast alerts are all derived per render and can't be dismissed or
   "notified once per threshold". This blocks the spec's "notify once per
   threshold" (budgets) and clean recommendation mechanics. Decide ownership
   (likely during Intelligence) and build a minimal persisted,
   deduplicated seen-state.
2. **`CalendarService` range helpers** — add `getRangeSummary(events, start,
end)` / `getRangeEvents` (recommended by Phase 7) for Analytics.
3. **Forecast run-rate hybrid** — the Phase 8 run-rate is a naive linear
   pace; §6 mentions "historical averages". Blend the current month with the
   previous period once Analytics has rolling data.
4. **Status/label maps duplicated in `RecurringCard`/`LoanCard`** — DRY if
   pills spread to new cards.
5. **Form-row markup duplicated across feature forms** — consistent, not
   broken; extract only if a real pattern emerges.

## 7. Deployment & CI

- Repo: `https://github.com/mohd-hanzala-s/project-mizan`, branch `main`.
- GitHub Pages URL: `https://mohd-hanzala-s.github.io/project-mizan/`.
- Base path `/project-mizan/` is set in three places — keep them in sync:
  `vite.config.ts` (`BASE_PATH`), `public/404.html`, and the
  `VITE_BASE_PATH` fallback in `.github/workflows/ci.yml` (both build jobs).
  If the repo is ever renamed, update all three + `README.md`.
- CI (`.github/workflows/ci.yml`): `verify` job runs `npm ci` → lint →
  format check → typecheck → test → build on every push/PR; `deploy` job
  publishes to Pages on pushes to `main` (requires repo Settings → Pages →
  Source = **GitHub Actions**; that must be enabled in the repo settings).
- `package.json` and `package-lock.json` names must stay in sync (both
  `mizan`).
- To ship the included `project-mizan-deployable.zip`: extract it into an
  empty repo (it excludes `node_modules/`, `.git/`, `dist/`), commit, and
  push `main`. `npm ci` regenerates dependencies on CI.
- All app data is client-side (IndexedDB); there is no backend to deploy.

## 8. Per-phase completion checklist

Every phase is only "done" when **all** of these hold:

- [ ] All planned functionality works (spec §9 scope + §10 acceptance criteria
      for the modules touched).
- [ ] Nothing existing breaks — full suite green, no console errors.
- [ ] `npm run lint`, `npm run format:check`, `npm run typecheck`,
      `npm run test`, `npm run build` all pass.
- [ ] Schema changes (if any) ship with a migration bumping the version in
      `src/database/db.ts`; schema version updated in `PROJECT_STATE.md`.
- [ ] New services/repositories/components/stores/routes added to the
      inventories in `PROJECT_STATE.md`; test count updated.
- [ ] `CHANGELOG.md` has a new section; `docs/PHASE<n>_REPORT.md` written in
      the established format (Added / Decisions & deviations / Known gaps;
      for full detail follow `docs/PHASE8_REPORT.md`).
- [ ] Deviations from the spec are **flagged, not silently assumed** — record
      each one with the reasoning.
- [ ] "Definition of done" from spec §9: offline mode works, tablet layouts
      verified, migrations validated, backup/restore succeed, docs updated,
      visual consistency maintained, performance within target.

## 9. First actions for the next agent

1. Read this file, then `docs/atlas-master-spec.md`, then `PROJECT_STATE.md`.
2. Run `npm ci` and the full quality-gate set (§4.5) to confirm the baseline
   is green before changing anything.
3. Decide Step A scope with the owner (Analytics route choice, which charts
   ship first) and implement it.
4. Follow §5 steps in order, completing §8's checklist each time.

When in doubt between two valid designs, prefer the option that is easiest to
maintain, easiest to understand, and most consistent with
`docs/atlas-master-spec.md` — that is the project's final principle.
