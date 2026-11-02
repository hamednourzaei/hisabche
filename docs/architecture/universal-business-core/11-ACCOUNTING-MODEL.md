# 11 — GENERAL LEDGER & DOUBLE-ENTRY ACCOUNTING SPECIFICATION

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/11-ACCOUNTING-MODEL.md`

---

## 1. Double-Entry Accounting Invariants

1. **Strict Line Balance Invariant**:
   Every journal entry must satisfy:
   $$\sum \text{Debits} \equiv \sum \text{Credits}$$
   in exact integer minor units. Zero tolerance / no floating-point epsilon.
2. **Canonical Posting Gateway**:
   Application services **NEVER** insert raw rows into `journal_lines`. All postings must pass through `ledger.postDocument` or the atomic Postgres posting procedure.
3. **Fiscal Period Lock Invariant**:
   Posting into or editing a date where $\text{entryDate} \le \text{lockDate}$ is strictly refused with `PERIOD_LOCKED`.
4. **Idempotent Re-posting**:
   Re-posting an already posted document (`sourceType + sourceId`) returns the existing `journalEntryId` without creating duplicate ledger rows.

---

## 2. Standard Chart of Accounts (COA) Mapping

| Account Code | Account Name                | Type      | Natural Balance | Automated Triggers                                    |
| :----------- | :-------------------------- | :-------- | :-------------- | :---------------------------------------------------- |
| `1010`       | Cash Drawer / Till          | Asset     | Debit           | Cash sales, cash refunds, till float movements        |
| `1020`       | Bank Accounts               | Asset     | Debit           | Wire transfers, card settlements, bank payouts        |
| `1200`       | Accounts Receivable (AR)    | Asset     | Debit           | Credit sales, invoice issuance, customer debt         |
| `1300`       | Physical Inventory          | Asset     | Debit           | Purchase receipt, COGS inventory deduction            |
| `2010`       | Accounts Payable (AP)       | Liability | Credit          | Purchase bills, supplier debt, raw material receipts  |
| `2150`       | Unearned / Deferred Revenue | Liability | Credit          | Sale of prepaid service packages / membership credits |
| `2200`       | Sales Tax Payable           | Liability | Credit          | Tax collected on sales invoices                       |
| `4010`       | Product Sales Revenue       | Revenue   | Credit          | Invoices for physical goods                           |
| `4020`       | Service Delivery Revenue    | Revenue   | Credit          | Invoices for direct services or credit redemptions    |
| `5010`       | Cost of Goods Sold (COGS)   | Expense   | Debit           | Realized cost layer value of sold inventory           |
| `5020`       | Restocking Fee Income       | Revenue   | Credit          | Deductions kept by shop on returns                    |
