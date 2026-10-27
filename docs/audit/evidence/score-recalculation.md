# Score recalculation (evidence-only)

Date: 2026-10-26. Reproduce the cell comparison: `node scripts/audit/capability-coverage-v2.mjs` (output `generated/capability-coverage-v2.md`). Evidence categories used: `CODE_VERIFIED` (file read), `TEST_VERIFIED` (a test run by the audit passes and asserts the point), `LIVE_VERIFIED` (executed against a real server/database — **none exist in this audit**), `OFFICIAL_VENDOR_EVIDENCE` (vendor page opened in full, `round3-page-reads.md`), `INFERENCE`, `UNKNOWN`. No global ranking is made, and nothing here claims first place, top 10, a position against QuickBooks or Xero, or "best in Afghanistan/Iran".

## 1. Hisabche — ten capability cells

Cell values: 1 present, 0.5 partial, 0 absent. Weight = equal weighting (0.1 per cell); market weights are in `SCORE-METHODOLOGY.md` §5.

| Cell | Criterion                       | Score | Weight | Evidence source                                                                                                                                       | Category                              | Confidence | PROVISIONAL because                                                 |
| ---- | ------------------------------- | ----- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------- | ------------------------------------------------------------------- |
| C1   | serial/lot tracking             | 0.5   | 0.1    | engine and tables exist; no entry UI for serials (N-25), online-only                                                                                  | CODE_VERIFIED                         | MEDIUM     | unit-level only                                                     |
| C2   | FIFO + average costing          | 1     | 0.1    | `costing`, `inventory_settings.costing_method`; avco migration reported run and VERIFIED by the owner on 18 Oct (CLAUDE.md) — not re-run here         | CODE_VERIFIED (+ owner-reported live) | MEDIUM     | live result not seen by the audit                                   |
| C3   | multi-currency with revaluation | 1     | 0.1    | frozen invoice rate, `fx_revaluation` source type, `exchange_rates`                                                                                   | CODE_VERIFIED                         | MEDIUM     | no Postgres execution (GATE-04)                                     |
| C4   | fixed assets                    | 1     | 0.1    | `depreciation` ledger source type, asset service                                                                                                      | CODE_VERIFIED                         | MEDIUM     | same                                                                |
| C5   | period lock / close             | 1     | 0.1    | `accounting_period_locks`, month-end                                                                                                                  | CODE_VERIFIED                         | MEDIUM     | same                                                                |
| C6   | native consolidation            | 0.5   | 0.1    | multi-workspace/branch reporting without eliminations                                                                                                 | CODE_VERIFIED                         | LOW        | scope of "consolidation" read once                                  |
| C7   | REST API + webhooks             | 1     | 0.1    | `API_ROUTE_SCOPES`, webhook events, OAuth apps; but sync/workflow/project routes have tenancy defects (N-18, N-31) which do not remove the capability | CODE_VERIFIED                         | MEDIUM     |                                                                     |
| C8   | independent attestation         | 0     | 0.1    | no SOC 2/ISO 27001/ISAE document in the repository                                                                                                    | CODE_VERIFIED (absence)               | HIGH       |                                                                     |
| C9   | offline transaction entry       | 1     | 0.1    | offline edition: local engine is the book (490-row matrix); cloud edition queues invoice creation only                                                | CODE_VERIFIED + TEST_VERIFIED (unit)  | MEDIUM     | no two-device run; cursor hazard N-36; client push body defect N-44 |
| C10  | budgets                         | 1     | 0.1    | budget service/capability                                                                                                                             | CODE_VERIFIED                         | MEDIUM     |                                                                     |

Sum = 8.0 / 10. **None of these is `LIVE_VERIFIED`.** If N-36 and N-44 are counted against C9 the cell is arguably 0.5; the audit keeps 1 and marks the cell PROVISIONAL. Effect: equal-weight total becomes 7.5 (range 7.5–8.0).

## 2. Rivals — only the four evidence-qualified products

| Product                       | Established cells | Source category                                              | Unknown cells | LB–UB (equal weights) |
| ----------------------------- | ----------------- | ------------------------------------------------------------ | ------------- | --------------------- |
| Odoo                          | 10/10             | OFFICIAL_VENDOR_EVIDENCE (`round3-page-reads.md` rows 13-21) | none          | 8.5–8.5               |
| Dynamics 365 Business Central | 9/10              | OFFICIAL_VENDOR_EVIDENCE (rows 41-47)                        | C9            | 8.5–9.5               |
| ERPNext                       | 8/10              | OFFICIAL_VENDOR_EVIDENCE (rows 22-32)                        | C6, C9        | 8.0–10.0              |
| Zoho Books                    | 7/10              | OFFICIAL_VENDOR_EVIDENCE (rows 33-40)                        | C2, C6, C9    | 7.0–10.0              |

Every other product: `NOT_VERIFIABLE` (partial pages, JavaScript shells, 403, PDF, unreachable, or not attempted). Their earlier 0–10 scores are `UNKNOWN`/judgement and are not used. No competitor was added in this round.

## 3. Relative position (inside the four, not a ranking)

| Weighting     | Hisabche | Position among 5 | Notes                                                           |
| ------------- | -------- | ---------------- | --------------------------------------------------------------- |
| Equal         | 8.0      | 3 to 5           | with C9 at 0.5 → 7.5, position 4 to 5                           |
| GLOBAL ERP    | 0.680    | 5                | C8 (0.20) and C6 (0.16) dominate                                |
| GENERAL SMB   | 0.800    | 4 to 5           |                                                                 |
| AF/IR SMB     | 0.880    | 1 to 4           | no regional product qualified; market weights are the auditor's |
| OFFLINE-FIRST | 0.890    | 1 to 4           | only Odoo is established on C9, and only as 0.5                 |

These are `INFERENCE` from a ten-cell model with auditor-chosen weights; they cannot support a market claim.

## 4. Dimension score (A–C), kept as PROVISIONAL

The eight-dimension total **60.25 → 60.3** is reproducible arithmetic (weights A .20, I .15, F .10, L .10, O .10, R .10, E .10, C .15; scores 6.5, 6.5, 5.5, 8.5, 8.0, 6.5, 4.5, 3.0 → 1.300 + 0.975 + 0.550 + 0.850 + 0.800 + 0.650 + 0.450 + 0.450 = 6.025). The scores themselves are **auditor judgement** (`INFERENCE`), not evidence, and there is no script that derives them. This round's findings are already reflected in the dimension reasons (N-17, N-37 in A; N-36 in O) — no dimension covers security/tenancy, so the confirmed P0s (N-30, N-18) have no place in the number. **Status: PROVISIONAL; confidence LOW.** A score that includes security would be lower than 60.3 by an amount the model cannot state.

## 5. Statements that must not be made

First place, "top 10", ahead of or behind QuickBooks/Xero/SAP/Oracle (unreadable or unattempted), best in Afghanistan or Iran (no regional product qualified; demos are needed), or any single "rank" number.
