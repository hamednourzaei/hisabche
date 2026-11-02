# 04 — CAPABILITY REGISTRY & MODULE MAPPING SPECIFICATION

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/04-CAPABILITY-MODEL.md`

<!-- target-vocabulary -->

> **Vocabulary note (M0, 1 Nov 2026):** commands, events, tables and function names in this document that do not
> exist in the repository are **target** names of a design, not claims about current code.
> `node scripts/audit/verify-spec-references.mjs` keeps checking every file path here.

---

## 1. Governance Axiom

> **CANONICAL SECURITY RULE**:
> **Industry Profile is NEVER an authorization boundary.**  
> Code like `if (workspace.industry === 'education')` is strictly forbidden.  
> Every business operation, route, and UI button is guarded exclusively by:
> `requireCapability('capability.id')` and `requireRole('role')`.

---

## 2. Capability Schema Definition

Every capability registered in the Universal Business Core adheres to the strict schema below:

```typescript
export interface CapabilityDefinition {
  readonly id: string // e.g. 'inventory.warehouses'
  readonly name: string // Human-readable title
  readonly description: string // Business function explanation
  readonly requires: readonly string[] // Pre-requisite capabilities
  readonly implies: readonly string[] // Capabilities automatically activated
  readonly conflicts: readonly string[] // Mutually exclusive capabilities
  readonly modules: readonly string[] // UI modules that expose this capability (M:N)
  readonly commands: readonly string[] // Mutating domain commands enabled
  readonly queries: readonly string[] // Read queries enabled
  readonly permissions: readonly string[] // Minimum required capabilities/roles
  readonly disableBehavior: 'hide' | 'read_only' | 'block_write'
  readonly offlineCompatibility:
    'OFFLINE_FULL' | 'OFFLINE_WITH_SERVER_AUTHORIZATION' | 'ONLINE_REQUIRED'
  readonly version: number
}
```

---

## 3. Core Capability Registry Matrix

| Capability ID                   | Name                        | Description                                                  | Modules (M:N)                | Requires                        | Offline Compatibility                             | Disable Behavior |
| :------------------------------ | :-------------------------- | :----------------------------------------------------------- | :--------------------------- | :------------------------------ | :------------------------------------------------ | :--------------- |
| `commercial.sales_invoicing`    | Sales Invoicing             | Core creation, pricing, and tracking of customer invoices    | `sales`, `pos`               | `party.customers`               | `OFFLINE_FULL`                                    | `block_write`    |
| `commercial.purchasing`         | Supplier Bills & Purchasing | Commercial bills, expense allocations, and AP liabilities    | `purchases`, `inventory`     | `party.suppliers`               | `OFFLINE_FULL`                                    | `block_write`    |
| `commercial.returns_refunds`    | Commercial Returns          | Proportional return docs, deductions, restock/scrap choices  | `sales`, `purchases`         | `commercial.sales_invoicing`    | `OFFLINE_FULL` (Returns) / `AUTH_LEASE` (Refunds) | `block_write`    |
| `offering.physical_inventory`   | Physical Goods & Costing    | Stock tracking, FIFO/AVCO layer depletion, adjustments       | `inventory`, `sales`         | None                            | `OFFLINE_FULL`                                    | `hide`           |
| `offering.service_delivery`     | Billable Services           | Billable human sessions, hourly time, non-inventory services | `services`, `sales`          | None                            | `OFFLINE_FULL`                                    | `hide`           |
| `offering.package_credits`      | Prepaid Package Credits     | Bundled credit ledger, session redemption, deferred revenue  | `services`, `sales`, `crm`   | `offering.service_delivery`     | `OFFLINE_FULL`                                    | `hide`           |
| `financial.double_entry_ledger` | General Ledger Posting      | Balanced debit/credit journal entries, chart of accounts     | `accounting`                 | None                            | `OFFLINE_FULL`                                    | `read_only`      |
| `financial.period_lock`         | Fiscal Period Locking       | Prevents retrospective modifications to closed periods       | `accounting`                 | `financial.double_entry_ledger` | `ONLINE_REQUIRED` (Unlock requires owner)         | `block_write`    |
| `financial.pos_till`            | POS Till & Cashbox          | Cash drawer shifts, cash in/out, variance tracking           | `pos`, `sales`               | None                            | `OFFLINE_FULL`                                    | `hide`           |
| `party.customers`               | Customer Management         | Customer accounts, credit limits, statements, risk           | `crm`, `sales`               | None                            | `OFFLINE_FULL`                                    | `read_only`      |
| `party.suppliers`               | Supplier Management         | Vendor directories, purchase history, AP balances            | `crm`, `purchases`           | None                            | `OFFLINE_FULL`                                    | `read_only`      |
| `workforce.attendance`          | Workforce Attendance        | Employee shift scheduling, clock-in/out, biometric sync      | `hr`                         | None                            | `OFFLINE_FULL`                                    | `hide`           |
| `workforce.payroll`             | Payroll Calculation         | Net salary, bonuses, deductions, and tax calculation         | `hr`, `accounting`           | `financial.double_entry_ledger` | `OFFLINE_FULL`                                    | `block_write`    |
| `operations.manufacturing`      | Manufacturing & BOM         | Work orders, bill of materials, finished goods assembly      | `manufacturing`, `inventory` | `offering.physical_inventory`   | `OFFLINE_FULL`                                    | `hide`           |

---

## 4. Module ↔ Capability M:N Relational Mapping

Modules group capabilities for unified screen navigation without forcing monolith dependencies:

```
[Module: Sales]
  ├── commercial.sales_invoicing
  ├── commercial.returns_refunds
  ├── offering.physical_inventory (optional)
  └── offering.service_delivery   (optional)

[Module: Services]
  ├── offering.service_delivery
  ├── offering.package_credits
  └── party.customers

[Module: Inventory]
  ├── offering.physical_inventory
  └── commercial.purchasing

[Module: POS]
  ├── commercial.sales_invoicing
  ├── financial.pos_till
  └── commercial.returns_refunds

[Module: Accounting]
  ├── financial.double_entry_ledger
  └── financial.period_lock
```

If a business disables `offering.physical_inventory`, the _Inventory_ module is automatically hidden from navigation, and invoice screens hide warehouse/stock columns, while the _Sales_ module remains fully operational for billable services.
