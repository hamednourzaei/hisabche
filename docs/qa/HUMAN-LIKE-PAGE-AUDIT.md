# Hisabche QA — Human-Like Page Audit & Source-of-Truth Traces (Phase 1 & Phase 2)

**Audit Run:** Phase 1 & Phase 2 (Write-Enabled Test Workspace `lolokhan`)  
**Auditor Mode:** Human-Like Business Operator (Store Owner & Accountant Perspective)  
**Session Details:** Antigravity Internal Chromium Webview (CDP Port 64571)

---

## 1. Inventory Metric Source-of-Truth Trace (Mandatory 7-Step Analysis)

### Question: Why did the dashboard display stock as "150 AFN" instead of a raw unit count?

1. **Supplying Hook / Endpoint:**
   - On `/en/dashboard`, the KPI card is fed by `useDashboardSummary()` (`packages/api/src/hooks/dashboard.ts`), which calls `GET /api/dashboard/summary`.
   - On `/en/invoices/new` (invoice line item picker), items are fetched via `useProductSearch()` calling `GET /api/products`.
   - On `/en/warehouse`, inventory is loaded via `useWarehouseOverview()` calling `GET /api/warehouses/overview`.

2. **Underlying Database Table & Query:**
   - The dashboard card reads the financial valuation aggregate from `stock_movements` and `products`:
     ```sql
     SELECT COALESCE(SUM(p.buy_price * sm.balance), 0) AS total_inventory_value
     FROM products p
     JOIN (
       SELECT product_id, SUM(quantity) as balance
       FROM stock_movements
       WHERE workspace_id = $1
       GROUP BY product_id
     ) sm ON sm.product_id = p.id
     WHERE p.workspace_id = $1;
     ```
   - In contrast, product list queries retrieve `quantity` directly from `products.quantity` or `stock_balances.quantity`.

3. **Warehouse / Branch Scope:**
   - The dashboard KPI aggregates across the **entire business workspace** (`Whole business`).
   - The warehouse hub displays either total inventory valuation or warehouse-scoped stock depending on the active filter.

4. **Document Statuses Included:**
   - Finalized invoices (`posted`), stock receipts, and manual adjustments are included.
   - Draft documents and voided transactions are strictly excluded.

5. **Storage Layer / Caching:**
   - Dashboard data is retrieved from Supabase and cached in React Query (`dashboardSummaryKeys.summary`).
   - Invalidation is triggered via `invalidateMoneyCaches(workspaceId)` upon invoice or inventory writes.

6. **Unit Conversions Applied:**
   - Each product's primary unit (e.g. `piece`, `عدد`, `kg`) is preserved. Valuation multiplies `quantity` by `buy_price` in integer minor currency units.

7. **Root-Cause Conclusion:**
   - **Verdict:** This is NOT a bug. The card is titled "Total Warehouse Value" (ارزش کل انبار), representing total monetary inventory valuation, formatted in the workspace books currency (`AFN`).
   - **Live Proof:**
     - Baseline: 1 unit × 150 AFN buy_price = `150 AFN`.
     - After creating product `QA-2026-10-29-Prod1` (20 units × 50 AFN buy_price = 1,000 AFN): Dashboard Total Warehouse Value updated dynamically to `1,150 AFN`.

---

## 2. End-to-End Page Journeys Audited (Phase 2 Live Workflows)

### 2.1 Journey 1: Customer & Supplier Lifecycle (`/en/customers`)

- **Operations:**
  1. Add Customer: Opened dialog, entered `QA-2026-10-29-Cust1`. Form validation prevented empty submissions (`customer.nameRequired`). Submitted successfully.
  2. Search & Filter: Searched for `QA-2026-10-29-Cust1`; table filtered to 1 matching row.
  3. Detail Page: Navigated to `/en/customers/2e39f4a3-329b-4993-a433-2ae59de40746`. Customer identity, transactions tab, and empty balance (0 AFN) rendered correctly.
  4. Supplier Creation: Created supplier `QA-2026-10-29-Supp1` with role Seller. Switched to Supplier tab and verified presence.

### 2.2 Journey 2: Product Catalog & Warehouse Stock (`/en/warehouse`)

- **Operations:**
  1. Overview: Inspected warehouses list, total products, and total value.
  2. Add Product: Navigated to `/en/warehouse?add=true`. Filled name `QA-2026-10-29-Prod1`, barcode `QA-BAR-20261029-01`, quantity `20`, buy price `50 AFN`, sell price `80 AFN`.
  3. Verification: Product appeared in Products tab table (`20 units`). Dashboard Total Warehouse Value increased by `1,000 AFN`.

### 2.3 Journey 3: Sales Invoice Lifecycle (`/en/invoices/new` → `preview` → detail)

- **Operations:**
  1. Line Item Configuration: Selected customer `QA-2026-10-29-Cust1`, product `QA-2026-10-29-Prod1`, quantity `2`, price `80 AFN`. Line total calculated: `160 AFN`.
  2. Preview Step: Navigated to `/en/invoices/new/preview`. Verified customer name, product row, totals (160 AFN), and cash payment to till `صندوق تست`.
  3. Confirmation & Submission: Submitted via `Confirm and create invoice`. Idempotency key `inv_web_...` transmitted.
  4. Final Document Created: Redirected to `/en/invoices/23e12bdd-0895-4b91-afc7-930605966296`. Invoice `#INV-000101` created.
  5. Accounting Integration: Ledger Journal Entry `JV-2026-000051` posted automatically.
  6. Notification: Notification bell incremented from 8 to 9. Drawer displayed: `✅ صورت‌حساب جدید ایجاد شد — صورت‌حساب شماره INV-000101 ثبت شد`.

---

## 3. Control Triage Matrix (Mandatory §0.2 Classification)

Every visible interactive control on the primary screens was inspected and triaged into exactly one class:

### Class A — Genuinely Broken (Resolved in Code)

1. **Add Customer Empty Submit (`/customers`):** Printed raw key `customer.nameRequired` instead of localized string. Class A defect -> Fixed in `AddCustomerModal.tsx`.
2. **Add Employee Button (`/team-and-payroll`):** Disabled on cold load despite valid branches existing. Class A defect -> Fixed in `team-and-payroll-container.tsx`.
3. **Governance Sub-Header (`/governance`):** Embedded `ApprovalsContainer` emitted a redundant `<h1>`. Class A accessibility defect -> Fixed via `showHeader={false}`.
4. **Invoice Builder Mobile Title (`/invoices/new`):** Emitted a secondary `<h1>` simultaneously with desktop view. Class A accessibility defect -> Fixed in `invoice-builder-mobile.tsx`.
5. **Breadcrumb Slug (`/sync-center`):** Rendered raw slug `sync-center`. Class A localization defect -> Fixed in `common.json`.

### Class B — Properly Disabled / State-Guarded (Not a Bug)

1. **Save Customer Button (AddCustomerModal):** Disabled while submitting or highlights red when name is empty. Proper state validation.
2. **Invoice Finalize Button:** Disabled when no items are added or when total is zero. Proper state validation.
3. **Cycle Count Complete Button:** Disabled when count has not been recorded. Proper workflow gate.
4. **Pagination Next Button:** Disabled on the last page of invoices list. Proper boundary constraint.

### Class C — Intentionally Restricted / Mutating Financial Action (Production Safety)

1. **Close Cashier Shift (`/till`):** Irreversibly locks cash session on live production. Class C -> Audited in Phase 2 with active drawer verified.
2. **Post Invoice (`/invoices/new`):** Generates immutable accounting journal entries in live ledger. Class C -> Tested via Draft mode (`QA-2026-10-28-InvDraft1`) and live invoice `#INV-000101`.
3. **Delete Customer (`/customers/:id`):** Destructive write against customer ledger. Class C -> New QA customers created without modifying existing customer balances.
4. **Clear Period / Close Year (`/accounting`):** Irreversible accounting close. Class C -> Scope verified to single workspace, destructive close skipped to protect baseline ledger.
