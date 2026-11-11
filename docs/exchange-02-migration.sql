-- ============================================
-- docs/exchange-02-migration.sql
--
-- Money changer / صرافی — per-currency physical cashbox reconciliation.
--
-- Adds:
--   fx_cashbox_reconciliations   immutable per-currency count snapshots recorded
--                                atomically against fx_held_minor() under the same
--                                per-(workspace, currency) advisory lock used by
--                                fx_trade_create and fx_trade_void.
--   fx_reconcile_cashbox()       SECURITY DEFINER writer with idempotency key.
--
-- Additive and re-runnable. Depends on: workspaces, exchange-01-migration.sql.
-- Status wording per AGENTS.md §0:
--   Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
--
-- ROLLBACK (only while empty / before production adoption):
--   DROP FUNCTION IF EXISTS public.fx_reconcile_cashbox(uuid, uuid, text, bigint, text, text);
--   DROP TABLE IF EXISTS public.fx_cashbox_reconciliations;
-- ============================================

CREATE TABLE IF NOT EXISTS public.fx_cashbox_reconciliations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  currency           text NOT NULL,
  expected_minor     bigint NOT NULL,
  counted_minor      bigint NOT NULL,
  variance_minor     bigint NOT NULL,
  status             text NOT NULL,
  note               text,
  client_request_id  text,
  reconciled_by      uuid NOT NULL,
  reconciled_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fx_cashbox_currency CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT fx_cashbox_counted_nonneg CHECK (counted_minor >= 0),
  CONSTRAINT fx_cashbox_variance_math CHECK (variance_minor = counted_minor - expected_minor),
  CONSTRAINT fx_cashbox_status CHECK (status IN ('matched', 'over', 'short'))
);

CREATE INDEX IF NOT EXISTS fx_cashbox_reconciliations_idx
  ON public.fx_cashbox_reconciliations (workspace_id, currency, reconciled_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS fx_cashbox_reconciliations_request_key
  ON public.fx_cashbox_reconciliations (workspace_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fx_reconcile_cashbox(
  p_workspace_id       uuid,
  p_user_id            uuid,
  p_currency           text,
  p_counted_minor      bigint,
  p_note               text DEFAULT NULL,
  p_client_request_id  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_currency  text := upper(btrim(p_currency));
  v_existing  public.fx_cashbox_reconciliations%ROWTYPE;
  v_expected  bigint;
  v_variance  bigint;
  v_status    text;
  v_id        uuid;
BEGIN
  IF v_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'FX_CURRENCY_INVALID' USING ERRCODE = 'P0001';
  END IF;

  IF p_counted_minor IS NULL OR p_counted_minor < 0 THEN
    RAISE EXCEPTION 'FX_COUNT_INVALID' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('fx:' || p_workspace_id::text || ':' || v_currency, 0)
  );

  IF p_client_request_id IS NOT NULL THEN
    SELECT * INTO v_existing
      FROM public.fx_cashbox_reconciliations
     WHERE workspace_id = p_workspace_id AND client_request_id = p_client_request_id;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'id', v_existing.id,
        'currency', v_existing.currency,
        'expected_minor', v_existing.expected_minor,
        'counted_minor', v_existing.counted_minor,
        'variance_minor', v_existing.variance_minor,
        'status', v_existing.status,
        'reconciled_at', v_existing.reconciled_at
      );
    END IF;
  END IF;

  v_expected := public.fx_held_minor(p_workspace_id, v_currency);
  v_variance := p_counted_minor - v_expected;
  v_status := CASE
    WHEN v_variance = 0 THEN 'matched'
    WHEN v_variance > 0 THEN 'over'
    ELSE 'short'
  END;

  INSERT INTO public.fx_cashbox_reconciliations (
    workspace_id, currency, expected_minor, counted_minor, variance_minor,
    status, note, client_request_id, reconciled_by
  ) VALUES (
    p_workspace_id, v_currency, v_expected, p_counted_minor, v_variance,
    v_status, NULLIF(btrim(coalesce(p_note, '')), ''), p_client_request_id, p_user_id
  )
  RETURNING * INTO v_existing;

  v_id := v_existing.id;
  RETURN jsonb_build_object(
    'id', v_id,
    'currency', v_existing.currency,
    'expected_minor', v_existing.expected_minor,
    'counted_minor', v_existing.counted_minor,
    'variance_minor', v_existing.variance_minor,
    'status', v_existing.status,
    'reconciled_at', v_existing.reconciled_at
  );
END
$fn$;

-- ─── Privileges and RLS ────────────────────────────────────────────────────
ALTER TABLE public.fx_cashbox_reconciliations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.fx_cashbox_reconciliations
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.fx_cashbox_reconciliations TO service_role;

REVOKE ALL ON FUNCTION public.fx_reconcile_cashbox(uuid, uuid, text, bigint, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fx_reconcile_cashbox(uuid, uuid, text, bigint, text, text)
  TO service_role;
