-- ============================================================================
-- docs/inventory-avco-01-migration.sql
--
-- «میانگین موزون» (weighted average) costing that keeps its average
-- (owner, 18 Oct 2026 — the method became selectable in the warehouse hub).
--
-- WHAT CHANGES: only the AVCO branch of `inventory_consume_layers`. Under
-- avco an issue is now drawn from every open layer in proportion to what each
-- holds, and each consumption row carries its own layer's unit cost. FIFO and
-- the shortfall/estimated path are byte-for-byte the definition in
-- docs/inventory-consume-concurrency-migration.sql (lock, idempotency,
-- negative-stock policy).
--
-- WHY: the old avco priced the issue at the average but took it from the
-- OLDEST layer, so the average of what remained rose after every sale — cost
-- of goods booked above what was paid (65k + 132k + 192k bought, 483,667 of
-- cost booked when all three were sold). No business could select avco
-- before today, so no stored sale was costed by it.
--
-- DATA: none changed. Sales already recorded keep their cost.
--
-- ROLLBACK / MITIGATION: run docs/inventory-consume-concurrency-migration.sql
-- again (the previous definition), and set every workspace back to FIFO:
--   UPDATE inventory_settings SET costing_method = 'fifo' WHERE costing_method = 'avco';
--
-- IDEMPOTENT. SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION inventory_consume_layers(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_payload      jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_product      uuid := (p_payload ->> 'product_id')::uuid;
  v_warehouse    uuid := NULLIF(p_payload ->> 'warehouse_id', '')::uuid;
  v_needed       numeric(18, 4) := (p_payload ->> 'quantity')::numeric;
  v_entry_date   date := (p_payload ->> 'entry_date')::date;
  v_method       text;
  v_negative     text;
  v_layer        record;
  v_take         numeric(18, 4);
  v_total_cost   numeric(18, 4) := 0;
  v_consumed     numeric(18, 4) := 0;
  v_last_cost    numeric(18, 4);
  v_shortfall    numeric(18, 4);
  v_existing     numeric(18, 4);
  v_open         numeric(18, 4);
  v_count        integer;
  v_seen         integer := 0;
  v_ratio        numeric;
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'INVENTORY_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF v_needed IS NULL OR v_needed <= 0 THEN
    RAISE EXCEPTION 'INVENTORY_ISSUE_QUANTITY_INVALID' USING ERRCODE = 'P0001';
  END IF;

  -- ⚠️ CONCURRENCY. The idempotency SELECT below was not locked: two calls for
  -- the SAME consumer line (a double-clicked «ثبت در دفتر», two tabs running
  -- the batch, a client retry racing its own timed-out request) could both see
  -- nothing consumed and BOTH draw the layers — stock and cost of goods taken
  -- twice for one sale. This transaction-scoped lock serialises calls per
  -- (workspace, consumer, line); the second waits, then finds the first one's
  -- rows and returns 'already_consumed'. Released automatically at commit or
  -- rollback. Different lines and different invoices do not wait on each other.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_workspace_id::text || '|' ||
      COALESCE(p_payload ->> 'consumer_type', '') || '|' ||
      COALESCE(p_payload ->> 'consumer_id', '') || '|' ||
      COALESCE(p_payload ->> 'consumer_line', ''),
      0
    )
  );

  -- Idempotency: this consumer line has already taken its stock.
  SELECT COALESCE(SUM(quantity), 0), COALESCE(SUM(amount), 0)
    INTO v_existing, v_total_cost
    FROM cost_consumptions
   WHERE workspace_id = p_workspace_id
     AND consumer_type = p_payload ->> 'consumer_type'
     AND consumer_id = NULLIF(p_payload ->> 'consumer_id', '')::uuid
     AND consumer_line IS NOT DISTINCT FROM (p_payload ->> 'consumer_line');

  IF v_existing > 0 THEN
    RETURN jsonb_build_object(
      'status', 'already_consumed',
      'quantity', v_existing,
      'total_cost', v_total_cost,
      'shortfall', 0
    );
  END IF;

  v_total_cost := 0;

  SELECT costing_method, negative_stock INTO v_method, v_negative
    FROM inventory_settings WHERE workspace_id = p_workspace_id;

  v_method := COALESCE(v_method, 'fifo');
  v_negative := COALESCE(v_negative, 'block');

  -- AVCO (avco-01): the issue is taken from EVERY open layer in proportion to
  -- what each still holds. The cost of the issue is then exactly quantity ×
  -- the weighted average, and — the point — the average of what REMAINS is
  -- unchanged, so the next sale is costed at the same average and the layers
  -- still add up to the stock's value.
  --
  -- ⚠️ The previous definition priced the issue at the average but drew it
  -- from the OLDEST layer: the cheap purchase left the shelf at the average
  -- price, the average of the rest rose, and every later sale was costed
  -- higher. Three purchases at 65,000 / 132,000 / 192,000 sold one by one
  -- booked 483,667 of cost for 389,000 actually paid.
  --
  -- The layers are locked BEFORE they are summed, so the shares are computed
  -- from quantities no concurrent issue can change underneath.
  IF v_method = 'avco' THEN
    PERFORM 1
       FROM cost_layers
      WHERE workspace_id = p_workspace_id
        AND product_id = v_product
        AND remaining_qty > 0
        AND (v_warehouse IS NULL OR warehouse_id IS NOT DISTINCT FROM v_warehouse)
      FOR UPDATE;
    SELECT COALESCE(SUM(remaining_qty), 0), COUNT(*)
      INTO v_open, v_count
      FROM cost_layers
     WHERE workspace_id = p_workspace_id
       AND product_id = v_product
       AND remaining_qty > 0
       AND (v_warehouse IS NULL OR warehouse_id IS NOT DISTINCT FROM v_warehouse);
    v_ratio := CASE WHEN v_open > 0 THEN LEAST(v_needed / v_open, 1) ELSE 0 END;
  END IF;

  FOR v_layer IN
    SELECT id, remaining_qty, unit_cost
      FROM cost_layers
     WHERE workspace_id = p_workspace_id
       AND product_id = v_product
       AND remaining_qty > 0
       AND (v_warehouse IS NULL OR warehouse_id IS NOT DISTINCT FROM v_warehouse)
     ORDER BY entry_date, created_at
     FOR UPDATE
  LOOP
    EXIT WHEN v_consumed >= v_needed;

    v_seen := v_seen + 1;
    IF v_method = 'avco' THEN
      -- This layer's share; the last layer takes what rounding left over.
      v_take := CASE
        WHEN v_seen >= v_count THEN LEAST(v_layer.remaining_qty, v_needed - v_consumed)
        ELSE LEAST(v_layer.remaining_qty, v_needed - v_consumed,
                   round(v_layer.remaining_qty * v_ratio, 4))
      END;
      CONTINUE WHEN v_take <= 0;
    ELSE
      v_take := LEAST(v_layer.remaining_qty, v_needed - v_consumed);
    END IF;

    UPDATE cost_layers
       SET remaining_qty = remaining_qty - v_take
     WHERE id = v_layer.id;

    INSERT INTO cost_consumptions (
      workspace_id, layer_id, product_id, warehouse_id,
      consumer_type, consumer_id, consumer_line,
      quantity, unit_cost, amount, is_estimated, entry_date, created_by
    ) VALUES (
      p_workspace_id, v_layer.id, v_product, v_warehouse,
      p_payload ->> 'consumer_type',
      NULLIF(p_payload ->> 'consumer_id', '')::uuid,
      p_payload ->> 'consumer_line',
      v_take,
      v_layer.unit_cost,
      v_take * v_layer.unit_cost,
      false,
      v_entry_date,
      p_user_id
    );

    v_consumed := v_consumed + v_take;
    v_total_cost := v_total_cost + v_take * v_layer.unit_cost;
  END LOOP;

  v_shortfall := v_needed - v_consumed;

  IF v_shortfall > 0 THEN
    IF v_negative = 'block' THEN
      RAISE EXCEPTION 'INVENTORY_INSUFFICIENT_STOCK' USING ERRCODE = 'P0001';
    END IF;

    -- Allowed to go negative. The uncovered quantity is costed at the last
    -- price we actually paid and marked estimated, so it can be found and
    -- corrected once the real receipt arrives. The old code did
    -- `Math.max(0, …)` here, which lost the fact entirely.
    SELECT unit_cost INTO v_last_cost
      FROM cost_layers
     WHERE workspace_id = p_workspace_id AND product_id = v_product
     ORDER BY entry_date DESC, created_at DESC
     LIMIT 1;

    v_last_cost := COALESCE(v_last_cost, 0);

    INSERT INTO cost_consumptions (
      workspace_id, layer_id, product_id, warehouse_id,
      consumer_type, consumer_id, consumer_line,
      quantity, unit_cost, amount, is_estimated, entry_date, created_by
    ) VALUES (
      p_workspace_id, NULL, v_product, v_warehouse,
      p_payload ->> 'consumer_type',
      NULLIF(p_payload ->> 'consumer_id', '')::uuid,
      p_payload ->> 'consumer_line',
      v_shortfall, v_last_cost, v_shortfall * v_last_cost, true,
      v_entry_date, p_user_id
    );

    v_total_cost := v_total_cost + v_shortfall * v_last_cost;
  END IF;

  RETURN jsonb_build_object(
    'status', 'consumed',
    'quantity', v_needed,
    'total_cost', v_total_cost,
    'shortfall', v_shortfall
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.inventory_consume_layers(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.inventory_consume_layers(uuid, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.inventory_consume_layers(uuid, uuid, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.inventory_consume_layers(uuid, uuid, jsonb) TO service_role;

COMMIT;
