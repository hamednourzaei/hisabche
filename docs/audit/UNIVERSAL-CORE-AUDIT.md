# Universal Core and Competitive Capability Audit — second round

Date: 2026-10-26 · Mode: audit only · Working tree: 196 modified or untracked paths over commit `41031ed2`.

```
AUDIT STATUS             : INCOMPLETE  (PASS 18 · BLOCKED_EXTERNAL 1 · FAIL 3 — see AUDIT-GATE-STATUS.md)
UNIVERSAL CORE           : INCOMPLETE
INDUSTRY ONBOARDING      : BLOCKED
PROVISIONAL_VERIFIED_SCORE: 60.3 (confidence LOW)
COMPETITIVE POSITION     : NOT_VERIFIABLE as a rank; 4 evidence-qualified rivals
```

Detail lives in the files below; this page is the summary.

| File                                                              | Content                                                               |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| `AUDIT-GATE-STATUS.md`                                            | the 22 gates                                                          |
| `UNIVERSAL-CORE-GAP-LEDGER.md`                                    | gaps N-01…N-43, G-01…G-17, core checklist                             |
| `WRITE-ROUTE-AUTHORIZATION.md`                                    | all 416 write routes by authorization mechanism                       |
| `ORPHAN-CAPABILITY-LEDGER.md`                                     | unused hooks, rule functions, routes, registry items                  |
| `gates/GATE-02…14-*.md`                                           | documentation, database, sync, accounting, inventory, reporting, i18n |
| `COMPETITIVE-EVIDENCE-MATRIX.md`, `evidence/round3-page-reads.md` | competitors from pages read                                           |
| `SCORE-METHODOLOGY.md`                                            | how the score and the comparison are computed                         |
| `generated/`, `verify-logs/`, `scripts/audit/`                    | reproducible outputs and tools                                        |

## 1. Audit status and gates

18 gates PASS, 1 BLOCKED_EXTERNAL (live database: the Postgres server cannot start on this machine, error 1314), 3 FAIL (competitive evidence and its two recalculations). The code audit is complete to the stated depth; the competitive audit is not. Nothing here claims an independent audit was completed.

## 2. Verified current state (evidence-backed facts only)

| Fact                                                                                                                                                                                                                | Evidence                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 7 of 12 type-checks pass; `packages/ui`, `app-shell`, `apps/web`, `apps/desktop`, `apps/admin` fail on one error (`toIsoDay` not imported, `invoice-returns-dialog.tsx:44`)                                         | `verify-logs/_summary.txt`                                      |
| All 9 unit-test runners pass (validation 575, api 281, formatting 132, app-bridge 29, local-engine 192, ui 2,449 + 2 skipped, backend 4,612, desktop 271, mobile 203)                                               | `verify-logs/`                                                  |
| eslint: backend 1 error + 54 `any` warnings; 10 other packages clean                                                                                                                                                | `verify-logs/_lint-summary.txt`                                 |
| 81 Postgres tests (724 cases) exist; none can start here (`initdb` works, server start fails with error 1314)                                                                                                       | `scripts/audit/pg-probe.mjs`, `gates/GATE-04-database.md`       |
| 816 routes, 416 writes; 191 writes ask for a capability, 63 platform-admin, 74 needed reading, of which 4 are cross-tenant, 10 leave an existing capability unapplied, 51 sit in domains with no capability defined | `WRITE-ROUTE-AUTHORIZATION.md`                                  |
| `POST /api/sync/push` with `operation: delete` deletes rows of nine entity types after only a workspace check; an existing test pushes an invoice delete                                                            | `sync.service.ts:503-512`, `sync-invariants.test.ts:640-660`    |
| Cloud sales returns read table `invoice_lines`, which exists nowhere (`invoice_items` is the table); a return moves no stock, ledger or money                                                                       | `table-names.mjs`; `gates/GATE-09-accounting.md`                |
| Sales tax and discounts are not posted to the ledger (one `total`; the `tax` account role is used only by payroll)                                                                                                  | `invoice-posting.domain.ts`                                     |
| Credit limit is enforced in the browser only; the Settings toggle writes a field the API does not read                                                                                                              | `credit-limit-mode-section.tsx`, search of backend              |
| Workflow update/delete and project-member add/remove are cross-tenant                                                                                                                                               | `workflow.service.ts`, `project.service.ts`                     |
| The pull cursor is a `BIGSERIAL` read in order; commit-order skips are possible; version check is not atomic                                                                                                        | `sync.service.ts`, `sync-engine-migration.sql`                  |
| 72 of 498 hooks and 40 rule functions have no consumer; the 50-option log names 16 tests that do not exist                                                                                                          | `ORPHAN-CAPABILITY-LEDGER.md`, `gates/GATE-02-documentation.md` |
| Offline: 490 matrix rows; cloud edition queues invoice creation only; the new tables have no path from the offline edition to the cloud                                                                             | `gates/GATE-08-sync.md`                                         |

## 3. Previous findings

| Finding of round 1                                      | Verdict now                                                                                          |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| N-01 returns have no effect                             | **CONFIRMED** (and N-17: cloud returns cannot work)                                                  |
| N-02 (a) not atomic                                     | **CONFIRMED**                                                                                        |
| N-02 (b) trusts caller lines                            | **REJECTED** for HTTP (route does not forward them)                                                  |
| N-02 (c) no workspace check on lines                    | **CONFIRMED**, moot                                                                                  |
| N-02 (d) no cumulative over-return guard                | **CONFIRMED**                                                                                        |
| N-03 credit limit client-only                           | **CONFIRMED**                                                                                        |
| N-04 sale ignores the 50 options                        | **CONFIRMED**                                                                                        |
| N-05 orphan hooks                                       | **CONFIRMED**, 72 of 498 repo-wide                                                                   |
| N-06 step-up MFA unrouted                               | **CONFIRMED**                                                                                        |
| N-07, N-08 route tests absent / mock-shaped             | **CONFIRMED**                                                                                        |
| N-09 zero FK                                            | **PARTIALLY_CONFIRMED** (pattern across the schema; the defect is the three FK-dependent embeds)     |
| N-10 duplicate transport paths                          | **CONFIRMED**                                                                                        |
| N-11, N-12, N-14                                        | **CONFIRMED**                                                                                        |
| N-13 generic sync queue                                 | **REJECTED** (invoice-only queue; closed 9-entity protocol)                                          |
| "114 write routes without capability = vulnerabilities" | **PARTIALLY_CONFIRMED**: 10 unapplied capabilities, 51 model gaps, 4 cross-tenant; the rest are safe |
| "QuickBooks and Xero certainly behind"                  | **WITHDRAWN** (came from search summaries)                                                           |
| "tsc 0 errors" (implementer)                            | **REJECTED**: 5 type-checks fail                                                                     |

## 4. New gaps

N-15…N-43 in the ledger (N-17, N-18, N-20, N-30, N-37 are the five new P0/P1-critical ones). Total gaps recorded: 45 rows.

## 5. Provisional verified score — 60.3 (LOW)

Dimensions and reasons in `SCORE-METHODOLOGY.md` §2. The word _provisional_ stands until the FAIL and BLOCKED gates close. Target: `NOT DETERMINABLE`.

## 6. Competitive evidence coverage

|                                                      | Count                                                                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Products studied                                     | 29                                                                                                                     |
| Evidence-qualified (≥ 7 of 10 cells from pages read) | **4** — Odoo, ERPNext, Business Central, Zoho Books                                                                    |
| Partially evidenced (1–4 cells), excluded            | 9 — Busy, Xero, Sepidar, QuickBooks Online, NetSuite, Hesabfa, TallyPrime, Exact Online, Sage Intacct (+ Holoo with 1) |
| Not directly comparable                              | 7                                                                                                                      |
| No page evidence                                     | SAP, Oracle Fusion, Infor, Epicor, Acumatica, Sage 50, MYOB, Rahkaran                                                  |

## 7. Competitive position — only if defensible

`NOT_VERIFIABLE` as a rank in any market. The evidence-qualified relative positions (inside five products, weights chosen by the auditor, Hisabche's cells from code): equal weights 3–5 · global ERP 5 · general SMB 4–5 · Afghanistan/Iran SMB 1–4 · offline-first 1–4. These are **not** market ranks.

## 8. Universal Core — INCOMPLETE

23 core rows: 6 COMPLETE, 16 PARTIAL, 1 MISSING (returns).

## 9. Industry onboarding — BLOCKED

The registry is not support. Depth tests: retail/wholesale yes; clothing/shoes, electronics, gold, freight/courier, services/agriculture no; fabric, auto parts, grocery partial (`gates/INDUSTRY-DEPTH.md`).

## 10. Top blockers (priority, with class)

1. **N-30** raw delete road in sync push (P0, security/accounting)
2. **N-20** five type-checks fail (P0, build)
3. **N-17 / N-01** returns broken and effect-less (P0, accounting)
4. **N-18 / N-31** cross-tenant workflow and project-member writes (P0/P1, security)
5. **N-37** tax and discount not in the ledger (P1, accounting)
6. **N-03 / N-15** credit control (P0/P1)
7. **N-36** pull cursor can skip rows (P1, sync)
8. **N-19 / N-33** authorization model gaps and unapplied capabilities (P1)
9. **N-24 / N-16** FK-dependent embeds and offline-edition data with no cloud path (P1)
10. **N-04 / N-12 / N-23** sale integration and registry honesty (P1)

## 11. Next implementation order (after the audit is closed)

1. Freeze this gap ledger after GATE-04, GATE-19–21 are resolved or accepted as external.
2. P0 batch (small, independent): N-20 import; N-30 delete road; N-18 and N-31 tenancy; N-17 table name.
3. Returns end to end (N-01, N-02, N-21) with a balance-measuring test and an engine twin.
4. Tax and discount lines in the ledger (N-37) before any further tax feature.
5. Capability model decisions for the domains with none (owner), then apply the ten unapplied ones (N-19).
6. Credit control server-side (N-03, N-15).
7. Sync hardening (N-35, N-36) and migration FKs plus exporter coverage (N-24, N-16).
8. Sale integration by chain (serial → variant → roll/area/kit), then UI callers or removal of orphans.
9. Re-audit the changed gates, then reconsider industry onboarding.

No implementation was done in this round.
