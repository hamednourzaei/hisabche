-- ═══════════════════════════════════════════════════════════════════════════
-- till-payments-01 — a cash payment names the till it went into or came out of
-- ═══════════════════════════════════════════════════════════════════════════
--
-- BEFORE: `payments` had no till. Which drawer a cash payment reached was
-- worked out from WHO recorded it (the person with a drawer open, in that
-- currency, at that time). A purchase paid by the manager from the shop's
-- drawer landed in whatever drawer the manager happened to hold — or in none.
--
-- AFTER:
--   · payments.pos_session_id    — the till, chosen by the person. NULL = no
--                                  till was named (bank, card, credit, or cash
--                                  that never passed through a drawer).
--   · payments.till_amount_minor — what entered or left that drawer, in the
--                                  TILL's currency (minor units). Different
--                                  from `amount` when a toman payment is taken
--                                  into an afghani drawer at a rate.
--   · payments_record_at_till()  — the payment, its allocations and its till
--                                  in ONE transaction. The till must belong to
--                                  the workspace and be OPEN; only cash.
--   · accounts.role 'fx_gain_loss' — the account a difference between the rate
--                                  of an invoice and the rate of its payment
--                                  is booked to.
--
-- ⚠️ NO BACKFILL. A payment made before this has pos_session_id NULL and stays
--    so: which drawer it reached is not known, and guessing «the first till»
--    would be a false statement about real money (§12).
--
-- Additive and re-runnable. Needs: payments-ar-ap, offline-idempotency
-- (payments_record_keyed), pos (pos_sessions), accounting-core (accounts.role).
--
-- ROLLBACK / MITIGATION (nothing here destroys data; to undo the surface):
--   DROP FUNCTION IF EXISTS public.payments_record_at_till(uuid, uuid, jsonb, jsonb, text, uuid, bigint);
--   DROP TRIGGER IF EXISTS payments_till_guard_trg ON public.payments;
--   DROP FUNCTION IF EXISTS public.payments_till_guard();
--   -- The two columns can stay: NULL in both is exactly the old behaviour.
--   -- Remove 'fx_gain_loss' from accounts_role_check only if no account uses it.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The till on the payment
-- ---------------------------------------------------------------------------

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS pos_session_id    uuid;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS till_amount_minor bigint;

COMMENT ON COLUMN public.payments.pos_session_id IS
  'The till this cash entered (direction in) or left (direction out). Chosen by the person, never inferred. NULL = no till named.';
COMMENT ON COLUMN public.payments.till_amount_minor IS
  'What moved in that till, in the TILL''s currency, minor units. Set together with pos_session_id.';

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'payments_pos_session_fk'
                    AND conrelid = 'public.payments'::regclass) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_pos_session_fk
      FOREIGN KEY (pos_session_id) REFERENCES public.pos_sessions (id);
  END IF;

  -- Both or neither; and a drawer never moves by zero or less.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'payments_till_pair_check'
                    AND conrelid = 'public.payments'::regclass) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_till_pair_check CHECK (
        (pos_session_id IS NULL AND till_amount_minor IS NULL)
        -- IS NOT NULL is said: `NULL > 0` is NULL, and a CHECK passes on NULL.
        OR (pos_session_id IS NOT NULL AND till_amount_minor IS NOT NULL
            AND till_amount_minor > 0)
      );
  END IF;

  -- A bank transfer or a card is not money in a drawer.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'payments_till_cash_only'
                    AND conrelid = 'public.payments'::regclass) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_till_cash_only CHECK (
        pos_session_id IS NULL OR method = 'cash'
      );
  END IF;
END
$do$;

CREATE INDEX IF NOT EXISTS payments_pos_session_idx
  ON public.payments (workspace_id, pos_session_id)
  WHERE pos_session_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. A till of another business is not a till; and the till, once written, is
--    history — moving a payment to another drawer afterwards would change what
--    two closed counts said.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.payments_till_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.pos_session_id IS NOT NULL
     AND (NEW.pos_session_id IS DISTINCT FROM OLD.pos_session_id
          OR NEW.till_amount_minor IS DISTINCT FROM OLD.till_amount_minor) THEN
    RAISE EXCEPTION 'PAYMENT_TILL_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.pos_session_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.pos_sessions s
        WHERE s.id = NEW.pos_session_id AND s.workspace_id = NEW.workspace_id) THEN
    RAISE EXCEPTION 'PAYMENT_TILL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS payments_till_guard_trg ON public.payments;
CREATE TRIGGER payments_till_guard_trg
  BEFORE INSERT OR UPDATE OF pos_session_id, till_amount_minor, workspace_id
  ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.payments_till_guard();

REVOKE ALL ON FUNCTION public.payments_till_guard() FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Payment + allocations + till, one transaction
--
-- It does not re-implement the payment: it calls the function that already
-- writes it (keyed when a request key is given), then stamps the till on the
-- row it made. If anything raises, all of it rolls back.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.payments_record_at_till(
  p_workspace_id      uuid,
  p_user_id           uuid,
  p_payment           jsonb,
  p_allocations       jsonb,
  p_client_request_id text,
  p_session_id        uuid,
  p_till_amount_minor bigint
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_existing uuid;
  v_status   text;
  v_keyed    jsonb;
  v_id       uuid;
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- A retry of a request already answered: the same payment, whatever has
  -- happened to the till since (it may have been counted and closed).
  IF p_client_request_id IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.payments
     WHERE workspace_id = p_workspace_id AND client_request_id = p_client_request_id;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('payment_id', v_existing, 'replayed', true);
    END IF;
  END IF;

  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_TILL_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF p_till_amount_minor IS NULL OR p_till_amount_minor <= 0 THEN
    RAISE EXCEPTION 'PAYMENT_TILL_AMOUNT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(p_payment ->> 'method', 'cash') <> 'cash' THEN
    RAISE EXCEPTION 'PAYMENT_TILL_ONLY_CASH' USING ERRCODE = 'P0001';
  END IF;

  -- Held until this transaction ends: the till cannot be closed between this
  -- check and the payment landing in it.
  SELECT s.status INTO v_status
    FROM public.pos_sessions s
   WHERE s.id = p_session_id AND s.workspace_id = p_workspace_id
     FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_TILL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'PAYMENT_TILL_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;

  IF p_client_request_id IS NOT NULL THEN
    v_keyed := public.payments_record_keyed(
      p_workspace_id, p_user_id, p_payment, p_allocations, p_client_request_id);
    v_id := (v_keyed ->> 'payment_id')::uuid;
    IF COALESCE((v_keyed ->> 'replayed')::boolean, false) THEN
      RETURN jsonb_build_object('payment_id', v_id, 'replayed', true);
    END IF;
  ELSE
    v_id := public.payments_record(p_workspace_id, p_user_id, p_payment, p_allocations);
  END IF;

  UPDATE public.payments
     SET pos_session_id = p_session_id, till_amount_minor = p_till_amount_minor
   WHERE id = v_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object('payment_id', v_id, 'replayed', false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.payments_record_at_till(uuid, uuid, jsonb, jsonb, text, uuid, bigint)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payments_record_at_till(uuid, uuid, jsonb, jsonb, text, uuid, bigint)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 4. The account for exchange differences
-- ---------------------------------------------------------------------------

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_role_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_role_check CHECK (
  role IS NULL OR role IN (
    'bank', 'cash', 'receivable', 'payable', 'tax',
    'inventory', 'cogs', 'sales', 'purchase',
    'retained_earnings', 'current_year_earnings',
    'salary_expense',
    -- An invoice booked at one rate and paid at another: the difference is
    -- neither sales nor the customer's debt.
    'fx_gain_loss'
  )
);

COMMIT;
