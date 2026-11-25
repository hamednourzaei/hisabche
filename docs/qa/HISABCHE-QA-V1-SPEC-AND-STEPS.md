# HISABCHE QA V1 — Universal Quality Engineering Platform (67 Industries · 10 Engines · 12+ Standards)

> **Location:** `docs/qa/HISABCHE-QA-V1-SPEC-AND-STEPS.md`
> **Purpose:** Complete executable specification (prompt), resume-safe step-by-step execution plan, and current verified QA baseline for Hisabche.
> **Governance:** Strictly subordinate to `AGENTS.md` (§0, §0.5, §0.6, §0.7) and `CLAUDE.md`.

---

## PART 1 — EXECUTABLE SPECIFICATION PROMPT (READY FOR CLAUDE CODE / ANTIGRAVITY)

```markdown
# HISABCHE QA V1 — UNIVERSAL QUALITY ENGINEERING PLATFORM

## 67-INDUSTRY COVERAGE · 10 QA ENGINES · INTERNATIONAL STANDARDS · EVIDENCE PACKAGE

You are operating inside the EXISTING `hisabche` repository (`AGENTS.md`, `CLAUDE.md`).

### 0. NON-NEGOTIABLE ARCHITECTURAL & SAFETY CONTRACT

1. Do NOT rebuild Hisabche or create a second business core, second financial engine, second industry resolver, second capability registry, or second sync engine.
2. Reuse and extend existing repo infrastructure first:
   - `packages/validation` (capability registry, industry profiles, offline endpoint matrix, Zod schemas)
   - `scripts/generate-capability-matrix-csv.mjs`, `scripts/industry/generate-coverage-table.mjs`, `scripts/capability/wiring-matrix.mjs`, `scripts/migrations/generate-registry.mjs`, `scripts/generate-consumer-registry.mjs`
   - `backend/src/__tests__/` (Vitest + Fastify `buildServer()` + `app.inject()` + `*.pg.test.ts`)
   - `packages/local-engine/src/__tests__/` (SQLite offline engine)
   - `packages/ui`, `packages/api`, `packages/i18n`, `apps/{web,admin,desktop,mobile}`
   - `docs/qa/` (existing QA scripts, ledgers, screenshots, and audit outputs)
3. Never `git commit`, `git push`, `git reset`, `git checkout --`, `git stash`, read `.env*`, run live Supabase DDL, run load tests against Production, use `any` / `@ts-ignore` / `eslint-disable`, or weaken tests to pass.
4. Never use Last-Write-Wins (LWW) on financial sync; never treat `UNKNOWN` as `0`; AFN has 0 decimal places (`FRACTION_DIGITS['AFN'] === 0`).
5. Write a Checkpoint Ledger in `docs/qa/final-audit/CHECKPOINT-LEDGER.md` BEFORE executing, and update it after every step so any interrupted session resumes without restarting.

### 1. TARGET ARCHITECTURE (EXTEND, DO NOT DUPLICATE)

Implement a unified, isolated QA capability layer (`packages/qa-engine` or extending `scripts/qa/` + `packages/validation` test helpers — inspect existing `docs/qa/scripts/` and `scripts/` first and avoid parallel duplication) organized around:

- **Environment A (Discovery — Read-Only):** Scans workspaces, packages, domains, 67 industry profiles, capabilities, API routes, hooks, services, resolvers, permissions, frontend routes, DB tables/RLS/migrations, outbox/sync/jobs, and workflows into a traceable `QA-REGISTRY` (no discovered item left without status).
- **Environment B (Isolated QA — Primary):** Isolated `All-in-One QA Profile` + `All-in-One Test Workspace` (synthetic data only, resettable, versioned, zero mutation of real industry profiles) PLUS per-industry isolated verification across all **67 real industries**.
- **Environment C (CI / Regression — Automated):** Permanent regression suite preventing defect recurrence.

### 2. THE 10 QA METHODS & 4 EXECUTION LEVELS (L1–L4)

Execute across L1 (Unit/Component), L2 (Integration/Contract), L3 (E2E/Workflow), L4 (System/Chaos/Scale):

1. **Registry-Based Discovery** (ISO 29119 + ISO 12207): Unique IDs across `FINANCIAL`, `INVENTORY`, `CRM`, `WORKFORCE`, `MANUFACTURING`, `SYNC`, `SECURITY`, `INDUSTRY` with `Component`, `Type`, `Owner`, `Dependencies`, `UI Entry`, `API Entry`, `Permission`, `Offline Support`, `Industry Mapping`, `Test Status`.
2. **All-in-One QA Industry** (ISO 25010 + ISO 29119): Aggregates all testable capabilities (including hidden/legacy) without altering real industry resolvers; separates incomplete from complete capabilities.
3. **Model-Based & End-to-End Workflow Testing** (ISO 29119 + ISTQB): State machines, preconditions/postconditions, happy/failure/cancel/reversal/duplicate/concurrency/crash-recovery paths across Sales, Purchases, Inventory, Accounting, Payroll, Manufacturing, CRM.
4. **Financial Invariant & Property-Based Testing**: Double-entry debit=credit, payment/receivable/payable reconciliation, stock movement consistency, invoice immutability, idempotency, reversals, multi-currency, AFN 0-decimal enforcement.
5. **Security & Multi-Tenant Adversarial Testing** (OWASP ASVS 5.0.0 + WSTG + API Top 10 + NIST SSDF): Cross-tenant IDOR, URL workspace tampering, missing capability/role escalation, expired sessions, private storage traversal, RLS bypass attempts, race conditions across UI + API + DB.
6. **Offline, Sync & Chaos Engineering** (ISO 25010 Reliability + ISO 22301): Weak/dropped network, mid-push/mid-pull disconnect, crash during write, duplicate outbox delivery, 2-device concurrent edits, version conflicts, stale data return, restart recovery, no silent overwrite of newer local data.
7. **UI Automation & Visual Regression Testing** (ISO 25010 + WCAG 2.2 AA): Playwright real-browser flows, forms, validation, responsive (mobile/desktop), RTL/LTR, `fa`/`af`/`en`, loading/empty/error/success states, keyboard/focus/contrast/ARIA.
8. **Performance, Load & Scalability Engineering** (ISO 25010 + ISO 25023): Isolated-only load/stress/spike/soak, DB query & N+1 profiling, memory/CPU/pool/sync latency (reuse `backend/src/services/capacity/` V76 suite — never target Production).
9. **Industry Compatibility & Capability Matrix Testing (All 67 Industries)**: Per-industry matrix verifying capability resolution, terminology, KPIs, workflows, permissions, UI navigation, offline support, missing features, no cross-industry leakage, and dedicated scenarios for regulated trades (currency exchange, pharmacy, gold/jewellery, financial services).
10. **Autonomous Remediation & Continuous Regression** (ISO 20246 + ISO 29119 + NIST SSDF): Reproduce -> Root Cause -> Risk Assessment -> Safe Fix -> Dedicated Regression Test -> Re-verify -> Evidence.

### 3. MANDATORY 24 QA RULES & HONEST SCORECARD

- Enforce all 24 QA rules (traceability, negative tests, boundary values, state transitions, deterministic seeds, no mock-only proof for financial invariants, atomic boundaries, idempotency, auditability, multi-layer security, redacted evidence, no PASS without reproducible evidence).
- Compute the 5 independent **Hisabche Quality Scorecard** axes (`Functional`, `Reliability`, `Security`, `Operational`, `Maintainability`) excluding `NOT_APPLICABLE` from denominators and never counting `BLOCKED` or `UNVERIFIED` as `PASS`.
- Enforce the **Release Gate**: 0 open P0 Security/Financial/Data-Loss, 0 unverified critical workflows, Tenant Isolation & Financial Invariants verified, safe migrations, reproducible evidence.

### 4. REQUIRED DELIVERABLE PACKAGE (`docs/qa/final-audit/`)

Produce and populate from real execution (not templates):

- `00-executive-summary.md` through `20-release-readiness.md` (including `02-complete-capability-inventory.csv`, `04-industry-coverage.csv`, `05-route-api-hook-coverage.csv`, `06-workflow-test-results.csv`, `16-defect-register.csv`, `17-remediation-history.csv`, `19-international-standards-mapping.csv`)
- `evidence/{test-logs,browser-traces,screenshots,api-results,database-assertions,security-results,sync-traces,performance-results}/`
```

---

## PART 2 — STEP-BY-STEP EXECUTION PLAN (6 PHASES · 10 RESUME-SAFE STEPS)

| Step      | Phase                                          | Action                                                                                                                                                                                      | Completion Criterion                                                                                                   | Current Status                                                          |
| --------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `STEP-01` | Phase 1: Discovery                             | Run `pnpm code-intel prepare`, inventory all 18 packages + 4 apps + `scripts/` + `docs/qa/`                                                                                                 | `CHECKPOINT-LEDGER.md` initialized; workspace baseline captured                                                        | `DONE` (in `docs/audits/FINAL-PRODUCT-WIDE-QA-PLAN.md`)                 |
| `STEP-02` | Phase 1: Registry                              | Build/refresh `QA-REGISTRY` (`01-repository-discovery.md`, `02-complete-capability-inventory.csv`, `05-route-api-hook-coverage.csv`, `19-international-standards-mapping.csv`)              | Every discovered API, hook, service, route, capability, and table has a unique ID & status                             | `READY_TO_EXECUTE`                                                      |
| `STEP-03` | Phase 2: All-in-One & 67 Industries            | Generate & verify `03-all-in-one-coverage.md` and `04-industry-coverage.csv` across all 67 industries (leveraging `sellable-industries.json`, `COVERAGE-TABLE.md`, `capability-matrix.csv`) | All 67 industries mapped; cross-industry leakage & regulated-trade checks verified                                     | `PARTIAL` (`106/106` validation tests green)                            |
| `STEP-04` | Phase 3: L1–L2 Test Sweep                      | Run full unit/contract suites across `backend`, `validation`, `formatting`, `local-engine`, `sync`, `store`, `api`, `i18n`, `ui`, `app-shell`, `admin`, `desktop`, `mobile`                 | Exact pass/fail/blocked counts logged in `evidence/test-logs/`                                                         | `DONE_FOR_NON_PG` (PG blocked locally on Windows `initdb` `0xC0000142`) |
| `STEP-05` | Phase 3: Financial & Security L2–L3            | Execute & expand Financial Invariant, Idempotency, Double-Entry, Multi-Currency/AFN, and Adversarial Multi-Tenant/OWASP ASVS checks                                                         | `07-financial-integrity.md`, `08-security-audit.md`, `09-tenant-isolation.md` backed by `app.inject()` / DB assertions | `READY_TO_EXECUTE`                                                      |
| `STEP-06` | Phase 3: Offline, Sync & DB/Migration          | Audit outbox/conflict/crash-recovery (`local-engine` + `sync`) and migration parity (`MIGRATIONS-REGISTRY.json`, `*.pg.test.ts` on Linux/CI)                                                | `10-offline-sync-recovery.md`, `11-database-migration-audit.md`, `12-inventory-costing-audit.md` populated             | `PARTIAL` (`*.pg.test.ts` `BLOCKED_EXTERNAL` on Windows)                |
| `STEP-07` | Phase 3–4: UI/Playwright, WCAG 2.2 & V76 Scale | Run isolated Playwright E2E + RTL/LTR + `fa`/`af`/`en` + WCAG 2.2 AA checks + isolated V76 capacity benchmarks (`01..10`)                                                                   | `13-platform-compatibility.md`, `14-performance-scale-results.md`, `15-accessibility-results.md` + traces/screenshots  | `READY_TO_EXECUTE`                                                      |
| `STEP-08` | Phase 5: Autonomous Remediation                | Fix all safe confirmed P0–P4 defects with root-cause analysis & permanent regression tests (`16-defect-register.csv`, `17-remediation-history.csv`)                                         | Every fix has before/after evidence & new regression test                                                              | `INITIAL_BATCH_DONE` (`QA-001`..`QA-005` fixed)                         |
| `STEP-09` | Phase 6: Full Regression & Hygiene             | Re-run `tsc --noEmit`, `eslint`, all affected Vitest/Jest suites, `git diff --check`, `pnpm code-intel update`                                                                              | Zero regressions; `18-regression-results.md` updated                                                                   | `DONE_FOR_CURRENT_BATCH`                                                |
| `STEP-10` | Phase 6: Scorecard & Release Gate              | Compute 5-axis Scorecard + honest Release Gate (`00-executive-summary.md`, `20-release-readiness.md`)                                                                                       | Honest status (`READY` / `READY_WITH_ACCEPTED_RISKS` / `NOT_READY` / `INDETERMINATE`)                                  | `DONE_FOR_CURRENT_BATCH` (`INDETERMINATE`)                              |

---

## PART 3 — CURRENT VERIFIED QA BASELINE (2026-11-25 · REV `46c953db`)

### Verified Passing Suites (After Final Edit)

- `@hisabche/validation`: `106/106` test files, `1277/1277` tests (`PASS`), `tsc --noEmit` 0 errors.
- `@hisabche/api`: `44/44` test files, `320/320` tests (`PASS`), `tsc --noEmit` 0 errors.
- `@hisabche/formatting`: `10/10` test files, `132/132` tests (`PASS`), `tsc --noEmit` 0 errors.
- `@hisabche/sync`: `3/3` test files, `42/42` tests (`PASS`), `tsc --noEmit` 0 errors.
- `@hisabche/store`: `5/5` test files, `22/22` tests (`PASS`), `tsc --noEmit` 0 errors.
- `@hisabche/i18n`: `2/2` test files, `29/29` tests (`PASS`), `tsc --noEmit` 0 errors.
- `@hisabche/app-shell`: test suite `PASS`, `tsc --noEmit` 0 errors.
- `@hisabche/admin`: `10/10` test files, `97/97` tests (`PASS`), `tsc --noEmit` 0 errors.
- `@hisabche/desktop`: `46/46` Jest suites, `387/387` tests (`PASS`), `tsc --noEmit` 0 errors.
- `@hisabche/mobile`: `20/20` Jest suites, `220/220` tests (`PASS`), `tsc --noEmit` 0 errors.
- `@hisabche/web`: `tsc --noEmit` 0 errors (no unit test script).
- `@hisabche/ui`: `tsc --noEmit` 0 errors; `design-token-existence.test.ts` `3/3` (`PASS`) after fixing `--fg-on-accent` -> `--color-destructive-fg`; initial full run `2941/2944` (`1` skipped, `1` token defect now fixed).
- `@hisabche/local-engine`: `688/690` in parallel run; `migration-v8.test.ts` & `migration-v9.test.ts` `3/3` (`PASS`) isolated; `tsc --noEmit` 0 errors.
- `@hisabche/backend`: `tsc --noEmit` 0 errors; initial non-PG run `6059/6072`; isolated `admin-gate` + `referral-programme` `40/40` (`PASS`); all 4 fixed test files (`authorization-explain`, `concurrency-safety-map`, `tenancy-isolation`, `v59-http-routes`) `121/121` (`PASS`).
- Hygiene: `eslint` on all 6 modified files = `0` errors; `git diff --check` = `0`; `pnpm code-intel update` = `2294` files, `22399` symbols.

### Confirmed Defects Fixed in This Baseline

1. `packages/ui/src/components/ui/settings/settings-page.tsx:719` (`QA-001`, P2): Undefined `--fg-on-accent` replaced with `--color-destructive-fg`.
2. `packages/validation/src/schemas/offline-endpoint-matrix.ts` (`QA-002`, P2): Added `POST` & `DELETE /workspaces/:x/brand-assets/:x` under `settings.business_profile_edit` (`online_required`).
3. `backend/src/utils/concurrency-safety-map.ts` (`QA-003`, P2): Mapped all 13 mutating routes of `workspace.routes.ts`.
4. `backend/src/__tests__/{authorization-explain,tenancy-isolation,v59-http-routes}.test.ts` (`QA-004`, P2): Aligned test expectations with canonical `viewer` role and fail-closed unknown/null role enforcement.
5. `docs/architecture/capability-matrix.csv` & `docs/architecture/universal-core/COVERAGE-TABLE.md` (`QA-005`, P3): Regenerated to match current route line numbers and industry coverage.

### Open / Blocked Items (Honest Status)

- **Postgres Integration (`*.pg.test.ts`):** `BLOCKED_EXTERNAL` on this Windows host (`embedded-postgres` `initdb.exe` exits with `0xC0000142` / `3221225794`); must be executed in Linux/CI Postgres.
- **Undeclared Imports (`QA-006`, P2):** `scripts/check-undeclared-deps.mjs` reports 6 undeclared imports across `@hisabche/{app-shell,auth,db-schema,ui}` (left untouched per Rule 0.5 dependency-manifest freeze).
- **Live Browser E2E / Staging V76 Scale / Live Supabase:** Not executed (`UNVERIFIED` / `IMPLEMENTED_NOT_LIVE_VERIFIED`).
- **Release Readiness Status:** `INDETERMINATE` (until `*.pg.test.ts` on Linux/CI, live browser E2E, and isolated staging checks complete).
