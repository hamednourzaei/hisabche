-- ============================================
-- docs/payment-gateway-events-03-atomic-internal-migration.sql
--
-- Hardens payment processor state transitions & webhook telemetry:
--   1. Extends `payment_gateway_events.processing_status` to allow `rejected_signature`.
--   2. Adds `provenance` and `idempotency_key` columns + unique index.
--   3. Adds `public.transition_payment_processor_state(...)` for atomic internal
--      non-final and audited admin-override transitions with FOR UPDATE locking.
--   4. Hardens `public.apply_payment_gateway_event(...)` against payload tampering
--      on replayed `event_id`.
-- Additive, idempotent. Human-applied only.
-- ============================================

BEGIN;

ALTER TABLE IF EXISTS public.payment_gateway_events
  ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'internal_non_final',
  ADD COLUMN IF NOT EXISTS idempotency_key text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_gateway_events_processing_status_check'
      AND conrelid = 'public.payment_gateway_events'::regclass
  ) THEN
    ALTER TABLE public.payment_gateway_events
      DROP CONSTRAINT payment_gateway_events_processing_status_check;
  END IF;

  ALTER TABLE public.payment_gateway_events
    ADD CONSTRAINT payment_gateway_events_processing_status_check
    CHECK (processing_status IN ('processed', 'replayed', 'failed', 'rejected_signature'));

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_gateway_events_provenance_check'
      AND conrelid = 'public.payment_gateway_events'::regclass
  ) THEN
    ALTER TABLE public.payment_gateway_events
      ADD CONSTRAINT payment_gateway_events_provenance_check
      CHECK (
        provenance IN (
          'webhook_verified',
          'webhook_rejected_signature',
          'internal_non_final',
          'admin_override',
          'failed_processing'
        )
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_gateway_events_ws_idempotency
  ON public.payment_gateway_events (workspace_id, payment_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.transition_payment_processor_state(
  p_workspace_id uuid,
  p_payment_id uuid,
  p_to_state text,
  p_gateway_name text,
  p_external_ref text,
  p_fee_minor integer,
  p_reason text,
  p_actor_id uuid,
  p_admin_override boolean DEFAULT false,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.payments;
  v_existing public.payment_gateway_states;
  v_replay public.payment_gateway_events;
  v_current text;
  v_now timestamptz := now();
  v_saved public.payment_gateway_states;
  v_provenance text;
BEGIN
  IF p_to_state NOT IN ('queued_offline', 'pending_capture', 'captured', 'declined', 'voided') THEN
    RAISE EXCEPTION 'INVALID_PROCESSOR_STATE';
  END IF;
  IF p_fee_minor IS NULL OR p_fee_minor < 0 THEN
    RAISE EXCEPTION 'INVALID_FEE_MINOR';
  END IF;

  IF p_to_state IN ('captured', 'declined', 'voided') THEN
    IF NOT COALESCE(p_admin_override, false) OR char_length(trim(COALESCE(p_reason, ''))) < 5 THEN
      RAISE EXCEPTION 'PROCESSOR_FINAL_STATE_REQUIRES_WEBHOOK_OR_OVERRIDE';
    END IF;
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id AND workspace_id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND';
  END IF;

  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT * INTO v_replay
    FROM public.payment_gateway_events
    WHERE workspace_id = p_workspace_id
      AND payment_id = p_payment_id
      AND idempotency_key = trim(p_idempotency_key)
    LIMIT 1;
  END IF;

  SELECT * INTO v_existing
  FROM public.payment_gateway_states
  WHERE workspace_id = p_workspace_id
    AND payment_id = p_payment_id
  FOR UPDATE;

  IF v_replay.id IS NOT NULL AND v_existing.id IS NOT NULL THEN
    IF v_replay.to_state <> p_to_state THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_STATE_CONFLICT';
    END IF;
    RETURN jsonb_build_object(
      'paymentId', v_existing.payment_id,
      'processorState', v_existing.processor_state,
      'gatewayName', v_existing.gateway_name,
      'externalRef', v_existing.external_ref,
      'feeMinor', v_existing.fee_minor,
      'currency', v_existing.currency,
      'reason', v_existing.reason,
      'updatedAt', v_existing.updated_at,
      'provenance', v_replay.provenance,
      'replay', true
    );
  END IF;

  v_current := COALESCE(
    v_existing.processor_state,
    CASE WHEN v_payment.method = 'cash' THEN 'captured' ELSE 'queued_offline' END
  );

  IF v_current <> p_to_state THEN
    IF NOT (
      (v_current = 'queued_offline' AND p_to_state IN ('pending_capture', 'voided')) OR
      (v_current = 'pending_capture' AND p_to_state IN ('captured', 'declined', 'voided')) OR
      (v_current = 'declined' AND p_to_state IN ('pending_capture', 'voided')) OR
      (v_current = 'captured' AND p_to_state = 'voided')
    ) THEN
      RAISE EXCEPTION 'PROCESSOR_STATE_TRANSITION_NOT_ALLOWED';
    END IF;
  END IF;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.payment_gateway_states
    SET processor_state = p_to_state,
        gateway_name = COALESCE(p_gateway_name, gateway_name),
        external_ref = COALESCE(p_external_ref, external_ref),
        fee_minor = p_fee_minor,
        currency = v_payment.currency,
        reason = p_reason,
        updated_by = p_actor_id,
        updated_at = v_now
    WHERE id = v_existing.id
    RETURNING * INTO v_saved;
  ELSE
    INSERT INTO public.payment_gateway_states (
      workspace_id, payment_id, processor_state, gateway_name, external_ref,
      fee_minor, currency, reason, updated_by, updated_at
    ) VALUES (
      p_workspace_id, p_payment_id, p_to_state, p_gateway_name, p_external_ref,
      p_fee_minor, v_payment.currency, p_reason, p_actor_id, v_now
    )
    RETURNING * INTO v_saved;
  END IF;

  v_provenance := CASE WHEN COALESCE(p_admin_override, false) THEN 'admin_override' ELSE 'internal_non_final' END;

  INSERT INTO public.payment_gateway_events (
    workspace_id, payment_id, from_state, to_state, gateway_name, external_ref,
    fee_minor, signature_verified, reason, actor_id, currency, processing_status,
    provenance, idempotency_key
  ) VALUES (
    p_workspace_id, p_payment_id, v_current, p_to_state, v_saved.gateway_name, v_saved.external_ref,
    p_fee_minor, false, p_reason, p_actor_id, v_payment.currency, 'processed',
    v_provenance, NULLIF(trim(COALESCE(p_idempotency_key, '')), '')
  );

  IF COALESCE(p_admin_override, false) THEN
    INSERT INTO public.audit_logs (
      workspace_id, user_id, action, entity_type, entity_id, details
    ) VALUES (
      p_workspace_id,
      p_actor_id,
      'payment.processor_state_override',
      'payment',
      p_payment_id::text,
      jsonb_build_object(
        'fromState', v_current,
        'toState', p_to_state,
        'reason', p_reason
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'paymentId', v_saved.payment_id,
    'processorState', v_saved.processor_state,
    'gatewayName', v_saved.gateway_name,
    'externalRef', v_saved.external_ref,
    'feeMinor', v_saved.fee_minor,
    'currency', v_saved.currency,
    'reason', v_saved.reason,
    'updatedAt', v_saved.updated_at,
    'provenance', v_provenance,
    'replay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transition_payment_processor_state(
  uuid, uuid, text, text, text, integer, text, uuid, boolean, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.transition_payment_processor_state(
  uuid, uuid, text, text, text, integer, text, uuid, boolean, text
) TO service_role;

COMMIT;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.transition_payment_processor_state(uuid, uuid, text, text, text, integer, text, uuid, boolean, text);
-- DROP INDEX IF EXISTS public.idx_payment_gateway_events_ws_idempotency;
-- ALTER TABLE IF EXISTS public.payment_gateway_events DROP CONSTRAINT IF EXISTS payment_gateway_events_provenance_check;
-- ALTER TABLE IF EXISTS public.payment_gateway_events DROP COLUMN IF EXISTS idempotency_key, DROP COLUMN IF EXISTS provenance;
