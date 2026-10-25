# Comprehensive Business Rules Audit (AUDIT.md)

This audit documents the authoritative location of every business rule across the repository (backend, web, desktop, mobile, and local engine). It notes duplicates, divergences, behavioral variations, and characterization tests.

---

## 1. Domain: Invoice Math, Discounts, Taxes & Totals

### Locations

- **Shared Canonical Core**: `packages/validation/src/schemas/invoice-grid.ts`, `packages/validation/src/schemas/invoice-math.ts`.
- **Backend Service Adapter**: `backend/src/services/invoice.service.ts` (imports and calls validation logic; converts between `numeric` major units and minor integer units).
- **Device Engine**: `packages/local-engine/src/routes/sales-side.ts`, `packages/local-engine/src/routes/invoice-ops.ts`.
- **Client UI Form Calculation**: `packages/ui/src/components/ui/invoice-builder/hooks/use-invoice-grid.ts` (directly invokes pure functions from `@hisabche/validation`).

### Behavior & Divergence Analysis

- **Rule**:
  `lineTotal = (qty * unitPriceMinor) - discountMinor`  
  `invoiceSubtotal = sum(lineTotal)`  
  `invoiceDiscount = applyDiscount(invoiceSubtotal, discountRate, discountType)`  
  `invoiceTax = applyTax(invoiceSubtotal - invoiceDiscount, taxRate)`  
  `invoiceTotal = invoiceSubtotal - invoiceDiscount + invoiceTax`
- **Observed Divergences**:
  1. _Unit Discrepancy_: Postgres stores `numeric(12, 2)` (major units like `10.50`), whereas local-engine SQLite stores `INTEGER` (minor units like `1050`). `OpenInvoice` types historically used major unit floats.
  2. _Line Tax vs. Invoice Tax (BUG-136)_: Older backend handlers accepted line-level tax but only stored invoice-level tax aggregate. Current core supports both via `computeInvoiceLines` and `computeInvoiceMoney`.
- **Characterization Tests**:
  - `packages/validation/src/__tests__/invoice-grid.test.ts` (39 tests: line calculation, discounts, zero quantity, custom units).
  - `packages/validation/src/__tests__/invoice-math.parity.test.ts` (23 tests: asserts identical rounding and arithmetic between client and server).
  - `backend/src/__tests__/invoice-derived-money.test.ts` (asserts server never trusts client-sent totals; re-derives from lines).

---

## 2. Domain: Stock Movements & Inventory Costing (FIFO / AVCO)

### Locations

- **Shared Canonical Core**: `packages/validation/src/schemas/costing.domain.ts`.
- **Backend Service**: `backend/src/services/inventory-costing/costing.service.ts` (re-exports from validation via `costing.domain.ts`), `stock-count.domain.ts`, `transfer.domain.ts`.
- **Device Engine**: `packages/local-engine/src/routes/costing.ts`, `packages/local-engine/src/routes/inventory.ts`.
- **UI Components**: `packages/ui/src/components/ui/warehouse/costing-method-picker.tsx`.

### Behavior & Divergence Analysis

- **Rules**:
  1. _Layer Depletion_: FIFO sorts layers ascending by date/seq; AVCO calculates weighted average `totalCost / totalRemainingUnits`.
  2. _Unknown is Not Zero_: If a sold item has no cost layers, unit cost and profit MUST be `null` (`CostStatus = 'cost_unknown'`), NEVER `0`. A zero-cost layer is a distinct known zero (`CostStatus = 'cost_known'`).
  3. _Negative Stock Policy_: Governed by `NegativeStockPolicy` (`'refuse' | 'warn' | 'allow'`).
- **Observed Divergences**:
  - In backend Postgres, cost consumption was historically written through triggers or `costing.service.ts` RPCs; in local SQLite, `packages/local-engine/src/routes/costing.ts` writes directly to `cost_layer` and `cost_consumption` tables. The pure calculation function `planConsumption` in `@hisabche/validation` is now shared by both.
- **Characterization Tests**:
  - `packages/validation/src/__tests__/costing-rule.test.ts` (19 tests asserting FIFO order, AVCO weighting, layersValue, onHand).
  - `backend/src/__tests__/cost-unknown-is-not-zero.test.ts` (asserts missing cost yields `null` profit).
  - `packages/local-engine/src/__tests__/costing.test.ts` (asserts local SQLite layer consumption matches canonical rule).

---

## 3. Domain: Payments, Allocations & Till (POS)

### Locations

- **Shared Canonical Core**: `packages/validation/src/schemas/payments.domain.ts`, `packages/validation/src/schemas/installment.domain.ts`.
- **Backend Service**: `backend/src/services/payments/payments.service.ts`, `backend/src/services/pos/pos.service.ts`.
- **Device Engine**: `packages/local-engine/src/routes/sales-side.ts`, `packages/local-engine/src/routes/till.ts`.
- **Client UI**: `packages/app-shell/src/features/sales/till-page.tsx`.

### Behavior & Divergence Analysis

- **Rules**:
  1. _Currency Isolation_: A payment in currency X can only settle an invoice in currency X (`settlesInCurrency`). Outstanding balances are never summed across different currencies.
  2. _Till Session Close_: Expected cash = `opening_float + cash_sales + cash_in - cash_out`. Discrepancy is recorded as variance. A closed till session is immutable.
  3. _Over-allocation_: Allocations can never exceed payment amount or remaining invoice balance.
- **Characterization Tests**:
  - `packages/validation/src/__tests__/payments-rule.test.ts` (28 tests: allocations, currency matching, overpay guards).
  - `backend/src/__tests__/payments-ar-ap-rules.test.ts` (asserts AR/AP boundary isolation).
  - `packages/local-engine/src/__tests__/till.test.ts` (7 tests: till opening, transactions, shift closing, variance calculation).

---

## 4. Domain: General Ledger Postings & Accounting Rules

### Locations

- **Shared Canonical Core**: `packages/validation/src/schemas/accounting.domain.ts`, `packages/validation/src/schemas/accounting.reports.ts`, `packages/validation/src/schemas/invoice-posting.domain.ts`.
- **Backend Service**: `backend/src/services/accounting/ledger.port.ts`, `accounting.service.ts`.
- **Device Engine**: `packages/local-engine/src/routes/local-ledger.ts`.
- **UI Components**: `packages/ui/src/components/ui/accounting/`.

### Behavior & Divergence Analysis

- **Rules**:
  1. _Double-entry Balance_: `sum(debits) === sum(credits)` in integer minor units. No epsilon/slack tolerance.
  2. _Natural Balances_: Assets/Expenses debit-positive; Liabilities/Equity/Revenue credit-positive (`naturalBalance`).
  3. _Period Lock_: Disallow posting into periods where `lock_date >= entry.date`.
  4. _Idempotency_: Re-posting the same document (`source_type + source_id`) returns the existing `journal_entry.id`.
- **Characterization Tests**:
  - `packages/validation/src/__tests__/ledger-rule.test.ts` (28 tests: balancing, period lock evaluation, line reversals).
  - `backend/src/__tests__/reversal-ledger.test.ts` (proves multi-table posting integrity and reversal safety).
  - `packages/local-engine/src/__tests__/one-financial-engine.test.ts` (proves local ledger matches backend ledger schema).

---

## 5. Domain: Payroll & Human Resources

### Locations

- **Shared Canonical Core**: `packages/validation/src/schemas/payroll-rules.ts`, `packages/validation/src/schemas/human-resources.schema.ts`.
- **Backend Service**: `backend/src/services/human-resources.service.ts`.
- **Device Engine**: `packages/local-engine/src/routes/people.ts`.

### Behavior & Divergence Analysis

- **Rules**:
  `netSalary = baseSalary + bonuses + (overtimeHours * overtimeRate) - deductions - taxAmount`  
  `isPayrollFinal`: A draft payroll can transition to `paid` or `cancelled`; a finalized payroll (`status === 'paid'`) is strictly immutable.
- **Characterization Tests**:
  - `packages/ui/src/__tests__/payroll-outcome.test.ts` (asserts lifecycle status transitions).
  - `backend/src/__tests__/payroll-ledger.test.ts` (asserts salary expense, tax withholding, and bank payout entries).
  - `packages/local-engine/src/__tests__/people.test.ts` (14 tests: employee records, payroll calculation on SQLite).

---

## 6. Domain: Permissions, Roles & Segregation of Duties (SoD)

### Locations

- **Shared Canonical Core**: `packages/validation/src/schemas/feature-registry.ts`, `packages/validation/src/schemas/offline-endpoint-matrix.ts`.
- **Backend Service**: `backend/src/services/authorization/authorization.domain.ts`, `sod.domain.ts`, `role-capabilities.service.ts`.
- **Device Engine**: Role checks enforced via local tenancy context and `offline-license.ts`.

### Behavior & Divergence Analysis

- **Rules**:
  1. _Role Hierarchy_: `owner > manager > seller`.
  2. _Field Masking_: Seller role has `RESTRICTED_FIELDS` (`buy_price`, `unit_cost`, `margin`, `profit`) stripped on queries.
  3. _SoD Enforcement_: A user who creates an invoice or collects cash cannot unilaterally delete or reverse it without manager/owner approval.
- **Characterization Tests**:
  - `packages/validation/src/__tests__/workspace-member.test.ts` (role capabilities and workspace scoping).
  - `backend/src/__tests__/authorization-rules.test.ts` (25 capabilities verified against role hierarchy).
  - `backend/src/__tests__/seller-field-masking.test.ts` (proves restricted fields never reach seller clients).

---

## Summary of Rule Migration Status

All pure mathematical, accounting, and lifecycle rules have been centralized in `packages/validation/src/schemas/`. Backend service files and local-engine routes act as I/O and persistence adapters around these single-source-of-truth functions. No divergent arithmetic implementations remain.
