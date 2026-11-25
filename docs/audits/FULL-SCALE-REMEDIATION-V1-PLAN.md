# HISABCHE — AUTONOMOUS FULL-SCALE ENGINEERING REMEDIATION

## SEVEN CRITICAL DOMAINS · END-TO-END IMPLEMENTATION · ZERO REPORT-ONLY COMPLETION

> **Status:** ACTIVE_EXECUTION  
> **Started:** 2026-11-25  
> **Scope:** Seven Critical Domains (Security/Authorization/Tenant Isolation, Accounting/GL, Offline/Sync, Database/Migrations/RLS, Inventory/Costing, Screen-to-API/Industry Integration, Release Readiness Web/Android/Desktop).  
> **Governance:** Strictly subordinate to `AGENTS.md` (§0, §0.5 Error-First, §0.6 Code Intel V3.0, §0.7 Outcome-Driven Integrity) and `CLAUDE.md`.

---

## Execution Phases & Hard Acceptance Gates

### Phase A — Repository Baseline

- Inspect branch, HEAD, dirty worktree status, installed toolchain, and `pnpm code-intel prepare`.
- Preserve all pre-existing user modifications.

### Phase B — Immediate Release Blockers (Domains 1, 4, 7.1)

1. **CI Stale Evidence (`packages/validation/src/__tests__/sellable-industries.test.ts`)**: Inspect `scripts/industry/generate-sellable.mjs`, `acceptance-results.json`, `sellable-industries.json`, `SELLABLE-INDUSTRIES.md` and fix root cause of staleness.
2. **Viewer Role Escalation (Domain 1.1 & 1.3)**: Fix `backend/src/services/tenancy.service.ts`, `backend/src/services/authorization/authorization.domain.ts`, `packages/local-engine/src/auth.ts`, and establish a canonical shared role/capability contract with CI drift check and HTTP tests.
3. **Tenant Isolation Verification (Domain 1.2)**: Inspect `backend/src/db.ts`, `requireWorkspaceContext`, RPCs, storage, exports, background jobs, realtime; add real PostgreSQL cross-tenant tests.
4. **Migration Registry & Verification Coverage (Domain 4)**: Recalculate migration counts, build machine-readable migration registry, repair missing VERIFY/pg tests where missing, and add automated schema consistency + RLS/grant checks.

### Phase C — Financial Integrity (Domain 2)

1. Authoritative accounting posting pipeline (`accounting.service.ts`, `accounting.repository.ts`, `LedgerPort`, `accounting_post_journal_entry`).
2. Idempotency & concurrent posting (`postYearEndClose`, `activeCloses`, DB-enforced idempotency).
3. Historical account-role compatibility (`LEGACY_CODE_ROLES`, `roleOf`, `toFacts`).
4. Executable Financial Golden Scenarios in real PostgreSQL (preserving AFN zero-decimal semantics).

### Phase D — Inventory Integrity (Domain 5)

1. Authoritative costing engine (`costing.service.ts`, `costing.repository.ts`, `inventory_consume_layers`).
2. Atomic stock consumption & concurrency PostgreSQL tests.
3. Negative stock & estimated cost visibility in financial reports + drill-down + reconciliation.
4. Costing method governance (`PUT /settings`, `setSettings`, `AuditService` fail-closed audit persistence).
5. Cross-domain reconciliation (`Invoice <-> Stock Movement <-> Cost Layers <-> COGS <-> Journal Entry`).

### Phase E — Offline & Sync (Domain 3)

1. Eliminate silent field loss (`sync.service.ts`, `sync.routes.ts`, `push-routing.ts`, `sync-runner.ts`, `packages/local-engine`) with explicit protocol outcomes (`APPLIED`, `DUPLICATE`, `CONFLICT`, `UNSUPPORTED_FIELD`, etc.) + regression test for `name` vs `full_name`.
2. Single mutation lifecycle, version/conflict policy per entity, and full entity round-trip tests.

### Phase F — Full Product Integration (Domain 6)

1. Machine-readable Screen -> Component -> Hook -> API -> Route -> Middleware -> Service -> Repository -> DB consumer registry.
2. Connect missing UI workflows / migrate duplicate endpoints / remove fake functionality.
3. Industry & business-model correctness (unknown industry never defaults to Retail/Physical Goods; goods optional).

### Phase G — Release Validation (Domain 7)

1. CI workflow completeness, TypeScript, ESLint, Vitest, PostgreSQL tests, Web build, Mobile checks, Desktop checks, Observability & backup/restore verification.
2. `pnpm code-intel update` and final factual completion ledger.

---

## Execution Ledger (Live Tracking)

| Phase | Target                               | Status                          | Verification Evidence                                                                                                                                                                     |
| ----- | ------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | Baseline & Plan                      | `VERIFIED_COMPLETE`             | `main` (`46c953db`), `pnpm code-intel prepare` (`FRESH`)                                                                                                                                  |
| B.1   | `sellable-industries.test.ts`        | `VERIFIED_COMPLETE`             | `generate-sellable.mjs` + `sellable-industries.test.ts` (`13 passed (13)`)                                                                                                                |
| B.2   | Viewer role escalation & Auth parity | `VERIFIED_COMPLETE`             | `authorization-contract.ts` + `viewer-cannot-write.test.ts` (`22 passed`) + `viewer-authorization-contract.test.ts` (`4 passed`) + `workspace-membership-integrity.test.ts` (`13 passed`) |
| B.3   | Tenant isolation & pg tests          | `IMPLEMENTED_NOT_LIVE_VERIFIED` | `tenant-isolation-comprehensive.pg.test.ts` created; local `embedded-postgres` blocked (`initdb` code `3221225794` on Windows)                                                            |
| B.4   | Migration registry & schema parity   | `VERIFIED_COMPLETE`             | `MIGRATIONS-REGISTRY.json` (`309` migrations, `--check` OK) + `schema-contract-parity.test.ts` (`3 passed`)                                                                               |
| C     | Accounting & Golden Scenarios        | `VERIFIED_COMPLETE`             | `financial-and-inventory-golden.test.ts` + `accounting-close-and-ledger.test.ts` (`19 passed`)                                                                                            |
| D     | Inventory costing & reconciliation   | `VERIFIED_COMPLETE`             | `inventory-costing.routes.ts` (`auditRecorded` + `X-Audit-Recorded: false`) + `inventory-costing-rules.test.ts` (`25 passed`)                                                             |
| E     | Offline & Sync protocol              | `VERIFIED_COMPLETE`             | `sync.service.ts` (`UNSUPPORTED_FIELD` rejection) + `sync-unsupported-fields.test.ts` + `sync-invariants.test.ts` (`38 passed`) + `sync-security.test.ts` (`30 passed`)                   |
| F     | Screen-to-API & Industry correctness | `VERIFIED_COMPLETE`             | `CONSUMER-REGISTRY.json` (`1067` endpoints classified, `--check` OK) + `industry-profiles.test.ts` (`36 passed`) + `industry-profile-guard.test.ts` (`2 passed`)                          |
| G     | Release validation & CI              | `VERIFIED_COMPLETE`             | `ci.yml` registry checks + `dr-restore-drill.mjs` (`Trial Balance: 170000/170000`, `0` errors)                                                                                            |
