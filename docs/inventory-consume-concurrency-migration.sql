-- ============================================================================
-- docs/inventory-consume-concurrency-migration.sql
--
-- Serialise stock issues per consumer line so a retried or concurrent posting
-- cannot consume the same sale's stock (and cost of goods) twice.
--
-- WHAT CHANGES: one `PERFORM pg_advisory_xact_lock(...)` before the existing
-- idempotency check in `inventory_consume_layers`. Every other line of the
-- function is byte-for-byte the definition in docs/inventory-costing-migration.sql.
--
-- WHY A LOCK AND NOT A UNIQUE INDEX: one consumer line legitimately writes
-- SEVERAL cost_consumptions rows (one per layer it draws from, plus an
-- estimated shortfall row), so (consumer_type, consumer_id, consumer_line) is
-- not unique by design. The journal entry side is already protected by the
-- unique index journal_entries_source_key.
--
-- ROLLBACK / MITIGATION: re-run section 6 of docs/inventory-costing-migration.sql
-- (the previous definition). No data is changed by this migration.
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
  v_avg_cost     numeric(18, 4);
  v_last_cost    numeric(18, 4);
  v_shortfall    numeric(18, 4);
  v_existing     numeric(18, 4);
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

  -- AVCO prices every unit at the weighted average of what is open, but still
  -- draws the quantity from the layers in order, so the trail survives.
  IF v_method = 'avco' THEN
    SELECT CASE WHEN SUM(remaining_qty) > 0
                THEN SUM(remaining_qty * unit_cost) / SUM(remaining_qty) END
      INTO v_avg_cost
      FROM cost_layers
     WHERE workspace_id = p_workspace_id
       AND product_id = v_product
       AND remaining_qty > 0
       AND (v_warehouse IS NULL OR warehouse_id IS NOT DISTINCT FROM v_warehouse);
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

    v_take := LEAST(v_layer.remaining_qty, v_needed - v_consumed);

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
      COALESCE(v_avg_cost, v_layer.unit_cost),
      v_take * COALESCE(v_avg_cost, v_layer.unit_cost),
      false,
      v_entry_date,
      p_user_id
    );

    v_consumed := v_consumed + v_take;
    v_total_cost := v_total_cost + v_take * COALESCE(v_avg_cost, v_layer.unit_cost);
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

NOTIFY pgrst, 'reload schema';
