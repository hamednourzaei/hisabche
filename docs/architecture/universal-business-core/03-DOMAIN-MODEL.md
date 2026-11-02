# 03 — UNIVERSAL DOMAIN MODEL & AGGREGATE BOUNDARIES

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/03-DOMAIN-MODEL.md`

<!-- target-vocabulary -->

> **Vocabulary note (M0, 1 Nov 2026):** commands, events, tables and function names in this document that do not
> exist in the repository are **target** names of a design, not claims about current code.
> `node scripts/audit/verify-spec-references.mjs` keeps checking every file path here.

---

## 1. Domain Separation: Shared Core vs. Optional Operational Domains

To guarantee extreme maintainability and prevent domain bloat, entities are strictly partitioned:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   SHARED BUSINESS & FINANCIAL CORE                     │
│  (Mandatory for all business models — Retail, Services, Education)     │
│                                                                        │
│  • Party (Customer, Supplier, Student, Client)                         │
│  • Offering (Physical Item, Billable Service, Prepaid Package)         │
│  • Commercial Document (Invoice, Bill, Quotation, Return)              │
│  • Payment & Allocation (Receipt, Payout, Debt Settlement)             │
│  • Cashbox & Till (Drawer Session, Cash Movement, Variance)            │
│  • Double-Entry Ledger (Journal Entry, Journal Line, Period Lock)      │
│  • Package Credit Ledger (Prepaid Credits, Redemption, Expiry)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Extended by Capabilities
┌───────────────────────────────────┴────────────────────────────────────┐
│                    OPTIONAL OPERATIONAL DOMAINS                        │
│  (Activated dynamically via Capabilities — zero core pollution)        │
│                                                                        │
│  • Physical Warehousing & Cost Layers (FIFO/AVCO, Bins, Transfers)     │
│  • Service Delivery Sessions (Practitioner, Attendance, Delivery Room) │
│  • Manufacturing & BOM (Work Orders, Assembly Runs, Output Layers)     │
│  • Automotive Fitments & Vehicle Specs                                 │
│  • Gold & Jewellery Karat / Weight Attributes                          │
│  • Warranty & Serial Batch Tracking                                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Aggregate Roots Specification

### 2.1 Offering Aggregate (Unified Goods / Services / Packages)

- **Owner**: Commercial Sales & Service Domain
- **Identity**: UUID (`offeringId`), unique per `workspaceId`
- **Offering Types**:
  - `goods`: Physical stock requiring cost layers and warehouse movements.
  - `service`: Non-tangible deliverable measured in hours, sessions, or tasks.
  - `package`: Bundled offering of $N$ prepaid service credits or goods allocations.
- **Lifecycle**: `draft` $\rightarrow$ `active` $\rightarrow$ `archived`
- **Commands**: `CreateOffering`, `UpdateOffering`, `ArchiveOffering`, `AdjustPricing`
- **Queries**: `GetOfferingById`, `ListOfferings(filters)`, `SearchOfferings`
- **Events**: `OfferingCreated`, `OfferingUpdated`, `OfferingArchived`
- **Invariants**:
  - Sell price must be an integer minor unit $\ge 0$.
  - When `type === 'service'`, physical inventory validation is bypassed.
  - When `type === 'package'`, `packageDetails` (total credits, credit unit, valid days) must be present.
- **Persistence**: SQLite `product` / Postgres `products` (extended with `offering_type` and `package_details`).
- **Offline Behavior**: Full local creation and editing; queues domain push.
- **Remote Validation**: Re-validates price integrity and workspace uniqueness.
- **Audit**: Logged in business event stream with actor and device ID.

---

### 2.2 Commercial Invoice Aggregate

- **Owner**: Sales & Revenue Domain
- **Identity**: UUID (`invoiceId`), unique per `workspaceId`
- **Lifecycle**: `draft` $\rightarrow$ `issued` $\rightarrow$ `partially_paid` $\rightarrow$ `paid` $\rightarrow$ `voided` $\rightarrow$ `returned`
- **Commands**: `CreateInvoice`, `IssueInvoice`, `VoidInvoice`, `ApplyReturn`
- **Queries**: `GetInvoiceById`, `ListInvoices`, `GetInvoiceFinancialSummary`
- **Events**: `InvoiceIssued`, `InvoicePaid`, `InvoiceVoided`, `InvoiceReturned`
- **Invariants**:
  - Double-entry integrity: All line items sum to subtotal; tax and discount apply deterministically.
  - A paid or voided invoice cannot have its lines edited.
  - An invoice with active returns cannot be voided.
- **Persistence**: SQLite `invoice`, `invoice_item` / Postgres `invoices`, `invoice_items`.
- **Offline Behavior**: Issued locally; atomically reserves physical stock or redeems package credits; queued with stable idempotency key.
- **Remote Validation**: Server recalculates every line item; never trusts client totals.

---

### 2.3 Package Credit Ledger Aggregate

- **Owner**: Service Delivery & Deferred Revenue Domain
- **Identity**: UUID (`packageCreditId`), unique per `workspaceId`
- **Lifecycle**: `active` $\rightarrow$ `exhausted` $\rightarrow$ `expired` $\rightarrow$ `cancelled`
- **Commands**: `IssuePackageCredit`, `RedeemCredit`, `ExtendExpiry`, `CancelCredit`
- **Queries**: `GetCreditBalance(partyId)`, `ListActiveCredits`, `GetCreditHistory`
- **Events**: `PackageCreditIssued`, `CreditRedeemed`, `CreditExpired`, `CreditCancelled`
- **Invariants**:
  - `remainingCredits = totalCredits - sum(redeemedCredits)`.
  - `remainingCredits` cannot be negative.
  - Redemption after `expiresAt` is rejected unless extended by manager/owner.
  - Revenue recognition: Credited amount moves from _Unearned Revenue_ (liability) to _Service Revenue_ (income) proportionally per redemption.
- **Persistence**: SQLite `package_credit`, `package_credit_ledger` / Postgres `package_credits`, `package_credit_ledger`.
- **Offline Behavior**: Deducts local credit balance atomically when recording a delivered service session; queued to outbox.
- **Remote Validation**: Server validates remaining balance against authoritative credit ledger.

---

### 2.4 Payment & Allocation Aggregate

- **Owner**: Cash & Financial Settlement Domain
- **Identity**: UUID (`paymentId`), unique per `workspaceId`
- **Lifecycle**: `recorded` $\rightarrow$ `allocated` $\rightarrow$ `voided`
- **Commands**: `RecordPayment`, `AllocatePayment`, `VoidPayment`
- **Invariants**:
  - Currency isolation: Payment in currency $C$ can only allocate against invoices in currency $C$.
  - Allocations cannot exceed the payment amount or remaining invoice balance.
  - Cash payments must bind to an open till session if POS capability is active.
- **Persistence**: SQLite `payments`, `payment_allocations` / Postgres `payments`, `payment_allocations`.
- **Offline Behavior**: Cash/bank payment recorded locally; reduces customer debt on device.
- **Remote Validation**: Server verifies customer account balance and invoice outstanding amounts.
