-- ============================================================================
-- docs/variant-cost-layers-migration.sql
--
-- WP-01 — cost layers learn the variant they belong to.
--
-- WHY
--   A product can have several active variants (a shirt in black-L, black-M,
--   white-L). Stock movements already name the variant (variant-stock-01), but
--   `cost_layers` is still keyed by product only: every size and colour draws
--   from ONE pool, so a sale of the expensive colour is costed at the cheap
--   colour's purchase price and the reported profit is wrong.
--
-- THE OWNER'S DECISION (D5, 17 Nov 2026): STRICT, NO BRIDGE.
--   A layer belongs to exactly one variant, and a sale of a variant consumes
--   ONLY layers of that same variant. `variant_id = NULL` is not "any variant";
--   it means "this stock was never assigned to a variant" and it is usable only
--   by a line that names no variant (a product with no variants). Stock that
--   predates this migration therefore stays unsellable by variant until a person
--   assigns it with `inventory_assign_layer_variant`. That act is deliberate:
--   guessing which size an old pile belongs to would invent a cost.
--
-- STOCK SUFFICIENCY IS STILL PRODUCT-KEYED.
--   The only decision taken here is which COST a sale consumes. Existing
--   low-stock checks keep reading the product's own quantity, exactly as today.
--
-- WHAT THIS FILE DOES
--   1. cost_layers.variant_id       + FK (NOT VALID) + FIFO index
--   2. cost_consumptions.variant_id + FK (NOT VALID)
--   3. inventory_receive_layer      validates the variant belongs to the product
--   4. inventory_consume_layers     consumes only layers of the same variant
--   5. inventory_release_consumption gives the quantity back to its own variant
--   6. inventory_assign_layer_variant  the manual bridge the strict rule needs
--
-- Additive and re-runnable. Depends on: inventory-costing-migration.sql,
-- universal-core-migration.sql (product_variants).
-- Deploy the backend AFTER this file: the backend now sends `variant_id`, and a
-- database that does not know the column refuses the receipt (42703) instead of
-- silently dropping the variant.
--
-- ⚠️ NOT run by the assistant. Run it, then docs/VERIFY-variant-cost-layers.sql.
--
-- ROLLBACK (only while no consumption names a variant; afterwards the identity
-- is lost and the valuation cannot be attributed any more):
--   DROP FUNCTION IF EXISTS public.inventory_assign_layer_variant(uuid, uuid, uuid, uuid);
--   ALTER TABLE public.cost_consumptions DROP COLUMN IF EXISTS variant_id;
--   ALTER TABLE public.cost_layers DROP COLUMN IF EXISTS variant_id;
--   DROP INDEX IF EXISTS public.cost_layers_fifo_variant_idx;
--   DROP INDEX IF EXISTS public.cost_consumptions_variant_idx;
--   then re-run the function blocks of inventory-costing-migration.sql.
-- ============================================================================

BEGIN;

-- ─── 1. Cost layers name their variant ──────────────────────────────────────
ALTER TABLE public.cost_layers ADD COLUMN IF NOT EXISTS variant_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cost_layers_variant_fk') THEN
    ALTER TABLE public.cost_layers
      ADD CONSTRAINT cost_layers_variant_fk
      FOREIGN KEY (variant_id) REFERENCES public.product_variants (id) NOT VALID;
  END IF;
END $$;

-- The strict FIFO queue: open layers for one product AND one variant.
CREATE INDEX IF NOT EXISTS cost_layers_fifo_variant_idx
  ON public.cost_layers (workspace_id, product_id, variant_id, entry_date, created_at)
  WHERE remaining_qty > 0;

-- ─── 2. The consumption trail names the same variant ────────────────────────
ALTER TABLE public.cost_consumptions ADD COLUMN IF NOT EXISTS variant_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cost_consumptions_variant_fk'
  ) THEN
    ALTER TABLE public.cost_consumptions
      ADD CONSTRAINT cost_consumptions_variant_fk
      FOREIGN KEY (variant_id) REFERENCES public.product_variants (id) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cost_consumptions_variant_idx
  ON public.cost_consumptions (workspace_id, product_id, variant_id, entry_date)
  WHERE variant_id IS NOT NULL;

-- ─── 3. Receiving goods: the variant must be a variant OF THIS product ──────
CREATE OR REPLACE FUNCTION public.inventory_receive_layer(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_payload      jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_layer_id uuid;
  v_product  uuid := (p_payload ->> 'product_id')::uuid;
  v_variant  uuid := NULLIF(p_payload ->> 'variant_id', '')::uuid;
  v_qty      numeric(18, 4) := (p_payload ->> 'quantity')::numeric;
  v_cost     numeric(18, 4) := (p_payload ->> 'unit_cost')::numeric;
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'INVENTORY_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF v_qty IS NULL OR v_qty <= 0 THEN
    RAISE EXCEPTION 'INVENTORY_RECEIPT_QUANTITY_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF v_cost IS NULL OR v_cost < 0 THEN
    RAISE EXCEPTION 'INVENTORY_RECEIPT_COST_INVALID' USING ERRCODE = 'P0001';
  END IF;

  -- The product must belong to this workspace. A foreign product id in the
  -- payload would otherwise create a layer in somebody else's inventory.
  PERFORM 1 FROM public.products
   WHERE id = v_product
     AND workspace_id = p_workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_PRODUCT_NOT_IN_WORKSPACE' USING ERRCODE = 'P0001';
  END IF;

  -- A variant is not a free-floating id: it must belong to this workspace and
  -- to THIS product. Otherwise a layer of «black-L» could be filed under a
  -- different product and never be found by the sale that needs it.
  IF v_variant IS NOT NULL THEN
    PERFORM 1 FROM public.product_variants v
     WHERE v.id = v_variant
       AND v.workspace_id = p_workspace_id
       AND v.template_product_id = v_product;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVENTORY_VARIANT_NOT_ON_PRODUCT' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.cost_layers (
    workspace_id, product_id, variant_id, warehouse_id,
    source_type, source_id, source_line,
    received_qty, remaining_qty, unit_cost, currency, entry_date, created_by
  ) VALUES (
    p_workspace_id,
    v_product,
    v_variant,
    NULLIF(p_payload ->> 'warehouse_id', '')::uuid,
    p_payload ->> 'source_type',
    NULLIF(p_payload ->> 'source_id', '')::uuid,
    p_payload ->> 'source_line',
    v_qty,
    v_qty,
    v_cost,
    COALESCE(p_payload ->> 'currency', 'AFN'),
    (p_payload ->> 'entry_date')::date,
    p_user_id
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_layer_id;

  -- Already received. Hand back the layer that exists rather than a second one.
  IF v_layer_id IS NULL THEN
    SELECT id INTO v_layer_id FROM public.cost_layers
     WHERE workspace_id = p_workspace_id
       AND source_type = p_payload ->> 'source_type'
       AND source_id = NULLIF(p_payload ->> 'source_id', '')::uuid
       AND source_line IS NOT DISTINCT FROM (p_payload ->> 'source_line');
  END IF;

  RETURN v_layer_id;
END;
$fn$;

-- ─── 4. Issuing goods: STRICT, the same variant only ────────────────────────
-- `variant_id IS NOT DISTINCT FROM v_variant` is the whole decision:
--   * a line WITH a variant never draws a NULL (unassigned) layer;
--   * a line WITHOUT a variant never draws a variant layer.
-- The layers are locked FOR UPDATE: two sales of the last unit must not both
-- see it.
CREATE OR REPLACE FUNCTION public.inventory_consume_layers(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_payload      jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_product      uuid := (p_payload ->> 'product_id')::uuid;
  v_variant      uuid := NULLIF(p_payload ->> 'variant_id', '')::uuid;
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

  -- Idempotency: this consumer line has already taken its stock.
  SELECT COALESCE(SUM(quantity), 0), COALESCE(SUM(amount), 0)
    INTO v_existing, v_total_cost
    FROM public.cost_consumptions
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
    FROM public.inventory_settings WHERE workspace_id = p_workspace_id;

  v_method := COALESCE(v_method, 'fifo');
  v_negative := COALESCE(v_negative, 'block');

  -- AVCO prices every unit at the weighted average of what is open FOR THIS
  -- VARIANT, but still draws the quantity from the layers in order, so the
  -- trail survives.
  IF v_method = 'avco' THEN
    SELECT CASE WHEN SUM(remaining_qty) > 0
                THEN SUM(remaining_qty * unit_cost) / SUM(remaining_qty) END
      INTO v_avg_cost
      FROM public.cost_layers
     WHERE workspace_id = p_workspace_id
       AND product_id = v_product
       AND variant_id IS NOT DISTINCT FROM v_variant
       AND remaining_qty > 0
       AND (v_warehouse IS NULL OR warehouse_id IS NOT DISTINCT FROM v_warehouse);
  END IF;

  FOR v_layer IN
    SELECT id, remaining_qty, unit_cost
      FROM public.cost_layers
     WHERE workspace_id = p_workspace_id
       AND product_id = v_product
       AND variant_id IS NOT DISTINCT FROM v_variant
       AND remaining_qty > 0
       AND (v_warehouse IS NULL OR warehouse_id IS NOT DISTINCT FROM v_warehouse)
     ORDER BY entry_date, created_at
     FOR UPDATE
  LOOP
    EXIT WHEN v_consumed >= v_needed;

    v_take := LEAST(v_layer.remaining_qty, v_needed - v_consumed);

    UPDATE public.cost_layers
       SET remaining_qty = remaining_qty - v_take
     WHERE id = v_layer.id;

    INSERT INTO public.cost_consumptions (
      workspace_id, layer_id, product_id, variant_id, warehouse_id,
      consumer_type, consumer_id, consumer_line,
      quantity, unit_cost, amount, is_estimated, entry_date, created_by
    ) VALUES (
      p_workspace_id, v_layer.id, v_product, v_variant, v_warehouse,
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
    -- price we actually paid FOR THIS VARIANT and marked estimated. Falling
    -- back to another variant's price would be inventing a cost.
    SELECT unit_cost INTO v_last_cost
      FROM public.cost_layers
     WHERE workspace_id = p_workspace_id
       AND product_id = v_product
       AND variant_id IS NOT DISTINCT FROM v_variant
     ORDER BY entry_date DESC, created_at DESC
     LIMIT 1;

    v_last_cost := COALESCE(v_last_cost, 0);

    INSERT INTO public.cost_consumptions (
      workspace_id, layer_id, product_id, variant_id, warehouse_id,
      consumer_type, consumer_id, consumer_line,
      quantity, unit_cost, amount, is_estimated, entry_date, created_by
    ) VALUES (
      p_workspace_id, NULL, v_product, v_variant, v_warehouse,
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

-- ─── 5. Returning goods: put them back into their OWN variant's layer ───────
CREATE OR REPLACE FUNCTION public.inventory_release_consumption(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_consumer_type text,
  p_consumer_id   uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_row        record;
  v_restored   numeric(18, 4) := 0;
  v_amount     numeric(18, 4) := 0;
BEGIN
  FOR v_row IN
    SELECT id, layer_id, product_id, variant_id, warehouse_id, quantity, unit_cost,
           amount, is_estimated, consumer_line, entry_date
      FROM public.cost_consumptions
     WHERE workspace_id = p_workspace_id
       AND consumer_type = p_consumer_type
       AND consumer_id = p_consumer_id
       AND quantity > 0
  LOOP
    IF v_row.layer_id IS NOT NULL THEN
      UPDATE public.cost_layers
         SET remaining_qty = LEAST(received_qty, remaining_qty + v_row.quantity)
       WHERE id = v_row.layer_id AND workspace_id = p_workspace_id;
    END IF;

    -- The release is recorded as its own negative-signed row rather than by
    -- deleting the original. What happened stays in the trail.
    INSERT INTO public.cost_consumptions (
      workspace_id, layer_id, product_id, variant_id, warehouse_id,
      consumer_type, consumer_id, consumer_line,
      quantity, unit_cost, amount, is_estimated, entry_date, created_by
    ) VALUES (
      p_workspace_id, v_row.layer_id, v_row.product_id, v_row.variant_id,
      v_row.warehouse_id,
      'release', p_consumer_id, v_row.consumer_line,
      v_row.quantity, v_row.unit_cost, -v_row.amount, v_row.is_estimated,
      CURRENT_DATE, p_user_id
    );

    v_restored := v_restored + v_row.quantity;
    v_amount := v_amount + v_row.amount;
  END LOOP;

  RETURN jsonb_build_object('quantity', v_restored, 'total_cost', v_amount);
END;
$fn$;

-- ─── 6. The manual bridge: assign an unassigned layer to a variant ──────────
-- The strict rule makes pre-migration stock unusable by a variant sale. The
-- owner's decision is that a PERSON says which variant it is — the system never
-- guesses. This is that act, and it is deliberately narrow:
--   * only an OPEN layer (remaining_qty > 0) can be assigned;
--   * only an UNASSIGNED layer (variant_id IS NULL) is moved — a layer already
--     assigned to a variant cannot be stolen by another;
--   * the variant must belong to the layer's own product and workspace;
--   * the row is locked, so two people assigning the same pile cannot both win.
CREATE OR REPLACE FUNCTION public.inventory_assign_layer_variant(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_layer_id     uuid,
  p_variant_id   uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_layer   record;
  v_product uuid;
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'INVENTORY_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF p_variant_id IS NULL THEN
    RAISE EXCEPTION 'INVENTORY_VARIANT_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, product_id, variant_id, remaining_qty, unit_cost
    INTO v_layer
    FROM public.cost_layers
   WHERE id = p_layer_id AND workspace_id = p_workspace_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_LAYER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_layer.remaining_qty <= 0 THEN
    RAISE EXCEPTION 'INVENTORY_LAYER_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;

  IF v_layer.variant_id IS NOT NULL THEN
    IF v_layer.variant_id = p_variant_id THEN
      RETURN jsonb_build_object(
        'layer_id', v_layer.id,
        'product_id', v_layer.product_id,
        'variant_id', v_layer.variant_id,
        'quantity', v_layer.remaining_qty,
        'value', v_layer.remaining_qty * v_layer.unit_cost,
        'moved', false
      );
    END IF;
    RAISE EXCEPTION 'INVENTORY_LAYER_ALREADY_ASSIGNED' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1 FROM public.product_variants v
   WHERE v.id = p_variant_id
     AND v.workspace_id = p_workspace_id
     AND v.template_product_id = v_layer.product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_VARIANT_NOT_ON_PRODUCT' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.cost_layers
     SET variant_id = p_variant_id
   WHERE id = v_layer.id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object(
    'layer_id', v_layer.id,
    'product_id', v_layer.product_id,
    'variant_id', p_variant_id,
    'quantity', v_layer.remaining_qty,
    'value', v_layer.remaining_qty * v_layer.unit_cost,
    'moved', true
  );
END;
$fn$;

-- ─── 7. Privileges ─────────────────────────────────────────────────────────
-- These functions write cost and profit under SECURITY DEFINER. Only the
-- backend's service role may call them.
REVOKE ALL ON FUNCTION public.inventory_receive_layer(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_receive_layer(uuid, uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.inventory_consume_layers(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_consume_layers(uuid, uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.inventory_release_consumption(uuid, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_release_consumption(uuid, uuid, text, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.inventory_assign_layer_variant(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_assign_layer_variant(uuid, uuid, uuid, uuid)
  TO service_role;

COMMIT;
