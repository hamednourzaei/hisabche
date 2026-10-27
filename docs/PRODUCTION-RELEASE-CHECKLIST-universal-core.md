# Production Release Checklist — Universal Business Core & Wave 1 Capabilities

Generated: 2026-10-26
Status: PENDING_HUMAN_CONFIRMATION

---

## 1. Deployment Order

```
[Phase 1] Database Migrations & Verification (Run SQL files in order)
      ↓
[Phase 2] Backend Fastify Deployment (Includes new domain routes, odata, mfa)
      ↓
[Phase 3] Platform Shells Deployment (Web Next.js, Desktop Electron, Mobile Expo)
```

**Rule:** Database migration must precede backend deployment. Backend deployment must precede client deployments.

---

## 2. Database Migrations (Run in Supabase SQL Editor by Owner)

### Order of Migration Execution:

1. `docs/universal-core-migration.sql`
2. `docs/deferral-schedules-migration.sql`
3. `docs/expense-claims-migration.sql`
4. `docs/landed-costs-migration.sql`

### Tables Created & Columns Added:

- **Universal Core (`docs/universal-core-migration.sql`):**
  - `public.product_variants`
  - `public.metal_rates`
  - `public.auto_fitments`
  - `public.vehicle_attributes` (references canonical `stock_serials.id`)
  - `public.warranties`
  - `public.invoice_returns` & `public.invoice_return_lines`
  - `public.order_deposits`
  - `public.freight_trips`, `public.trip_loads`, `public.trip_expenses`
  - `public.courier_deliveries`
  - `public.delivery_notes` & `public.delivery_note_lines`
  - `public.workspaces.credit_limit_mode` (default `'warn'`)
  - _Anti-duplicate rule:_ `pack_barcodes`, `product_serials`, `vehicle_units` are strictly eliminated in favour of `product_barcodes(..., unit)` and `stock_serials`.

- **Deferred Revenue (`docs/deferral-schedules-migration.sql`):**
  - `public.deferral_schedules`
  - `public.deferral_schedule_lines`

- **Expense Claims (`docs/expense-claims-migration.sql`):**
  - `public.expense_reports`
  - `public.expense_lines`

- **Landed Costs (`docs/landed-costs-migration.sql`):**
  - `public.landed_costs`
  - `public.landed_cost_lines`

### Verification Queries:

Run each verification query following its migration:

1. `docs/VERIFY-universal-core.sql`
2. `docs/VERIFY-deferral-schedules.sql`
3. `docs/VERIFY-expense-claims.sql`
4. `docs/VERIFY-landed-costs.sql`

Expected result for each: all required columns and tables exist with RLS policies enabled and `service_role` granted permissions.

### Rollback Plan:

Each SQL migration file contains an idempotent `ROLLBACK` block commented at the end of the file. To reverse changes in an emergency, execute the rollback blocks in reverse order.

---

## 3. Backward & Forward Compatibility Statement

1. **Old Clients vs New Backend:**
   - Fully backward compatible. All new database columns have non-null defaults (`credit_limit_mode = 'warn'`).
   - Standard invoice creation without variant IDs, serial IDs, or deposit references continues to function without error.

2. **New Clients vs Old Backend:**
   - Graceful fallback: when connected to an un-migrated backend, client screens fall back to simple product display and standard invoice validation.
   - Offline engine operates locally with `SCHEMA_VERSION = 9` independently of remote backend state.

3. **CORS & Headers:**
   - No new request headers required. Existing `x-workspace-id`, `Idempotency-Key`, and standard auth headers suffice.

---

## 4. Backfill Statement

- **Strictly Zero Guessed Backfill (§12 Guardrail):**
  - Existing products are NOT modified or converted to templates.
  - Existing invoices are NOT re-calculated.
  - Existing customer credit limits remain as entered; `credit_limit_mode` defaults to `'warn'`.
  - Historical journals are preserved without modification.

---

## 5. Offline Engine & First-Launch Behavior

- **Schema Version:** `SCHEMA_VERSION = 9`.
- **First Launch Migration:**
  - Local migration `v9` executes idempotently on existing device `hisabche.db`.
  - Upgrades from v8 to v9 creating local tables for `product_variants`, `metal_rates`, `auto_fitments`, `vehicle_attributes`, `warranties`, `invoice_returns`, `order_deposits`.
  - Verified by `packages/local-engine/src/__tests__/migration-v9.test.ts` (upgrades v8 database copy twice cleanly).
