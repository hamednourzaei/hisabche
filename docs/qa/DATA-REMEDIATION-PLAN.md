# HISABCHE — DATA REMEDIATION & HISTORICAL RECONCILIATION PLAN

## 1. Overview & Purpose

This document provides executable SQL queries and remediation guidance for the business owner to detect, verify, and reconcile historical data inconsistencies resulting from pre-fix operational holes in Hisabche before the deployment of the Fix Program.

---

## 2. Area 1: Purchase Return Accounting Reversals

### Forensic Analysis

Prior to migration `docs/invoice-return-02-purchase-return-accounting-migration.sql`, the PostgreSQL function `invoice_return_create` booked both sales returns and purchase returns with the same ledger accounts:

- Debit: `Sales Revenue` (or return account)
- Credit: `Accounts Receivable`

For purchase returns (`purchase_return`), this distorted financial reports by understating Sales Revenue and Accounts Receivable, while leaving Accounts Payable (`payable`) and Inventory Asset (`inventory`) unchanged.

### Identification Query (Read-Only)

```sql
-- Find journal entries created by purchase returns with mismatched accounts
SELECT
  je.id AS journal_entry_id,
  je.workspace_id,
  je.entry_number,
  je.date,
  je.description,
  jl.id AS line_id,
  a.code AS account_code,
  a.name AS account_name,
  a.type AS account_type,
  jl.debit,
  jl.credit
FROM journal_entries je
JOIN journal_lines jl ON jl.journal_id = je.id
JOIN accounts a ON a.id = jl.account_id
WHERE je.description LIKE '%برگشت فاکتور خرید%'
  AND a.type IN ('revenue', 'receivable');
```

### Remediation Action

After human verification of the affected rows:

1. Run `docs/invoice-return-02-purchase-return-accounting-migration.sql` to ensure future returns book Dr Accounts Payable / Cr Inventory.
2. For past incorrect journal entries, generate adjusting journal entries (`type: 'adjustment'`) debiting Accounts Payable and crediting Inventory for the exact returned minor units, offsetting the accidental revenue/receivable entries.

---

## 3. Area 2: Cost Layers on Inter-Warehouse Stock Transfers

### Forensic Analysis

Prior to migration `docs/stock-transfer-02-cost-layers-migration.sql`, stock transfers between warehouses (`warehouse_transfer_stock_keyed`) moved physical quantities in `warehouse_stock` / `product_stock`, but did not move or split `cost_layer` records from the source warehouse to the destination warehouse. As a result, destination sales could encounter empty cost layers, reporting `null` margin.

### Identification Query (Read-Only)

```sql
-- Identify warehouses with positive physical stock but zero active cost layers
WITH stock_sum AS (
  SELECT workspace_id, product_id, warehouse_id, SUM(qty) AS total_physical_qty
  FROM warehouse_stock
  GROUP BY workspace_id, product_id, warehouse_id
),
cost_sum AS (
  SELECT workspace_id, product_id, warehouse_id, SUM(remaining_qty) AS total_costed_qty
  FROM cost_layers
  WHERE remaining_qty > 0 AND deleted_at IS NULL
  GROUP BY workspace_id, product_id, warehouse_id
)
SELECT
  s.workspace_id,
  s.product_id,
  s.warehouse_id,
  s.total_physical_qty,
  COALESCE(c.total_costed_qty, 0) AS total_costed_qty,
  (s.total_physical_qty - COALESCE(c.total_costed_qty, 0)) AS uncosted_qty
FROM stock_sum s
LEFT JOIN cost_sum c
  ON c.workspace_id = s.workspace_id
  AND c.product_id = s.product_id
  AND c.warehouse_id = s.warehouse_id
WHERE s.total_physical_qty > COALESCE(c.total_costed_qty, 0);
```

### Remediation Action

1. Apply `docs/stock-transfer-02-cost-layers-migration.sql` and run `docs/VERIFY-stock-transfer-02.sql`.
2. For existing discrepancies identified above, backfill cost layers at the destination warehouse by moving equivalent remaining quantities from source cost layers that had surplus remaining units.

---

## 4. Area 3: Historical Expired Subscription Renewal Periods

### Forensic Analysis

In `BillingService.extendSubscriptionRow`, renewal previously calculated `new Date(current.period_end)` plus 1 month. When a customer paid after an extended period of expiration (e.g. 2 months past expiration), their new `period_end` remained in the past or granted fewer days than paid for.

### Identification Query (Read-Only)

```sql
-- Subscriptions where active status exists but period_end is in the past
SELECT
  id,
  user_id,
  workspace_id,
  plan,
  status,
  period_start,
  period_end,
  updated_at
FROM subscriptions
WHERE status = 'active'
  AND period_end < NOW();
```

### Remediation Action

For any customer who paid but whose subscription was computed from a stale expired date, manually execute an adjustment extending `period_end` from the payment date (`updated_at`) plus the intended plan duration (1 month or 1 year).
