-- ============================================================================
-- INSTALLMENTS — 01 (capability #123). Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-installments-01.sql.
--
-- An installment plan is WHEN the rest of one invoice is due, in parts. It is a
-- schedule and nothing else:
--
--   • it records no payment — money is still recorded with payments_record and
--     allocated to the invoice, and «how much of installment 2 is paid» is
--     DERIVED from the invoice's allocations, oldest installment first;
--   • it posts nothing to the ledger and charges no late fee;
--   • its parts add up to exactly what the invoice still owed when it was made.
--
-- Amounts are integer minor units (hundredths of the invoice's currency).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invoice_installments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  invoice_id   uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  seq          integer NOT NULL CHECK (seq >= 1),
  due_date     date NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  created_by   uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.invoice_installments IS
  'When the unpaid part of one invoice is due, in parts. A schedule only: payments stay in payments/payment_allocations.';

CREATE UNIQUE INDEX IF NOT EXISTS invoice_installments_invoice_seq
  ON public.invoice_installments (invoice_id, seq);
CREATE INDEX IF NOT EXISTS invoice_installments_due_idx
  ON public.invoice_installments (workspace_id, due_date);

ALTER TABLE public.invoice_installments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_installments FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.invoice_installments TO service_role;

-- ─── Saving a plan ──────────────────────────────────────────────────────────
-- Replaces the invoice's plan in one transaction. `p_lines` is a JSON array of
-- { seq, due_date, amount_minor }; an EMPTY array removes the plan.
--
-- The parts must add up to what the invoice still owes NOW (total − allocated),
-- read under a lock on the invoice — so a payment recorded at the same moment
-- cannot leave a plan that asks for money already paid.

CREATE OR REPLACE FUNCTION public.installments_save(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_invoice_id   uuid,
  p_lines        jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total       numeric;
  v_type        text;
  v_allocated   numeric;
  v_outstanding bigint;
  v_sum         bigint;
  v_count       integer;
BEGIN
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'INSTALLMENT_LINES_INVALID' USING ERRCODE = 'P0001';
  END IF;

  SELECT i.total, i.type INTO v_total, v_type
    FROM public.invoices i
   WHERE i.id = p_invoice_id AND i.workspace_id = p_workspace_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSTALLMENT_INVOICE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.invoice_installments
   WHERE invoice_id = p_invoice_id AND workspace_id = p_workspace_id;

  v_count := jsonb_array_length(p_lines);
  IF v_count = 0 THEN
    RETURN 0;
  END IF;

  IF v_count < 2 OR v_count > 60 THEN
    RAISE EXCEPTION 'INSTALLMENT_COUNT_INVALID' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(a.amount), 0) INTO v_allocated
    FROM public.payment_allocations a
   WHERE a.invoice_id = p_invoice_id;

  v_outstanding := round((v_total - v_allocated) * 100)::bigint;
  IF v_outstanding <= 0 THEN
    RAISE EXCEPTION 'INSTALLMENT_NOTHING_OWED' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM((l->>'amount_minor')::bigint), 0) INTO v_sum
    FROM jsonb_array_elements(p_lines) l;

  IF v_sum <> v_outstanding THEN
    RAISE EXCEPTION 'INSTALLMENT_SUM_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.invoice_installments
    (workspace_id, invoice_id, seq, due_date, amount_minor, created_by)
  SELECT p_workspace_id,
         p_invoice_id,
         (l->>'seq')::integer,
         (l->>'due_date')::date,
         (l->>'amount_minor')::bigint,
         p_user_id
    FROM jsonb_array_elements(p_lines) l;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.installments_save(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.installments_save(uuid, uuid, uuid, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Removes every installment plan. No payment, invoice or ledger row depends on
-- them: an invoice without a plan is simply due on its own due date.
--
--   DROP FUNCTION IF EXISTS public.installments_save(uuid, uuid, uuid, jsonb);
--   DROP TABLE IF EXISTS public.invoice_installments;
