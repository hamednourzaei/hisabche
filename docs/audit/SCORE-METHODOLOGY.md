# Score methodology (third version — after page-read evidence)

Reproduce: `node scripts/audit/capability-coverage-v2.mjs` (competitive comparison). Hisabche's dimension scores are the auditor's rubric judgements with the evidence listed below; there is no script that derives them.

## 1. What the earlier numbers were

| Claim                        | Origin                                                                     | Inputs                                                                                            | Classification now                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 67.5, "rank 11 of 30"        | `RANKING-MODEL.md`, `HISABCHE_NOW` in `scripts/industry/ranking-model.mjs` | author judgement for Hisabche and 29 rivals; Hisabche inputs assume every in-flight request ships | formula `PARTIALLY_REPRODUCIBLE`, inputs `JUDGMENTAL_ESTIMATE`; **retired**                               |
| 63.3                         | first audit of 2026-10-26                                                  | same formula, Hisabche inputs lowered by the auditor, same rival inputs                           | `PARTIALLY_REPRODUCIBLE`; **superseded**                                                                  |
| 62.8                         | cited in the request                                                       | no file in the repository contains it                                                             | `NOT_REPRODUCIBLE`                                                                                        |
| 81.1 and 86.8 (rank 4 and 2) | model scenarios "Wave 1" / "all 50 options"                                | per-option gains assumed by the author                                                            | `INVALID` as claims about the current product (N-01, N-04, N-15, N-17, N-20 contradict the assumed gains) |
| every rival 0–10 score       | `RIVALS` table in the same script                                          | author knowledge                                                                                  | `JUDGMENTAL_ESTIMATE — NOT BENCHMARK`; not used anywhere in this audit                                    |

## 2. PROVISIONAL_VERIFIED_SCORE = 60.3

The word _provisional_ is deliberate: twelve audit gates still carry findings that can move it (see `AUDIT-GATE-STATUS.md`). Weights (base): A 20% · I 15% · F 10% · L 10% · O 10% · R 10% · E 10% · C 15%.

| Dim                               | Score | Confidence | Evidence count / quality                                                 | Main reasons                                                                                                                    |
| --------------------------------- | ----- | ---------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| A Accounting depth                | 6.5   | MEDIUM     | many files and tests; STRONG for core, WEAK for new options              | ledger, period lock, month-end, FX are present; sales tax and discounts are not posted (N-37); returns post nothing (N-01/N-17) |
| I Inventory and commerce          | 6.5   | MEDIUM     | STRONG for costing/shelves/transfers; WEAK for serial and variants       | no entry UI for serials (N-25), variants carry no stock (N-24b), no reservations (N-39)                                         |
| F Industry fit                    | 5.5   | LOW        | registry + profiles + depth tests for eight trades                       | registry overclaims (N-23); trade extensions mostly lack UI                                                                     |
| L Multi-currency and localisation | 8.5   | MEDIUM     | catalogues (13 key differences), frozen rates, revaluation entries       | 48 uncatalogued keys (N-40), 91 raw formatting calls; live parity unverified                                                    |
| O Offline and resilience          | 8.0   | MEDIUM     | 490-row matrix + guard + 192 engine tests                                | no two-device run; serial/lot online-only; cursor hazard (N-36)                                                                 |
| R Reporting                       | 6.5   | LOW        | 27 report endpoints inventoried                                          | per-report filters/permissions not exercised; management pack and scheduled reports unwired                                     |
| E Ecosystem and integrations      | 4.5   | MEDIUM     | API keys, webhooks, OAuth apps, OData (mock-tested)                      | connector framework adapter-less                                                                                                |
| C Compliance, trust, maturity     | 3.0   | HIGH       | no SOC 2 / ISO 27001 / ISAE; compliance drafts cite missing files (N-26) |                                                                                                                                 |

Score = Σ(score × weight) × 10 = **60.3**. Confidence in the total: LOW. Target score: `NOT DETERMINABLE`.

## 3. Rivals: no per-vendor 0–10 score

A 0–10 value per dimension needs evidence for accounting depth, reporting breadth, industry configuration, ecosystem and maturity. The page reads of this round cover ten _capabilities_, not the eight _dimensions_, and for 25 of 29 products they cover almost nothing. A number would re-label the old judgement. Therefore: `NOT_VERIFIABLE` for every rival's eight-dimension score.

## 4. What is offered instead — documented-capability cells

Ten capabilities (C1 serial/lot, C2 costing, C3 FX revaluation, C4 fixed assets, C5 period lock, C6 consolidation, C7 API+webhooks, C8 attestation, C9 offline entry, C10 budgets). Cell values: ✔ 1, ◐ 0.5, ✖ 0, `?` unknown. A cell is filled **only** from a vendor page read in full this round (`evidence/round3-page-reads.md`). "Not stated" is unknown, not absent.

Qualification: a rival is evidence-qualified with ≥ 7 of 10 cells established. Result: **4 rivals** (Odoo, ERPNext, Business Central, Zoho Books). Bounds: lower bound counts unknown cells as 0, upper bound as 1. A rival is _certainly ahead_ of Hisabche if its lower bound exceeds Hisabche's upper bound, _certainly behind_ if its upper bound is below, otherwise _undetermined_.

Hisabche's cells are repository evidence, not live verification: ✔ means code + route + (UI or engine) exist. That is a weaker kind of ✔ than "ran in production", and a different kind from "the vendor says so". The comparison is therefore indicative, not a benchmark.

## 5. Market-specific positions (relative, inside the qualified set)

Weights on the ten capabilities (each row sums to 1):

| Market                 | C1  | C2  | C3  | C4  | C5  | C6  | C7  | C8  | C9  | C10 |
| ---------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GLOBAL ERP             | .08 | .08 | .12 | .10 | .10 | .16 | .10 | .20 | .01 | .05 |
| GENERAL SMB            | .12 | .12 | .10 | .08 | .08 | .04 | .14 | .12 | .08 | .12 |
| AFGHANISTAN / IRAN SMB | .14 | .14 | .16 | .06 | .08 | .02 | .06 | .04 | .22 | .08 |
| OFFLINE-FIRST SMB      | .08 | .08 | .08 | .04 | .06 | .02 | .06 | .06 | .50 | .02 |

| Market                 | Hisabche | Qualified rivals                  | Competitors included / excluded                  | Evidence coverage             | Relative position among 5 | Confidence |
| ---------------------- | -------- | --------------------------------- | ------------------------------------------------ | ----------------------------- | ------------------------- | ---------- |
| Equal weights          | 8.0 / 10 | 4                                 | 4 included, 25 excluded                          | 10/10, 9/10, 8/10, 7/10 cells | 3 to 5                    | LOW        |
| GLOBAL ERP             | 0.680    | 4                                 | same                                             | same                          | **5 (last)**              | LOW        |
| GENERAL SMB            | 0.800    | 4                                 | same                                             | same                          | 4 to 5                    | LOW        |
| AFGHANISTAN / IRAN SMB | 0.880    | 4 (no regional product qualified) | same; Sepidar, Hesabfa, Holoo, Rahkaran excluded | same                          | 1 to 4                    | LOW        |
| OFFLINE-FIRST SMB      | 0.890    | 4                                 | same                                             | same                          | 1 to 4                    | LOW        |

These are `EVIDENCE-QUALIFIED RELATIVE POSITION`s. They are not a global or market rank: 25 of 29 products are outside the comparison, and the weights are the auditor's.

## 6. Sensitivity and limits

1. Changing the weights changes the range; the order global-ERP < general SMB < AF/IR < offline-first (Hisabche improving as offline weighs more) is stable because the single offline-established qualified rival (Odoo) is limited there.
2. Equal-weight sensitivity: raising any one Hisabche cell by ½ (to 8.5) makes Odoo and Business Central (8.5) no longer certainly ahead, so the position widens from 3–5 to 1–5; lowering any cell by ½ (to 7.5) narrows it to 4–5 (ERPNext's lower bound 8.0 then exceeds Hisabche). The result is therefore fragile at the top and stable at the bottom.
3. The qualified set depends on which pages the tool could read; JavaScript portals (Xero, Intuit developer, Exact support), a 403 (SAP, Intacct security) and an unreadable PDF (Acumatica) kept five serious products out. A different reader could change the set.
4. Price, support, partner network, customer count and sales channels are outside the model.
