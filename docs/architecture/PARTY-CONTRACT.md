# HISABCHE — PARTY CONTRACT & ROLE INTEGRITY TRUTH TABLE

Canonical Architectural Standard for Counterparties, Invoices, Advances, and Payments

---

## 1. Executive Law & Core Principles

1. **Role is Determined by Document Kind, Never Inferred from Non-Null IDs:**
   The domain intent and document direction (`kind`, `type`, `direction`) dictate which counterparty role is required. A system must never decide whether a transaction is a purchase or sale simply by looking at whether `customer_id` or `supplier_id` happens to be populated.
2. **Strict Column-Role Invariant:**
   A supplier ID must **never** enter a `customer_id` column, and a customer ID must **never** enter a `supplier_id` column. Putting a supplier's UUID into `customer_id` corrupts aging, party balances, statement history, and ledger classification.
3. **Counterparty Duality (One Party, Two Roles):**
   A legal business entity can act as a buyer (`customer`), a seller (`supplier`), or both. Operations must respect the specific role demanded by the business transaction.
4. **Tenancy Boundary:**
   Every party reference (`customer_id`, `supplier_id`, `party_id`) must belong to the exact same `workspace_id` as the transaction document. Cross-workspace party references are strictly forbidden and rejected at the database and service layers.

---

## 2. Table-by-Table Truth Table (Source-Verified from Migrations)

| Table                     | Identifying Column(s)                           | Nullability                                                                  | Target Entity / Foreign Key                                                                | Permitted Roles & Invariants                                                                                                                                                                                                                                                                                                                                                                                                               |
| :------------------------ | :---------------------------------------------- | :--------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`customers`**           | `id`                                            | `NOT NULL PRIMARY KEY`                                                       | References `workspaces(id)` on delete cascade                                              | Represents counterparties acting in the **buyer / debtor** role. Carries `opening_balance` and debtor attributes.                                                                                                                                                                                                                                                                                                                          |
| **`suppliers`**           | `id`                                            | `NOT NULL PRIMARY KEY`                                                       | References `workspaces(id)`                                                                | Represents counterparties acting in the **seller / creditor** role. Carries creditor attributes and vendor metadata.                                                                                                                                                                                                                                                                                                                       |
| **`invoices`**            | `customer_id`<br>`supplier_id`                  | `NULLABLE`<br>`NULLABLE`                                                     | `customer_id` → `customers(id)`<br>`supplier_id` → `suppliers(id)`                         | **For `type IN ('sale', 'sale_return', 'proforma')`:** `customer_id` is required for credit transactions (`status <> 'draft'` / credit sale); `supplier_id` must be `NULL`.<br>**For `type IN ('purchase', 'purchase_return')`:** `supplier_id` is required for credit transactions; `customer_id` must be `NULL`.<br>_Violation D-2 & D-5 Fixed:_ Creation and credit checks branch on `type`, never requiring `customer_id` on purchase. |
| **`payments`**            | `party_type`<br>`party_id`                      | `NOT NULL`<br>`NULLABLE`                                                     | `party_type = 'customer'` → `customers(id)`<br>`party_type = 'supplier'` → `suppliers(id)` | **For `direction = 'in'`:** Must have `party_type = 'customer'`. Settles receivables.<br>**For `direction = 'out'`:** Must have `party_type = 'supplier'`. Settles payables.<br>`amount > 0`, integer minor units on calculation path.                                                                                                                                                                                                     |
| **`payment_allocations`** | `payment_id`<br>`invoice_id`                    | `NOT NULL`<br>`NOT NULL`                                                     | `payment_id` → `payments(id)`<br>`invoice_id` → `invoices(id)`                             | Allocated invoice's party and currency must match the payment's party and currency. Direction `in` allocates only to sales; direction `out` allocates only to purchases. `amount <> 0`.                                                                                                                                                                                                                                                    |
| **`order_deposits`**      | `customer_id`<br>`supplier_id`<br>`source_type` | `NULLABLE` (legacy `NOT NULL`)<br>`NULLABLE` (WP-04 migration)<br>`NOT NULL` | `customer_id` → `customers(id)`<br>`supplier_id` → `suppliers(id)`                         | **For `source_type = 'pre_sale'`:** `customer_id` required, `supplier_id` NULL.<br>**For `source_type = 'pre_purchase'`:** `supplier_id` required, `customer_id` NULL. (_Closing Violation D-1_).                                                                                                                                                                                                                                          |
| **`purchase_orders`**     | `supplier_id`                                   | `NULLABLE`                                                                   | `supplier_id` → `suppliers(id)`                                                            | Always represents a procurement document with a supplier. `customer_id` is never used.                                                                                                                                                                                                                                                                                                                                                     |

---

## 3. Remediation & Closure of Verified Violations

### Violation D-1: Pre-purchase Storing Supplier in `customer_id`

- **Location:** `backend/src/routes/order-deposit.routes.ts:214-227`, `backend/src/services/sales/order-deposit.service.ts:497`.
- **Root Cause:** Schema originally lacked a `supplier_id` on `order_deposits`. The route looked up `customers` for both types and stored the supplier ID into `customer_id`.
- **Remediation Contract (WP-04):**
  1. Add additive migration `docs/advances-04-party-identity-migration.sql` introducing `supplier_id uuid` and adjusting constraints to allow `customer_id` to be null when `supplier_id` is present.
  2. Route validates party against `suppliers` when `kind === 'pre_purchase'`, and against `customers` when `kind === 'pre_sale'`.
  3. Service persists `supplier_id: supplierId, customer_id: null` on `pre_purchase`.

### Violation D-2: Invoice Creation Refusing Credit Purchases without `customerId`

- **Location:** `backend/src/services/invoice.service.ts:1127`.
- **Root Cause:** Checked `if (!data.customerId) throw new Error('INVOICE_CREDIT_NEEDS_PARTY')` without inspecting `data.type`.
- **Remediation Contract (WP-02):**
  - Branch on `isPurchase`:
    ```ts
    if (isPurchase) {
      if (!data.supplierId) throw new Error('INVOICE_CREDIT_NEEDS_PARTY')
    } else {
      if (!data.customerId) throw new Error('INVOICE_CREDIT_NEEDS_PARTY')
    }
    ```
  - Enforce `INVOICE_PARTY_WRONG_ROLE` if `isPurchase && data.customerId && !data.supplierId` or `!isPurchase && data.supplierId && !data.customerId`.

### Violation D-3: Missing Supplier Picker in Invoice Builder

- **Location:** `packages/ui/src/components/ui/invoice-builder/customer-panel.tsx`, `customer-picker.tsx`.
- **Root Cause:** UI invoice builder container only wired `customerId` and called `useCustomers`.
- **Remediation Contract (WP-02):**
  - Extend picker with `partyType?: 'customer' | 'supplier'`.
  - When `transactionType === 'purchase'`, query suppliers via `useSuppliers` and output `supplierId`.
  - Container maps `supplierId` to the invoice payload.

---

## 4. Key Write & Read Paths in Codebase

### Invoice Write & Read Paths:

- `backend/src/services/invoice.service.ts`:
  - `create`: Resolves `supplier_id` on purchase, `customer_id` on sale.
  - `list`: Filters by `partyId` or `customerId` / `supplierId`.
  - `assertWithinCreditLimit`: Branches on customer vs supplier.
- `packages/validation/src/schemas/invoice.schema.ts`:
  - `createInvoiceBodySchema`: Accepts `customerId` and `supplierId`.
  - `invoiceFiltersSchema`: Accepts `partyId`, `customerId`, `supplierId`.

### Advance / Deposit Write & Read Paths:

- `backend/src/routes/order-deposit.routes.ts`:
  - `POST /api/advances`: Validates party role by `kind` (`pre_sale` vs `pre_purchase`).
- `backend/src/services/sales/order-deposit.service.ts`:
  - `createAdvance`: Sets `customer_id` or `supplier_id` according to document kind.
  - `applyDeposit`: Enforces party role and workspace matching.

### Payment & Allocation Write & Read Paths:

- `backend/src/services/payments/payments.service.ts`:
  - `createPayment`: Enforces `party_type` matches `direction` (`in` → `customer`, `out` → `supplier`).
  - `allocatePayment`: Enforces invoice counterparty matches payment `party_id`.
