---
name: hisabche-accounting-reconciliation
description: Use when implementing or auditing trial balance, general ledger, customer/supplier balances, bank/cash reconciliation, period close, financial reports, or comparing operational records with accounting entries.
---

# Hisabche Accounting Reconciliation

## Purpose

Make every financial report reproducible from canonical source records and posted accounting evidence. Reconciliation detects disagreement; it must not silently repair or hide it.

## Mandatory reading and discovery

1. Read `AGENTS.md`.
2. Read `.claude/accounting-integrity/00-SPEC.md`.
3. Read `.claude/db-integrity/00-SPEC.md`.
4. Locate the single canonical report service and account balance implementation.
5. Search for duplicate formulas in UI, API, analytics, AI summaries and exports. Reuse the canonical domain result.

## Report integrity rules

- A report must declare its date basis, period boundaries, currency, timezone and inclusion rules.
- Never combine balances across currencies.
- Never interpret query failure, missing row, missing cost layer or incomplete import as zero.
- Distinguish debit balance, credit balance and abnormal balance. Do not encode account nature solely as a signed number if the report contract uses explicit sides.
- Trial balance equality is necessary but not sufficient evidence of correct classification, completeness or source linkage.
- Include unposted source documents and last successful ledger update when the domain contract supports it.
- Report incomplete/unknown values explicitly; do not render a misleading total.
- Reconcile operational invoices/payments/stock with posted journal entries using stable source identity.
- Reconciliation is read-only by default. Any correction must be a separate authorized and auditable command.

## Reconciliation dimensions

- Source document ↔ journal entry.
- Payment ↔ allocations ↔ receivable/payable ↔ journal.
- Inventory movement ↔ cost layer receipt/consumption ↔ COGS journal.
- Opening balances ↔ explicit opening source and journal.
- Cash/bank statement ↔ recorded cash/bank movements.
- Workspace and currency consistency.
- Period cutoff and timezone consistency.
- Reversal/refund ↔ original event.
- Offline local mutation ↔ server-accepted mutation and final canonical state.

## Period close

Do not invent a close workflow if one is not present. First inspect current period/date/accounting state model. A robust close generally needs:

- explicit period status and authorized close/reopen transitions;
- cutoff validation for late and backdated transactions;
- unresolved source-to-ledger exceptions;
- unvalued inventory and unknown COGS exceptions;
- foreign-currency revaluation policy if supported;
- closing journal and retained audit evidence;
- immutable closed-period behavior and controlled reopen;
- repeatable close report snapshot or deterministic regeneration.

Every item above is a design checklist, not a claim that Hisabche currently implements it. Owner approval is required for accounting policy choices.

## Required tests

- Debit and credit sides and totals are consistent.
- Filter boundaries are correct at start/end of period and timezone edges.
- No cross-currency aggregation.
- Missing records remain missing/unknown, not zero.
- Duplicate source documents are detected.
- Unposted, reversed and voided records are treated according to explicit policy.
- Operational source and journal mismatch is surfaced.
- Reconciliation is read-only and deterministic.
- A correction requires authorization, reason and audit.
- Report totals agree with canonical ledger query and UI formatting.
- CSV/export matches on-screen semantics.

## Output

Provide:
1. Reconciliation equation and source set.
2. Exceptions grouped by severity and owner.
3. Exact SQL/query or test evidence.
4. Whether report is complete, partial or unknown.
5. No auto-fix unless explicitly authorized.
