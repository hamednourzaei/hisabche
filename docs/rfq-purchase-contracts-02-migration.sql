-- ============================================================================
-- docs/rfq-purchase-contracts-02-migration.sql
--
-- V61 audit (12 Nov 2026) — choosing a supplier quotation is ONE transaction.
--
-- Before: `RfqContractsService.chooseQuotation` wrote three tables with three
-- separate supabase-js calls (a purchase order, the quotation, the RFQ),
-- ignored the errors of the last two, divided the total by 100 (wrong for
-- AFN, which has no minor unit), used the UTC date, and a double click made
-- two purchase orders. It also wrote `purchase_orders`, a table no screen
-- reads any more (purchases are purchase invoices, CLAUDE.md «دو خط موازی»).
--
-- After: `rfq_choose_quotation` locks the RFQ, then the quotation (always in
-- that order, so two people choosing at once cannot deadlock), checks the
-- RFQ is open, the quotation is still submitted and not expired on the
-- business's own day, marks it chosen, rejects the RFQ's other open
-- quotations and awards the RFQ. It creates NO purchase document — the
-- purchase invoice is recorded from the invoice builder, like every other.
--
-- Additive, idempotent, safe to run twice.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- (docs/VERIFY-rfq-purchase-contracts-02.sql).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.rfq_choose_quotation(
  p_workspace_id uuid,
  p_quotation_id uuid,
  p_today date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rfq_id uuid;
  v_rfq record;
  v_q record;
BEGIN
  IF p_workspace_id IS NULL OR p_quotation_id IS NULL OR p_today IS NULL THEN
    RAISE EXCEPTION 'RFQ_CHOOSE_ARGUMENTS_REQUIRED' USING ERRCODE = '22023';
  END IF;

  -- Which RFQ — read without a lock, only to know what to lock first.
  SELECT rfq_id INTO v_rfq_id
    FROM public.supplier_quotations
   WHERE id = p_quotation_id AND workspace_id = p_workspace_id;
  IF v_rfq_id IS NULL THEN
    RAISE EXCEPTION 'RFQ_QUOTATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- Lock order: RFQ, then quotation.
  SELECT * INTO v_rfq
    FROM public.rfqs
   WHERE id = v_rfq_id AND workspace_id = p_workspace_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RFQ_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_q
    FROM public.supplier_quotations
   WHERE id = p_quotation_id AND workspace_id = p_workspace_id
     FOR UPDATE;

  IF v_rfq.status <> 'open' THEN
    RAISE EXCEPTION 'RFQ_NOT_OPEN' USING ERRCODE = '55000';
  END IF;
  IF v_q.status <> 'submitted' THEN
    RAISE EXCEPTION 'QUOTATION_NOT_OPEN' USING ERRCODE = '55000';
  END IF;
  IF v_q.valid_until < p_today THEN
    RAISE EXCEPTION 'QUOTATION_EXPIRED' USING ERRCODE = '55000';
  END IF;

  UPDATE public.supplier_quotations
     SET status = 'chosen'
   WHERE id = p_quotation_id AND workspace_id = p_workspace_id;

  UPDATE public.supplier_quotations
     SET status = 'rejected'
   WHERE rfq_id = v_rfq_id
     AND workspace_id = p_workspace_id
     AND id <> p_quotation_id
     AND status = 'submitted';

  UPDATE public.rfqs
     SET status = 'awarded'
   WHERE id = v_rfq_id AND workspace_id = p_workspace_id;

  RETURN (
    SELECT to_jsonb(q) FROM public.supplier_quotations q WHERE q.id = p_quotation_id
  );
END;
$$;

-- Backend only: Supabase grants new functions to everyone, service_role included.
REVOKE ALL ON FUNCTION public.rfq_choose_quotation(uuid, uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rfq_choose_quotation(uuid, uuid, date) TO service_role;

-- A quotation is reached by RFQ; the RFQ list reads them together.
CREATE INDEX IF NOT EXISTS supplier_quotations_rfq_idx
  ON public.supplier_quotations (workspace_id, rfq_id);

COMMIT;

-- ----------------------------------------------------------------------------
-- Rollback / Mitigation (manual):
--   DROP FUNCTION IF EXISTS public.rfq_choose_quotation(uuid, uuid, date);
--   DROP INDEX IF EXISTS public.supplier_quotations_rfq_idx;
-- Without the function the backend answers 503 RFQ_CHOOSE_NOT_INSTALLED; it
-- never falls back to the old three-call write.
-- ----------------------------------------------------------------------------
