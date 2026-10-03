-- ============================================================================
-- MANUFACTURING — 01: one generic production domain.
-- Additive, idempotent (safe to run twice).
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-manufacturing-01.sql and report the result.
--
-- RUN AFTER: inventory-costing-migration.sql, inventory-consume-concurrency-
--            migration.sql, phase-c-01-inventory-source-of-truth-migration.sql
--            (all three are already part of the live schema).
--
-- WHAT THIS IS
--
--   The three tables manufacturing already had are EXTENDED, not replaced:
--
--     boms          the definition («how one unit is normally made»), versioned
--     bom_items     its lines — components AND other costs
--     work_orders   the production record («what was actually made, and what
--                   it cost that day»)
--
--   and one table is new:
--
--     work_order_lines   the immutable cost snapshot of a production run
--
--   Nothing here names an industry. A line is a product reference or a free
--   label, a quantity, a unit and a cost.
--
-- WHY A SNAPSHOT TABLE
--
--   A work order used to point at a BOM and nothing else, so its cost was
--   whatever the BOM said TODAY. Raising the price of one material rewrote the
--   cost of every unit ever made. `work_order_lines` copies the lines at the
--   moment of production; reports read it, never the current BOM.
--
-- WHY TWO FUNCTIONS
--
--   supabase-js has no transaction. A production run writes the record, its
--   lines, the cost layers consumed, the finished-goods layer and the stock
--   movements — a failure half way used to leave components consumed and
--   nothing produced. `manufacturing_complete` does all of it in one
--   transaction, through the SAME costing functions invoices use
--   (inventory_consume_layers / inventory_receive_layer). There is no second
--   inventory engine.
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- boms — the definition
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.boms ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.boms ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.boms ADD COLUMN IF NOT EXISTS currency text;
-- The component table's column configuration (the invoice grid's own model):
-- which columns exist, which are hidden, which the user added.
ALTER TABLE public.boms ADD COLUMN IF NOT EXISTS columns jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Labour for ONE unit. All optional: time and head-count can be recorded
-- without being priced.
ALTER TABLE public.boms ADD COLUMN IF NOT EXISTS labor_workers numeric(18, 4);
ALTER TABLE public.boms ADD COLUMN IF NOT EXISTS labor_minutes numeric(18, 4);
ALTER TABLE public.boms ADD COLUMN IF NOT EXISTS labor_hourly_rate numeric(18, 4);
-- NULL = «derive from workers × time × rate». A number is what a person set.
ALTER TABLE public.boms ADD COLUMN IF NOT EXISTS labor_cost_input numeric(18, 4);
-- Derived by the server from the lines, for ONE unit. Never sent by a client.
ALTER TABLE public.boms ADD COLUMN IF NOT EXISTS components_cost numeric(18, 4) NOT NULL DEFAULT 0;
ALTER TABLE public.boms ADD COLUMN IF NOT EXISTS labor_cost numeric(18, 4) NOT NULL DEFAULT 0;
ALTER TABLE public.boms ADD COLUMN IF NOT EXISTS other_cost numeric(18, 4) NOT NULL DEFAULT 0;
ALTER TABLE public.boms ADD COLUMN IF NOT EXISTS unit_cost numeric(18, 4) NOT NULL DEFAULT 0;
-- The revision this one replaced. Revisions are rows; history is never edited.
ALTER TABLE public.boms ADD COLUMN IF NOT EXISTS supersedes_bom_id uuid;

CREATE INDEX IF NOT EXISTS boms_workspace_product_idx
  ON public.boms (workspace_id, product_id, version DESC);


-- ═══════════════════════════════════════════════════════════════════════════
-- bom_items — components and other costs of the definition
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS workspace_id uuid;
-- 'component' = a material/part/sub-assembly. 'cost' = any other cost of one
-- unit (packaging, transport, machine time — the label says which).
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'component';
-- A component need not be a stocked product: `raw_material_id` stays NULL and
-- the label carries the name. Only a product-linked component can be consumed
-- from stock.
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS line_total numeric(18, 4) NOT NULL DEFAULT 0;
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;
-- The row exactly as typed, user-defined columns included.
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS cells jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bom_items_kind_check') THEN
    ALTER TABLE public.bom_items
      ADD CONSTRAINT bom_items_kind_check CHECK (kind IN ('component', 'cost'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bom_items_bom_idx ON public.bom_items (bom_id, position);


-- ═══════════════════════════════════════════════════════════════════════════
-- work_orders — the production record
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS workspace_id uuid;

-- `quantity` was integer: half a kilo could not be produced. Widening integer
-- to numeric loses nothing and is skipped when it is already numeric.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'work_orders'
       AND column_name = 'quantity' AND data_type = 'integer'
  ) THEN
    ALTER TABLE public.work_orders ALTER COLUMN quantity TYPE numeric(18, 4);
  END IF;
END $$;

-- Which revision of the definition this run used — a number, so it survives
-- even if the BOM row is later removed.
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS bom_version integer;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS columns jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS labor_workers numeric(18, 4);
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS labor_minutes numeric(18, 4);
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS labor_hourly_rate numeric(18, 4);
-- The cost of ONE unit, by part.
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS components_cost numeric(18, 4);
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS labor_cost numeric(18, 4);
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS other_cost numeric(18, 4);
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS unit_cost numeric(18, 4);
-- The run. `calculated_total` is never overwritten: an override sits BESIDE it
-- with who, when and why.
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS calculated_total numeric(18, 4);
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS override_total numeric(18, 4);
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS override_reason text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS override_by uuid;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS override_at timestamptz;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS total_cost numeric(18, 4);
-- What the costing core says the consumed components REALLY cost (FIFO/AVCO).
-- NULL when nothing was consumed. Kept beside the entered figures so the
-- difference (material variance) is a query, not a guess.
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS actual_material_cost numeric(18, 4);
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS add_to_inventory boolean NOT NULL DEFAULT false;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS consume_components boolean NOT NULL DEFAULT false;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS warehouse_id uuid;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS produced_on date;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS completed_by uuid;

-- A retry of the same press of «ثبت» is the same run.
CREATE UNIQUE INDEX IF NOT EXISTS work_orders_idempotency_key
  ON public.work_orders (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS work_orders_workspace_completed_idx
  ON public.work_orders (workspace_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS work_orders_workspace_product_idx
  ON public.work_orders (workspace_id, product_id, completed_at DESC);


-- ═══════════════════════════════════════════════════════════════════════════
-- work_order_lines — the cost snapshot
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ APPEND-ONLY. No route updates or deletes a line; a mistake in a completed
-- run is corrected by a new run or a stock adjustment, never by editing what
-- was recorded. Reports («which material got more expensive») read THIS, so
-- editing it would rewrite history.
CREATE TABLE IF NOT EXISTS public.work_order_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL,
  work_order_id     uuid NOT NULL REFERENCES public.work_orders (id) ON DELETE CASCADE,
  kind              text NOT NULL CHECK (kind IN ('component', 'labor', 'cost')),
  position          integer NOT NULL DEFAULT 0,
  -- NULL for a free-text component, for labour and for other costs.
  product_id        uuid,
  label             text NOT NULL DEFAULT '',
  unit              text,
  -- Per ONE finished unit, as entered.
  quantity_per_unit numeric(18, 4) NOT NULL DEFAULT 0,
  -- For the whole run: quantity_per_unit × units produced.
  quantity          numeric(18, 4) NOT NULL DEFAULT 0,
  unit_cost         numeric(18, 4) NOT NULL DEFAULT 0,
  -- For the whole run.
  total             numeric(18, 4) NOT NULL DEFAULT 0,
  -- What the costing core charged for this line. NULL = not consumed from stock.
  actual_cost       numeric(18, 4),
  -- True when part of the consumed quantity had no stock behind it.
  is_estimated      boolean NOT NULL DEFAULT false,
  cells             jsonb NOT NULL DEFAULT '{}'::jsonb,
  produced_on       date NOT NULL DEFAULT CURRENT_DATE,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.work_order_lines IS
  'Immutable cost snapshot of a production run: components, labour and other costs as they were on the day. Reports read this, never the current BOM.';

CREATE INDEX IF NOT EXISTS work_order_lines_order_idx
  ON public.work_order_lines (work_order_id, position);
-- The report: per workspace, per material, over a date range.
CREATE INDEX IF NOT EXISTS work_order_lines_report_idx
  ON public.work_order_lines (workspace_id, produced_on, kind);
CREATE INDEX IF NOT EXISTS work_order_lines_product_idx
  ON public.work_order_lines (workspace_id, product_id, produced_on)
  WHERE product_id IS NOT NULL;

-- Internal: the backend reads it with service_role. RLS on, no policy, no grant
-- to a browser role — the same posture as cost_layers.
ALTER TABLE public.work_order_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.work_order_lines FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.work_order_lines TO service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- manufacturing_save_bom — save or revise a definition
-- ═══════════════════════════════════════════════════════════════════════════
--
-- p_payload:
--   { product_id, bom_id?, currency, columns, notes?,
--     labor: { workers?, minutes?, hourly_rate?, cost_input? },
--     components_cost, labor_cost, other_cost, unit_cost,
--     lines: [ { kind, product_id?, label, quantity, unit?, unit_cost,
--                line_total, position, cells } ] }
--
-- ⚠️ REVISION RULE. A definition that a production run already used is never
-- edited: saving it writes a NEW row (version + 1) and retires the old one, so
-- the run keeps pointing at what it was actually made from. A definition
-- nothing has used yet is simply replaced — there is no history to protect.
--
-- Returns { bom_id, version, revised }.
CREATE OR REPLACE FUNCTION public.manufacturing_save_bom(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_payload      jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_product  uuid := NULLIF(p_payload ->> 'product_id', '')::uuid;
  v_bom_id   uuid := NULLIF(p_payload ->> 'bom_id', '')::uuid;
  v_lines    jsonb := COALESCE(p_payload -> 'lines', '[]'::jsonb);
  v_labor    jsonb := COALESCE(p_payload -> 'labor', '{}'::jsonb);
  v_existing record;
  v_version  integer;
  v_revised  boolean := false;
  v_target   uuid;
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'MANUFACTURING_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF v_product IS NULL OR NOT EXISTS (
    SELECT 1 FROM products WHERE id = v_product AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'MANUFACTURING_PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  -- Every component that names a product must name one of THIS workspace.
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
  -- A product cannot be a component of itself.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_lines) l
     WHERE NULLIF(l ->> 'product_id', '')::uuid = v_product
  ) THEN
    RAISE EXCEPTION 'MANUFACTURING_SELF_COMPONENT' USING ERRCODE = 'P0001';
  END IF;

  -- One writer per product at a time: two saves cannot both become «version 2».
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_workspace_id::text || '|bom|' || v_product::text, 0)
  );

  IF v_bom_id IS NOT NULL THEN
    SELECT id, version INTO v_existing
      FROM boms
     WHERE id = v_bom_id AND workspace_id = p_workspace_id AND product_id = v_product
       FOR UPDATE;
    IF v_existing.id IS NULL THEN
      RAISE EXCEPTION 'MANUFACTURING_BOM_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    v_revised := EXISTS (
      SELECT 1 FROM work_orders
       WHERE bom_id = v_bom_id AND workspace_id = p_workspace_id
    );
  END IF;

  IF v_bom_id IS NOT NULL AND NOT v_revised THEN
    -- Unused: replace in place.
    v_target := v_bom_id;
    v_version := v_existing.version;
    UPDATE boms SET
      currency          = p_payload ->> 'currency',
      columns           = COALESCE(p_payload -> 'columns', '[]'::jsonb),
      notes             = p_payload ->> 'notes',
      labor_workers     = NULLIF(v_labor ->> 'workers', '')::numeric,
      labor_minutes     = NULLIF(v_labor ->> 'minutes', '')::numeric,
      labor_hourly_rate = NULLIF(v_labor ->> 'hourly_rate', '')::numeric,
      labor_cost_input  = NULLIF(v_labor ->> 'cost_input', '')::numeric,
      components_cost   = COALESCE((p_payload ->> 'components_cost')::numeric, 0),
      labor_cost        = COALESCE((p_payload ->> 'labor_cost')::numeric, 0),
      other_cost        = COALESCE((p_payload ->> 'other_cost')::numeric, 0),
      unit_cost         = COALESCE((p_payload ->> 'unit_cost')::numeric, 0),
      is_active         = true,
      updated_at        = now()
    WHERE id = v_target;
    DELETE FROM bom_items WHERE bom_id = v_target;
  ELSE
    SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
      FROM boms WHERE workspace_id = p_workspace_id AND product_id = v_product;

    INSERT INTO boms (
      product_id, version, is_active, workspace_id, user_id, currency, columns, notes,
      labor_workers, labor_minutes, labor_hourly_rate, labor_cost_input,
      components_cost, labor_cost, other_cost, unit_cost, supersedes_bom_id
    ) VALUES (
      v_product, v_version, true, p_workspace_id, p_user_id,
      p_payload ->> 'currency',
      COALESCE(p_payload -> 'columns', '[]'::jsonb),
      p_payload ->> 'notes',
      NULLIF(v_labor ->> 'workers', '')::numeric,
      NULLIF(v_labor ->> 'minutes', '')::numeric,
      NULLIF(v_labor ->> 'hourly_rate', '')::numeric,
      NULLIF(v_labor ->> 'cost_input', '')::numeric,
      COALESCE((p_payload ->> 'components_cost')::numeric, 0),
      COALESCE((p_payload ->> 'labor_cost')::numeric, 0),
      COALESCE((p_payload ->> 'other_cost')::numeric, 0),
      COALESCE((p_payload ->> 'unit_cost')::numeric, 0),
      v_bom_id
    )
    RETURNING id INTO v_target;
  END IF;

  -- Exactly one active definition per product: the one just saved.
  UPDATE boms SET is_active = false, updated_at = now()
   WHERE workspace_id = p_workspace_id AND product_id = v_product
     AND id <> v_target AND is_active IS DISTINCT FROM false;

  INSERT INTO bom_items (
    bom_id, workspace_id, user_id, kind, raw_material_id, label, quantity, unit,
    unit_cost, line_total, position, cells
  )
  SELECT
    v_target, p_workspace_id, p_user_id,
    COALESCE(l ->> 'kind', 'component'),
    NULLIF(l ->> 'product_id', '')::uuid,
    COALESCE(l ->> 'label', ''),
    COALESCE((l ->> 'quantity')::numeric, 0),
    NULLIF(l ->> 'unit', ''),
    COALESCE((l ->> 'unit_cost')::numeric, 0),
    COALESCE((l ->> 'line_total')::numeric, 0),
    COALESCE((l ->> 'position')::integer, 0),
    COALESCE(l -> 'cells', '{}'::jsonb)
  FROM jsonb_array_elements(v_lines) l;

  RETURN jsonb_build_object('bom_id', v_target, 'version', v_version, 'revised', v_revised);
END;
$fn$;


-- ═══════════════════════════════════════════════════════════════════════════
-- manufacturing_complete — record one production run, atomically
-- ═══════════════════════════════════════════════════════════════════════════
--
-- p_payload:
--   { idempotency_key, work_order_id?, product_id, bom_id?, bom_version?,
--     quantity, currency, columns, notes?, produced_on,
--     labor: { workers?, minutes?, hourly_rate? },
--     components_cost, labor_cost, other_cost, unit_cost,      -- per ONE unit
--     calculated_total, override_total?, override_reason?, total_cost,
--     add_to_inventory, consume_components, warehouse_id?,
--     lines: [ { kind: 'component'|'cost', product_id?, label, quantity, unit?,
--                unit_cost, line_total, position, cells } ] }  -- per ONE unit
--
-- Every figure is computed by the server (computeProductionCost) before it
-- arrives. This function does not trust them blindly: it re-adds the lines and
-- refuses a payload whose parts do not make its total.
--
-- ⚠️ IDEMPOTENT. The same key returns the run it already recorded, with
-- status 'already_completed' — components are not consumed twice and the goods
-- are not received twice. The costing functions are idempotent per line as
-- well, so even a crash between two statements cannot double them: it is all
-- one transaction.
--
-- ⚠️ INVENTORY IS A SWITCH.  add_to_inventory = false writes the cost record
-- and NOTHING else — no layer, no movement.  With it on, the finished goods
-- are received at total_cost ÷ quantity; with consume_components on as well,
-- every product-linked component is issued from the same warehouse through the
-- costing core, which refuses when the stock is not there (the workspace's
-- own negative-stock policy decides).
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

  -- Serialise retries of one press; the second waits and then finds the first.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_workspace_id::text || '|produce|' || v_key, 0)
  );

  SELECT id, status, total_cost, unit_cost, quantity INTO v_existing
    FROM work_orders
   WHERE workspace_id = p_workspace_id AND idempotency_key = v_key;
  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'already_completed',
      'work_order_id', v_existing.id,
      'quantity', v_existing.quantity,
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

    -- The finished goods ARRIVE, worth what the run was recorded at.
    PERFORM inventory_receive_layer(p_workspace_id, p_user_id, jsonb_build_object(
      'product_id', v_product,
      'warehouse_id', v_warehouse,
      'quantity', v_qty,
      'unit_cost', round(v_total / v_qty, 4),
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
      v_product, 'production', v_qty, 'work_order', v_order_id,
      v_warehouse, p_workspace_id, p_user_id
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'completed',
    'work_order_id', v_order_id,
    'quantity', v_qty,
    'total_cost', v_total,
    'unit_cost', round(v_total / v_qty, 4),
    'actual_material_cost', (SELECT actual_material_cost FROM work_orders WHERE id = v_order_id)
  );
END;
$fn$;


-- ═══════════════════════════════════════════════════════════════════════════
-- manufacturing_report — what was made and what it cost, from the snapshot
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Aggregated in the database. For each material, «previous» is the unit cost
-- on its LAST run BEFORE the range (or, with none, its first run inside it)
-- and «current» is the unit cost on its last run inside the range — both read
-- from what was recorded on those days, never from today's product price.
--
-- A material is identified by its product when it has one, otherwise by its
-- label: «LCD» typed by hand in March and in April is the same material.
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
           (ARRAY_AGG(round(r.total_cost / NULLIF(r.quantity, 0), 4)
                      ORDER BY r.produced_on, r.completed_at))[1]       AS first_unit_cost,
           (ARRAY_AGG(round(r.total_cost / NULLIF(r.quantity, 0), 4)
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


-- Only the backend calls these.
REVOKE ALL ON FUNCTION public.manufacturing_save_bom(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.manufacturing_complete(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.manufacturing_report(uuid, date, date, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manufacturing_save_bom(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.manufacturing_complete(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.manufacturing_report(uuid, date, date, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK / MITIGATION
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The backend checks for the new schema and answers «not configured» instead
-- of failing, so the safe mitigation is to leave the columns in place and drop
-- only the functions:
--
--   DROP FUNCTION IF EXISTS public.manufacturing_report(uuid, date, date, uuid);
--   DROP FUNCTION IF EXISTS public.manufacturing_complete(uuid, uuid, jsonb);
--   DROP FUNCTION IF EXISTS public.manufacturing_save_bom(uuid, uuid, jsonb);
--
-- A full rollback also removes recorded production costs — destructive, and
-- written down for that reason rather than recommended:
--
--   DROP TABLE IF EXISTS public.work_order_lines;
--   ALTER TABLE public.work_orders DROP COLUMN IF EXISTS total_cost;   -- …and the others added above
--
-- Stock already moved by a completed run is NOT undone by any of this; reverse
-- it with a stock adjustment.
