# Return Flow Map: Invoice Sale vs. Invoice Return Accounting & Inventory

Date: 2026-10-26  
Status: **ANALYSIS FROM CODE AND EXISTING REPOSITORY PATTERNS (UPDATED FIX 3)**

---

## 1. What Exists Today for an Invoice Sale

From code inspection across `backend/src/services/invoice.service.ts`, `packages/validation/src/schemas/invoice-posting.domain.ts`, `backend/src/services/inventory-costing/`, and PostgreSQL migrations (`accounting-core-migration.sql`, `inventory-costing-migration.sql`):

### A. General Ledger Posting (`InvoiceService.createAccountingEntries` & `invoiceLedgerLines`)

- **Accounts Required (by role):**
  - `accounts.role = 'receivable'` (Accounts Receivable)
  - `accounts.role = 'sales'` (Sales Revenue)
  - `accounts.role = 'inventory'` (Inventory Asset)
  - `accounts.role = 'cogs'` (Cost of Goods Sold)
- **Currency & Rate:**
  - Total is converted to the books currency at the frozen rate: `InvoiceService.inBooksCurrency(total, invoice.exchange_rate)`.
- **Journal Lines (`invoiceLedgerLines`):**
  - `Dr Accounts Receivable` = `total_books`
  - `Cr Sales Revenue` = `total_books`
  - When goods are costed (`costOfGoodsSold > 0`):
    - `Dr Cost of Goods Sold (COGS)` = `cogs_books`
    - `Cr Inventory Asset` = `cogs_books`
- **Atomicity:** Posted via Postgres function `accounting_post_journal_entry` with `source_type = 'invoice'` and `source_id = invoice.id`.

### B. Inventory Movement (`stock_movements`)

- For sales:
  - Row inserted into `stock_movements`:
    - `product_id` = item.product_id
    - `quantity` = `-item.quantity` (or positive quantity with `from_warehouse_id = warehouse_id`, `to_warehouse_id = NULL`)
    - `reference_type` = `'invoice'`
    - `reference_id` = `invoice.id`

### C. Cost Layer Consumption (`cost_consumptions` & `cost_layers`)

- Executed by Postgres function `inventory_consume_layers`:
  - Depletes open `cost_layers` (`remaining_qty := remaining_qty - take`).
  - Records consumption rows in `cost_consumptions`:
    - `consumer_type` = `'invoice'`
    - `consumer_id` = `invoice.id`
    - `consumer_line` = line identifier
    - `quantity` = consumed quantity
    - `unit_cost` = original consumed cost (FIFO or AVCO at time of sale)
    - `amount` = `quantity * unit_cost`

### D. Customer Balance Derivation

- Two coordinated mechanisms:
  1. **General Ledger:** Debits minus Credits on the customer's Accounts Receivable account (`accounts.role = 'receivable'`). An invoice increases receivable by `total_books`.
  2. **Subledger Projection (`invoice_outstanding` view):**
     - `outstanding` = `i.total - COALESCE(allocated_payments, 0)`.
     - `settlement_state` = `unpaid` | `partially_paid` | `paid`.

---

## 2. The Exact Inverse for a Return Document (`invoice_returns`)

A sales invoice return represents the partial or full cancellation of the sale event for specific returned line items. The accounting and inventory effects are the exact mathematical inverse of the sale:

### A. Over-Return & Concurrency Guard

- Locks the invoice row (`SELECT ... FROM invoices WHERE id = p_invoice_id AND workspace_id = p_workspace_id FOR UPDATE`).
- Cumulative returned quantity across all historical returns (`invoice_return_lines`) for each `original_line_id` + this return's quantity must NOT exceed the original `invoice_items.quantity`.

### B. Multi-Currency Minor-Unit Scaling

- Precision factor is derived from invoice currency (`p_fraction_digits int`, between 0 and 4):
  `v_factor := POWER(10, p_fraction_digits)::numeric`.
- Currencies with 0 decimals (AFN, IRR, JPY) use factor `1`. Currencies with 2 decimals (USD, EUR) use factor `100`. Currencies with 3 decimals (BHD, IQD, precious metals) use factor `1000`.
- Monetary amounts in minor units:
  - `v_subtotal_minor := ROUND(v_qty * v_item.unit_price * v_factor);`
  - `v_total_books := ROUND(((v_tot_grand_minor::numeric / v_factor) * v_rate), 2);`
- Eliminates hardcoded `100` / `100.0`.

### C. Revenue & Receivable Reversal & Mandatory Accounts Guard

- For the returned items, calculate:
  - `returned_subtotal_minor`
  - `returned_discount_minor`
  - `returned_tax_minor`
  - `returned_total_minor` (grand total)
- Convert to books currency using the original invoice's frozen exchange rate:
  `returned_total_books = ROUND(((v_tot_grand_minor::numeric / v_factor) * v_rate), 2)`.
- Reversal Journal Lines:
  - `Dr Sales Revenue` = `returned_total_books`
  - `Cr Accounts Receivable` = `returned_total_books`
- **Mandatory accounts rule:** If `v_sales_acct IS NULL` or `v_recv_acct IS NULL`, the function immediately raises `RETURN_ACCOUNTS_MISSING: <role>` and rolls back the entire return transaction. There is no silent skip of ledger posting.

### D. Stock and Cost Reversal: Full Document vs. Partial Line Returns

- **Why `inventory_release_consumption` is for full document releases:**
  - `inventory_release_consumption(workspace, user, consumer_type, consumer_id)` operates at the whole document level. It has no line ID or quantity arguments and releases 100% of all consumptions recorded for that `consumer_id`.
  - For full invoice cancellations or voiding, `inventory_release_consumption` is suitable.
  - For sales returns, which are frequently **partial** (e.g., returning 2 out of 5 units on a specific line), `inventory_release_consumption` cannot be used directly without wiping other lines.
- **Partial Return Mechanism in `invoice_return_create`:**
  - When `restock_choice = 'restock'`:
    - Physical quantity is always restocked into `stock_movements`.
    - It reads the original consumption rows for that invoice and line.
    - If `v_consumed_qty > 0`:
      - It restores `remaining_qty` on the original `cost_layers` up to `v_qty` (capped at `received_qty`).
      - It appends a negative consumption row in `cost_consumptions` (`amount = -v_line_cost`, `consumer_type = 'invoice_return'`).
      - It verifies `v_inv_acct` and `v_cogs_acct` exist (raising `RETURN_ACCOUNTS_MISSING` if missing) and posts:
        - `Dr Inventory Asset` = `restored_cost_books`
        - `Cr Cost of Goods Sold (COGS)` = `restored_cost_books`
      - Sets `costStatus := 'restored'`.
- **Unknown Cost Rule («نامعلوم، صفر نیست»):**
  - If `v_consumed_qty = 0` (e.g. historical uncosted sale, missing stock layer at sale time):
    - Physical quantity is still restocked into `stock_movements`.
    - It does **NOT** write zero cost (`amount = 0`) to `cost_consumptions`.
    - It does **NOT** post COGS reversal (and does not require inventory/COGS ledger accounts).
    - Returns `costStatus := 'unknown'` and `restoredCostMinor := NULL`.
    - The restocked quantity enters the unvalued stock pipeline (`CostingService#valueUnvaluedStock`) to be valued when purchase receipts arrive.

### E. Idempotency & Tenant Isolation

- Key: `(workspace_id, original_invoice_id, return_number)`.
- Replaying the same return number returns the existing document with `idempotentReplay: true`.
