-- ============================================================================
-- docs/rfq-purchase-contracts-01-migration.sql
--
-- V61 B.2.13 (RFQ & supplier quotations) + B.2.14 (Long-term purchase contracts)
--
-- Additive, idempotent. Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'awarded', 'cancelled')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL,
  currency text NOT NULL,
  valid_until date NOT NULL,
  lead_time_days integer NOT NULL DEFAULT 0 CHECK (lead_time_days >= 0),
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_minor bigint NOT NULL CHECK (total_minor >= 0),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'chosen', 'rejected', 'expired')),
  converted_po_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF to_regclass('public.contracts') IS NOT NULL THEN
    ALTER TABLE public.contracts
      ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'sales';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.purchase_contract_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  product_id uuid NOT NULL,
  agreed_unit_price_minor bigint NOT NULL CHECK (agreed_unit_price_minor >= 0),
  currency text NOT NULL,
  valid_from date NOT NULL,
  valid_to date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, contract_id, product_id)
);

REVOKE ALL ON public.rfqs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.supplier_quotations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.purchase_contract_prices FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.rfqs TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.supplier_quotations TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.purchase_contract_prices TO service_role;

ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_contract_prices ENABLE ROW LEVEL SECURITY;


-- Rollback (manual reference):
-- DROP TABLE IF EXISTS public.purchase_contract_prices;
-- DROP TABLE IF EXISTS public.supplier_quotations;
-- DROP TABLE IF EXISTS public.rfqs;


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
       AND tablename = ANY (ARRAY['rfqs', 'supplier_quotations', 'purchase_contract_prices'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $lockdown$;
ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rfqs FROM PUBLIC, anon, authenticated;
ALTER TABLE public.supplier_quotations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_quotations FROM PUBLIC, anon, authenticated;
ALTER TABLE public.purchase_contract_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.purchase_contract_prices FROM PUBLIC, anon, authenticated;
