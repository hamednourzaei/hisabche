-- ============================================
-- docs/payment-gateway-events-02-rpc-migration.sql
--
-- V100 P0 (4.1): Raw-Body Provider Webhook Replay Protection & Atomic RPC
--   - Extends `payment_gateway_events` with `event_id`, `event_type`, `amount_minor`,
--     `currency`, `payload_sha256`, `processing_status`, `delivery_attempts`, `last_error`.
--   - Enforces unique idempotency on `(workspace_id, gateway_name, event_id)` and
--     `(workspace_id, payment_id, external_ref, to_state)`.
--   - Adds `public.apply_payment_gateway_event(...)` with `FOR UPDATE` payment lock,
--     amount/currency verification, FSM validation, atomic state upsert & immutable event trail.
-- Additive, idempotent. Human-applied only.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_gateway_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  processor_state text NOT NULL CHECK (
    processor_state IN ('queued_offline', 'pending_capture', 'captured', 'declined', 'voided')
  ),
  gateway_name text,
  external_ref text,
  fee_minor integer NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
  currency text NOT NULL CHECK (char_length(trim(currency)) BETWEEN 3 AND 8),
  reason text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, payment_id)
);

ALTER TABLE public.payment_gateway_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_gateway_states FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.payment_gateway_states TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'payment_gateway_states'
      AND policyname = 'payment_gateway_states_workspace_isolation'
  ) THEN
    CREATE POLICY payment_gateway_states_workspace_isolation ON public.payment_gateway_states
      FOR ALL TO authenticated
      USING (
        workspace_id IN (
          SELECT wm.workspace_id FROM public.workspace_members wm
          WHERE wm.user_id = auth.uid() AND wm.has_access = true AND wm.suspended_at IS NULL
        )
      )
      WITH CHECK (
        workspace_id IN (
          SELECT wm.workspace_id FROM public.workspace_members wm
          WHERE wm.user_id = auth.uid() AND wm.has_access = true AND wm.suspended_at IS NULL
        )
      );
  END IF;
END $$;

ALTER TABLE IF EXISTS public.payment_gateway_states
  ADD COLUMN IF NOT EXISTS gateway_name text,
  ADD COLUMN IF NOT EXISTS external_ref text,
  ADD COLUMN IF NOT EXISTS fee_minor integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

CREATE TABLE IF NOT EXISTS public.payment_gateway_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  from_state text,
  to_state text NOT NULL CHECK (
    to_state IN ('queued_offline', 'pending_capture', 'captured', 'declined', 'voided')
  ),
  gateway_name text,
  external_ref text,
  fee_minor integer NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
  signature_verified boolean NOT NULL DEFAULT false,
  reason text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_gateway_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_gateway_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.payment_gateway_events TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'payment_gateway_events'
      AND policyname = 'payment_gateway_events_workspace_isolation'
  ) THEN
    CREATE POLICY payment_gateway_events_workspace_isolation ON public.payment_gateway_events
      FOR ALL TO authenticated
      USING (
        workspace_id IN (
          SELECT wm.workspace_id FROM public.workspace_members wm
          WHERE wm.user_id = auth.uid() AND wm.has_access = true AND wm.suspended_at IS NULL
        )
      )
      WITH CHECK (
        workspace_id IN (
          SELECT wm.workspace_id FROM public.workspace_members wm
          WHERE wm.user_id = auth.uid() AND wm.has_access = true AND wm.suspended_at IS NULL
        )
      );
  END IF;
END $$;

ALTER TABLE IF EXISTS public.payment_gateway_events
  ADD COLUMN IF NOT EXISTS from_state text,
  ADD COLUMN IF NOT EXISTS to_state text,
  ADD COLUMN IF NOT EXISTS gateway_name text,
  ADD COLUMN IF NOT EXISTS external_ref text,
  ADD COLUMN IF NOT EXISTS fee_minor integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signature_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS actor_id uuid,
  ADD COLUMN IF NOT EXISTS event_id text,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS amount_minor bigint,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS payload_sha256 text,
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'processed',
  ADD COLUMN IF NOT EXISTS delivery_attempts integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_error text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_gateway_events_processing_status_check'
      AND conrelid = 'public.payment_gateway_events'::regclass
  ) THEN
    ALTER TABLE public.payment_gateway_events
      ADD CONSTRAINT payment_gateway_events_processing_status_check
      CHECK (processing_status IN ('processed', 'replayed', 'failed'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_gateway_events_ws_event_id
  ON public.payment_gateway_events (workspace_id, gateway_name, event_id)
  WHERE event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_gateway_events_ws_ref_state
  ON public.payment_gateway_events (workspace_id, payment_id, external_ref, to_state)
  WHERE external_ref IS NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_payment_gateway_event(
  p_payment_id uuid,
  p_gateway_name text,
  p_event_id text,
  p_event_type text,
  p_to_state text,
  p_external_ref text,
  p_fee_minor integer,
  p_amount_minor bigint,
  p_currency text,
  p_scale integer,
  p_payload_sha256 text,
  p_reason text,
  p_actor_id uuid
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
  v_expected_minor bigint;
BEGIN
  IF p_to_state NOT IN ('queued_offline', 'pending_capture', 'captured', 'declined', 'voided') THEN
    RAISE EXCEPTION 'INVALID_PROCESSOR_STATE';
  END IF;
  IF p_fee_minor IS NULL OR p_fee_minor < 0 THEN
    RAISE EXCEPTION 'INVALID_FEE_MINOR';
  END IF;
  IF p_scale IS NULL OR p_scale NOT IN (1, 10, 100, 1000) THEN
    RAISE EXCEPTION 'INVALID_CURRENCY_SCALE';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND';
  END IF;

  IF p_currency IS NOT NULL AND upper(trim(p_currency)) <> upper(trim(v_payment.currency)) THEN
    RAISE EXCEPTION 'GATEWAY_CURRENCY_MISMATCH';
  END IF;

  v_expected_minor := round(v_payment.amount * p_scale)::bigint;
  IF p_amount_minor IS NOT NULL AND p_amount_minor <> v_expected_minor THEN
    RAISE EXCEPTION 'GATEWAY_AMOUNT_MISMATCH';
  END IF;

  IF p_event_id IS NOT NULL AND trim(p_event_id) <> '' THEN
    SELECT * INTO v_replay
    FROM public.payment_gateway_events
    WHERE workspace_id = v_payment.workspace_id
      AND gateway_name = p_gateway_name
      AND event_id = p_event_id
    LIMIT 1;
  END IF;

  IF v_replay.id IS NULL AND p_external_ref IS NOT NULL AND trim(p_external_ref) <> '' THEN
    SELECT * INTO v_replay
    FROM public.payment_gateway_events
    WHERE workspace_id = v_payment.workspace_id
      AND payment_id = p_payment_id
      AND external_ref = p_external_ref
      AND to_state = p_to_state
    LIMIT 1;
  END IF;

  SELECT * INTO v_existing
  FROM public.payment_gateway_states
  WHERE workspace_id = v_payment.workspace_id
    AND payment_id = p_payment_id
  FOR UPDATE;

  IF v_replay.id IS NOT NULL AND v_existing.id IS NOT NULL THEN
    UPDATE public.payment_gateway_events
    SET delivery_attempts = delivery_attempts + 1
    WHERE id = v_replay.id;

    RETURN jsonb_build_object(
      'workspaceId', v_payment.workspace_id,
      'paymentId', v_existing.payment_id,
      'processorState', v_existing.processor_state,
      'externalRef', v_existing.external_ref,
      'eventId', COALESCE(p_event_id, v_replay.event_id),
      'currency', v_payment.currency,
      'signatureVerified', true,
      'replay', true
    );
  END IF;

  v_current := COALESCE(
    v_existing.processor_state,
    CASE WHEN v_payment.method = 'cash' THEN 'captured' ELSE 'queued_offline' END
  );

  IF v_current <> p_to_state THEN
    IF NOT (
      (v_current = 'queued_offline' AND p_to_state IN ('pending_capture', 'captured', 'declined', 'voided')) OR
      (v_current = 'pending_capture' AND p_to_state IN ('captured', 'declined', 'voided')) OR
      (v_current = 'captured' AND p_to_state = 'voided') OR
      (v_current = 'declined' AND p_to_state = 'pending_capture')
    ) THEN
      RAISE EXCEPTION 'PROCESSOR_STATE_TRANSITION_NOT_ALLOWED';
    END IF;
  END IF;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.payment_gateway_states
    SET processor_state = p_to_state,
        gateway_name = p_gateway_name,
        external_ref = p_external_ref,
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
      v_payment.workspace_id, p_payment_id, p_to_state, p_gateway_name, p_external_ref,
      p_fee_minor, v_payment.currency, p_reason, p_actor_id, v_now
    )
    RETURNING * INTO v_saved;
  END IF;

  INSERT INTO public.payment_gateway_events (
    workspace_id, payment_id, from_state, to_state, gateway_name, external_ref,
    fee_minor, signature_verified, reason, actor_id, event_id, event_type,
    amount_minor, currency, payload_sha256, processing_status, delivery_attempts
  ) VALUES (
    v_payment.workspace_id, p_payment_id, v_current, p_to_state, p_gateway_name, p_external_ref,
    p_fee_minor, true, COALESCE(p_reason, 'HMAC-SHA256 verified provider webhook'), p_actor_id,
    NULLIF(trim(COALESCE(p_event_id, '')), ''), p_event_type,
    p_amount_minor, v_payment.currency, p_payload_sha256, 'processed', 1
  );

  RETURN jsonb_build_object(
    'workspaceId', v_payment.workspace_id,
    'paymentId', v_saved.payment_id,
    'processorState', v_saved.processor_state,
    'externalRef', v_saved.external_ref,
    'eventId', p_event_id,
    'currency', v_payment.currency,
    'signatureVerified', true,
    'replay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_payment_gateway_event(
  uuid, text, text, text, text, text, integer, bigint, text, integer, text, text, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_payment_gateway_event(
  uuid, text, text, text, text, text, integer, bigint, text, integer, text, text, uuid
) TO service_role;

COMMIT;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.apply_payment_gateway_event(uuid, text, text, text, text, text, integer, bigint, text, integer, text, text, uuid);
-- DROP INDEX IF EXISTS public.idx_payment_gateway_events_ws_ref_state;
-- DROP INDEX IF EXISTS public.idx_payment_gateway_events_ws_event_id;
-- ALTER TABLE IF EXISTS public.payment_gateway_events DROP CONSTRAINT IF EXISTS payment_gateway_events_processing_status_check;
-- ALTER TABLE IF EXISTS public.payment_gateway_events DROP COLUMN IF EXISTS last_error, DROP COLUMN IF EXISTS delivery_attempts, DROP COLUMN IF EXISTS processing_status, DROP COLUMN IF EXISTS payload_sha256, DROP COLUMN IF EXISTS currency, DROP COLUMN IF EXISTS amount_minor, DROP COLUMN IF EXISTS event_type, DROP COLUMN IF EXISTS event_id;
