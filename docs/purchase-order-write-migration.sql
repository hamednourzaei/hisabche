-- ============================================================================
-- docs/purchase-order-write-migration.sql               (27 Sep 2026)
--
-- ⚠️ RUN AFTER docs/invoice-write-document-migration.sql (it defines
-- document_write_rows, shared by both).
--
-- A purchase order and its lines in ONE transaction, and a retried create
-- returns the first order.
--
-- WHY
--   createPurchaseOrder inserted the header, then the lines, and on a lines
--   failure DELETEd the header — the compensating write CLAUDE.md rule 4
--   forbids (a second statement that can itself fail, leaving a header with
--   no lines and no error). And POST had no idempotency key: a double submit
--   created two orders and reserved the budget twice.
--
-- HOW
--   The backend builds both rows, with the order's id derived from the
--   Idempotency-Key when one is sent (deterministic: every retry names the
--   same id). This function writes them together; the primary key refuses a
--   second copy (23505), and the backend answers that with the first order.
--
-- SAFETY
--   Additive, idempotent. Every line must name this order and workspace.
--   Clients cannot call it (service_role only).
--
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.purchase_order_write(uuid, uuid, jsonb, jsonb);
--   The backend then writes the two rows one at a time (no compensating
--   DELETE either way) and refuses KEYED creates with 503 until it is back.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.purchase_order_write(
  p_workspace_id uuid,
  p_order_id uuid,
  p_order jsonb,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bad int;
BEGIN
  IF p_workspace_id IS NULL OR p_order_id IS NULL OR p_order IS NULL THEN
    RAISE EXCEPTION 'purchase_order_write: workspace, id and order are required' USING ERRCODE = '22023';
  END IF;
  IF (p_order ->> 'workspace_id')::uuid IS DISTINCT FROM p_workspace_id
     OR (p_order ->> 'id')::uuid IS DISTINCT FROM p_order_id THEN
    RAISE EXCEPTION 'purchase_order_write: order does not match workspace/id' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_bad FROM jsonb_array_elements(coalesce(p_items, '[]')) r
   WHERE (r ->> 'purchase_order_id')::uuid IS DISTINCT FROM p_order_id
      OR (r ->> 'workspace_id')::uuid IS DISTINCT FROM p_workspace_id;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'purchase_order_write: a line names another order or workspace' USING ERRCODE = '42501';
  END IF;

  PERFORM public.document_write_rows('purchase_orders', jsonb_build_array(p_order));
  PERFORM public.document_write_rows('purchase_order_items', p_items);
  RETURN p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_order_write(uuid, uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purchase_order_write(uuid, uuid, jsonb, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_order_write(uuid, uuid, jsonb, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
