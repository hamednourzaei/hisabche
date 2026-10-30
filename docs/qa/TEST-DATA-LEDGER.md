# Hisabche QA Phase 2 — Test Data Ledger

**Test Run Dates:** 2026-10-28 & 2026-10-29  
**Target Environment:** `https://hisabche.com` (Live browser session via Antigravity CDP Port 64571)  
**Authorized Test Workspace:** `lolokhan` (`3f19d3ca-b024-4565-b5e3-47a078585c72`)  
**Base Books Currency:** `AFN`  
**Data Prefix Convention:** All test records created in this session are strictly prefixed with `QA-2026-10-28-` or `QA-2026-10-29-`.

---

## 1. Baseline Pre-Write Snapshot (2026-10-28 & 2026-10-29)

Before executing write operations in this workspace, the starting financial and inventory states were recorded from `/en/dashboard`:

| Metric / Entity           | Baseline Value                                  | Scope / Screen              | Verification Source               |
| ------------------------- | ----------------------------------------------- | --------------------------- | --------------------------------- |
| **Total Sales**           | `571,449,700 AFN`                               | Lifetime Workspace          | `/en/dashboard` KPI Card          |
| **Sales (Last 7 Days)**   | `130,080 AFN`                                   | 10/22/2026 – 10/28/2026     | `/en/dashboard` KPI Card          |
| **Customer Debt**         | `130,000 AFN`                                   | Receivable Subledger        | `/en/dashboard` & `/en/customers` |
| **Warehouse Value**       | `150 AFN`                                       | Primary Warehouse Inventory | `/en/dashboard` & `/en/warehouse` |
| **Active Cashbox / Till** | 1 Active Drawer (`AFN`)                         | Till Hub                    | `/en/till`                        |
| **Chart of Accounts**     | Standard Chart (1010 Cash, 1020 AR, 4010 Sales) | General Ledger              | `/en/accounting`                  |

---

## 2. Test Data Record Ledger

| Record Type                   | Identifier / Name                                              | Creation Route             | Created At (UTC)     | Delta / Values                                             | Cleanup Status        | Verification Notes                                                                                                                                                    |
| ----------------------------- | -------------------------------------------------------------- | -------------------------- | -------------------- | ---------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _Initialization_              | Baseline Snapshot                                              | `/en/dashboard`            | 2026-10-29T13:28:00Z | Baseline logged                                            | `BASELINE`            | Pre-write state established                                                                                                                                           |
| **Customer (Batch 1)**        | `QA-2026-10-29-Cust1` (`2e39f4a3-329b-4993-a433-2ae59de40746`) | `/en/customers`            | 2026-10-29T12:31:39Z | Balance: 0 AFN, Role: Buyer                                | `RETAINED_BY_DESIGN`  | Created via Add Customer dialog, verified in list and search filter (`batch1-search-filter.png`). Linked to INV-000101.                                               |
| **Supplier (Batch 1)**        | `QA-2026-10-29-Supp1`                                          | `/en/customers`            | 2026-10-29T12:32:15Z | Balance: 0 AFN, Role: Seller                               | `PENDING_OR_RETAINED` | Created via Add Customer dialog (Role: Supplier), verified in Supplier tab (`batch1-supplier-tab-verified.png`).                                                      |
| **Product (Batch 2)**         | `QA-2026-10-29-Prod1` (Barcode: `QA-BAR-20261029-01`)          | `/en/warehouse?add=true`   | 2026-10-29T18:05:40Z | Qty: 20, Buy: 50 AFN, Sell: 80 AFN                         | `RETAINED_BY_DESIGN`  | Created via AddProductModal. Verified in Products list (`batch2-03-product-verified-in-list.png`). Dashboard Warehouse Value delta: 150 AFN → 1,150 AFN (+1,000 AFN). |
| **Sales Invoice (Batch 3)**   | `INV-000101` (`23e12bdd-0895-4b91-afc7-930605966296`)          | `/en/invoices/new/preview` | 2026-10-29T19:32:45Z | Line: 2 × 80 = 160 AFN, Paid: 160 AFN cash                 | `RETAINED_BY_DESIGN`  | Created with submissionKey idempotency. Posted ledger entry `JV-2026-000051`. Till cash increased by 160 AFN. Bell notification pushed.                               |
| **Customer (Phase 1)**        | `QA-2026-10-28-Cust1`                                          | `/en/customers`            | 2026-10-28T17:00:21Z | Phone `0701234567`, Opening balance 0                      | `PENDING_OR_RETAINED` | Created via Add Customer dialog. Empty validation triggered B4 (`customer.nameRequired`).                                                                             |
| **Supplier (Phase 1)**        | `QA-2026-10-28-Supp1`                                          | `/en/customers`            | 2026-10-28T17:00:26Z | Seller role, Opening balance 0                             | `PENDING_OR_RETAINED` | Created via Add Customer dialog (Role: Seller).                                                                                                                       |
| **InvoiceDraft (Phase 1)**    | `QA-2026-10-28-InvDraft1`                                      | `/en/invoices/new`         | 2026-10-28T17:00:40Z | Line item `QA-2026-10-28-Item1`, Qty 2, Unit Price 150 AFN | `RETAINED_BY_DESIGN`  | Saved as draft. Does not post to general ledger or alter cash balances until finalized.                                                                               |
| **Till Audit (Phase 1)**      | `QA-2026-10-28-TillAudit`                                      | `/en/till`                 | 2026-10-28T17:00:45Z | Audited active drawer `صندوق تست`                          | `RETAINED_BY_DESIGN`  | Read drawer balance and status. Closing drawer forbidden on live without physical cash count.                                                                         |
| **Sync Emulation (Phase 1)**  | `QA-2026-10-28-CDP-Offline`                                    | `/en/sync-center`          | 2026-10-28T17:00:50Z | CDP offline/online condition toggled                       | `CLEANED`             | Network connection restored to online immediately after screenshot capture.                                                                                           |
| **Backup / Export (Phase 1)** | `QA-2026-10-28-BackupExport`                                   | `/en/data-and-sync`        | 2026-10-28T17:00:55Z | Export metadata read                                       | `CLEANED`             | Verified sync center and export controls without corrupting workspace backup storage.                                                                                 |

---

## 3. Cleanup & Retention Protocol

- **Temporary / Unlinked Records:** Archived, voided, or deleted via the application's supported UI flows where supported.
- **Financial / Ledger Entities:** Invoices and posted journal entries with ledger history are marked `RETAINED_BY_DESIGN` as the system intentionally forbids hard deletion of posted financial lines to protect accounting integrity.
- **Pre-existing Data Integrity:** No pre-existing customer, product, invoice, or till drawer was altered or deleted during this test run.
