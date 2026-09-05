# Hisabche Architecture Contract Template

> **Purpose:** Every URL, Domain, and Workflow in Hisabche must have a single, explicit contract. This template enforces consistency across UI, Domain Logic, Database, Accounting Effect, Audit, and Sync.

> **Status:** MANDATORY — All new work and refactoring must follow this contract.

---

## Contract Structure (8 Sections)

### 1. PURPOSE

**One-sentence definition of what this feature exists to do.**

Example:

> `/invoices` exists to create, view, edit, and manage sales and purchase invoices as the single entry point for all AR/AP transactions.

---

### 2. JOBS TO BE DONE (JTBD)

**List of user jobs this feature enables (max 8).**

Format:

- [Job 1]
- [Job 2]
- ...

---

### 3. DATA SHOWN (Read Model)

**Exact list of data entities and fields visible to the user.**

Must specify:

- Entity name
- Fields displayed (with source table/column)
- Computed/derived fields (with formula)
- Filters available
- Sort options

**Source of Truth reference:** Every field must trace back to a table in Section 6.

---

### 4. ACTIONS (Write Model)

**All mutating actions the user can perform.**

Format:

```
Action Name
  → Domain Command
  → Input Schema
  → Preconditions
  → Postconditions
  → Accounting Effect (if any)
  → Inventory Effect (if any)
  → Audit Event
  → Outbox Event
```

---

### 5. SOURCE OF TRUTH

**The single authoritative table/column for each data concept.**

Example:

| Concept        | Source of Truth                | Projection/Read Model         |
| -------------- | ------------------------------ | ----------------------------- |
| Customer       | `parties` + `customer_profile` | `customers` view              |
| Invoice Status | `invoices.status`              | Derived from settlement state |
| Inventory Qty  | `stock_movements`              | `stock_balances` (projection) |

**Rule:** Never store mutable truth in a derived table. Projections are read-only.

---

### 6. DATABASE TABLES

**Complete list of tables this feature touches (read + write).**

For each table:

- Table name
- Primary key
- Foreign keys (with cascade rules)
- RLS policy (workspace_id filter)
- Columns used by this feature

---

### 7. WORKFLOW

**State machine or sequence diagram of the business process.**

Format (state machine):

```
State A
  → [Action X] → State B
  → [Action Y] → State C

State B
  → [Action Z] → State D (terminal)
```

Or (sequence):

```
User Action
  ↓
Domain Command (validation + authorization)
  ↓
Database Transaction (atomic)
  ↓
  ├─ Domain Record (e.g., invoice)
  ├─ Accounting Effect (journal entry)
  ├─ Inventory Effect (stock movement)
  ├─ Audit Event
  └─ Outbox Event (for sync)
  ↓
Sync Queue → Other Devices
  ↓
Conflict Detection (if offline)
  ↓
Resolution
```

---

### 8. CROSS-DOMAIN EFFECTS

**All side effects that cross domain boundaries.**

Must include:

- **Accounting Effect:** Journal entry template (debit/credit accounts, dimensions)
- **Inventory Effect:** Stock movement type, valuation impact
- **Audit Event:** Event type, entity, before/after snapshot
- **Sync Scope:** Which tables are queued for sync
- **Permission Check:** Required capability/role

---

## Contract Enforcement Rules

1. **No feature exists without a contract.** If a URL or domain lacks a contract, it is UNDEFINED and must be blocked.

2. **Source of Truth is immutable.** If the contract says `stock_movements` is the Source of Truth for inventory, no code path may write directly to `stock_balances`.

3. **Workflow must be deterministic.** Given the same input state, the same action must produce the same output state (including accounting and audit).

4. **Every mutation creates an Audit Event.** No exceptions. Audit is append-only.

5. **Cross-domain effects are explicit.** If an Invoice creates a Journal Entry, the contract must show the exact journal lines (not "creates accounting").

---

## Example: `/invoices` Contract (Summary)

| Section             | Content                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**         | Single workspace for creating, viewing, editing, and settling sales and purchase invoices.                                                                          |
| **JTBD**            | Create draft invoice → Post invoice → Allocate payment → View outstanding → Export for audit                                                                        |
| **Data Shown**      | Invoice #, Customer/Supplier, Type (Sales/Purchase), Date, Due Date, Total, Paid, Outstanding, Status (Draft/Open/Paid/Overdue), Actions                            |
| **Actions**         | Create Invoice → Post Invoice → Cancel Invoice → Allocate Payment → Export PDF/CSV                                                                                  |
| **Source of Truth** | `invoices` + `invoice_lines` + `payments` + `payment_allocations`                                                                                                   |
| **DB Tables**       | `invoices`, `invoice_lines`, `invoice_taxes`, `invoice_discounts`, `payments`, `payment_allocations`, `credit_notes`, `journal_entries`, `journal_lines`            |
| **Workflow**        | Create (Draft) → Approval? → Post (AR Journal) → Payment Allocation → Settlement State Update → Audit + Outbox                                                      |
| **Cross-Domain**    | Accounting: AR Journal on Post; Inventory: COGS on Sales Shipment (via stock_movements); Audit: CREATE/POST/CANCEL/PAY; Sync: `invoices`, `payments`, `allocations` |

---

## Status Legend

| Status             | Meaning                                     |
| ------------------ | ------------------------------------------- |
| `NOT STARTED`      | Contract not written                        |
| `DRAFT`            | Contract written, not reviewed              |
| `REVIEWED`         | Contract reviewed, no blockers              |
| `IMPLEMENTED`      | Code matches contract                       |
| `VERIFIED`         | Tests + manual verification against live DB |
| `PRODUCTION-READY` | Deployed + observed in production           |

---

**Next Step:** Create individual contract files for each Canonical URL listed in Section 67 of the master architecture document.

**Canonical URLs (from master plan):**

```
/dashboard
/sales-workspace
/invoices
/customers
/crm
/sales-followup
/till
/inventory-workspace
/warehouse
/purchasing
/expiry
/manufacturing
/accounting-workspace
/accounting
/accounting?tab=journal
/accounting?tab=trialBalance
/accounting?tab=balanceSheet
/accounting?tab=incomeStatement
/bank
/budgets
/assets
/people-workspace
/team-and-payroll
/timesheets
/permissions
/approvals
/workflow-templates
/activities
/data-and-sync
/sync-center
/conflicts
/data-migration
/settings
```

**Alias/Deprecated (redirect to canonical):**

- `/human-resources` → `/team-and-payroll`
- `/customer-list` → `/customers`
- `/product-list` → `/warehouse` (or Product Catalog)

---

**End of Template**
