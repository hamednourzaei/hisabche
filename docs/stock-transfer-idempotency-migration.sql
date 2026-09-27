-- ============================================================================
-- docs/stock-transfer-idempotency-migration.sql         (27 Sep 2026)
--
-- POST /api/stock-transfers with an Idempotency-Key moves the goods ONCE.
--
-- WHY
--   warehouse_transfer_stock inserts one stock_movements row per call. A
--   client that lost the response and retried moved the goods again — the
--   concurrency safety map listed it as a gap.
--
-- HOW
--   The backend derives the movement's id from (workspace, key) —
--   deterministic, so every retry of one request names the SAME id. The
--   movement's PRIMARY KEY then does the rest:
--     * already there (same workspace) → the first result, nothing moves;
--     * two copies at once → the second waits on the source-stock lock, then
--       hits the primary key and answers as a replay.
--   One implementation: warehouse_transfer_stock (unkeyed) now forwards to
--   the keyed function with a fresh id, so the two can never drift apart.
--
-- SAFETY
--   Additive, idempotent (CREATE OR REPLACE). Same checks, same single write,
--   same projection trigger as phase-c-01. Clients cannot call either
--   function (see also docs/rpc-client-revoke-migration.sql).
--
-- ROLLBACK
--   Re-run section 5 of docs/phase-c-01-inventory-source-of-truth-migration.sql
--   (the original warehouse_transfer_stock), then
--   DROP FUNCTION IF EXISTS public.warehouse_transfer_stock_keyed(uuid, uuid, jsonb, uuid);
--   The backend refuses keyed transfers (503 …_IDEMPOTENCY_MIGRATION_REQUIRED)
--   while the keyed function is missing; unkeyed ones keep working.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.warehouse_transfer_stock_keyed(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_payload      jsonb,
  p_movement_id  uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_product   uuid := (p_payload ->> 'product_id')::uuid;
  v_from      uuid := (p_payload ->> 'from_warehouse_id')::uuid;
  v_to        uuid := (p_payload ->> 'to_warehouse_id')::uuid;
  v_qty       numeric(18, 4) := (p_payload ->> 'quantity')::numeric;
  v_available numeric(18, 4);
  v_existing  uuid;
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'WAREHOUSE_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF p_movement_id IS NULL THEN
    RAISE EXCEPTION 'WAREHOUSE_TRANSFER_ID_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- A replay: this request already moved the goods.
  SELECT workspace_id INTO v_existing FROM stock_movements WHERE id = p_movement_id;
  IF FOUND THEN
    IF v_existing IS DISTINCT FROM p_workspace_id THEN
      RAISE EXCEPTION 'WAREHOUSE_TRANSFER_ID_CONFLICT' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object(
      'replayed', true,
      'remaining_at_source',
      (SELECT quantity FROM warehouse_stock WHERE warehouse_id = v_from AND product_id = v_product)
    );
  END IF;

  IF v_qty IS NULL OR v_qty <= 0 THEN
    RAISE EXCEPTION 'WAREHOUSE_TRANSFER_QUANTITY_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF v_from = v_to THEN
    RAISE EXCEPTION 'WAREHOUSE_TRANSFER_SAME_WAREHOUSE' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1 FROM warehouses
   WHERE id IN (v_from, v_to) AND workspace_id = p_workspace_id
   HAVING COUNT(*) = 2;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WAREHOUSE_NOT_IN_WORKSPACE' USING ERRCODE = 'P0001';
  END IF;

  -- Lock the source row so the availability check cannot be raced (and so a
  -- concurrent copy of THIS request waits here, then meets the primary key).
  SELECT quantity INTO v_available
    FROM warehouse_stock
   WHERE warehouse_id = v_from AND product_id = v_product
   FOR UPDATE;

  IF v_available IS NULL OR v_available < v_qty THEN
    RAISE EXCEPTION 'WAREHOUSE_INSUFFICIENT_STOCK' USING ERRCODE = 'P0001';
  END IF;

  -- The ONLY write. stock_movements_project() moves both warehouse rows.
  BEGIN
    INSERT INTO stock_movements (
      id, product_id, type, quantity, from_warehouse_id, to_warehouse_id,
      notes, workspace_id, user_id, reference_type
    ) VALUES (
      p_movement_id, v_product, 'transfer', v_qty, v_from, v_to,
      COALESCE(p_payload ->> 'notes', ''), p_workspace_id, p_user_id, 'transfer'
    );
  EXCEPTION WHEN unique_violation THEN
    -- The concurrent copy won. Nothing moved twice.
    RETURN jsonb_build_object(
      'replayed', true,
      'remaining_at_source',
      (SELECT quantity FROM warehouse_stock WHERE warehouse_id = v_from AND product_id = v_product)
    );
  END;

  RETURN jsonb_build_object('remaining_at_source', v_available - v_qty);
END;
$fn$;

-- The unkeyed entry point: the same implementation, with a fresh id.
CREATE OR REPLACE FUNCTION public.warehouse_transfer_stock(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_payload      jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  RETURN public.warehouse_transfer_stock_keyed(p_workspace_id, p_user_id, p_payload, gen_random_uuid());
END;
$fn$;

REVOKE ALL ON FUNCTION public.warehouse_transfer_stock_keyed(uuid, uuid, jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.warehouse_transfer_stock_keyed(uuid, uuid, jsonb, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.warehouse_transfer_stock(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.warehouse_transfer_stock(uuid, uuid, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.warehouse_transfer_stock_keyed(uuid, uuid, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.warehouse_transfer_stock(uuid, uuid, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
