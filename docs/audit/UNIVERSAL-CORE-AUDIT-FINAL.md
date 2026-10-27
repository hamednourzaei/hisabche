# Universal Core audit — final (evidence-closing round)

Date: 2026-10-26 · audit only · nothing in product code, schema, migrations or git changed. Evidence kinds: CODE / TEST / SQL (static). **No finding is LIVE_VERIFIED.**

## 1. Executive verdict

`AUDIT_INCOMPLETE`. The code-side audit is complete to the depth recorded per gate; two things keep it incomplete: no real-Postgres execution (GATE-04, `BLOCKED_EXTERNAL`) and competitor evidence beyond a four-product cohort (GATE-19–21, `NOT_VERIFIABLE`). The Universal Core is `INCOMPLETE` (6 COMPLETE / 16 PARTIAL / 1 MISSING of 23 checklist items).

**Freeze decision: `NO — DO NOT FREEZE`** (reasons in §14).

## 2. Confirmed P0

| ID   | Defect                                                                                                                                                                    | Where                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| N-30 | `POST /api/sync/push` `delete` removes rows of 9 entities with no capability, domain rule, ledger/stock reversal or audit entry                                           | `backend/src/routes/sync.routes.ts:106-108`; `backend/src/services/sync.service.ts:503-512`                                |
| N-17 | return service queries undefined `invoice_lines`; every cloud return → HTTP 500; even with the right table the columns read do not exist                                  | `backend/src/services/sales/invoice-return.service.ts:36-60`; `backend/src/routes/invoice-return.routes.ts:29-60`          |
| N-18 | workflows: cross-tenant read/update/delete/steps replace/instance read (no workspace predicate)                                                                           | `backend/src/routes/workflow.routes.ts:95,124,153,236`; `backend/src/services/workflow.service.ts:230-295,301-325,413-440` |
| N-20 | `toIsoDay` not imported — `tsc` fails in `packages/ui`, `app-shell`, `apps/web`, `desktop`, `admin`; CI step `pnpm type-check` (`.github/workflows/ci.yml:33`) would fail | `packages/ui/src/components/ui/invoices/invoice-returns-dialog.tsx:44`                                                     |

## 3. Confirmed P1

| ID   | Defect                                                                                                                                                                                                    | Where                                                                                                                                                    |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N-31 | project members list/add/remove cross-tenant (`project_members` has no workspace column)                                                                                                                  | `backend/src/services/project.service.ts:335-390`; `backend/src/routes/project.routes.ts:296,322,349`                                                    |
| N-36 | pull cursor is an insertion id; out-of-order commit can be skipped permanently (CONDITIONALLY_CONFIRMED)                                                                                                  | `backend/src/services/sync.service.ts:716-741`; `docs/sync-engine-migration.sql:97-125,176-218`                                                          |
| N-37 | taxed sale credits the tax-inclusive total to sales; no tax-liability posting; ledger and tax return use two different tax sources; engine runs unawaited                                                 | `backend/src/services/invoice.service.ts:3395-3405,3030-3085,1227-1229`; `backend/src/services/tax/tax.service.ts:348-400`                               |
| N-44 | both clients omit `deviceId`/`batchId` from `/sync/push` → versioned push answered 400                                                                                                                    | `packages/app-shell/src/features/sync/sync-engine.ts:642`; mobile `sync-runner.ts:109`; `packages/validation/src/schemas/sync-protocol.schema.ts:86-141` |
| N-19 | missing authorization: warehouses (3), cloud migration (4), offline licences/devices (8) lack an existing capability; HR/payroll (11), purchase-order receive, cycle-count complete need new capabilities | `capability-model-gap-matrix.md` §1–2                                                                                                                    |
| N-01 | returns have no effect on stock, ledger or money in either edition                                                                                                                                        | ledger §A                                                                                                                                                |

P2/P3 (non-exhaustive): project cross-references (P2), tax engine consistency (N-37b–d), notification mark-read (P3), `'line-default'` and `'customer_return'` in the return dialog.

## 4. Downgraded / rejected

N-13 (generic offline queue) rejected; N-09 downgraded; "114 unguarded routes" retired (74 triaged: 10 capability-exists-unapplied, 4 cross-tenant, ~45 family gaps, ~6 safe, 3 undecided); N-19 reclassified (inline `requireRole` families are gated); "QuickBooks/Xero certainly behind" withdrawn (search-summary origin); rivals' 0–10 scores `NOT_VERIFIABLE`.

## 5. Security / tenancy verdict

Tenant boundary is sound in the main paths (workspace predicate present in the great majority of 907 scanned chains); 56 id-only chains triaged, 4 route families cross-tenant (N-18, N-31). Authorization is split into capabilities, inline role floors, service `assertMay` and nothing; `sync/push` is a bypass of all three (N-30). No HTTP negative test exists, so exploitability is `CODE`-level, not `LIVE`.

## 6. Sync verdict

Idempotency, write allow-list and conflict preservation are sound by code. The delete road (N-30), the ordering hazard (N-36) and the client body defect (N-44) mean the optimistic-concurrency path is unreachable from shipped clients while the unsafe delete is reachable from a direct call.

## 7. Accounting verdict

Core ledger, period lock, FX and costing exist. Returns do nothing (N-01) and cannot run (N-17); tax is booked as revenue (N-37).

## 8. Inventory verdict

Costing, shelves, transfers present; serial/lot has no entry UI (N-25); variants carry no stock (N-24b); no reservations (N-39). Sync delete can remove a product/warehouse stock row independent of movements (N-30).

## 9. Reporting verdict

27 report endpoints implemented, 2 unwired, 4 families missing (GATE-13). Tax return and P&L cannot be reconciled (N-37).

## 10. i18n verdict

3 catalogues with 13 key differences, 49 uncatalogued literal keys, 91 raw formatting calls, 48 hard-coded locale codes (GATE-14); not rendered.

## 11. Database-test blocker

81 pg test files could not start (Windows error 1314). `.github/workflows/ci.yml` job `backend-tests` runs them on `ubuntu-latest` but cannot be triggered without a push. See `evidence/database-gate-blocker.md`. GATE-04 stays `BLOCKED_EXTERNAL`.

## 12. Competitor evidence boundary

Directly read: Odoo (10/10 cells), Business Central (9), ERPNext (8), Zoho Books (7). Everything else `NOT_VERIFIABLE`. Scope was not expanded this round.

## 13. Score methodology

`evidence/score-recalculation.md`: Hisabche ten-cell 8.0 (7.5 if offline cell is halved), PROVISIONAL, CODE_VERIFIED only; eight-dimension 60.25→60.3 is auditor judgement, LOW confidence, excludes security. No ranking, no #1/top-10/QuickBooks/Xero/regional-best claim.

## 14. Freeze decision — `NO — DO NOT FREEZE`

| Condition                                | Met?                                                                                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All P0/P1 have sufficient evidence       | partly — N-36 is conditional; N-44 end-to-end not run; N-18/N-30/N-31 are code-level only                                                                                             |
| N-30, N-17, N-18 conclusively classified | yes (code-level)                                                                                                                                                                      |
| Capability gaps classified               | yes, but five rows await owner product decisions                                                                                                                                      |
| N-36 and N-37 classified                 | yes                                                                                                                                                                                   |
| Competitor claims bounded                | yes                                                                                                                                                                                   |
| Score reproducible                       | yes (cells and arithmetic)                                                                                                                                                            |
| DB limitation documented                 | yes                                                                                                                                                                                   |
| No major question unanswered             | **no** — live foreign-key state (decides which N-30 deletes succeed), concurrency behaviour of the cursor, tax-account presence per workspace, and HTTP negative tests are unanswered |

## 15. Minimum implementation prerequisites (not started)

1. Run the 81 pg tests (CI/Linux) and attach the log. 2. Run N-30, N-18, N-31 negative tests with two workspace tokens and a seller token. 3. Owner decisions: seller rights (products, warehouses, counts, purchase orders, payroll); whether tax-inclusive totals split into sales + tax payable. 4. Only then: freeze the ledger and plan P0 fixes in this order — N-30, N-18/N-31, N-20, N-17+N-01, N-37, N-44, N-36.
