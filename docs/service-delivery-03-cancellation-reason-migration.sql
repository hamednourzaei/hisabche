-- ============================================================================
-- Hisabche Migration: Service Delivery - a cancellation says why (M4.2)
-- File: docs/service-delivery-03-cancellation-reason-migration.sql
-- Status: Post-migration verification query generated - PENDING HUMAN CONFIRMATION
--
-- Needs: docs/service-delivery-02-atomic-migration.sql already applied.
-- Additive and idempotent. Nothing is deleted or rewritten; old cancelled rows keep an empty reason.
--
-- WHY
--   A cancellation (and, for a delivered package session, the credit reversal it triggers) had no stated reason: neither the
--   table nor the function kept one, so nobody could audit WHY a delivered service was undone. The function now refuses a
--   cancellation without a reason (a replay of one that already happened asks for nothing) and keeps it on the session.
--
-- SIGNATURE CHANGE
--   service_delivery_cancel(uuid, uuid, uuid)  ->  service_delivery_cancel(uuid, uuid, uuid, text)
--   The old function is dropped (a caller of the old signature gets "function does not exist", which the server maps to
--   SERVICE_DELIVERY_MIGRATION_REQUIRED): DEPLOY THE BACKEND THAT CALLS THE NEW SIGNATURE FIRST OR TOGETHER.
-- ============================================================================

ALTER TABLE public.service_delivery_sessions
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- New and updated rows: a cancelled session carries its reason. NOT VALID: rows cancelled before this migration are not
-- rewritten or rejected (VERIFY counts them).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_delivery_cancelled_has_reason') THEN
    ALTER TABLE public.service_delivery_sessions
      ADD CONSTRAINT chk_service_delivery_cancelled_has_reason CHECK (
        status <> 'cancelled'
        OR (cancellation_reason IS NOT NULL AND length(btrim(cancellation_reason)) > 0)
      ) NOT VALID;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.service_delivery_cancel(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.service_delivery_cancel(
  p_workspace_id uuid,
  p_session_id   uuid,
  p_entry_id     uuid DEFAULT NULL,
  p_reason       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_s        public.service_delivery_sessions%ROWTYPE;
  v_consume  public.package_credit_ledger%ROWTYPE;
  v_rev_id   uuid;
  v_reason   text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  IF p_workspace_id IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_AND_SESSION_REQUIRED' USING ERRCODE = '22000';
  END IF;

  SELECT * INTO v_s
    FROM public.service_delivery_sessions
   WHERE id = p_session_id AND workspace_id = p_workspace_id AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVICE_DELIVERY_SESSION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- A replay of a cancellation that already happened: the same answer, nothing written, no reason asked for.
  IF v_s.status = 'cancelled' THEN
    RETURN jsonb_build_object('replayed', true, 'session_id', v_s.id, 'status', v_s.status, 'reversal_entry_id', NULL);
  END IF;

  IF v_s.status NOT IN ('scheduled', 'in_progress', 'delivered') THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION:%->cancelled', v_s.status USING ERRCODE = 'P0001';
  END IF;

  -- Asked for AFTER the state check (a forbidden move is reported as the move), BEFORE anything is written.
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'CANCELLATION_REASON_REQUIRED' USING ERRCODE = '22000';
  END IF;

  IF v_s.status = 'delivered' THEN
    IF v_s.settlement_method = 'invoice' THEN
      RAISE EXCEPTION 'DELIVERED_INVOICE_CORRECTION_REQUIRED' USING ERRCODE = 'P0001';
    END IF;

    IF v_s.settlement_method = 'package_credit' THEN
      IF v_s.package_credit_id IS NULL THEN
        RAISE EXCEPTION 'CREDIT_REFERENCE_MISSING' USING ERRCODE = 'P0001';
      END IF;
      SELECT * INTO v_consume
        FROM public.package_credit_ledger
       WHERE id = v_s.package_credit_id AND workspace_id = p_workspace_id AND entry_type = 'CONSUME';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'CREDIT_REFERENCE_MISSING' USING ERRCODE = 'P0001';
      END IF;

      -- Serialise on the customer, then give the credit back ONCE (the unique index also guarantees it).
      PERFORM 1 FROM public.customers WHERE id = v_consume.customer_id AND workspace_id = p_workspace_id FOR UPDATE;

      SELECT id INTO v_rev_id
        FROM public.package_credit_ledger
       WHERE workspace_id = p_workspace_id AND entry_type = 'REVERSAL'
         AND reference_entry_id = v_consume.id AND deleted_at IS NULL
       LIMIT 1;
      IF v_rev_id IS NULL THEN
        v_rev_id := COALESCE(p_entry_id, gen_random_uuid());
        INSERT INTO public.package_credit_ledger (
          id, workspace_id, customer_id, package_product_id, entry_type, quantity,
          source_document_type, source_document_id, reference_entry_id, idempotency_key, notes, effective_date
        ) VALUES (
          v_rev_id, p_workspace_id, v_consume.customer_id, v_consume.package_product_id, 'REVERSAL',
          v_consume.quantity, 'service_delivery', v_s.id, v_consume.id,
          'delivery_cancel_' || v_s.id::text, 'Reversal for cancelled service session ' || v_s.id::text,
          CURRENT_DATE
        );
      END IF;
    END IF;
  END IF;

  UPDATE public.service_delivery_sessions
     SET status = 'cancelled', cancellation_reason = v_reason
   WHERE id = v_s.id;

  RETURN jsonb_build_object('replayed', false, 'session_id', v_s.id, 'status', 'cancelled', 'reversal_entry_id', v_rev_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.service_delivery_cancel(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_delivery_cancel(uuid, uuid, uuid, text) TO service_role;

-- ============================================================================
-- Rollback / mitigation (nothing here edits history; the reason column keeps audit text and is left in place)
-- ============================================================================
/*
DROP FUNCTION IF EXISTS public.service_delivery_cancel(uuid, uuid, uuid, text);
-- then re-run docs/service-delivery-02-atomic-migration.sql to restore the 3-argument function
ALTER TABLE public.service_delivery_sessions DROP CONSTRAINT IF EXISTS chk_service_delivery_cancelled_has_reason;
*/
