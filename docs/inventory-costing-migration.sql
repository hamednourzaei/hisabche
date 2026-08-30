-- ============================================================================
-- docs/inventory-costing-migration.sql
--
-- Inventory Costing Core — cost layers, their consumption, and the settings
-- that decide how they are consumed.
--
-- WHY THIS FILE EXISTS
--   Cost of goods sold was priced from products.buy_price, the CURRENT buy
--   price. A shop that buys the same phone at 10,000,000 and then at
--   9,000,000 was reporting both sales at 9,000,000, so the profit on the
--   first sale was overstated by a million and nothing in the system could
--   say which purchase a sale had actually consumed.
--
-- SAFE TO RE-RUN. Every statement is guarded.
-- ============================================================================

BEGIN;

-- ─── 1. Settings ────────────────────────────────────────────────────────────
-- One row per workspace. Costing method and negative stock policy are business
-- decisions, not constants, and they belong to the business not to the code.

CREATE TABLE IF NOT EXISTS inventory_settings (
  workspace_id    uuid PRIMARY KEY,
  costing_method  text NOT NULL DEFAULT 'fifo',
  -- 'block'  — an issue with no stock behind it is refused.
  -- 'allow'  — it goes through, costed at the last known price and FLAGGED,
  --            so the gap is visible and correctable instead of silent.
  negative_stock  text NOT NULL DEFAULT 'block',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_settings_method_check
    CHECK (costing_method IN ('fifo', 'avco', 'standard')),
  CONSTRAINT inventory_settings_negative_check
    CHECK (negative_stock IN ('block', 'allow'))
);

-- ─── 2. Cost layers ─────────────────────────────────────────────────────────
-- One row per receipt of goods, holding what is LEFT of it and what it cost.

CREATE TABLE IF NOT EXISTS cost_layers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  product_id    uuid NOT NULL,
  warehouse_id  uuid,
  -- The document that brought the goods in. Together these make a receipt
  -- idempotent: re-saving a purchase must not create the layer twice.
  source_type   text NOT NULL,
  source_id     uuid,
  source_line   text,
  received_qty  numeric(18, 4) NOT NULL,
  remaining_qty numeric(18, 4) NOT NULL,
  unit_cost     numeric(18, 4) NOT NULL,
  currency      text NOT NULL DEFAULT 'AFN',
  -- The date the goods ARRIVED. FIFO order is by this, not by created_at, so
  -- a receipt entered late still takes its rightful place in the queue.
  entry_date    date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  CONSTRAINT cost_layers_qty_check CHECK (
    received_qty > 0 AND remaining_qty >= 0 AND remaining_qty <= received_qty
  ),
  CONSTRAINT cost_layers_cost_check CHECK (unit_cost >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS cost_layers_source_key
  ON cost_layers (workspace_id, source_type, source_id, source_line)
  WHERE source_id IS NOT NULL;

-- The FIFO queue: open layers for one product, oldest first.
CREATE INDEX IF NOT EXISTS cost_layers_fifo_idx
  ON cost_layers (workspace_id, product_id, entry_date, created_at)
  WHERE remaining_qty > 0;

CREATE INDEX IF NOT EXISTS cost_layers_product_idx
  ON cost_layers (workspace_id, product_id);

-- ─── 3. Consumption ─────────────────────────────────────────────────────────
-- Which layer paid for which issue. This table is the answer to "why is the
-- profit on this sale what it is" and is append-only.

CREATE TABLE IF NOT EXISTS cost_consumptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  layer_id      uuid,               -- NULL only for an estimated shortfall
  product_id    uuid NOT NULL,
  warehouse_id  uuid,
  consumer_type text NOT NULL,      -- 'invoice', 'adjustment', 'reversal'…
  consumer_id   uuid,
  consumer_line text,
  quantity      numeric(18, 4) NOT NULL,
  unit_cost     numeric(18, 4) NOT NULL,
  amount        numeric(18, 4) NOT NULL,
  -- true when stock was not there and the policy allowed the issue anyway.
  -- The cost is a guess and is meant to be found and corrected.
  is_estimated  boolean NOT NULL DEFAULT false,
  entry_date    date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  CONSTRAINT cost_consumptions_qty_check CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS cost_consumptions_consumer_idx
  ON cost_consumptions (workspace_id, consumer_type, consumer_id);

CREATE INDEX IF NOT EXISTS cost_consumptions_layer_idx
  ON cost_consumptions (workspace_id, layer_id);

CREATE INDEX IF NOT EXISTS cost_consumptions_product_idx
  ON cost_consumptions (workspace_id, product_id, entry_date);

-- ─── 4. Stock movements grow a cost ─────────────────────────────────────────

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS unit_cost numeric(18, 4);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS total_cost numeric(18, 4);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reference_id uuid;

-- Transfers were written with no workspace at all; the movement history was
-- then read back by user_id, so a second member of the shop saw none of it.
UPDATE stock_movements m SET workspace_id = p.workspace_id
FROM products p
WHERE m.workspace_id IS NULL AND m.product_id = p.id;

CREATE INDEX IF NOT EXISTS stock_movements_workspace_idx
  ON stock_movements (workspace_id, created_at DESC);

-- ─── 5. Receiving goods ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION inventory_receive_layer(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_payload      jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_layer_id uuid;
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
  PERFORM 1 FROM products
   WHERE id = (p_payload ->> 'product_id')::uuid
     AND workspace_id = p_workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_PRODUCT_NOT_IN_WORKSPACE' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO cost_layers (
    workspace_id, product_id, warehouse_id, source_type, source_id, source_line,
    received_qty, remaining_qty, unit_cost, currency, entry_date, created_by
  ) VALUES (
    p_workspace_id,
    (p_payload ->> 'product_id')::uuid,
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
    SELECT id INTO v_layer_id FROM cost_layers
     WHERE workspace_id = p_workspace_id
       AND source_type = p_payload ->> 'source_type'
       AND source_id = NULLIF(p_payload ->> 'source_id', '')::uuid
       AND source_line IS NOT DISTINCT FROM (p_payload ->> 'source_line');
  END IF;

  RETURN v_layer_id;
END;
$fn$;

-- ─── 6. Issuing goods ───────────────────────────────────────────────────────
-- Consumes the open layers in FIFO order and records what it took from each.
-- Returns the total cost and how much could not be covered by real stock.
--
-- The layers are locked FOR UPDATE. Two sales of the last unit, priced in Node
-- from a plain SELECT, would both see it available and both sell it.

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

-- ─── 7. Returning goods to their layers ─────────────────────────────────────
-- A return puts the quantity back where it came from, at the price it left at.
-- Restoring it at today's price would silently change the profit already
-- reported on the original sale.

CREATE OR REPLACE FUNCTION inventory_release_consumption(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_consumer_type text,
  p_consumer_id   uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row        record;
  v_restored   numeric(18, 4) := 0;
  v_amount     numeric(18, 4) := 0;
BEGIN
  FOR v_row IN
    SELECT id, layer_id, product_id, warehouse_id, quantity, unit_cost, amount,
           is_estimated, consumer_line, entry_date
      FROM cost_consumptions
     WHERE workspace_id = p_workspace_id
       AND consumer_type = p_consumer_type
       AND consumer_id = p_consumer_id
       AND quantity > 0
  LOOP
    IF v_row.layer_id IS NOT NULL THEN
      UPDATE cost_layers
         SET remaining_qty = LEAST(received_qty, remaining_qty + v_row.quantity)
       WHERE id = v_row.layer_id AND workspace_id = p_workspace_id;
    END IF;

    -- The release is recorded as its own negative-signed row rather than by
    -- deleting the original. What happened stays in the trail.
    INSERT INTO cost_consumptions (
      workspace_id, layer_id, product_id, warehouse_id,
      consumer_type, consumer_id, consumer_line,
      quantity, unit_cost, amount, is_estimated, entry_date, created_by
    ) VALUES (
      p_workspace_id, v_row.layer_id, v_row.product_id, v_row.warehouse_id,
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

-- ─── 8. Valuation ───────────────────────────────────────────────────────────
-- Σ(remaining × unit cost), which is what the stock account in the ledger must
-- agree with. `quantity × buy_price` never did.

CREATE OR REPLACE FUNCTION inventory_valuation(
  p_workspace_id uuid,
  p_product_id   uuid
) RETURNS TABLE (
  product_id    uuid,
  product_name  text,
  on_hand       numeric,
  value         numeric,
  average_cost  numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    p.id,
    p.name,
    COALESCE(SUM(l.remaining_qty), 0),
    COALESCE(SUM(l.remaining_qty * l.unit_cost), 0),
    CASE WHEN COALESCE(SUM(l.remaining_qty), 0) > 0
         THEN SUM(l.remaining_qty * l.unit_cost) / SUM(l.remaining_qty)
         ELSE 0 END
  FROM products p
  LEFT JOIN cost_layers l
    ON l.product_id = p.id
   AND l.workspace_id = p_workspace_id
   AND l.remaining_qty > 0
  WHERE p.workspace_id = p_workspace_id
    AND (p_product_id IS NULL OR p.id = p_product_id)
  GROUP BY p.id, p.name
  ORDER BY p.name;
$fn$;

-- ─── 9. Row level security ──────────────────────────────────────────────────

ALTER TABLE cost_layers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_consumptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cost_layers_workspace_members ON cost_layers;
CREATE POLICY cost_layers_workspace_members ON cost_layers
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS cost_consumptions_workspace_members ON cost_consumptions;
CREATE POLICY cost_consumptions_workspace_members ON cost_consumptions
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS inventory_settings_workspace_members ON inventory_settings;
CREATE POLICY inventory_settings_workspace_members ON inventory_settings
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS stock_movements_workspace_members ON stock_movements;
CREATE POLICY stock_movements_workspace_members ON stock_movements
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

COMMIT;

-- ============================================================================
-- Warehouse transfers — part of the same change.
--
-- The transfer used to read both sides' quantities into Node, subtract, and
-- write them back. Two transfers of the last unit both read it as available
-- and the second write recreated stock the first had spent.
-- ============================================================================

BEGIN;

ALTER TABLE warehouses      ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE warehouse_stock ADD COLUMN IF NOT EXISTS workspace_id uuid;

WITH sole_membership AS (
  SELECT user_id, MIN(workspace_id::text)::uuid AS workspace_id
  FROM workspace_members
  WHERE has_access = true AND suspended_at IS NULL
  GROUP BY user_id
  HAVING COUNT(DISTINCT workspace_id) = 1
)
UPDATE warehouses w SET workspace_id = m.workspace_id
FROM sole_membership m
WHERE w.workspace_id IS NULL AND w.user_id = m.user_id;

UPDATE warehouse_stock s SET workspace_id = w.workspace_id
FROM warehouses w
WHERE s.workspace_id IS NULL AND s.warehouse_id = w.id;

CREATE INDEX IF NOT EXISTS warehouses_workspace_idx ON warehouses (workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS warehouse_stock_unique
  ON warehouse_stock (warehouse_id, product_id);

CREATE OR REPLACE FUNCTION warehouse_transfer_stock(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_payload      jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_product   uuid := (p_payload ->> 'product_id')::uuid;
  v_from      uuid := (p_payload ->> 'from_warehouse_id')::uuid;
  v_to        uuid := (p_payload ->> 'to_warehouse_id')::uuid;
  v_qty       numeric(18, 4) := (p_payload ->> 'quantity')::numeric;
  v_available numeric(18, 4);
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'WAREHOUSE_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF v_qty IS NULL OR v_qty <= 0 THEN
    RAISE EXCEPTION 'WAREHOUSE_TRANSFER_QUANTITY_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF v_from = v_to THEN
    RAISE EXCEPTION 'WAREHOUSE_TRANSFER_SAME_WAREHOUSE' USING ERRCODE = 'P0001';
  END IF;

  -- Both warehouses must belong to this workspace. Checked here as well as in
  -- the service: this is the check that cannot be raced or skipped.
  PERFORM 1 FROM warehouses
   WHERE id IN (v_from, v_to) AND workspace_id = p_workspace_id
   HAVING COUNT(*) = 2;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WAREHOUSE_NOT_IN_WORKSPACE' USING ERRCODE = 'P0001';
  END IF;

  -- The lock is the whole point: the row cannot change between reading the
  -- quantity and writing the new one.
  SELECT quantity INTO v_available
    FROM warehouse_stock
   WHERE warehouse_id = v_from AND product_id = v_product
   FOR UPDATE;

  IF v_available IS NULL OR v_available < v_qty THEN
    RAISE EXCEPTION 'WAREHOUSE_INSUFFICIENT_STOCK' USING ERRCODE = 'P0001';
  END IF;

  UPDATE warehouse_stock
     SET quantity = quantity - v_qty
   WHERE warehouse_id = v_from AND product_id = v_product;

  INSERT INTO warehouse_stock (warehouse_id, product_id, quantity, workspace_id, user_id)
  VALUES (v_to, v_product, v_qty, p_workspace_id, p_user_id)
  ON CONFLICT (warehouse_id, product_id)
  DO UPDATE SET quantity = warehouse_stock.quantity + EXCLUDED.quantity;

  INSERT INTO stock_movements (
    product_id, type, quantity, from_warehouse_id, to_warehouse_id,
    notes, workspace_id, user_id, reference_type
  ) VALUES (
    v_product, 'transfer', v_qty, v_from, v_to,
    COALESCE(p_payload ->> 'notes', ''), p_workspace_id, p_user_id, 'transfer'
  );

  RETURN jsonb_build_object('remaining_at_source', v_available - v_qty);
END;
$fn$;

ALTER TABLE warehouses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS warehouses_workspace_members ON warehouses;
CREATE POLICY warehouses_workspace_members ON warehouses
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS warehouse_stock_workspace_members ON warehouse_stock;
CREATE POLICY warehouse_stock_workspace_members ON warehouse_stock
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

COMMIT;
