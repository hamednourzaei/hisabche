-- ============================================================================
-- docs/bundles-consignment-commission-01-migration.sql
--
-- V61 B.2.8 (Product bundles), B.2.10 (Consignment in/out), B.2.9 (Seller commission)
--
-- Additive, idempotent. Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_kind_chk' AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_kind_chk CHECK (kind IN ('standard', 'bundle')) NOT VALID;
  END IF;
  ALTER TABLE public.products VALIDATE CONSTRAINT products_kind_chk;
END $$;

CREATE TABLE IF NOT EXISTS public.bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  bundle_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  component_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity numeric(18, 4) NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, bundle_product_id, component_product_id),
  CHECK (bundle_product_id <> component_product_id)
);

ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'warehouses_kind_chk' AND conrelid = 'public.warehouses'::regclass
  ) THEN
    ALTER TABLE public.warehouses
      ADD CONSTRAINT warehouses_kind_chk CHECK (kind IN ('standard', 'consignee')) NOT VALID;
  END IF;
  ALTER TABLE public.warehouses VALIDATE CONSTRAINT warehouses_kind_chk;
END $$;

CREATE TABLE IF NOT EXISTS public.consignment_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  party_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity numeric(18, 4) NOT NULL CHECK (quantity > 0),
  unit_agreed_price_minor bigint NOT NULL CHECK (unit_agreed_price_minor >= 0),
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled', 'returned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS seller_employee_id uuid;

REVOKE ALL ON public.bundle_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.consignment_lots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bundle_items TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.consignment_lots TO service_role;

ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignment_lots ENABLE ROW LEVEL SECURITY;


-- Rollback (manual reference):
-- DROP TABLE IF EXISTS public.consignment_lots;
-- DROP TABLE IF EXISTS public.bundle_items;
-- ALTER TABLE public.invoices DROP COLUMN IF EXISTS seller_employee_id;


-- ---------------------------------------------------------------------------
-- CLIENT LOCKDOWN (V61 audit, 12 Nov 2026).
--
-- These tables are reached ONLY through the backend (service_role), which
-- checks the capability of the person asking. A policy "FOR ALL TO
-- authenticated USING (workspace member)" let ANY member of the workspace —
-- a seller included — write these rows straight through the Supabase API and
-- skip every capability check (e.g. approve their own request, overwrite
-- another member's 2FA enrollment). RLS stays ON with NO policy; clients get
-- nothing. Idempotent: on a database where the earlier version of this file
-- already ran, it drops whatever policies exist on these tables.
-- ---------------------------------------------------------------------------
DO $lockdown$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = ANY (ARRAY['bundle_items', 'consignment_lots'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $lockdown$;
ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bundle_items FROM PUBLIC, anon, authenticated;
ALTER TABLE public.consignment_lots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consignment_lots FROM PUBLIC, anon, authenticated;
