# 00 — MASTER SPECIFICATION: HISABCHE UNIVERSAL BUSINESS OPERATING SYSTEM

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION (Read-Only Specification Phase)  
**Architecture Target**: Universal Business Core v50.50-HIGH  
**Location**: `docs/architecture/universal-business-core/00-MASTER-SPEC.md`

---

## 1. Product Foundations

### 1.1 What is Hisabche?

Hisabche (حسابچه) is a **local-first, multilingual, offline-capable Business Operating System (BOS)** tailored for small, medium, and distributed enterprises across Afghanistan, Iran, and Persian/Dari-speaking markets. It is engineered to unify commercial sales, service delivery, inventory costing, cashbox handling, double-entry general ledger accounting, and multi-tenant workforce management into a single, cohesive engine that functions with 100% fidelity whether an internet connection is present or absent.

### 1.2 What is a Business Operating System (BOS)?

Unlike traditional accounting software (which merely records historic financial data) or basic Point of Sale (POS) terminals (which execute fast sales without balance sheets), a Business Operating System coordinates:

1. **Commercial Operations**: Proposals, sales, orders, deliveries, returns.
2. **Operational Resources**: Physical stock, warehouse bins, human time, service capacity, service packages/credits.
3. **Financial Truth**: Integer minor-unit balances, cash movements, multi-currency isolation, accounts receivable/payable, double-entry journals.
4. **Autonomous Local Execution**: Devices operate as peer nodes holding a verifiable local subset of state, synchronizing deterministically with the PostgreSQL cloud authority.

### 1.3 Key Conceptual Definitions

- **Business Model**: The foundational archetype of revenue generation:
  - `GOODS`: Selling tangible inventory items requiring stock movements and cost-layer tracking.
  - `SERVICES`: Selling human time, expertise, or bookings (no physical inventory deduction).
  - `PACKAGES_MEMBERSHIPS`: Prepaid bundles of service sessions/credits redeemed over time.
  - `MIXED`: Combining physical retail goods with billable services and prepaid packages.
- **Industry Profile**: A descriptive taxonomy and UI terminology preset (e.g., _Automotive Repair_, _Medical Clinic_, _Language Teacher_, _Retail Grocery_).
  > **CANONICAL AXIOM**: An Industry Profile **MUST NEVER** be used as an authorization gate or security boundary. It merely informs default terminology, suggested dashboard widgets, and default capability selections.
- **Capability**: A discrete, verifiable unit of business functionality (e.g., `inventory.batch_tracking`, `service.package_credits`, `accounting.period_lock`, `pos.till_management`). Capabilities can be enabled or disabled per workspace without code modification.
- **Module**: A top-level UI and workflow navigation container (e.g., _Sales_, _Inventory_, _Services_, _Accounting_, _Human Resources_). A Module exposes an M:N relationship with Capabilities.
- **Permission**: Role-based and capability-scoped access controls evaluated at request time (`request.tenancy.role` + `requireCapability(...)`).
- **Feature Flag / Configuration**: Dynamic declarative parameters governing tenant behavior, resolution of active modules, and validation constraints.

---

## 2. Core Architecture Topology

Hisabche strictly implements **One Domain Core, Multiple Execution Adapters**:

```
                  ┌────────────────────────────────────────┐
                  │       Shared Business & Financial      │
                  │               Domain Core              │
                  │   (@hisabche/validation/universal-core) │
                  │                                        │
                  │  • Pure Domain Rules & Validation      │
                  │  • Integer Minor-Unit Financial Math   │
                  │  • FIFO/AVCO Cost Layer Algorithms     │
                  │  • Service Credit Accrual & Redemption │
                  │  • Deterministic State Machines        │
                  │  • Versioned Command Contracts         │
                  └───────────────────┬────────────────────┘
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            ▼                                                   ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│         Local Adapter         │               │        Remote Adapter         │
│   (@hisabche/local-engine)    │               │      (@hisabche/backend)      │
│                               │               │                               │
│ • Local SQLite Execution      │               │ • PostgreSQL Authority        │
│ • Atomic Outbox (sync_queue)  │               │ • Multi-table RPC Transact.   │
│ • Deterministic Clock/ID Port │               │ • Strict Tenancy RLS          │
│ • Bounded Offline Leases      │               │ • Replay / Idempotency Cache  │
└───────────────┬───────────────┘               └───────────────┬───────────────┘
                │                                               │
                └───────────────┐               ┌───────────────┘
                                ▼               ▼
                  ┌────────────────────────────────────────┐
                  │          Unified Sync Engine           │
                  │         (@hisabche/app-shell)          │
                  │                                        │
                  │ • Keyset Snapshot Pulls                │
                  │ • Domain-Routed Push Gate              │
                  │ • Crash Recovery & Retry Exponential   │
                  │ • Three-Tier Conflict Resolution       │
                  └────────────────────────────────────────┘
```

---

## 3. Truth Boundaries & Authority Matrix

To eliminate split-brain financial discrepancies between offline edge devices and cloud instances, Hisabche defines six mutually exclusive **Truth Boundaries**:

| Truth Boundary           | Authority Subsystem           | Authoritative Store                                              | Authority Rule                                                                                                                                                |
| :----------------------- | :---------------------------- | :--------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Commercial Truth**  | Sales & Invoicing Service     | PostgreSQL (`invoices`, `invoice_items`)                         | Agreements on quantities, agreed prices, discounts, and return terms. Server re-derives all lines and never trusts client-sent totals.                        |
| **2. Financial Truth**   | Payment & Settlement Engine   | PostgreSQL (`payments`, `payment_allocations`)                   | Monetary values owed and settled. Integer minor units only. A payment can only settle invoices of the identical currency (`settlesInCurrency`).               |
| **3. Entitlement Truth** | License & Governance Service  | PostgreSQL / Cryptographic Offline License                       | Workspace tier, active seats, authorized modules, and pre-allocated offline authorization leases (limits and expiry).                                         |
| **4. Cash Truth**        | Till & POS Cashbox Engine     | Local Drawer / PostgreSQL (`pos_sessions`, `pos_cash_movements`) | Physical cash counted in drawers. An open till session is single-writer. Variances between expected cash and closing physical counts are immutably preserved. |
| **5. Accounting Truth**  | General Ledger Posting Engine | PostgreSQL (`journal_entries`, `journal_lines`)                  | Double-entry balance: `sum(debits) === sum(credits)` with zero tolerance. Postings into closed fiscal periods are strictly forbidden.                         |
| **6. Operational Truth** | Inventory & Service Delivery  | Warehouse (`product_stock`) / Service Sessions                   | On-hand physical units, serial batches, and redeemed service credits. Local reservations commit atomically with outbox records.                               |

---

## 4. Generality & Extensibility Contract

The Universal Business Core is intentionally designed to support:

- Retail shops, wholesale distribution, pharmacies, hardware stores.
- Language institutes, training centers, tutoring networks.
- Automotive repair, service workshops, beauty salons, clinics.
- Professional consultancies, software/creative agencies, freelancers.

> **RULE OF GENERALITY**: The Language Teacher or Educational Tutor scenario is an active **Validation Characterization Scenario**, not a specialized hardcoded architectural branch. All service offerings, package credits, student/client records, and delivery schedules execute via universal core capabilities.
