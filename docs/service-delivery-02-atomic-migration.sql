-- ============================================================================
-- Hisabche Migration: Service Delivery - atomic deliver / cancel (M4 audit)
-- File: docs/service-delivery-02-atomic-migration.sql
-- Status: Post-migration verification query generated - PENDING HUMAN CONFIRMATION
--
-- Needs: docs/package-credit-ledger-01-migration.sql and docs/service-delivery-01-migration.sql already applied.
-- Additive and idempotent. Nothing is deleted or rewritten; the append-only ledger is only ever INSERTed into.
--
-- WHY
--   Delivering a session was two round trips (consume credit, then update the session) and cancelling was two more.
--   A crash between them left a credit consumed with the session not delivered, or the reverse; two simultaneous
--   deliveries both passed the status check. These two functions do each action in ONE transaction, with the session
--   row locked, and make the ledger itself refuse a second consume / reversal for the same session.
--
-- RULES (the same ones the pure domain states - packages/validation .../service-delivery.domain.ts)
--   package_credit : needs a package and enough credit, else the whole call fails; never turns into another settlement
--   invoice        : needs an existing invoice of the SAME customer in the SAME workspace
--   complementary  : needs a reason
--   cancel         : a delivered package session is reversed by a compensating REVERSAL that references the consume;
--                    a delivered invoiced session is REFUSED (a correction flow, not a status flip)
--   identity       : the idempotency key of a delivery is derived from the session ('delivery_<id>' / 'delivery_cancel_<id>')
-- ============================================================================

-- 1. The reason a free session was free.
ALTER TABLE public.service_delivery_sessions
  ADD COLUMN IF NOT EXISTS settlement_reason text;

-- 2. A delivered session carries what its settlement needs. NOT VALID: rows written before this migration are not
--    rewritten or rejected; every NEW or UPDATED row is checked.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_delivery_free_has_reason') THEN
    ALTER TABLE public.service_delivery_sessions
      ADD CONSTRAINT chk_service_delivery_free_has_reason CHECK (
        status <> 'delivered' OR settlement_method <> 'complementary'
        OR (settlement_reason IS NOT NULL AND length(btrim(settlement_reason)) > 0)
      ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_delivery_invoice_has_invoice') THEN
    ALTER TABLE public.service_delivery_sessions
      ADD CONSTRAINT chk_service_delivery_invoice_has_invoice CHECK (
        status <> 'delivered' OR settlement_method <> 'invoice' OR invoice_id IS NOT NULL
      ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_delivery_credit_has_entry') THEN
    ALTER TABLE public.service_delivery_sessions
      ADD CONSTRAINT chk_service_delivery_credit_has_entry CHECK (
        status <> 'delivered' OR settlement_method <> 'package_credit' OR package_credit_id IS NOT NULL
      ) NOT VALID;
  END IF;
END $$;

-- 3. One consume and one reversal per service session - enforced by the ledger, not by the caller's good behaviour.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pkg_credit_service_consume
  ON public.package_credit_ledger (workspace_id, source_document_id)
  WHERE source_document_type = 'service_delivery' AND entry_type = 'CONSUME' AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pkg_credit_service_reversal
  ON public.package_credit_ledger (workspace_id, source_document_id)
  WHERE source_document_type = 'service_delivery' AND entry_type = 'REVERSAL' AND deleted_at IS NULL;

-- 3b. Row-level security by MEMBERSHIP, like every other tenant table. Migration 01 scoped the policy by a JWT claim
--     (`request.jwt.claims`) that the other tables do not use and that nothing in this codebase sets; the repository's
--     RLS guard accepts only the membership chain. The policy is replaced (idempotent); the server uses service_role
--     and is unaffected.
DROP POLICY IF EXISTS service_delivery_sessions_tenant_isolation ON public.service_delivery_sessions;
CREATE POLICY service_delivery_sessions_tenant_isolation ON public.service_delivery_sessions
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  );

-- 4. DELIVER: session transition + settlement fact in one transaction.
CREATE OR REPLACE FUNCTION public.service_delivery_deliver(
  p_workspace_id        uuid,
  p_session_id          uuid,
  p_settlement          text,
  p_package_product_id  uuid DEFAULT NULL,
  p_quantity            numeric DEFAULT 1,
  p_invoice_id          uuid DEFAULT NULL,
  p_reason              text DEFAULT NULL,
  p_entry_id            uuid DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_s        public.service_delivery_sessions%ROWTYPE;
  v_key      text;
  v_balance  numeric;
  v_entry_id uuid;
  v_existing public.package_credit_ledger%ROWTYPE;
  v_reason   text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  IF p_workspace_id IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_AND_SESSION_REQUIRED' USING ERRCODE = '22000';
  END IF;
  IF p_settlement IS NULL OR p_settlement NOT IN ('package_credit', 'invoice', 'complementary') THEN
    RAISE EXCEPTION 'SETTLEMENT_METHOD_REQUIRED' USING ERRCODE = '22000';
  END IF;

  -- The session row is locked for the whole call: two simultaneous deliveries queue here.
  SELECT * INTO v_s
    FROM public.service_delivery_sessions
   WHERE id = p_session_id AND workspace_id = p_workspace_id AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVICE_DELIVERY_SESSION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- A replay of a delivery that already happened: the same answer, nothing written.
  IF v_s.status = 'delivered' THEN
    IF v_s.settlement_method <> p_settlement THEN
      RAISE EXCEPTION 'SESSION_ALREADY_DELIVERED_DIFFERENTLY' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('replayed', true, 'session_id', v_s.id, 'status', v_s.status,
      'settlement_method', v_s.settlement_method, 'package_credit_id', v_s.package_credit_id,
      'invoice_id', v_s.invoice_id, 'updated_at', v_s.updated_at);
  END IF;

  IF v_s.status NOT IN ('scheduled', 'in_progress') THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION:%->delivered', v_s.status USING ERRCODE = 'P0001';
  END IF;

  IF p_expected_updated_at IS NOT NULL AND v_s.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'SESSION_CHANGED' USING ERRCODE = 'P0001';
  END IF;

  IF p_settlement = 'package_credit' THEN
    IF p_package_product_id IS NULL THEN
      RAISE EXCEPTION 'SETTLEMENT_PACKAGE_REQUIRED' USING ERRCODE = '22000';
    END IF;
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
      RAISE EXCEPTION 'CONSUMPTION_QUANTITY_MUST_BE_POSITIVE' USING ERRCODE = '22000';
    END IF;
    v_key := 'delivery_' || v_s.id::text;

    -- Serialise on the customer exactly as package_credit_consume does.
    PERFORM 1 FROM public.customers WHERE id = v_s.customer_id AND workspace_id = p_workspace_id FOR UPDATE;

    -- A consume already written for this session (an interrupted earlier attempt): reuse it, never write a second.
    SELECT * INTO v_existing
      FROM public.package_credit_ledger
     WHERE workspace_id = p_workspace_id AND idempotency_key = v_key AND deleted_at IS NULL
     LIMIT 1;
    IF FOUND THEN
      IF v_existing.customer_id <> v_s.customer_id OR v_existing.package_product_id <> p_package_product_id THEN
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH' USING ERRCODE = 'P0001';
      END IF;
      v_entry_id := v_existing.id;
    ELSE
      SELECT COALESCE(SUM(CASE
               WHEN entry_type IN ('GRANT', 'ADJUSTMENT', 'REVERSAL') THEN quantity
               WHEN entry_type IN ('CONSUME', 'EXPIRE') THEN -quantity
               ELSE 0 END), 0)
        INTO v_balance
        FROM public.package_credit_ledger
       WHERE workspace_id = p_workspace_id AND customer_id = v_s.customer_id
         AND package_product_id = p_package_product_id AND deleted_at IS NULL;
      IF v_balance < p_quantity THEN
        RAISE EXCEPTION 'INSUFFICIENT_PACKAGE_CREDIT: available % is less than requested %', v_balance, p_quantity
          USING ERRCODE = 'P0001';
      END IF;

      v_entry_id := COALESCE(p_entry_id, gen_random_uuid());
      INSERT INTO public.package_credit_ledger (
        id, workspace_id, customer_id, package_product_id, entry_type, quantity,
        source_document_type, source_document_id, idempotency_key, notes, effective_date
      ) VALUES (
        v_entry_id, p_workspace_id, v_s.customer_id, p_package_product_id, 'CONSUME', p_quantity,
        'service_delivery', v_s.id, v_key, 'Delivered service session ' || v_s.id::text, v_s.session_date
      );
    END IF;

    UPDATE public.service_delivery_sessions
       SET status = 'delivered', settlement_method = 'package_credit', package_credit_id = v_entry_id
     WHERE id = v_s.id;

  ELSIF p_settlement = 'invoice' THEN
    IF p_invoice_id IS NULL THEN
      RAISE EXCEPTION 'SETTLEMENT_INVOICE_REQUIRED' USING ERRCODE = '22000';
    END IF;
    PERFORM 1 FROM public.invoices
     WHERE id = p_invoice_id AND workspace_id = p_workspace_id AND customer_id = v_s.customer_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SETTLEMENT_INVOICE_INVALID' USING ERRCODE = '22000';
    END IF;
    UPDATE public.service_delivery_sessions
       SET status = 'delivered', settlement_method = 'invoice', invoice_id = p_invoice_id
     WHERE id = v_s.id;

  ELSE
    IF v_reason IS NULL THEN
      RAISE EXCEPTION 'SETTLEMENT_REASON_REQUIRED' USING ERRCODE = '22000';
    END IF;
    UPDATE public.service_delivery_sessions
       SET status = 'delivered', settlement_method = 'complementary', settlement_reason = v_reason
     WHERE id = v_s.id;
  END IF;

  SELECT * INTO v_s FROM public.service_delivery_sessions WHERE id = p_session_id;
  RETURN jsonb_build_object('replayed', false, 'session_id', v_s.id, 'status', v_s.status,
    'settlement_method', v_s.settlement_method, 'package_credit_id', v_s.package_credit_id,
    'invoice_id', v_s.invoice_id, 'updated_at', v_s.updated_at);
END;
$$;

-- 5. CANCEL: session transition + compensating reversal in one transaction.
--    Created ONLY while migration 03 has not replaced it: re-running 02 after 03 must not bring the old
--    3-argument function (no reason) back next to the 4-argument one.
DO $guard$
BEGIN
  IF to_regprocedure('public.service_delivery_cancel(uuid, uuid, uuid, text)') IS NULL THEN
    EXECUTE $f$
CREATE OR REPLACE FUNCTION public.service_delivery_cancel(
  p_workspace_id uuid,
  p_session_id   uuid,
  p_entry_id     uuid DEFAULT NULL
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

  IF v_s.status = 'cancelled' THEN
    RETURN jsonb_build_object('replayed', true, 'session_id', v_s.id, 'status', v_s.status, 'reversal_entry_id', NULL);
  END IF;

  IF v_s.status NOT IN ('scheduled', 'in_progress', 'delivered') THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION:%->cancelled', v_s.status USING ERRCODE = 'P0001';
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

  UPDATE public.service_delivery_sessions SET status = 'cancelled' WHERE id = v_s.id;

  RETURN jsonb_build_object('replayed', false, 'session_id', v_s.id, 'status', 'cancelled', 'reversal_entry_id', v_rev_id);
END;
$$;

    $f$;
    REVOKE EXECUTE ON FUNCTION public.service_delivery_cancel(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.service_delivery_cancel(uuid, uuid, uuid) TO service_role;
  END IF;
END
$guard$;

REVOKE EXECUTE ON FUNCTION public.service_delivery_deliver(uuid, uuid, text, uuid, numeric, uuid, text, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_delivery_deliver(uuid, uuid, text, uuid, numeric, uuid, text, uuid, timestamptz) TO service_role;

-- ============================================================================
-- Rollback / mitigation (nothing here edits history, so rolling back loses no fact)
-- ============================================================================
/*
DROP FUNCTION IF EXISTS public.service_delivery_cancel(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.service_delivery_deliver(uuid, uuid, text, uuid, numeric, uuid, text, uuid, timestamptz);
DROP INDEX IF EXISTS public.uq_pkg_credit_service_reversal;
-- (the membership policy of 3b is left in place)
DROP INDEX IF EXISTS public.uq_pkg_credit_service_consume;
ALTER TABLE public.service_delivery_sessions DROP CONSTRAINT IF EXISTS chk_service_delivery_credit_has_entry;
ALTER TABLE public.service_delivery_sessions DROP CONSTRAINT IF EXISTS chk_service_delivery_invoice_has_invoice;
ALTER TABLE public.service_delivery_sessions DROP CONSTRAINT IF EXISTS chk_service_delivery_free_has_reason;
-- the settlement_reason column is left in place: it is additive and holds audit text.
*/
