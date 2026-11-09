# Hisabche — Master Audit Index (forensic architecture audit)

- Date: 2026-11-08 · Commit `b546d5df103601194827a1bb7e79a68ae491aab4`
- Mode: READ-ONLY. No product code changed, nothing committed/pushed/deployed, no production DDL, no `.env`/secrets read.
- Written in worktree `.claude/worktrees/optimistic-chatelet-48772a/docs/audit/`; commands run in the main checkout (same HEAD).

## Progress checkpoint (resume from here)

| #   | Deliverable                                                                        | State                |
| --- | ---------------------------------------------------------------------------------- | -------------------- |
| 1   | [HISABCHE-REPOSITORY-MAP.md](HISABCHE-REPOSITORY-MAP.md)                           | DONE                 |
| 2   | [HISABCHE-BUSINESS-CORE-INVENTORY.md](HISABCHE-BUSINESS-CORE-INVENTORY.md)         | DONE                 |
| 3   | [HISABCHE-UI-ROUTE-TAB-INVENTORY.md](HISABCHE-UI-ROUTE-TAB-INVENTORY.md)           | DONE                 |
| 4   | [HISABCHE-DEPENDENCY-MAP.md](HISABCHE-DEPENDENCY-MAP.md)                           | DONE                 |
| 5   | [HISABCHE-SAAS-LIFECYCLE-AUDIT.md](HISABCHE-SAAS-LIFECYCLE-AUDIT.md)               | DONE                 |
| 6   | [HISABCHE-MULTITENANCY-SECURITY-AUDIT.md](HISABCHE-MULTITENANCY-SECURITY-AUDIT.md) | DONE                 |
| 7   | [HISABCHE-OFFLINE-SYNC-AUDIT.md](HISABCHE-OFFLINE-SYNC-AUDIT.md)                   | DONE                 |
| 8   | [HISABCHE-DATABASE-DATA-MODEL.md](HISABCHE-DATABASE-DATA-MODEL.md)                 | DONE (no live DB)    |
| 9   | [HISABCHE-PLATFORM-PARITY.md](HISABCHE-PLATFORM-PARITY.md)                         | DONE (no device run) |
| 10  | [HISABCHE-TEST-QUALITY-AUDIT.md](HISABCHE-TEST-QUALITY-AUDIT.md)                   | DONE                 |
| 11  | [HISABCHE-PRODUCTION-READINESS.md](HISABCHE-PRODUCTION-READINESS.md)               | DONE                 |
| 12  | this file                                                                          | DONE                 |

Open for a next pass: live DB FINDING for drift lines; pg tests in CI; mobile/desktop jest; per-route review of the 58 handler-gated writes; RPC catalogue; whole-repo import-cycle scan.

## Headline numbers (FACT)

| Item                                          |                             Count |
| --------------------------------------------- | --------------------------------: |
| Workspace packages                            | 23 (4 apps, 18 packages, backend) |
| Business cores                                |                                44 |
| Backend route files / endpoints               |      110 / 853 (repo script: 857) |
| Routes with no client caller                  |                               122 |
| Web pages (total / dashboard / public)        |                      67 / 30 / 37 |
| App-shell dashboard routes                    |              30 (parity with web) |
| Admin pages                                   |                                26 |
| Hubs / top-level tabs / sections              |               14 files / 24 / ≈30 |
| Legacy redirect pairs                         |                                28 |
| SQL files / migrations / VERIFY / FINDING     |              415 / 228 / 142 / 15 |
| Distinct tables in SQL / device SQLite tables |                          305 / 62 |
| Tests passed this session                     |                 8,423 (exit 0 ×3) |

## Critical findings (summary; details in linked files)

| ID   | Sev    | file:line                                                                                          | One line                                                         |
| ---- | ------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| F-01 | High   | `packages/app-shell/src/features/auth/offline-license.ts:102-109`                                  | Offline licence key trusted on first use when build key absent   |
| F-02 | High   | `backend/src/services/offline-license.service.ts:250-256`                                          | Licence private key stored in DB                                 |
| F-03 | Medium | `backend/src/routes/product-images.routes.ts:27`                                                   | Product-image writes without capability                          |
| F-04 | Medium | `backend/src/services/notification.service.ts:78`                                                  | Notifications not workspace-scoped                               |
| F-05 | Medium | `backend/src/services/subscription-order.service.ts:246`                                           | Unowned paid order provisionable without claim token             |
| L-01 | Medium | `backend/src/routes/billing.routes.ts:911-931` + `backend/src/index.ts:353-410`                    | Anonymous buy-first path unreachable (401)                       |
| L-02 | Medium | `backend/src/workers/trial-expiration.worker.ts:124-135`                                           | Trial-expiry email is TODO and reads non-existent `users` table  |
| L-03 | Medium | `backend/src/services/billing.service.ts:265-272` vs `:366-389`                                    | Two rules for "current subscription"                             |
| F-06 | Medium | `backend/src/services/permission.service.ts:215-226`                                               | Non-atomic role permission rewrite, errors ignored               |
| C-01 | Medium | `backend/src/services/invoice.service.ts:1322-1398`                                                | Invoice create is a multi-step chain; ledger failure after stock |
| D-01 | Medium | `scripts/check-schema-drift.mjs` (exit 1)                                                          | Drift gate red with false positives                              |
| X-01 | Low    | `.ai/codebase/` missing; CLAUDE.md claims stale (invoice capability, 27 pairs, workspace fallback) | Documentation drift                                              |

## Fact / inference / recommendation discipline

Each linked file separates FACT (read in code or command output), INFERENCE (marked), and RECOMMENDATION (own section). Nothing is VERIFIED_COMPLETE: no live HTTP or DB was used.

## Fix round (8–9 Nov 2026) — checkpoint

Details and owner steps: [HISABCHE-FIXES-2026-11-08.md](HISABCHE-FIXES-2026-11-08.md).

| Finding                                              | State                                                                                                     |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| F-01 licence key trust                               | IMPLEMENTED + UNIT TESTED (key pinned in code)                                                            |
| F-02 private key in DB                               | **ACCEPTED RISK** by owner decision (9 Nov): key stays in DB; env path removed; migration 02 rev2 pending |
| F-03 product images                                  | IMPLEMENTED (guard test updated)                                                                          |
| F-04 notifications                                   | IMPLEMENTED + UNIT TESTED                                                                                 |
| F-05 / L-01 / F-10 orders                            | IMPLEMENTED + UNIT TESTED (injection-checked: F-05)                                                       |
| L-02 trial worker (+ new: expireTrial hit paid rows) | IMPLEMENTED + UNIT TESTED                                                                                 |
| L-03 one subscription rule                           | IMPLEMENTED + UNIT TESTED                                                                                 |
| C-01 invoice ledger                                  | retry completes the document — UNIT TESTED; full atomicity NOT FIXED                                      |
| F-06 roles / F-08 stock count                        | IMPLEMENTED; migrations PENDING HUMAN CONFIRMATION                                                        |
| F-09, D-01, X-01                                     | IMPLEMENTED (drift 74 → 5, FINDING for owner)                                                             |
| F-07, F-12, S-01, S-02, API_ONLY areas               | NOT FIXED — reasons in the fixes file                                                                     |

Correction to the original audit: `.ai/codebase/` is **gitignored** and exists in the main checkout. It was missing only in this worktree. `scripts/build-ai-index.mjs` failed in a fresh checkout because it never created the folder; it now does.

Commands run in the worktree (node_modules junctioned from main):

| Command                                                |  Exit   | Result                                                                                                                                                         |
| ------------------------------------------------------ | :-----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit` (backend)                           |    0    | clean                                                                                                                                                          |
| `npx tsc --noEmit` (packages/app-shell)                |    0    | clean                                                                                                                                                          |
| `npx tsc --noEmit` (apps/desktop)                      |    0    | clean                                                                                                                                                          |
| `npx vitest run --exclude "**/*.pg.test.ts"` (backend) |    0    | 387 files, **5,267 passed** (was 5,240)                                                                                                                        |
| `npx jest` (apps/desktop, includes app-shell)          |    1    | 312 passed, 11 failed — all 11 in three `electron/__tests__/built-*` / `packaged-*` suites that need a build output (`out/`), absent because nothing was built |
| `npx jest offline-licence` (apps/desktop)              |    0    | 5 passed                                                                                                                                                       |
| `npx eslint <changed files>` (backend, app-shell)      |    0    | 0 errors                                                                                                                                                       |
| `node scripts/check-schema-drift.mjs`                  |    1    | 5 findings (was 74)                                                                                                                                            |
| `node scripts/build-ai-index.mjs`                      |    0    | map written                                                                                                                                                    |
| `*.pg.test.ts` (3 new/changed)                         | not run | BLOCKED_EXTERNAL on this machine                                                                                                                               |
