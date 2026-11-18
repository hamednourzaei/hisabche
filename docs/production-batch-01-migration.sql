-- ============================================
-- docs/production-batch-01-migration.sql
--
-- WP-09 — a production run knows what it STARTED and what came out SELLABLE.
--
-- Before this file, `work_orders.quantity` carried two meanings at once: the
-- units the material was issued for AND the units received into stock. A run
-- of 100 units that yielded 95 sellable and 5 spoiled recorded 100 of each:
-- the shelf gained five units that do not exist, and the cost per sellable
-- unit was understated by the scrap.
--
-- After it:
--
--   quantity         units the material was issued for (unchanged meaning)
--   scrap_quantity   of those, the ones that came out unsellable
--   rework_quantity  of those, the ones set aside for rework (not sellable yet)
--   good_quantity    quantity − scrap − rework: what stock receives
--   yield_percent    good ÷ quantity × 100
--
-- The run's total cost does not change. It is carried by fewer units, which is
-- the whole point: `total ÷ good_quantity` is what a sellable unit is worth.
--
-- ⚠️ DEPENDS ON docs/manufacturing-01-migration.sql (the tables, the costing
-- functions and `manufacturing_complete` itself). Run that one first.
--
-- ⚠️ Idempotent: every statement may run twice. The function is replaced, the
-- columns are guarded by IF NOT EXISTS, and the constraint is added only when
-- its name is absent.
-- ============================================

BEGIN;

-- ── 1. The columns ─────────────────────────────────────────────────────────
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS scrap_quantity numeric(18, 4) NOT NULL DEFAULT 0;
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS rework_quantity numeric(18, 4) NOT NULL DEFAULT 0;
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS good_quantity numeric(18, 4);
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS yield_percent numeric(9, 4);

COMMENT ON COLUMN public.work_orders.quantity IS
  'Units the material was issued for (WP-09).';
COMMENT ON COLUMN public.work_orders.scrap_quantity IS
  'Of the started units, the ones that came out unsellable (WP-09).';
COMMENT ON COLUMN public.work_orders.rework_quantity IS
  'Of the started units, the ones set aside for rework (WP-09).';
COMMENT ON COLUMN public.work_orders.good_quantity IS
  'quantity - scrap_quantity - rework_quantity: what stock received (WP-09).';
COMMENT ON COLUMN public.work_orders.yield_percent IS
  'good_quantity / quantity * 100, stored on completion (WP-09).';

-- ── 2. Backfill — a FACT, not an estimate ──────────────────────────────────
-- Every completed run before this file received exactly `quantity` units into
-- stock (the old function's only figure). So on those rows good = quantity and
-- the yield is exactly 100%. Rows that never completed stay NULL: their output
-- is genuinely unknown and must not be invented.
UPDATE public.work_orders
   SET good_quantity = quantity,
       yield_percent = 100
 WHERE good_quantity IS NULL
   AND status = 'completed';

-- ── 3. The invariant the three figures must satisfy ────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'work_orders_output_adds_up'
       AND conrelid = 'public.work_orders'::regclass
  ) THEN
    ALTER TABLE public.work_orders
      ADD CONSTRAINT work_orders_output_adds_up CHECK (
        good_quantity IS NULL
        OR (
          scrap_quantity >= 0
          AND rework_quantity >= 0
          AND good_quantity = quantity - scrap_quantity - rework_quantity
        )
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.work_orders VALIDATE CONSTRAINT work_orders_output_adds_up;

-- ── 4. manufacturing_complete knows the output ─────────────────────────────
-- Same contract, same ledger and stock functions. The only change: the finished
-- goods arrive as `good_quantity`, at `total / good_quantity` — and a run with
-- nothing sellable cannot put zero units on the shelf.
CREATE OR REPLACE FUNCTION public.manufacturing_complete(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_payload      jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_key        text := NULLIF(p_payload ->> 'idempotency_key', '');
  v_order_id   uuid := NULLIF(p_payload ->> 'work_order_id', '')::uuid;
  v_product    uuid := NULLIF(p_payload ->> 'product_id', '')::uuid;
  v_bom_id     uuid := NULLIF(p_payload ->> 'bom_id', '')::uuid;
  v_warehouse  uuid := NULLIF(p_payload ->> 'warehouse_id', '')::uuid;
  v_qty        numeric(18, 4) := (p_payload ->> 'quantity')::numeric;
  v_scrap      numeric(18, 4) := COALESCE(
                   NULLIF(p_payload ->> 'scrap_quantity', '')::numeric, 0);
  v_rework     numeric(18, 4) := COALESCE(
                   NULLIF(p_payload ->> 'rework_quantity', '')::numeric, 0);
  v_good       numeric(18, 4);
  v_day        date := COALESCE(NULLIF(p_payload ->> 'produced_on', '')::date, CURRENT_DATE);
  v_lines      jsonb := COALESCE(p_payload -> 'lines', '[]'::jsonb);
  v_labor      jsonb := COALESCE(p_payload -> 'labor', '{}'::jsonb);
  v_components numeric(18, 4) := COALESCE((p_payload ->> 'components_cost')::numeric, 0);
  v_labor_cost numeric(18, 4) := COALESCE((p_payload ->> 'labor_cost')::numeric, 0);
  v_other      numeric(18, 4) := COALESCE((p_payload ->> 'other_cost')::numeric, 0);
  v_unit       numeric(18, 4) := COALESCE((p_payload ->> 'unit_cost')::numeric, 0);
  v_calculated numeric(18, 4) := COALESCE((p_payload ->> 'calculated_total')::numeric, 0);
  v_override   numeric(18, 4) := NULLIF(p_payload ->> 'override_total', '')::numeric;
  v_total      numeric(18, 4) := COALESCE((p_payload ->> 'total_cost')::numeric, 0);
  v_inventory  boolean := COALESCE((p_payload ->> 'add_to_inventory')::boolean, false);
  v_consume    boolean := COALESCE((p_payload ->> 'consume_components')::boolean, false);
  v_existing   record;
  v_line       record;
  v_result     jsonb;
  v_actual     numeric(18, 4);
  v_any_actual boolean := false;
  v_sum        numeric(18, 4);
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'MANUFACTURING_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'MANUFACTURING_IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF v_qty IS NULL OR v_qty <= 0 THEN
    RAISE EXCEPTION 'MANUFACTURING_QUANTITY_INVALID' USING ERRCODE = 'P0001';
  END IF;
  -- Output losses are OUTPUT of the quantity started. Together they can never
  -- exceed it, and a negative loss is not a figure a run can have.
  IF v_scrap < 0 OR v_rework < 0 OR v_scrap + v_rework > v_qty THEN
    RAISE EXCEPTION 'MANUFACTURING_OUTPUT_EXCEEDS_QUANTITY' USING ERRCODE = 'P0001';
  END IF;
  v_good := v_qty - v_scrap - v_rework;

  -- Serialise retries of one press; the second waits and then finds the first.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_workspace_id::text || '|produce|' || v_key, 0)
  );

  SELECT id, status, total_cost, unit_cost, quantity, good_quantity INTO v_existing
    FROM work_orders
   WHERE workspace_id = p_workspace_id AND idempotency_key = v_key;
  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'already_completed',
      'work_order_id', v_existing.id,
      'quantity', v_existing.quantity,
      'good_quantity', v_existing.good_quantity,
      'total_cost', v_existing.total_cost
    );
  END IF;

  IF v_product IS NULL OR NOT EXISTS (
    SELECT 1 FROM products WHERE id = v_product AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'MANUFACTURING_PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_lines) l
     WHERE NULLIF(l ->> 'product_id', '') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM products p
          WHERE p.id = (l ->> 'product_id')::uuid AND p.workspace_id = p_workspace_id
       )
  ) THEN
    RAISE EXCEPTION 'MANUFACTURING_COMPONENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_lines) l
     WHERE NULLIF(l ->> 'product_id', '')::uuid = v_product
  ) THEN
    RAISE EXCEPTION 'MANUFACTURING_SELF_COMPONENT' USING ERRCODE = 'P0001';
  END IF;
  IF v_warehouse IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM warehouses WHERE id = v_warehouse AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'MANUFACTURING_WAREHOUSE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_bom_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM boms WHERE id = v_bom_id AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'MANUFACTURING_BOM_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_override IS NOT NULL AND COALESCE(btrim(p_payload ->> 'override_reason'), '') = '' THEN
    RAISE EXCEPTION 'MANUFACTURING_OVERRIDE_REASON_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  -- Nothing sellable is nothing to receive. The material was still issued, so
  -- «add to stock» with zero good units would post a cost for no goods.
  IF v_inventory AND v_good <= 0 THEN
    RAISE EXCEPTION 'MANUFACTURING_GOOD_QUANTITY_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- ── The parts must make the whole ───────────────────────────────────────
  SELECT COALESCE(SUM((l ->> 'line_total')::numeric), 0) INTO v_sum
    FROM jsonb_array_elements(v_lines) l WHERE COALESCE(l ->> 'kind', 'component') = 'component';
  IF abs(v_sum - v_components) > 0.01 THEN
    RAISE EXCEPTION 'MANUFACTURING_TOTALS_MISMATCH' USING ERRCODE = 'P0001';
  END IF;
  SELECT COALESCE(SUM((l ->> 'line_total')::numeric), 0) INTO v_sum
    FROM jsonb_array_elements(v_lines) l WHERE l ->> 'kind' = 'cost';
  IF abs(v_sum - v_other) > 0.01
     OR abs(v_components + v_labor_cost + v_other - v_unit) > 0.01
     OR abs(v_unit * v_qty - v_calculated) > 0.01
     OR abs(COALESCE(v_override, v_calculated) - v_total) > 0.01 THEN
    RAISE EXCEPTION 'MANUFACTURING_TOTALS_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  -- ── The record ──────────────────────────────────────────────────────────
  IF v_order_id IS NOT NULL THEN
    SELECT id, status INTO v_existing
      FROM work_orders
     WHERE id = v_order_id AND workspace_id = p_workspace_id
       FOR UPDATE;
    IF v_existing.id IS NULL THEN
      RAISE EXCEPTION 'MANUFACTURING_ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF v_existing.status = 'completed' THEN
      RAISE EXCEPTION 'WORK_ORDER_ALREADY_COMPLETED' USING ERRCODE = 'P0001';
    END IF;
    IF v_existing.status = 'cancelled' THEN
      RAISE EXCEPTION 'WORK_ORDER_CANCELLED' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    INSERT INTO work_orders (product_id, quantity, status, workspace_id, user_id, start_date)
    VALUES (v_product, v_qty, 'in_progress', p_workspace_id, p_user_id, now())
    RETURNING id INTO v_order_id;
  END IF;

  UPDATE work_orders SET
    product_id           = v_product,
    quantity             = v_qty,
    scrap_quantity       = v_scrap,
    rework_quantity      = v_rework,
    good_quantity        = v_good,
    yield_percent        = round(v_good / v_qty * 100, 4),
    bom_id               = v_bom_id,
    bom_version          = NULLIF(p_payload ->> 'bom_version', '')::integer,
    currency             = p_payload ->> 'currency',
    columns              = COALESCE(p_payload -> 'columns', '[]'::jsonb),
    notes                = p_payload ->> 'notes',
    labor_workers        = NULLIF(v_labor ->> 'workers', '')::numeric,
    labor_minutes        = NULLIF(v_labor ->> 'minutes', '')::numeric,
    labor_hourly_rate    = NULLIF(v_labor ->> 'hourly_rate', '')::numeric,
    components_cost      = v_components,
    labor_cost           = v_labor_cost,
    other_cost           = v_other,
    unit_cost            = v_unit,
    calculated_total     = v_calculated,
    override_total       = v_override,
    override_reason      = CASE WHEN v_override IS NOT NULL THEN btrim(p_payload ->> 'override_reason') END,
    override_by          = CASE WHEN v_override IS NOT NULL THEN p_user_id END,
    override_at          = CASE WHEN v_override IS NOT NULL THEN now() END,
    total_cost           = v_total,
    add_to_inventory     = v_inventory,
    consume_components   = v_inventory AND v_consume,
    warehouse_id         = CASE WHEN v_inventory THEN v_warehouse END,
    idempotency_key      = v_key,
    produced_on          = v_day,
    status               = 'completed',
    end_date             = now(),
    completed_at         = now(),
    completed_by         = p_user_id,
    updated_at           = now()
  WHERE id = v_order_id;

  -- ── The snapshot ────────────────────────────────────────────────────────
  INSERT INTO work_order_lines (
    workspace_id, work_order_id, kind, position, product_id, label, unit,
    quantity_per_unit, quantity, unit_cost, total, cells, produced_on
  )
  SELECT
    p_workspace_id, v_order_id,
    COALESCE(l ->> 'kind', 'component'),
    COALESCE((l ->> 'position')::integer, 0),
    NULLIF(l ->> 'product_id', '')::uuid,
    COALESCE(l ->> 'label', ''),
    NULLIF(l ->> 'unit', ''),
    COALESCE((l ->> 'quantity')::numeric, 0),
    COALESCE((l ->> 'quantity')::numeric, 0) * v_qty,
    COALESCE((l ->> 'unit_cost')::numeric, 0),
    COALESCE((l ->> 'line_total')::numeric, 0) * v_qty,
    COALESCE(l -> 'cells', '{}'::jsonb),
    v_day
  FROM jsonb_array_elements(v_lines) l;

  -- Labour is a line of the snapshot too, so «where did the cost come from»
  -- is one table. Written only when there is something to say.
  IF v_labor_cost > 0
     OR NULLIF(v_labor ->> 'workers', '') IS NOT NULL
     OR NULLIF(v_labor ->> 'minutes', '') IS NOT NULL THEN
    INSERT INTO work_order_lines (
      workspace_id, work_order_id, kind, position, label,
      quantity_per_unit, quantity, unit_cost, total, cells, produced_on
    ) VALUES (
      p_workspace_id, v_order_id, 'labor', 100000, '',
      1, v_qty, v_labor_cost, v_labor_cost * v_qty,
      jsonb_strip_nulls(jsonb_build_object(
        'workers', v_labor ->> 'workers',
        'minutes', v_labor ->> 'minutes',
        'hourly_rate', v_labor ->> 'hourly_rate'
      )),
      v_day
    );
  END IF;

  -- ── The stock ───────────────────────────────────────────────────────────
  IF v_inventory THEN
    IF v_consume THEN
      FOR v_line IN
        SELECT id, product_id, quantity
          FROM work_order_lines
         WHERE work_order_id = v_order_id AND kind = 'component'
           AND product_id IS NOT NULL AND quantity > 0
         ORDER BY position
      LOOP
        v_result := inventory_consume_layers(p_workspace_id, p_user_id, jsonb_build_object(
          'product_id', v_line.product_id,
          'warehouse_id', v_warehouse,
          'quantity', v_line.quantity,
          'entry_date', v_day,
          'consumer_type', 'adjustment',
          'consumer_id', v_order_id,
          'consumer_line', v_line.id::text
        ));
        v_actual := COALESCE((v_result ->> 'total_cost')::numeric, 0);
        v_any_actual := true;

        UPDATE work_order_lines
           SET actual_cost = v_actual,
               is_estimated = COALESCE((v_result ->> 'shortfall')::numeric, 0) > 0
         WHERE id = v_line.id;

        -- The components LEAVE. Negative, from the warehouse they were in.
        INSERT INTO stock_movements (
          product_id, type, quantity, reference_type, reference_id,
          from_warehouse_id, workspace_id, user_id
        ) VALUES (
          v_line.product_id, 'consumption', -v_line.quantity, 'work_order', v_order_id,
          v_warehouse, p_workspace_id, p_user_id
        );
      END LOOP;

      IF v_any_actual THEN
        UPDATE work_orders
           SET actual_material_cost = (
             SELECT COALESCE(SUM(actual_cost), 0) FROM work_order_lines
              WHERE work_order_id = v_order_id AND actual_cost IS NOT NULL
           )
         WHERE id = v_order_id;
      END IF;
    END IF;

    -- The finished goods ARRIVE — the good units only, worth what the whole
    -- run was recorded at, so scrap raises the cost of what can be sold.
    PERFORM inventory_receive_layer(p_workspace_id, p_user_id, jsonb_build_object(
      'product_id', v_product,
      'warehouse_id', v_warehouse,
      'quantity', v_good,
      'unit_cost', round(v_total / v_good, 4),
      'currency', COALESCE(p_payload ->> 'currency', 'AFN'),
      'entry_date', v_day,
      'source_type', 'adjustment',
      'source_id', v_order_id,
      'source_line', 'finished-goods'
    ));

    INSERT INTO stock_movements (
      product_id, type, quantity, reference_type, reference_id,
      to_warehouse_id, workspace_id, user_id
    ) VALUES (
      v_product, 'production', v_good, 'work_order', v_order_id,
      v_warehouse, p_workspace_id, p_user_id
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'completed',
    'work_order_id', v_order_id,
    'quantity', v_qty,
    'good_quantity', v_good,
    'total_cost', v_total,
    'unit_cost', round(v_total / v_good, 4),
    'actual_material_cost', (SELECT actual_material_cost FROM work_orders WHERE id = v_order_id)
  );
END;
$fn$;

-- ── 5. The report's «unit cost» is per SELLABLE unit ──────────────────────
-- `manufacturing_report` divided the run's total by `quantity` — the units it
-- STARTED. After this file that is the wrong denominator: a run of 100 that
-- yielded 95 cost 5% more per sellable unit, and the report would have shown
-- the old, lower figure beside a history that shows the new one. Same body,
-- same shape; only the two unit-cost aggregates change.
CREATE OR REPLACE FUNCTION public.manufacturing_report(
  p_workspace_id uuid,
  p_from         date,
  p_to           date,
  p_product_id   uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH runs AS (
    SELECT w.*
      FROM work_orders w
     WHERE w.workspace_id = p_workspace_id
       AND w.status = 'completed'
       AND w.produced_on BETWEEN p_from AND p_to
       AND (p_product_id IS NULL OR w.product_id = p_product_id)
  ),
  totals AS (
    SELECT
      COUNT(*)                                       AS runs,
      COALESCE(SUM(quantity), 0)                     AS quantity,
      COALESCE(SUM(total_cost), 0)                   AS total_cost,
      COALESCE(SUM(components_cost * quantity), 0)   AS components_cost,
      COALESCE(SUM(labor_cost * quantity), 0)        AS labor_cost,
      COALESCE(SUM(other_cost * quantity), 0)        AS other_cost,
      COALESCE(SUM(labor_minutes * quantity), 0)     AS labor_minutes
    FROM runs
  ),
  by_product AS (
    SELECT r.product_id,
           MAX(p.name)                    AS name,
           COUNT(*)                       AS runs,
           SUM(r.quantity)                AS quantity,
           SUM(r.total_cost)              AS total_cost,
           -- A run that predates output tracking received exactly `quantity`,
           -- so the fallback reproduces the old figure and invents nothing. A
           -- run with no sellable unit at all has no per-unit cost: NULL, not
           -- a figure divided by units that do not exist.
           (ARRAY_AGG(round(
              r.total_cost / NULLIF(
                CASE WHEN r.good_quantity IS NULL THEN r.quantity ELSE r.good_quantity END, 0), 4)
              ORDER BY r.produced_on, r.completed_at))[1]       AS first_unit_cost,
           (ARRAY_AGG(round(
              r.total_cost / NULLIF(
                CASE WHEN r.good_quantity IS NULL THEN r.quantity ELSE r.good_quantity END, 0), 4)
              ORDER BY r.produced_on DESC, r.completed_at DESC))[1] AS last_unit_cost
      FROM runs r
      LEFT JOIN products p ON p.id = r.product_id AND p.workspace_id = p_workspace_id
     GROUP BY r.product_id
  ),
  material_lines AS (
    SELECT l.*,
           COALESCE(l.product_id::text, 'label:' || lower(btrim(l.label))) AS material_key
      FROM work_order_lines l
      JOIN work_orders w ON w.id = l.work_order_id
     WHERE l.workspace_id = p_workspace_id
       AND l.kind = 'component'
       AND w.status = 'completed'
       AND (p_product_id IS NULL OR w.product_id = p_product_id)
       AND l.produced_on <= p_to
  ),
  in_range AS (
    SELECT * FROM material_lines WHERE produced_on >= p_from
  ),
  materials AS (
    SELECT
      i.material_key,
      MAX(i.product_id::text)::uuid                       AS product_id,
      COALESCE(MAX(p.name), MAX(i.label))                 AS name,
      MAX(i.unit)                                         AS unit,
      SUM(i.quantity)                                     AS quantity,
      SUM(i.total)                                        AS value,
      COUNT(DISTINCT i.work_order_id)                     AS runs,
      COUNT(DISTINCT w.product_id)                        AS products,
      (ARRAY_AGG(i.unit_cost ORDER BY i.produced_on DESC, i.created_at DESC))[1] AS current_cost,
      (ARRAY_AGG(i.unit_cost ORDER BY i.produced_on, i.created_at))[1]           AS first_cost_in_range,
      (SELECT b.unit_cost FROM material_lines b
        WHERE b.material_key = i.material_key AND b.produced_on < p_from
        ORDER BY b.produced_on DESC, b.created_at DESC LIMIT 1)                  AS cost_before_range
    FROM in_range i
    JOIN work_orders w ON w.id = i.work_order_id
    LEFT JOIN products p ON p.id = i.product_id AND p.workspace_id = p_workspace_id
    GROUP BY i.material_key
  ),
  material_rows AS (
    SELECT m.*,
           COALESCE(m.cost_before_range, m.first_cost_in_range) AS previous_cost
      FROM materials m
  )
  SELECT jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'totals', (SELECT to_jsonb(t) FROM totals t),
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'product_id', b.product_id, 'name', b.name, 'runs', b.runs,
        'quantity', b.quantity, 'total_cost', b.total_cost,
        'first_unit_cost', b.first_unit_cost, 'last_unit_cost', b.last_unit_cost
      ) ORDER BY b.total_cost DESC)
      FROM (SELECT * FROM by_product ORDER BY total_cost DESC LIMIT 50) b
    ), '[]'::jsonb),
    'materials', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', r.material_key, 'product_id', r.product_id, 'name', r.name, 'unit', r.unit,
        'quantity', r.quantity, 'value', r.value, 'runs', r.runs, 'products', r.products,
        'previous_cost', r.previous_cost, 'current_cost', r.current_cost,
        'change', r.current_cost - r.previous_cost,
        'change_percent', CASE WHEN r.previous_cost > 0
          THEN round((r.current_cost - r.previous_cost) * 100 / r.previous_cost, 2) END
      ) ORDER BY r.value DESC)
      FROM (SELECT * FROM material_rows ORDER BY value DESC LIMIT 100) r
    ), '[]'::jsonb)
  );
$fn$;

COMMIT;

-- ============================================
-- Rollback (manual — the owner runs it)
--
--   BEGIN;
--   -- 1. Put the previous body back (docs/manufacturing-01-migration.sql,
--   --    section «manufacturing_complete»), so the stock receipt is
--   --    `quantity` again and nothing writes the new columns. The same file
--   --    also holds the previous `manufacturing_report`, whose unit cost
--   --    divides by `quantity`.
--   -- 2. Then remove what this file added:
--   ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS work_orders_output_adds_up;
--   ALTER TABLE public.work_orders DROP COLUMN IF EXISTS yield_percent;
--   ALTER TABLE public.work_orders DROP COLUMN IF EXISTS good_quantity;
--   ALTER TABLE public.work_orders DROP COLUMN IF EXISTS rework_quantity;
--   ALTER TABLE public.work_orders DROP COLUMN IF EXISTS scrap_quantity;
--   COMMIT;
--
-- ⚠️ Dropping `good_quantity` loses the scrap/yield history of every run. The
-- money is unaffected: cost layers and the ledger keep what was actually
-- received.
-- ============================================
