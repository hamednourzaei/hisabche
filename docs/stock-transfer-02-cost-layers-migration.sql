-- ============================================================================
-- Hisabche Migration: Transfer Cost Layers on Stock Transfer
-- File: docs/stock-transfer-02-cost-layers-migration.sql
--
-- TARGET D: When stock is transferred between warehouses, the cost layers
-- must travel with the physical goods from source to destination warehouse.
-- Without this, sales at the destination warehouse find no cost layers
-- (shortfall/unknown cost).
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
  v_product     uuid := (p_payload ->> 'product_id')::uuid;
  v_from        uuid := (p_payload ->> 'from_warehouse_id')::uuid;
  v_to          uuid := (p_payload ->> 'to_warehouse_id')::uuid;
  v_qty         numeric(18, 4) := (p_payload ->> 'quantity')::numeric;
  v_available   numeric(18, 4);
  v_existing    uuid;
  v_existing_rec record;
  v_need        numeric(18, 4);
  v_layer       record;
  v_take        numeric(18, 4);
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'WAREHOUSE_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF p_movement_id IS NULL THEN
    RAISE EXCEPTION 'WAREHOUSE_TRANSFER_ID_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- A replay: this request already moved the goods.
  SELECT * INTO v_existing_rec FROM stock_movements WHERE id = p_movement_id;
  IF FOUND THEN
    IF v_existing_rec.workspace_id IS DISTINCT FROM p_workspace_id THEN
      RAISE EXCEPTION 'WAREHOUSE_TRANSFER_ID_CONFLICT' USING ERRCODE = '42501';
    END IF;
    IF v_existing_rec.product_id IS DISTINCT FROM v_product
       OR v_existing_rec.quantity IS DISTINCT FROM v_qty
       OR v_existing_rec.from_warehouse_id IS DISTINCT FROM v_from
       OR v_existing_rec.to_warehouse_id IS DISTINCT FROM v_to THEN
      RAISE EXCEPTION 'WAREHOUSE_TRANSFER_PAYLOAD_MISMATCH: this movement ID was already used with a different transfer payload'
        USING ERRCODE = 'P0001';
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

  -- Lock the source row so the availability check cannot be raced
  SELECT quantity INTO v_available
    FROM warehouse_stock
   WHERE warehouse_id = v_from AND product_id = v_product
   FOR UPDATE;

  IF v_available IS NULL OR v_available < v_qty THEN
    RAISE EXCEPTION 'WAREHOUSE_INSUFFICIENT_STOCK' USING ERRCODE = 'P0001';
  END IF;

  -- 1. Insert movement (stock_movements_project trigger updates warehouse_stock)
  INSERT INTO stock_movements (
    id, product_id, type, quantity, from_warehouse_id, to_warehouse_id,
    notes, workspace_id, created_by, date
  ) VALUES (
    p_movement_id, v_product, 'transfer', v_qty, v_from, v_to,
    p_payload ->> 'notes', p_workspace_id, p_user_id, CURRENT_DATE
  );

  -- 2. Transfer cost layers from source to destination warehouse
  v_need := v_qty;
  FOR v_layer IN
    SELECT id, unit_cost, remaining_qty
      FROM cost_layers
     WHERE workspace_id = p_workspace_id
       AND product_id = v_product
       AND warehouse_id = v_from
       AND remaining_qty > 0
     ORDER BY entry_date ASC, created_at ASC
     FOR UPDATE
  LOOP
    v_take := LEAST(v_layer.remaining_qty, v_need);

    UPDATE cost_layers
       SET remaining_qty = remaining_qty - v_take,
           updated_at = now()
     WHERE id = v_layer.id;

    INSERT INTO cost_layers (
      id, workspace_id, product_id, warehouse_id, source_type,
      source_id, source_line, quantity, remaining_qty, unit_cost,
      entry_date, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), p_workspace_id, v_product, v_to, 'transfer',
      p_movement_id, 1, v_take, v_take, v_layer.unit_cost,
      CURRENT_DATE, now(), now()
    );

    v_need := v_need - v_take;
    IF v_need <= 0 THEN
      EXIT;
    END IF;
  END LOOP;

  IF v_need > 0 THEN
    RAISE EXCEPTION 'WAREHOUSE_TRANSFER_COST_LAYERS_INSUFFICIENT: transferred %, but cost layers only covered %',
      v_qty, (v_qty - v_need)
      USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'replayed', false,
    'remaining_at_source',
    (SELECT quantity FROM warehouse_stock WHERE warehouse_id = v_from AND product_id = v_product)
  );
END;
$fn$;
