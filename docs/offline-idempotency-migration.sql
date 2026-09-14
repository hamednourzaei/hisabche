-- ============================================================================
-- docs/offline-idempotency-migration.sql
--
-- NOTE: payments_record_keyed returns jsonb {payment_id, replayed}.
--
-- Every create an offline client can replay becomes idempotent per request:
-- customers, products, transactions and payments. (Invoices: already done in
-- docs/invoice-idempotency-migration.sql — PASS.)
--
-- WHY. The desktop queue sends `Idempotency-Key` to /customers, /products and
-- /transactions, and nothing read it. A request whose RESPONSE was lost was
-- replayed as a second customer, a second product — and for a payment, a
-- second receipt of the same money.
--
-- MODEL (same as invoices):
--   * `client_request_id text` on each table, NULL for every existing row;
--   * a partial unique index (workspace_id, client_request_id) — a second row
--     with the same key cannot exist;
--   * payments are written by the `payments_record` function (payment +
--     allocations, one transaction). Its body is NOT replaced here — the live
--     version is left exactly as it is. `payments_record_keyed` calls it and
--     stamps the key IN THE SAME TRANSACTION, so a duplicate key rolls back the
--     payment AND its allocations together.
--
-- EXISTING DATA: untouched.
-- ⚠️ CREATE INDEX briefly locks writes on each table; run at a quiet time.
--
-- ROLLBACK / MITIGATION
--   DROP FUNCTION IF EXISTS public.payments_record_keyed(uuid, uuid, jsonb, jsonb, text);
--   DROP INDEX IF EXISTS public.customers_client_request_key;
--   DROP INDEX IF EXISTS public.products_client_request_key;
--   DROP INDEX IF EXISTS public.transactions_client_request_key;
--   DROP INDEX IF EXISTS public.payments_client_request_key;
--   ALTER TABLE public.customers    DROP COLUMN IF EXISTS client_request_id;
--   ALTER TABLE public.products     DROP COLUMN IF EXISTS client_request_id;
--   ALTER TABLE public.transactions DROP COLUMN IF EXISTS client_request_id;
--   ALTER TABLE public.payments     DROP COLUMN IF EXISTS client_request_id;
--   (the backend then answers keyed creates 503 *_IDEMPOTENCY_MIGRATION_REQUIRED
--    and offline clients keep them queued — never an unkeyed copy)
--
-- ADDITIVE / IDEMPOTENT. SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

ALTER TABLE public.customers    ADD COLUMN IF NOT EXISTS client_request_id text;
ALTER TABLE public.products     ADD COLUMN IF NOT EXISTS client_request_id text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS client_request_id text;
ALTER TABLE public.payments     ADD COLUMN IF NOT EXISTS client_request_id text;

CREATE UNIQUE INDEX IF NOT EXISTS customers_client_request_key
  ON public.customers (workspace_id, client_request_id) WHERE client_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS products_client_request_key
  ON public.products (workspace_id, client_request_id) WHERE client_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_client_request_key
  ON public.transactions (workspace_id, client_request_id) WHERE client_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_client_request_key
  ON public.payments (workspace_id, client_request_id) WHERE client_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.payments_record_keyed(
  p_workspace_id      uuid,
  p_user_id           uuid,
  p_payment           jsonb,
  p_allocations       jsonb,
  p_client_request_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_existing   uuid;
  v_payment_id uuid;
BEGIN
  IF p_client_request_id IS NULL OR length(p_client_request_id) < 8 THEN
    RAISE EXCEPTION 'PAYMENT_REQUEST_KEY_INVALID' USING ERRCODE = 'P0001';
  END IF;

  -- A replay: answer with the payment this key already made.
  SELECT id INTO v_existing FROM payments
   WHERE workspace_id = p_workspace_id AND client_request_id = p_client_request_id;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('payment_id', v_existing, 'replayed', true);
  END IF;

  v_payment_id := public.payments_record(p_workspace_id, p_user_id, p_payment, p_allocations);

  -- Same transaction: a concurrent twin that got here first makes this raise
  -- 23505, and the payment + allocations above roll back with it.
  UPDATE payments SET client_request_id = p_client_request_id
   WHERE id = v_payment_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object('payment_id', v_payment_id, 'replayed', false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.payments_record_keyed(uuid, uuid, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payments_record_keyed(uuid, uuid, jsonb, jsonb, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
