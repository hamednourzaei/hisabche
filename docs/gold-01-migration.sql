-- ============================================
-- docs/gold-01-migration.sql
--
-- V59.1 Gold & Jewellery completion:
--   1. Persist locked invoice-line metal rate snapshot columns on invoice_items
--      (rate, purity karat, net weight in mg, making charge minor, captured_at/by).
--   2. Track gold operations (second-hand purchase w/ KYC + melt/scrap) and
--      showcase/safe weight reconciliations with workspace-scoped RLS & idempotent RPCs.
--
-- Depends on: invoices/invoice_items, customers, metal_rates.
-- Additive and idempotent. Status: PENDING HUMAN CONFIRMATION.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS
--     public.gold_reconcile_location(uuid, uuid, jsonb),
--     public.gold_record_melt_scrap(uuid, uuid, jsonb),
--     public.gold_record_second_hand_purchase(uuid, uuid, jsonb);
--   DROP TABLE IF EXISTS public.gold_location_reconciliations, public.gold_operations;
-- ============================================

BEGIN;

-- ─── 1. Invoice-line gold snapshot columns ────────────────────────────────────
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS metal_rate_24k_minor bigint,
  ADD COLUMN IF NOT EXISTS metal_purity_karat integer,
  ADD COLUMN IF NOT EXISTS metal_net_weight_mg bigint,
  ADD COLUMN IF NOT EXISTS making_charge_minor bigint,
  ADD COLUMN IF NOT EXISTS metal_rate_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS metal_rate_captured_by uuid;

ALTER TABLE public.invoice_items DROP CONSTRAINT IF EXISTS invoice_items_metal_purity_check;
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_metal_purity_check
  CHECK (metal_purity_karat IS NULL OR metal_purity_karat IN (9, 14, 18, 21, 22, 24)) NOT VALID;

ALTER TABLE public.invoice_items DROP CONSTRAINT IF EXISTS invoice_items_metal_weight_check;
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_metal_weight_check
  CHECK (metal_net_weight_mg IS NULL OR metal_net_weight_mg > 0) NOT VALID;

ALTER TABLE public.invoice_items DROP CONSTRAINT IF EXISTS invoice_items_making_charge_check;
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_making_charge_check
  CHECK (making_charge_minor IS NULL OR making_charge_minor >= 0) NOT VALID;

-- Track who set each board rate when created
ALTER TABLE public.metal_rates
  ADD COLUMN IF NOT EXISTS set_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- ─── 2. Second-hand purchase (KYC) & melt/scrap operations ────────────────────
CREATE TABLE IF NOT EXISTS public.gold_operations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  operation_type         text NOT NULL,
  karat                  integer NOT NULL,
  input_weight_mg        bigint NOT NULL,
  recovered_pure_mg      bigint,
  weight_loss_mg         bigint,
  rate_24k_minor_per_gram bigint NOT NULL,
  gross_credit_minor     bigint,
  deduction_bp           integer,
  net_credit_minor       bigint,
  waste_cost_minor       bigint,
  customer_id            uuid REFERENCES public.customers (id),
  id_full_name           text,
  id_type                text,
  id_number              text,
  kyc_threshold_minor    bigint,
  note                   text,
  client_request_id      text,
  created_by             uuid NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gold_operations_type CHECK (operation_type IN ('second_hand_purchase', 'melt_scrap')),
  CONSTRAINT gold_operations_karat CHECK (karat IN (9, 14, 18, 21, 22, 24)),
  CONSTRAINT gold_operations_weight CHECK (
    input_weight_mg > 0
    AND (recovered_pure_mg IS NULL OR (recovered_pure_mg >= 0 AND recovered_pure_mg <= input_weight_mg))
    AND rate_24k_minor_per_gram > 0
  ),
  CONSTRAINT gold_operations_identity_whole CHECK (
    (id_full_name IS NULL AND id_type IS NULL AND id_number IS NULL)
    OR (id_full_name IS NOT NULL AND id_type IS NOT NULL AND id_number IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS gold_operations_workspace_idx
  ON public.gold_operations (workspace_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS gold_operations_request_key
  ON public.gold_operations (workspace_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

ALTER TABLE gold_operations ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON public.gold_operations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.gold_operations TO service_role;

-- ─── 3. Showcase / safe weight reconciliation ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gold_location_reconciliations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  location              text NOT NULL,
  karat                 integer NOT NULL,
  system_weight_mg      bigint NOT NULL,
  physical_counted_mg   bigint NOT NULL,
  variance_mg           bigint NOT NULL,
  note                  text,
  client_request_id     text,
  reconciled_by         uuid NOT NULL,
  reconciled_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gold_loc_rec_location CHECK (location IN ('showcase', 'safe')),
  CONSTRAINT gold_loc_rec_karat CHECK (karat IN (9, 14, 18, 21, 22, 24)),
  CONSTRAINT gold_loc_rec_weights CHECK (system_weight_mg >= 0 AND physical_counted_mg >= 0)
);

CREATE INDEX IF NOT EXISTS gold_loc_rec_workspace_idx
  ON public.gold_location_reconciliations (workspace_id, reconciled_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS gold_loc_rec_request_key
  ON public.gold_location_reconciliations (workspace_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

ALTER TABLE gold_location_reconciliations ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON public.gold_location_reconciliations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.gold_location_reconciliations TO service_role;

-- ─── 4. Atomic idempotent RPCs ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gold_record_second_hand_purchase(
  p_workspace_id uuid,
  p_user_id uuid,
  p_op jsonb
)
RETURNS public.gold_operations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_req text := p_op ->> 'client_request_id';
  v_existing public.gold_operations%ROWTYPE;
  v_net_credit bigint := (p_op ->> 'net_credit_minor')::bigint;
  v_threshold bigint := NULLIF(p_op ->> 'kyc_threshold_minor', '')::bigint;
  v_has_id boolean :=
    NULLIF(btrim(p_op ->> 'id_full_name'), '') IS NOT NULL
    AND NULLIF(btrim(p_op ->> 'id_type'), '') IS NOT NULL
    AND NULLIF(btrim(p_op ->> 'id_number'), '') IS NOT NULL;
  v_row public.gold_operations%ROWTYPE;
BEGIN
  IF v_req IS NOT NULL THEN
    SELECT * INTO v_existing
      FROM public.gold_operations
     WHERE workspace_id = p_workspace_id AND client_request_id = v_req;
    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  IF v_threshold IS NOT NULL AND v_net_credit >= v_threshold AND NOT v_has_id THEN
    RAISE EXCEPTION 'GOLD_KYC_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.gold_operations (
    workspace_id, operation_type, karat, input_weight_mg, recovered_pure_mg,
    rate_24k_minor_per_gram, gross_credit_minor, deduction_bp, net_credit_minor,
    customer_id, id_full_name, id_type, id_number, kyc_threshold_minor,
    note, client_request_id, created_by
  ) VALUES (
    p_workspace_id,
    'second_hand_purchase',
    (p_op ->> 'karat')::int,
    (p_op ->> 'input_weight_mg')::bigint,
    (p_op ->> 'recovered_pure_mg')::bigint,
    (p_op ->> 'rate_24k_minor_per_gram')::bigint,
    (p_op ->> 'gross_credit_minor')::bigint,
    coalesce((p_op ->> 'deduction_bp')::int, 0),
    v_net_credit,
    NULLIF(p_op ->> 'customer_id', '')::uuid,
    NULLIF(btrim(p_op ->> 'id_full_name'), ''),
    NULLIF(btrim(p_op ->> 'id_type'), ''),
    NULLIF(btrim(p_op ->> 'id_number'), ''),
    v_threshold,
    p_op ->> 'note',
    v_req,
    p_user_id
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END
$fn$;

CREATE OR REPLACE FUNCTION public.gold_record_melt_scrap(
  p_workspace_id uuid,
  p_user_id uuid,
  p_op jsonb
)
RETURNS public.gold_operations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_req text := p_op ->> 'client_request_id';
  v_existing public.gold_operations%ROWTYPE;
  v_input bigint := (p_op ->> 'input_weight_mg')::bigint;
  v_recovered bigint := (p_op ->> 'recovered_pure_mg')::bigint;
  v_row public.gold_operations%ROWTYPE;
BEGIN
  IF v_req IS NOT NULL THEN
    SELECT * INTO v_existing
      FROM public.gold_operations
     WHERE workspace_id = p_workspace_id AND client_request_id = v_req;
    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  IF v_recovered > v_input THEN
    RAISE EXCEPTION 'GOLD_RECOVERED_EXCEEDS_INPUT' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.gold_operations (
    workspace_id, operation_type, karat, input_weight_mg, recovered_pure_mg, weight_loss_mg,
    rate_24k_minor_per_gram, waste_cost_minor, note, client_request_id, created_by
  ) VALUES (
    p_workspace_id,
    'melt_scrap',
    (p_op ->> 'karat')::int,
    v_input,
    v_recovered,
    v_input - v_recovered,
    (p_op ->> 'rate_24k_minor_per_gram')::bigint,
    (p_op ->> 'waste_cost_minor')::bigint,
    p_op ->> 'note',
    v_req,
    p_user_id
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END
$fn$;

CREATE OR REPLACE FUNCTION public.gold_reconcile_location(
  p_workspace_id uuid,
  p_user_id uuid,
  p_rec jsonb
)
RETURNS public.gold_location_reconciliations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_req text := p_rec ->> 'client_request_id';
  v_existing public.gold_location_reconciliations%ROWTYPE;
  v_sys bigint := (p_rec ->> 'system_weight_mg')::bigint;
  v_phys bigint := (p_rec ->> 'physical_counted_mg')::bigint;
  v_row public.gold_location_reconciliations%ROWTYPE;
BEGIN
  IF v_req IS NOT NULL THEN
    SELECT * INTO v_existing
      FROM public.gold_location_reconciliations
     WHERE workspace_id = p_workspace_id AND client_request_id = v_req;
    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  INSERT INTO public.gold_location_reconciliations (
    workspace_id, location, karat, system_weight_mg, physical_counted_mg,
    variance_mg, note, client_request_id, reconciled_by
  ) VALUES (
    p_workspace_id,
    p_rec ->> 'location',
    (p_rec ->> 'karat')::int,
    v_sys,
    v_phys,
    v_phys - v_sys,
    p_rec ->> 'note',
    v_req,
    p_user_id
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END
$fn$;

REVOKE ALL ON FUNCTION public.gold_record_second_hand_purchase(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gold_record_melt_scrap(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gold_reconcile_location(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gold_record_second_hand_purchase(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gold_record_melt_scrap(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gold_reconcile_location(uuid, uuid, jsonb) TO service_role;


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
       AND tablename = ANY (ARRAY['gold_operations', 'gold_location_reconciliations'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $lockdown$;
ALTER TABLE public.gold_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gold_operations FROM PUBLIC, anon, authenticated;
ALTER TABLE public.gold_location_reconciliations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gold_location_reconciliations FROM PUBLIC, anon, authenticated;

COMMIT;
