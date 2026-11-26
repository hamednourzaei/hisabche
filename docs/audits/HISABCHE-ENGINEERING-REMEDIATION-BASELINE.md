# Hisabche — Engineering Remediation Baseline (Phase 0)

- **Baseline Date:** 2026-11-26
- **Actual `HEAD` at Start:** `0e74320d778e8898c4b8cd6fd520c04dcee51028` (`fixed adminpanel 28`)
- **Previous Audited Commit:** `f884673fa148cc699d23818ff9725b5ddb0c6604` (`fixed adminpanel 26`)
- **Ancestry Check:** `git merge-base --is-ancestor f884673fa148cc699d23818ff9725b5ddb0c6604 HEAD` -> `0` (`f884673f` is an ancestor of `HEAD`).
- **Commits Since Audited Snapshot:**
  - `6335aa32` (`fixed adminpanel 27`)
  - `0e74320d` (`fixed adminpanel 28`)
  - Diff (`f884673f..HEAD`): 10 files changed (`+458 / -60`), strictly scoped to brand-asset storage/signed-URL routing (`backend/src/storage/storage-adapter.ts`, `backend/src/services/brand-asset.service.ts`, `backend/src/index.ts`, `brand-asset-engine.test.ts`) and Supabase Realtime/Presence token & StrictMode lifecycle (`packages/auth/src/supabase.ts`, `packages/api/src/hooks/{useRealtime,usePresence}.ts`, `packages/api/src/supabase/{realtime,presence}.ts`, `realtime-lifecycle-guards.test.ts`).
- **Initial Working Tree:** Clean before plan creation (`?? docs/audits/HISABCHE-REMEDIATION-PHASES-PLAN.md`).
- **Code Intelligence Index:** `FRESH` (`2355` files, `22661` symbols).

---

## Architecture Verified at Baseline

- Monorepo (`pnpm@11.9.0` + Turbo): `backend/` (Fastify + supabase-js + zod + vitest), `packages/{api,ui,validation,formatting,store,i18n,app-shell,local-engine,sync,auth,ui-contract}`, `apps/{web,desktop,mobile,admin}`, `docs/` (SQL migrations, `VERIFY-*`, `MIGRATIONS-REGISTRY.json`, `MIGRATIONS-PENDING.md`).
- Environment constraint noted at baseline: On elevated Windows PowerShell sessions, `embedded-postgres` (`initdb`) refuses to run (`assertPostgresCanStart -> elevated`). Any `*.pg.test.ts` executed in an elevated Windows shell will report `BLOCKED` until run from a non-elevated shell / CI Linux runner.

---

## Initial Disposition of Audited Workstreams (Verified Against `HEAD`)

| Workstream                                   | Status at Baseline         | Notes                                                                                                                                   |
| -------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| A. Payment Security & Processor State        | Pending reproduction & fix | Untouched since `f884673f`; inspecting `payments.routes.ts`, `payment-webhook.routes.ts`, `payment-gateway-events-02-rpc-migration.sql` |
| B. Accounting & Cross-Core Reconciliation    | Pending reproduction & fix | Untouched since `f884673f`; inspecting `cross-core-reconcile.ts`                                                                        |
| C. Migration Registry & Execution Order      | Pending reproduction & fix | `docs/MIGRATIONS-REGISTRY.json` & `docs/MIGRATIONS-PENDING.md` present; inspecting dependencies & order                                 |
| D. Project Change Orders & Budget Governance | Pending reproduction & fix | Untouched since `f884673f`                                                                                                              |
| E. Support Tickets & SLA                     | Pending reproduction & fix | Untouched since `f884673f`                                                                                                              |
| F. Payment Webhook Telemetry & Admin UI      | Pending reproduction & fix | Untouched since `f884673f`                                                                                                              |
| G. Restore Preview & Validation              | Pending reproduction & fix | Untouched since `f884673f`                                                                                                              |
| H. Admin Metrics, UI & Query Reliability     | Pending reproduction & fix | Untouched since `f884673f`                                                                                                              |
| I. AI Financial Reporting & Currency         | Pending reproduction & fix | Untouched since `f884673f`                                                                                                              |
| J. Concurrency & Reversal Coverage           | Pending reproduction & fix | Untouched since `f884673f`                                                                                                              |
