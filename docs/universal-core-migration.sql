-- ============================================================================
-- docs/universal-core-migration.sql
--
-- Universal Business Core Extensions: Variants, Metal Rates, Auto Fitments,
-- Vehicle Attributes (linked to stock_serials), Warranties, Returns,
-- Order Deposits, Logistics/Transport, Agriculture, and Credit Limits.
--
-- Anti-duplicate protocol (§3):
-- - Pack barcodes reuse existing `product_barcodes(..., unit)`
-- - Serial items reuse existing `stock_serials` (in traceability)
-- - Vehicles store unit attributes in `vehicle_attributes` linked to `stock_serials.id`
--
-- Tenant-isolated, additive, idempotent, safe to re-run.
-- RUN ORDER: this file, then docs/VERIFY-universal-core.sql.
-- ============================================================================

BEGIN;

-- ── 1. Workspace credit limit setting ──────────────────────────────────────
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS credit_limit_mode text NOT NULL DEFAULT 'warn'
  CHECK (credit_limit_mode IN ('off', 'warn', 'block'));

-- ── 2. Product Variants ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  template_product_id uuid NOT NULL,
  sku text NOT NULL,
  barcode text,
  attributes jsonb NOT NULL DEFAULT '[]'::jsonb,
  price_override_minor bigint,
  cost_override_minor bigint,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Metal Rates (Gold & Jewellery) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.metal_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  rate_date date NOT NULL,
  rate_24k_minor_per_gram bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 4. Auto Fitments (Automotive Parts) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auto_fitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  product_id uuid NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  year_start int NOT NULL,
  year_end int NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 5. Vehicle Attributes (Dealership Units, linked to stock_serials) ───────
CREATE TABLE IF NOT EXISTS public.vehicle_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  serial_id uuid NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  year int NOT NULL,
  colour text NOT NULL,
  odometer int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 6. Warranties ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.warranties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  product_id uuid NOT NULL,
  serial_number text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  warranty_months int NOT NULL,
  customer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 7. Invoice Returns ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  original_invoice_id uuid NOT NULL,
  return_type text NOT NULL CHECK (return_type IN ('sale_return', 'purchase_return')),
  return_number text NOT NULL,
  return_date date NOT NULL,
  total_subtotal_minor bigint NOT NULL,
  total_discount_minor bigint NOT NULL,
  total_tax_minor bigint NOT NULL,
  grand_total_minor bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_return_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  return_id uuid NOT NULL,
  original_line_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity numeric NOT NULL,
  restock_choice text NOT NULL CHECK (restock_choice IN ('restock', 'scrap')),
  reason_code text NOT NULL,
  subtotal_minor bigint NOT NULL,
  discount_minor bigint NOT NULL,
  tax_minor bigint NOT NULL,
  total_minor bigint NOT NULL,
  restored_cost_minor bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 8. Appointments & Booking (G-17) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  staff_employee_id uuid,
  service_product_id uuid NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  invoice_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 9. Crop Cycles & Livestock (G-17) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crop_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  land_unit_id text NOT NULL,
  crop_name text NOT NULL,
  planting_date date NOT NULL,
  expected_harvest_date date,
  actual_harvest_date date,
  harvested_quantity_kg numeric,
  harvested_product_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.livestock_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  category text NOT NULL,
  head_count int NOT NULL DEFAULT 0,
  birth_or_acquisition_date date NOT NULL,
  location_barn text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 10. Order Deposits (G-17 Made-To-Order) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  order_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  amount_minor bigint NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash',
  applied_invoice_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 11. Freight Trips (G-14 Transport) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.freight_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  vehicle_asset_id uuid,
  driver_employee_id uuid,
  origin text NOT NULL,
  destination text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_transit', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 12. Passenger Tickets (G-14 Transport) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.passenger_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  trip_id uuid NOT NULL,
  seat_number text NOT NULL,
  passenger_name text NOT NULL,
  passenger_phone text,
  fare_amount_minor bigint NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'paid', 'boarded', 'cancelled', 'refunded')),
  invoice_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 13. Courier & COD (G-14 Transport) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courier_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  tracking_number text NOT NULL,
  customer_name text NOT NULL,
  destination_address text NOT NULL,
  driver_employee_id uuid,
  status text NOT NULL DEFAULT 'unassigned' CHECK (status IN ('unassigned', 'assigned', 'picked_up', 'delivered', 'failed', 'returned')),
  cod_amount_minor bigint NOT NULL DEFAULT 0,
  cod_stage text NOT NULL DEFAULT 'to_collect' CHECK (cod_stage IN ('to_collect', 'with_driver', 'with_cashier', 'banked')),
  proof_of_delivery_ref text,
  delivery_timestamp timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 14. Delivery Notes (G-14 Transport / Sales) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  note_number text NOT NULL,
  delivery_date date NOT NULL,
  carrier_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_note_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  delivery_note_id uuid NOT NULL,
  invoice_line_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity_delivered numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── RLS & Privileges on all new tables ────────────────────────────────────
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'product_variants',
    'metal_rates',
    'auto_fitments',
    'vehicle_attributes',
    'warranties',
    'invoice_returns',
    'invoice_return_lines',
    'appointments',
    'crop_cycles',
    'livestock_groups',
    'order_deposits',
    'freight_trips',
    'passenger_tickets',
    'courier_deliveries',
    'delivery_notes',
    'delivery_note_lines'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC;', tbl);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon;', tbl);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated;', tbl);
    EXECUTE format('REVOKE ALL ON public.%I FROM service_role;', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_workspace_members ON public.%I;', tbl, tbl);
    EXECUTE format('CREATE POLICY %I_workspace_members ON public.%I
      FOR ALL
      USING (
        workspace_id IN (
          SELECT wm.workspace_id FROM public.workspace_members wm
          WHERE wm.user_id = (SELECT auth.uid())
            AND wm.has_access = true
            AND wm.suspended_at IS NULL
        )
      )
      WITH CHECK (
        workspace_id IN (
          SELECT wm.workspace_id FROM public.workspace_members wm
          WHERE wm.user_id = (SELECT auth.uid())
            AND wm.has_access = true
            AND wm.suspended_at IS NULL
        )
      );', tbl, tbl);
  END LOOP;
END $$;

-- ── Diagnostic Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS product_variants_tpl_idx ON public.product_variants (template_product_id);
CREATE INDEX IF NOT EXISTS metal_rates_date_idx ON public.metal_rates (workspace_id, rate_date DESC);
CREATE INDEX IF NOT EXISTS auto_fitments_search_idx ON public.auto_fitments (workspace_id, make, model);
CREATE INDEX IF NOT EXISTS vehicle_attributes_serial_idx ON public.vehicle_attributes (workspace_id, serial_id);
CREATE INDEX IF NOT EXISTS invoice_returns_orig_idx ON public.invoice_returns (original_invoice_id);
CREATE INDEX IF NOT EXISTS appointments_staff_idx ON public.appointments (workspace_id, staff_employee_id, start_time);
CREATE INDEX IF NOT EXISTS courier_tracking_idx ON public.courier_deliveries (workspace_id, tracking_number);

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION BLOCK (run only to undo):
-- ============================================================================
/*
BEGIN;
DROP TABLE IF EXISTS public.delivery_note_lines CASCADE;
DROP TABLE IF EXISTS public.delivery_notes CASCADE;
DROP TABLE IF EXISTS public.courier_deliveries CASCADE;
DROP TABLE IF EXISTS public.passenger_tickets CASCADE;
DROP TABLE IF EXISTS public.freight_trips CASCADE;
DROP TABLE IF EXISTS public.order_deposits CASCADE;
DROP TABLE IF EXISTS public.livestock_groups CASCADE;
DROP TABLE IF EXISTS public.crop_cycles CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.invoice_return_lines CASCADE;
DROP TABLE IF EXISTS public.invoice_returns CASCADE;
DROP TABLE IF EXISTS public.warranties CASCADE;
DROP TABLE IF EXISTS public.vehicle_attributes CASCADE;
DROP TABLE IF EXISTS public.auto_fitments CASCADE;
DROP TABLE IF EXISTS public.metal_rates CASCADE;
DROP TABLE IF EXISTS public.product_variants CASCADE;
ALTER TABLE public.workspaces DROP COLUMN IF EXISTS credit_limit_mode;
COMMIT;
*/
