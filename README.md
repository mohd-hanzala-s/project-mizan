# Mizan by Mikarsh

Offline-first personal finance PWA. Know exactly where every rupee goes, in
under thirty seconds. Everything stays on-device — no cloud, no account.

The complete product spec lives in
[`docs/atlas-master-spec.md`](docs/atlas-master-spec.md) — read that first.
This README only covers running the code.

## Status

Phase 7 (Calendar & Timeline) complete, on top of Phase 6 (Loan Manager),
Phase 5 (Recurring), Phase 4 (Budgets), Phase 3 (Accounts), Phase 2
(Dashboard), Phase 1 (Core Transaction Engine), and Phase 0 (Foundation).
See [`CHANGELOG.md`](CHANGELOG.md) for what each phase includes and the spec
gaps that were resolved with a documented assumption rather than silently
guessed at. The detailed Phase 7 write-up is in
[`docs/PHASE7_REPORT.md`](docs/PHASE7_REPORT.md); a living summary of the
project's state lives in [`PROJECT_STATE.md`](PROJECT_STATE.md).

## Deploying

This repo is [mohd-hanzala-s/project-mizan](https://github.com/mohd-hanzala-s/project-mizan).
The GitHub Pages base path in `vite.config.ts` (`VITE_BASE_PATH`) is set to
`/project-mizan/` to match. If the repo is ever renamed or transferred,
update it there and as the `VITE_BASE_PATH` repository variable
(`Settings → Secrets and variables → Actions → Variables`).

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

## Scripts

| Script                 | What it does                            |
| ---------------------- | --------------------------------------- |
| `npm run dev`          | Dev server with HMR                     |
| `npm run build`        | Typecheck + production build to `dist/` |
| `npm run preview`      | Serve the production build locally      |
| `npm run lint`         | ESLint                                  |
| `npm run format`       | Prettier — write                        |
| `npm run format:check` | Prettier — check only (used in CI)      |
| `npm run typecheck`    | `tsc` with no emit                      |
| `npm run test`         | Vitest, single run (used in CI)         |
| `npm run test:watch`   | Vitest, watch mode                      |

## Stack

React 19 · TypeScript · Vite · Tailwind CSS · shadcn/ui · Dexie (IndexedDB) ·
Zustand · React Router · Vitest — full rationale in spec §4.

## Continuing the build

Each future phase is a one-line prompt (e.g. "Implement Phase 3 —
Accounts") to whichever AI assistant is continuing this project. Per
`docs/atlas-master-spec.md` §11, that assistant re-reads the spec, inspects
the current code, and builds only that phase's scope against §9's
Definition of Done — it does not need this README re-explained.
