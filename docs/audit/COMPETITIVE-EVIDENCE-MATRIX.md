# Competitive evidence matrix (second round — vendor pages read)

Date: 2026-10-26. Everything used here comes from `evidence/round3-page-reads.md`: vendor documentation pages that were **opened and read** with `WebFetch`. The search-result summaries of earlier rounds (`evidence/round1-…`, `round2-…`) are kept as leads only and are **not used** to fill any cell. Older numeric rival scores are `JUDGMENTAL_ESTIMATE — NOT BENCHMARK` and are not used.

Reproduce: `node scripts/audit/capability-coverage-v2.mjs` → `generated/capability-coverage-v2.md`.

## Result in four sentences

1. **Evidence-qualified comparison set = 4 rivals**: Odoo, ERPNext, Dynamics 365 Business Central, Zoho Books (≥ 7 of 10 capability cells established from pages read).
2. 10 more products have one to four cells established and are **excluded**; 7 are **not directly comparable**; the rest, including SAP, Oracle Fusion, Infor, Epicor, Acumatica, Sage 50, MYOB, Rahkaran, have **no page evidence** (403, unreadable PDF, JavaScript-only portals, unreachable sites, or not attempted).
3. Inside the four, Hisabche's relative position depends on the market weighting and is a **range**, never a rank (table below).
4. **No global rank, no per-vendor 0–10 score, and no 29-product ordering can be defended from this evidence.**

## Documented-capability cells (generated, page-read only)

C1 serial/lot · C2 FIFO and average costing · C3 multi-currency with revaluation · C4 fixed assets · C5 period lock/close · C6 native consolidation · C7 REST API + webhooks · C8 independent attestation · C9 offline transaction entry · C10 budgets.
✔ established present · ◐ established partial/limited · ✖ established absent · ? not established (page silent, unreadable or not read). Hisabche's cells are repository evidence (not live verified); rivals' cells are what the vendor's page says (not tested).

| Product                       | C1  | C2  | C3  | C4  | C5  | C6  | C7  | C8  | C9  | C10 | established cells | LB  | UB   | status                  |
| ----------------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ----------------- | --- | ---- | ----------------------- |
| Odoo                          | ✔   | ✔   | ◐   | ✔   | ✔   | ✔   | ◐   | ✔   | ◐   | ✔   | 10/10             | 8.5 | 8.5  | EVIDENCE-QUALIFIED      |
| Hisabche (repository)         | ◐   | ✔   | ✔   | ✔   | ✔   | ◐   | ✔   | ✖   | ✔   | ✔   | 10/10             | 8.0 | 8.0  | subject                 |
| Dynamics 365 Business Central | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | ?   | ◐   | 9/10              | 8.5 | 9.5  | EVIDENCE-QUALIFIED      |
| ERPNext                       | ✔   | ✔   | ✔   | ✔   | ✔   | ?   | ✔   | ✔   | ?   | ✔   | 8/10              | 8.0 | 10.0 | EVIDENCE-QUALIFIED      |
| Zoho Books                    | ✔   | ?   | ✔   | ✔   | ✔   | ?   | ✔   | ✔   | ?   | ✔   | 7/10              | 7.0 | 10.0 | EVIDENCE-QUALIFIED      |
| Busy (IN)                     | ✔   | ?   | ◐   | ?   | ?   | ◐   | ?   | ?   | ✔   | ?   | 4/10              | 3.0 | 9.0  | PARTIAL — excluded      |
| Xero                          | ✖   | ?   | ◐   | ✔   | ?   | ?   | ?   | ✔   | ?   | ?   | 4/10              | 2.5 | 8.5  | PARTIAL — excluded      |
| Sepidar (IR)                  | ◐   | ◐   | ◐   | ?   | ?   | ?   | ?   | ?   | ✖   | ?   | 4/10              | 1.5 | 7.5  | PARTIAL — excluded      |
| QuickBooks Online             | ?   | ?   | ?   | ?   | ✔   | ?   | ?   | ✔   | ?   | ✔   | 3/10              | 3.0 | 10.0 | PARTIAL — excluded      |
| Oracle NetSuite               | ✔   | ✔   | ?   | ?   | ?   | ?   | ?   | ?   | ◐   | ?   | 3/10              | 2.5 | 9.5  | PARTIAL — excluded      |
| Hesabfa (IR)                  | ?   | ?   | ✔   | ?   | ?   | ?   | ◐   | ?   | ✖   | ?   | 3/10              | 1.5 | 8.5  | PARTIAL — excluded      |
| TallyPrime                    | ?   | ?   | ◐   | ?   | ?   | ◐   | ?   | ?   | ?   | ?   | 2/10              | 1.0 | 9.0  | PARTIAL — excluded      |
| Exact Online                  | ?   | ?   | ?   | ?   | ?   | ◐   | ?   | ◐   | ?   | ?   | 2/10              | 1.0 | 9.0  | PARTIAL — excluded      |
| Sage Intacct                  | ?   | ?   | ?   | ?   | ?   | ✔   | ?   | ?   | ?   | ?   | 1/10              | 1.0 | 10.0 | PARTIAL — excluded      |
| Holoo (IR)                    | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ✔   | ?   | 1/10              | 1.0 | 10.0 | PARTIAL — excluded      |
| SAP S/4HANA Cloud             | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | 0/10              | 0.0 | 10.0 | NOT_VERIFIED            |
| Oracle Fusion Cloud ERP       | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | 0/10              | 0.0 | 10.0 | NOT_VERIFIED            |
| Infor CloudSuite              | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | 0/10              | 0.0 | 10.0 | NOT_VERIFIED            |
| Epicor Kinetic                | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | 0/10              | 0.0 | 10.0 | NOT_VERIFIED            |
| Acumatica                     | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | 0/10              | 0.0 | 10.0 | NOT_VERIFIED            |
| Workday Financials            | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | 0/10              | 0.0 | 10.0 | NOT_DIRECTLY_COMPARABLE |
| Sage 50                       | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | 0/10              | 0.0 | 10.0 | NOT_VERIFIED            |
| Fishbowl                      | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | 0/10              | 0.0 | 10.0 | NOT_DIRECTLY_COMPARABLE |
| DATEV                         | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | 0/10              | 0.0 | 10.0 | NOT_DIRECTLY_COMPARABLE |
| MYOB                          | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | 0/10              | 0.0 | 10.0 | NOT_VERIFIED            |
| Pennylane                     | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | 0/10              | 0.0 | 10.0 | NOT_DIRECTLY_COMPARABLE |
| Rahkaran (IR)                 | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | 0/10              | 0.0 | 10.0 | NOT_VERIFIED            |
| FreeAgent                     | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | 0/10              | 0.0 | 10.0 | NOT_DIRECTLY_COMPARABLE |
| FreshBooks                    | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | 0/10              | 0.0 | 10.0 | NOT_DIRECTLY_COMPARABLE |
| Wave                          | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | ?   | 0/10              | 0.0 | 10.0 | NOT_DIRECTLY_COMPARABLE |

EVIDENCE-QUALIFIED COMPARISON SET = 4 rivals (Odoo, ERPNext, Dynamics 365 Business Central, Zoho Books). Excluded: 25 others (not comparable, partially evidenced, or not verified).

## Relative position inside the qualified set (not a market ranking)

A rival is _certainly ahead_ when its lower bound exceeds Hisabche's upper bound, _certainly behind_ when its upper bound is below Hisabche's lower bound, otherwise _undetermined_. Hisabche has no unknown cells, so its bounds coincide.

### Equal weights (10 capabilities)

Hisabche = **8.0** · qualified rivals: 4 · certainly ahead 2 · certainly behind 0 · undetermined 2 · position among 5: **3 to 5**

| Rival                         | LB   | UB    | vs Hisabche     |
| ----------------------------- | ---- | ----- | --------------- |
| Odoo                          | 8.50 | 8.50  | certainly ahead |
| ERPNext                       | 8.00 | 10.00 | undetermined    |
| Dynamics 365 Business Central | 8.50 | 9.50  | certainly ahead |
| Zoho Books                    | 7.00 | 10.00 | undetermined    |

### GLOBAL ERP

Hisabche = **0.680** · qualified rivals: 4 · certainly ahead 4 · certainly behind 0 · undetermined 0 · position among 5: **5 to 5**

| Rival                         | LB   | UB   | vs Hisabche     |
| ----------------------------- | ---- | ---- | --------------- |
| Odoo                          | 0.89 | 0.89 | certainly ahead |
| ERPNext                       | 0.83 | 1.00 | certainly ahead |
| Dynamics 365 Business Central | 0.96 | 0.97 | certainly ahead |
| Zoho Books                    | 0.75 | 1.00 | certainly ahead |

### GENERAL SMB

Hisabche = **0.800** · qualified rivals: 4 · certainly ahead 3 · certainly behind 0 · undetermined 1 · position among 5: **4 to 5**

| Rival                         | LB   | UB   | vs Hisabche     |
| ----------------------------- | ---- | ---- | --------------- |
| Odoo                          | 0.84 | 0.84 | certainly ahead |
| ERPNext                       | 0.88 | 1.00 | certainly ahead |
| Dynamics 365 Business Central | 0.86 | 0.94 | certainly ahead |
| Zoho Books                    | 0.76 | 1.00 | undetermined    |

### AFGHANISTAN / IRAN SMB

Hisabche = **0.880** · qualified rivals: 4 · certainly ahead 0 · certainly behind 1 · undetermined 3 · position among 5: **1 to 4**

| Rival                         | LB   | UB   | vs Hisabche      |
| ----------------------------- | ---- | ---- | ---------------- |
| Odoo                          | 0.78 | 0.78 | certainly behind |
| ERPNext                       | 0.76 | 1.00 | undetermined     |
| Dynamics 365 Business Central | 0.74 | 0.96 | undetermined     |
| Zoho Books                    | 0.62 | 1.00 | undetermined     |

### OFFLINE-FIRST SMB

Hisabche = **0.890** · qualified rivals: 4 · certainly ahead 0 · certainly behind 1 · undetermined 3 · position among 5: **1 to 4**

| Rival                         | LB   | UB   | vs Hisabche      |
| ----------------------------- | ---- | ---- | ---------------- |
| Odoo                          | 0.68 | 0.68 | certainly behind |
| ERPNext                       | 0.48 | 1.00 | undetermined     |
| Dynamics 365 Business Central | 0.49 | 0.99 | undetermined     |
| Zoho Books                    | 0.40 | 1.00 | undetermined     |

The market weights are the auditor's choice, recorded in `scripts/audit/capability-coverage-v2.mjs` (each set sums to 1); changing them changes the range. Reading the four blocks together: against global ERP weighting (consolidation, attestation, period close) Hisabche is last of the five; against offline-first weighting no qualified rival has an established offline cell except Odoo's limited one, so three of four stay undetermined.

## Regional products — EVIDENCE_REQUIRED (not scored, not ranked)

| Product  | Established from its own pages                                                                                                                                                              | EVIDENCE_REQUIRED (what is missing)                                                                                                                      | How it can be obtained                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Sepidar  | warehouse module: serial-status and expiry reports, weighted-average pricing, separate currency subsystem; Sepidar Cloud needs a network; desktop product installs on the customer's server | desktop offline behaviour; batch tracking; FIFO; multi-currency revaluation; fixed assets; consolidation; budgets; API/webhooks; independent attestation | trial installation or vendor demo (EXTERNAL_EVIDENCE_REQUIRED)     |
| Hesabfa  | automatic exchange-rate revaluation entries; API documentation exists; FAQ states cloud only, no offline version                                                                            | serial/batch; costing method; fixed assets; period lock; consolidation; attestation                                                                      | public API documentation (not opened) and a trial account          |
| Holoo    | APEX page: usable offline or online; colour/size breakdowns mentioned                                                                                                                       | serial/batch; costing; multi-currency; revaluation; fixed assets; period lock; consolidation; API; attestation                                           | demo or trial installation (EXTERNAL_EVIDENCE_REQUIRED)            |
| Rahkaran | site unreachable from the tool                                                                                                                                                              | everything                                                                                                                                               | vendor demo or customer documentation (EXTERNAL_EVIDENCE_REQUIRED) |

## Checks of the assumptions the owner asked to challenge

| Assumption                                               | Verdict                                                                                                                                                                                                                        | Basis                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| Hisabche has better offline support                      | `NOT_VERIFIABLE` against the qualified set (3 of 4 have no established offline cell); `PARTIALLY_CONFIRMED` against Odoo (official page: opened records readable, not editable offline) and Hesabfa/Sepidar Cloud (cloud-only) | page reads                         |
| Better localised                                         | `NOT_VERIFIABLE` for rivals                                                                                                                                                                                                    | not examined                       |
| Ahead of Iranian products                                | `NOT_VERIFIABLE`                                                                                                                                                                                                               | EVIDENCE_REQUIRED above            |
| Ahead of Indian products                                 | `NOT_VERIFIABLE`                                                                                                                                                                                                               | only 2–4 cells each for Tally/Busy |
| ~rank 20 globally / ~rank 8 in the target market         | `NOT_VERIFIABLE`                                                                                                                                                                                                               | no global ordering is defensible   |
| The industry registry represents real support            | `REJECTED`                                                                                                                                                                                                                     | N-23, N-24b, N-25                  |
| A service/test/endpoint/UI control proves the capability | `REJECTED`                                                                                                                                                                                                                     | N-04, N-15, N-17, N-20             |
| Hisabche is ahead of QuickBooks Online and Xero          | `NOT_VERIFIABLE` (the earlier "certainly behind" came from search summaries; QBO has 3 and Xero 4 page-read cells)                                                                                                             | withdrawn                          |

## What would complete this gate

Page reads for the remaining cells of the 4 qualified rivals (ERPNext C6/C9, Zoho C2/C6/C9, BC C9/C10), and for SAP, Oracle, Infor, Epicor, Acumatica, Sage, MYOB, QuickBooks, Xero and Exact through a reader that can render their JavaScript portals or from PDFs saved locally; demos for the four Iranian products. Until then the comparison set stays at 4.
