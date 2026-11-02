-- ============================================================================
-- docs/inventory-void-receipt-01-migration.sql
--
-- A purchase invoice that is cancelled or deleted must take its COST LAYERS out of the stock valuation.
--
-- WHY (measured in backend/src/services/invoice.service.ts, reverseEffects): cancelling a purchase returns the stock movements and
-- reverses the ledger entry, but the cost layers the purchase created stay with their remaining quantity. The inventory
-- account drops, the layer table does not, so valuation and later sales could draw from goods that no longer exist.
--
-- RULE (no invented cost): a receipt may be voided ONLY while NONE of it has been consumed (remaining = received on every layer
-- of the document). A layer that a sale, transfer or return already drew from refuses the whole void with PURCHASE_LAYER_CONSUMED,
-- and nothing changes. The caller refuses the cancel/delete before touching anything else.
--
-- ADDITIVE and IDEMPOTENT: one nullable column (voided_at: a voided layer must not read as a CONSUMED one, or a retried cancel would be
-- refused) and one function, CREATE OR REPLACE. Layers keep their rows (audit trail); remaining_qty becomes 0, which
-- cost_layers_qty_check allows.
--
-- ROLLBACK / MITIGATION: DROP FUNCTION public.inventory_void_receipt(uuid, uuid, text, uuid); the application then behaves as before
-- (a cancelled purchase leaves its layers). The column can stay (nullable, unused). Creating or dropping the function changes no data.
-- ============================================================================

ALTER TABLE public.cost_layers ADD COLUMN IF NOT EXISTS voided_at timestamptz;

CREATE OR REPLACE FUNCTION public.inventory_void_receipt(
  p_workspace_id  uuid,
  p_user_id       uuid,
  p_source_type   text,
  p_source_id     uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_layers    integer := 0;
  v_quantity  numeric(18, 4) := 0;
  v_consumed  integer := 0;
BEGIN
  -- Lock every layer of the document first: a sale drawing from one of them waits, then sees remaining = 0.
  PERFORM 1
     FROM public.cost_layers
    WHERE workspace_id = p_workspace_id
      AND source_type = p_source_type
      AND source_id = p_source_id
    FOR UPDATE;

  SELECT count(*), COALESCE(sum(received_qty), 0),
         count(*) FILTER (WHERE voided_at IS NULL AND remaining_qty < received_qty)
    INTO v_layers, v_quantity, v_consumed
    FROM public.cost_layers
   WHERE workspace_id = p_workspace_id
     AND source_type = p_source_type
     AND source_id = p_source_id;

  IF v_consumed > 0 THEN
    RAISE EXCEPTION 'PURCHASE_LAYER_CONSUMED: % of % cost layers of this receipt were already drawn from', v_consumed, v_layers
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.cost_layers
     SET remaining_qty = 0, voided_at = now()
   WHERE workspace_id = p_workspace_id
     AND source_type = p_source_type
     AND source_id = p_source_id
     AND voided_at IS NULL;

  RETURN jsonb_build_object('layers', v_layers, 'quantity', v_quantity);
END;
$fn$;

REVOKE ALL ON FUNCTION public.inventory_void_receipt(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_void_receipt(uuid, uuid, text, uuid) TO service_role;

COMMENT ON FUNCTION public.inventory_void_receipt(uuid, uuid, text, uuid) IS 'inventory-void-receipt:rev1';
