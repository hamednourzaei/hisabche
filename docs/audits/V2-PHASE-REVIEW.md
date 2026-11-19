# V2 Phase Review — Evidence, Security, Data Integrity and Test Report

**Baseline:** `b54636fa` · **Date:** 19 Nov 2026 · **Overall:** `PARTIALLY_IMPLEMENTED`
This report accompanies PART 8–11 of `docs/prompts/THE-LAST.md`. It records what was actually
inspected and changed; it is not a claim that the entire V2 programme is complete.

## A. Phase status (PART 6 / Phase A–L)

| Phase                      | Status                                    | Evidence                                                                                                                                                        |
| -------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Repository discovery     | **PARTIAL**                               | targeted source reads + `pnpm code-intel status` (PARTIALLY_STALE, index `aa1d0896` vs HEAD `b54636fa`); grep fallback used; no machine-wide inventory produced |
| B Business core integrity  | **NOT_IMPLEMENTED**                       | no duplicate-engine sweep or dependency guards added                                                                                                            |
| C Complete workflows       | **NOT_IMPLEMENTED**                       | no end-to-end UI→persistence workflow audit                                                                                                                     |
| D Industry generalization  | **NOT_IMPLEMENTED**                       | no SUPPORTED / SUPPORTED_WITH_LIMITS / NOT_OFFERED classification                                                                                               |
| E Database & migrations    | **PARTIAL**                               | `sync-entity-coverage-migration.sql` + VERIFY + FINDING + PG test written (files only); existing migrations not executed                                        |
| F API completeness         | **PARTIAL**                               | onboarding gate added to `auth.routes.ts` and all five dashboard entries; no full-route audit                                                                   |
| G Web/Desktop/Mobile       | **NOT_IMPLEMENTED**                       | no host-specific changes; no browser/device witness                                                                                                             |
| H Security audit           | **REVIEWED_WITH_LIMITATIONS** — see below | static review of gate, tenancy and archive paths                                                                                                                |
| I Performance              | **NOT_MEASURED**                          | no real-device baseline available                                                                                                                               |
| J Observability & recovery | **NOT_IMPLEMENTED**                       | no new correlation IDs or recovery tests                                                                                                                        |
| K Regression guards        | **PARTIAL**                               | dashboard-gate coverage guard + existing capability/sync guards; no new boundary guards                                                                         |
| L Test-driven loop         | **PARTIAL**                               | repeated targeted runs and one regression fix (generated CSVs); full PG loop blocked                                                                            |

## B. Security review (`SECURITY_REVIEWED_WITH_LIMITATIONS`)

Reviewed: authentication/session (`auth.middleware`), workspace tenancy (`workspace.middleware`,
`workspace-access.service`), capability checks, onboarding completion (now server-authoritative),
dashboard direct access (now server-gated before cache), archive integrity (deterministic
checksums; no encryption claim), and migration safety (files only; no live DDL).

Confirmed and fixed in this programme:

- **Client-controlled onboarding completion** — a browser could set `onboarding_completed_at`
  merely by sending `onboardingCompleted: true`. Now gated by server-owned facts; unmet prerequisites
  yield 422 and write nothing.
- **Direct dashboard API access by an incomplete account** — now 428, fail-closed. A missing
  migration column is «not complete», never «done».

Unverified / blocked: live RLS enforcement, webhook verification, upload/decompression limits,
attachment path traversal, secret/PII log scanning, dependency vulnerability scan, penetration
testing, browser E2E. No claim is made for these.

## C. Data integrity

- Financial rules preserved: no client-entered amount trusted by a new path; no `/100` on AFN;
  finalized-document immutability untouched; no Last-Write-Wins introduced.
- Archive: required-table coverage is explicit and verification now refuses an archive with a
  missing required table. Checksums are integrity, **not** authenticity — no encryption claim.
- Sync: four server change-log entities prepared; `accounts` explicitly BLOCKED pending a tenancy
  backfill decision (`FINDING-sync-account-tenancy.sql`). Local `DELTA_ENTITIES` was deliberately
  NOT widened until the server triggers exist — doing so would make devices wait for changes the
  server cannot emit.
- No compensating DELETE, no direct production restore, no customer SQL execution added.

## D. Test report (exact commands, real totals from this working tree)

| Command                                                                                                                                                                                                                                               | Result                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `cd packages/validation && npx vitest run`                                                                                                                                                                                                            | 1239 passed / 102 files                                                                                    |
| `cd packages/local-engine && npx vitest run`                                                                                                                                                                                                          | 655 passed / 103 files                                                                                     |
| backend targeted: `onboarding-access-gate`, `onboarding-activation-gate`, `auth-response-schema`, `profile-write`, `operational-profile`, `dashboard-visibility`, `money-cache-invalidation`, `local-day`, `unwired-capability`, `scope-wiring-guard` | 96 passed / 10 files                                                                                       |
| backend targeted re-run (5 gate/auth/dashboard files)                                                                                                                                                                                                 | 46 passed / 5 files                                                                                        |
| `npx vitest run src/__tests__/sync-entity-coverage.pg.test.ts`                                                                                                                                                                                        | 5 passed (environment-blocked mode, no live PG witness)                                                    |
| earlier full backend suite (previous session, unchanged DB environment)                                                                                                                                                                               | 5932 passed / 5 failed / 1239 skipped; 168 failed files = the `*.pg.test.ts` set (SeCreateGlobalPrivilege) |
| `npx tsc --noEmit` validation / local-engine / app-bridge / api / backend / web                                                                                                                                                                       | 0 errors each                                                                                              |
| `npx eslint` every changed source file                                                                                                                                                                                                                | 0 errors, 0 warnings                                                                                       |
| 7 generators `--check`                                                                                                                                                                                                                                | exit 0                                                                                                     |
| `git diff --check`                                                                                                                                                                                                                                    | exit 0                                                                                                     |

No test was weakened, skipped or deleted to obtain these results.

## E. Remaining work

**Code/implementation:** full server gate rollout (beyond dashboard entries), hybrid activation,
migration center import/staging/reconciliation, native restore path, 10-scenario E2E fixtures,
host-specific offline workflows, observability/correlation IDs, performance baselines.

**Owner decisions:** `accounts` tenancy backfill; whether to widen `DELTA_ENTITIES` only after the
sync migration is applied; gate rollout policy for protected routes.

**External/live:** PostgreSQL witness (`secpol.msc` → Create global objects → sign out/in),
browser E2E, Windows packaged runtime, Android physical device, real customer dataset migration,
internet-disconnection tests, production verification.

## F. Final operating principle respected

One business core, one portable archive contract, one onboarding completion timestamp, multiple
runtimes. No second engine, no invented financial truth, no silent data loss, no unsupported
capability advertised as complete.
