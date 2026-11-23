-- ============================================================================
-- docs/order-deposit-balances-01-migration.sql
--
-- One database call for the balances of MANY deposits.
-- Safety classification: ADDITIVE (one new function; nothing altered or dropped)
--
-- WHY. The customer screen needed `order_deposit_balance` (the definition
-- apply/refund validate against) for each row, which is one RPC per deposit —
-- the N+1 the batch read removed. Removing it was worse: the service then
-- subtracted amount − applied − refunded in Node, so the figure a person reads
-- and the figure the database refuses against were two implementations again.
--
-- This function is the SAME arithmetic, once, for a whole page:
--
--   amount_minor − SUM(live applications) − SUM(live refunds)
--
-- where «live» means the deposit's payment still has `status = 'posted'`, the
-- same join `order_deposit_balance` uses. A deposit that does not exist, or
-- belongs to another workspace, simply has no row: the caller already read the
-- rows and a missing balance is a fault it reports, never a zero.
--
-- Status: PENDING HUMAN CONFIRMATION
-- After running, run docs/VERIFY-order-deposit-balances-01.sql.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.order_deposit_balances(
  p_workspace_id uuid,
  p_deposit_ids  uuid[]
) RETURNS TABLE (
  deposit_id     uuid,
  amount_minor   bigint,
  applied_minor  bigint,
  refunded_minor bigint,
  remaining_minor bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT d.id,
         d.amount_minor,
         COALESCE(a.total, 0::bigint),
         COALESCE(r.total, 0::bigint),
         d.amount_minor - COALESCE(a.total, 0::bigint) - COALESCE(r.total, 0::bigint)
    FROM public.order_deposits d
    LEFT JOIN (
      SELECT ap.deposit_id, SUM(ap.amount_minor) AS total
        FROM public.order_deposit_applications ap
        JOIN public.payments p
          ON p.id = ap.payment_id AND p.workspace_id = ap.workspace_id
       WHERE ap.workspace_id = p_workspace_id
         AND p.status = 'posted'
       GROUP BY ap.deposit_id
    ) a ON a.deposit_id = d.id
    LEFT JOIN (
      SELECT rf.deposit_id, SUM(rf.amount_minor) AS total
        FROM public.order_deposit_refunds rf
        JOIN public.payments p
          ON p.id = rf.payment_id AND p.workspace_id = rf.workspace_id
       WHERE rf.workspace_id = p_workspace_id
         AND p.status = 'posted'
       GROUP BY rf.deposit_id
    ) r ON r.deposit_id = d.id
   WHERE d.workspace_id = p_workspace_id
     AND d.id = ANY(p_deposit_ids)
   ORDER BY d.created_at, d.id
$fn$;

COMMENT ON FUNCTION public.order_deposit_balances(uuid, uuid[]) IS
  'The balance of many order-deposit rows in one call: amount_minor minus live applications and refunds (payment status = posted), the same arithmetic as order_deposit_balance. Batching exists so a screen does not read the database per row and does not subtract in Node.';

-- ── Nobody but the server may call it ──────────────────────────────────────
REVOKE ALL ON FUNCTION public.order_deposit_balances(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_deposit_balances(uuid, uuid[]) TO service_role;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK BLOCK (manual)
-- ============================================================================
-- DROP FUNCTION IF EXISTS public.order_deposit_balances(uuid, uuid[]);
-- Nothing else changes: order_deposit_balance, the tables and their grants stay
-- exactly as they were. A backend that expects this function falls back to the
-- per-deposit order_deposit_balance calls when it is absent.
-- ============================================================================
