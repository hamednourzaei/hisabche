-- ═══════════════════════════════════════════════════════════════════════════
-- opening-capital-and-fees-01 — what the business started with, and what a
-- transfer cost
-- ═══════════════════════════════════════════════════════════════════════════
--
-- TWO GAPS, ONE SMALL MIGRATION.
--
-- 1. OPENING CAPITAL. A shop that began with cash in the drawer and goods on
--    the shelf had no way to say so. Its first cash purchase then drove the
--    cash account below zero, and the balance sheet showed a negative till.
--      · accounts.role 'owner_capital'   — the equity account both are credited to
--      · pos_cash_movements.kind 'opening_capital' — the cash of it, in the
--        till it was put in. Posted to the ledger when it is recorded, so the
--        till's close does not book it a second time (like a bank transfer).
--
-- 2. THE FEE OF A PAYMENT. A money changer or a bank keeps part of what moves.
--    That is a cost, not an exchange gain or loss, and not the party's debt.
--      · accounts.role 'bank_fees'       — the expense account
--      · payments.fee_amount             — the fee, in the payment's currency
--      · payments_record_with_fee()      — payment, allocations, till and fee
--                                          in ONE transaction
--
-- Additive and re-runnable. Needs till-payments-01.
--
-- ROLLBACK / MITIGATION (nothing here destroys data):
--   DROP FUNCTION IF EXISTS public.payments_record_with_fee(uuid, uuid, jsonb, jsonb, text, uuid, bigint, numeric);
--   -- payments.fee_amount can stay: NULL = no fee, which is the old behaviour.
--   -- Take a role or the movement kind out of its CHECK only if no row uses it.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The two accounts
-- ---------------------------------------------------------------------------

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_role_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_role_check CHECK (
  role IS NULL OR role IN (
    'bank', 'cash', 'receivable', 'payable', 'tax',
    'inventory', 'cogs', 'sales', 'purchase',
    'retained_earnings', 'current_year_earnings',
    'salary_expense',
    'fx_gain_loss',
    -- What the owner put in to start: cash and goods.
    'owner_capital',
    -- What a bank or a money changer kept of a payment.
    'bank_fees'
  )
);

-- ---------------------------------------------------------------------------
-- 2. Opening capital in a till
-- ---------------------------------------------------------------------------

ALTER TABLE public.pos_cash_movements DROP CONSTRAINT IF EXISTS pos_cash_movements_kind_check;
ALTER TABLE public.pos_cash_movements ADD CONSTRAINT pos_cash_movements_kind_check
  CHECK (kind IN ('cash_in', 'cash_out', 'transfer_to_bank', 'transfer_from_bank',
                  'opening_capital'));

-- ---------------------------------------------------------------------------
-- 3. The fee on a payment
-- ---------------------------------------------------------------------------

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS fee_amount numeric(18, 2);

COMMENT ON COLUMN public.payments.fee_amount IS
  'What a bank or money changer kept, in the payment''s own currency. NULL = none. Money in: the business received amount - fee. Money out: it paid amount + fee.';

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'payments_fee_positive'
                    AND conrelid = 'public.payments'::regclass) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_fee_positive CHECK (fee_amount IS NULL OR fee_amount > 0);
  END IF;
END
$do$;

CREATE OR REPLACE FUNCTION public.payments_record_with_fee(
  p_workspace_id      uuid,
  p_user_id           uuid,
  p_payment           jsonb,
  p_allocations       jsonb,
  p_client_request_id text,
  p_session_id        uuid,
  p_till_amount_minor bigint,
  p_fee_amount        numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_existing uuid;
  v_out      jsonb;
  v_id       uuid;
  v_amount   numeric := (p_payment ->> 'amount')::numeric;
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- A retry of a request already answered: the same payment, nothing new.
  IF p_client_request_id IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.payments
     WHERE workspace_id = p_workspace_id AND client_request_id = p_client_request_id;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('payment_id', v_existing, 'replayed', true);
    END IF;
  END IF;

  IF p_fee_amount IS NULL OR p_fee_amount <= 0 THEN
    RAISE EXCEPTION 'PAYMENT_FEE_INVALID' USING ERRCODE = 'P0001';
  END IF;
  -- Money in: the fee came out of what was sent, so it cannot be all of it.
  IF (p_payment ->> 'direction') = 'in' AND p_fee_amount >= v_amount THEN
    RAISE EXCEPTION 'PAYMENT_FEE_EXCEEDS_AMOUNT' USING ERRCODE = 'P0001';
  END IF;

  -- The payment itself is written by the functions that already write it.
  IF p_session_id IS NOT NULL THEN
    v_out := public.payments_record_at_till(
      p_workspace_id, p_user_id, p_payment, p_allocations,
      p_client_request_id, p_session_id, p_till_amount_minor);
  ELSIF p_client_request_id IS NOT NULL THEN
    v_out := public.payments_record_keyed(
      p_workspace_id, p_user_id, p_payment, p_allocations, p_client_request_id);
  ELSE
    v_out := jsonb_build_object(
      'payment_id', public.payments_record(p_workspace_id, p_user_id, p_payment, p_allocations),
      'replayed', false);
  END IF;

  v_id := (v_out ->> 'payment_id')::uuid;
  IF COALESCE((v_out ->> 'replayed')::boolean, false) THEN
    RETURN jsonb_build_object('payment_id', v_id, 'replayed', true);
  END IF;

  UPDATE public.payments SET fee_amount = p_fee_amount
   WHERE id = v_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object('payment_id', v_id, 'replayed', false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.payments_record_with_fee(uuid, uuid, jsonb, jsonb, text, uuid, bigint, numeric)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payments_record_with_fee(uuid, uuid, jsonb, jsonb, text, uuid, bigint, numeric)
  TO service_role;

COMMIT;
