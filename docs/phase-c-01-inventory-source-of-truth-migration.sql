-- ============================================================================
-- docs/phase-c-01-inventory-source-of-truth-migration.sql
--
-- PHASE C · 1/1 — stock_movements becomes the source of truth for quantity,
-- and the two stored quantities become projections of it.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS ACTUALLY THERE — four writers, no agreement
--
-- The audit says three sources. Reading the code, there are four, and they do
-- not overlap the way the audit assumed:
--
--   products.quantity      written by invoice.service (read-modify-write
--                          arithmetic), and OVERWRITTEN by purchasing.service
--                          and manufacturing.service from the cost layers.
--                          Whichever ran last wins.
--
--   warehouse_stock        written ONLY by warehouse_transfer_stock. Nothing
--                          else touches it, so it reflects transfers and
--                          nothing else — not a sale, not a receipt.
--
--   stock_movements        written by invoice.service and by the transfer
--                          function. NOT written by purchase receipts and NOT
--                          written by manufacturing. So it is not currently a
--                          complete record of anything.
--
--   cost_layers            the costing core's own quantities, which two
--                          services copy onto products.quantity.
--
-- ⚠️ That last point is why this migration cannot simply recompute
-- `products.quantity` from `SUM(stock_movements)`. Doing that would ZERO every
-- purchase receipt and every production run ever recorded, because no movement
-- row was ever written for them. It would look like a clean consolidation and
-- it would destroy the stock figures of every business using the app.
--
-- ---------------------------------------------------------------------------
-- HOW THAT IS HANDLED — an opening movement, not a recount
--
-- Section 3 does NOT recompute. It measures the gap between what is on the
-- books today and what the movements explain, and writes ONE movement per gap
-- with `type = 'opening'`.
--
-- After it runs, `SUM(stock_movements)` equals today's figure exactly. Nobody's
-- stock changes by a single unit. What changes is that the number now has an
-- explanation, and every future change has to go through a movement to happen.
--
-- The opening movements are also the honest record of what is NOT known: their
-- existence says "this quantity predates the movement log", which is true.
--
-- ---------------------------------------------------------------------------
-- ORDER INSIDE THIS FILE MATTERS
--
--   1-2  declare, index
--   3    backfill the opening movements   ← BEFORE the trigger exists
--   4    create the projection trigger    ← so the backfill is not double-applied
--   5    rewrite warehouse_transfer_stock to stop double-writing
--
-- If 4 ran before 3, every opening movement would ALSO bump the quantity it was
-- measured against, doubling every stock figure in the database.
--
-- ⚠️ APPLY BEFORE THE PHASE C CODE DEPLOY. The trigger makes the services'
-- existing `products.quantity` writes redundant, not wrong — a write that sets
-- the same value the trigger computed is a no-op. Deploying the code first
-- would leave a window where nothing maintains the figure at all.
--
-- SAFE TO RE-RUN. Section 3 is guarded by its own marker.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The decision
-- ---------------------------------------------------------------------------

COMMENT ON TABLE stock_movements IS
  'SOURCE OF TRUTH for inventory QUANTITY (Phase C). Append-only: every arrival, sale, transfer, adjustment and production is one row. products.quantity and warehouse_stock.quantity are projections maintained by stock_movements_project(). Cost and valuation remain the costing core''s (cost_layers) — this table owns how many, not how much they are worth.';

COMMENT ON COLUMN products.quantity IS
  'PROJECTION of SUM(stock_movements) for this product (Phase C). Maintained by trigger; never write it from application code. May be negative — a negative on-hand is a real shortfall that has been recorded rather than clamped to zero, and clamping is how the information gets lost (lesson 15).';

COMMENT ON COLUMN warehouse_stock.quantity IS
  'PROJECTION of SUM(stock_movements) attributed to this warehouse (Phase C). Maintained by trigger; never write it from application code.';

-- ---------------------------------------------------------------------------
-- 2. What the projection needs to be fast, and what the movement log needs to
--    be trustworthy
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS stock_movements_workspace_product_idx
  ON stock_movements (workspace_id, product_id);

CREATE INDEX IF NOT EXISTS stock_movements_from_warehouse_idx
  ON stock_movements (from_warehouse_id);

CREATE INDEX IF NOT EXISTS stock_movements_to_warehouse_idx
  ON stock_movements (to_warehouse_id);

CREATE INDEX IF NOT EXISTS stock_movements_reference_idx
  ON stock_movements (reference_type, reference_id);

-- The warehouse projection upserts on this pair; without the unique index the
-- ON CONFLICT below has nothing to conflict against.
CREATE UNIQUE INDEX IF NOT EXISTS warehouse_stock_unique
  ON warehouse_stock (warehouse_id, product_id);

-- ---------------------------------------------------------------------------
-- 2b. products.quantity must be able to hold what a movement can carry
--
-- It is `integer`. `stock_movements.quantity` is `numeric`, and the invoice
-- items it comes from carry `quantity` alongside `unit`, `unit_label` and
-- `weight_grams` precisely because this business sells things by weight.
--
-- Adding a numeric to an integer column ROUNDS. Half a kilogram sold becomes
-- either zero or one, with no error and no log line — and the projection would
-- then disagree with its own source by the rounding, forever.
--
-- integer → numeric is a widening conversion: every existing value survives
-- unchanged. Guarded so a re-run does not rewrite the table a second time.
-- ---------------------------------------------------------------------------

DO $widen$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products'
      AND column_name = 'quantity' AND data_type = 'integer'
  ) THEN
    ALTER TABLE products ALTER COLUMN quantity TYPE numeric(18, 4);
    RAISE NOTICE 'products.quantity widened from integer to numeric(18,4).';
  ELSE
    RAISE NOTICE 'products.quantity is already numeric — nothing to widen.';
  END IF;
END
$widen$;

-- ---------------------------------------------------------------------------
-- 3. Opening movements — make the log explain the current figures
--
-- Two passes, in this order:
--
--   3a  per (product, warehouse): the gap between warehouse_stock.quantity and
--       the movements already attributed to that warehouse
--   3b  per product: the gap between products.quantity and ALL movements for
--       that product — including the rows 3a just wrote, so the two levels end
--       up consistent rather than each carrying its own opening
--
-- `user_id` on stock_movements is NOT NULL, so these rows are attributed to the
-- workspace owner: the opening balance is the owner's assertion about their own
-- stock, which is exactly whose it is.
-- ---------------------------------------------------------------------------

DO $opening$
DECLARE
  v_existing bigint;
  v_wh       bigint := 0;
  v_prod     bigint := 0;
BEGIN
  SELECT COUNT(*) INTO v_existing
  FROM   stock_movements
  WHERE  reference_type = 'phase_c_opening';

  IF v_existing > 0 THEN
    RAISE NOTICE 'phase-c: opening movements already written (% rows) — skipping backfill.', v_existing;
    RETURN;
  END IF;

  -- ─── 3a. Per warehouse ───────────────────────────────────────────────────
  WITH attributed AS (
    -- What the movement log already says is sitting in each warehouse.
    -- A transfer moves an absolute quantity out of one and into the other;
    -- anything else applies its signed quantity to whichever it names.
    SELECT warehouse_id, product_id, SUM(qty) AS qty
    FROM (
      SELECT m.to_warehouse_id AS warehouse_id, m.product_id,
             CASE WHEN m.from_warehouse_id IS NOT NULL THEN ABS(m.quantity)
                  ELSE m.quantity END AS qty
      FROM   stock_movements m
      WHERE  m.to_warehouse_id IS NOT NULL

      UNION ALL

      SELECT m.from_warehouse_id, m.product_id,
             CASE WHEN m.to_warehouse_id IS NOT NULL THEN -ABS(m.quantity)
                  ELSE m.quantity END
      FROM   stock_movements m
      WHERE  m.from_warehouse_id IS NOT NULL
    ) legs
    GROUP BY warehouse_id, product_id
  ),
  gaps AS (
    SELECT
      ws.warehouse_id,
      ws.product_id,
      ws.workspace_id,
      ws.quantity - COALESCE(a.qty, 0) AS delta
    FROM   warehouse_stock ws
    LEFT   JOIN attributed a
      ON   a.warehouse_id = ws.warehouse_id AND a.product_id = ws.product_id
  )
  INSERT INTO stock_movements (
    product_id, type, quantity, to_warehouse_id,
    reference_type, notes, workspace_id, user_id
  )
  SELECT
    g.product_id,
    'opening',
    g.delta,
    g.warehouse_id,
    'phase_c_opening',
    'Opening balance recorded by phase-c-01: the quantity this warehouse held before stock_movements became the source of truth.',
    g.workspace_id,
    COALESCE(w.owner_id, (SELECT wm.user_id FROM workspace_members wm
                           WHERE wm.workspace_id = g.workspace_id LIMIT 1))
  FROM   gaps g
  LEFT   JOIN workspaces w ON w.id = g.workspace_id
  WHERE  g.delta <> 0
    AND  g.workspace_id IS NOT NULL;

  GET DIAGNOSTICS v_wh = ROW_COUNT;

  -- ─── 3b. Per product ─────────────────────────────────────────────────────
  WITH per_product AS (
    -- A transfer nets to zero at product level, so it is excluded rather than
    -- counted twice with opposite signs.
    SELECT m.product_id, SUM(
      CASE WHEN m.from_warehouse_id IS NOT NULL AND m.to_warehouse_id IS NOT NULL
           THEN 0 ELSE m.quantity END
    ) AS qty
    FROM   stock_movements m
    GROUP  BY m.product_id
  ),
  gaps AS (
    SELECT
      p.id            AS product_id,
      p.workspace_id,
      COALESCE(p.quantity, 0) - COALESCE(pp.qty, 0) AS delta
    FROM   products p
    LEFT   JOIN per_product pp ON pp.product_id = p.id
    WHERE  p.workspace_id IS NOT NULL
  )
  INSERT INTO stock_movements (
    product_id, type, quantity,
    reference_type, notes, workspace_id, user_id
  )
  SELECT
    g.product_id,
    'opening',
    g.delta,
    'phase_c_opening',
    'Opening balance recorded by phase-c-01: the quantity on hand before stock_movements became the source of truth. Not attributed to a warehouse because the figure it reconciles was not.',
    g.workspace_id,
    COALESCE(w.owner_id, (SELECT wm.user_id FROM workspace_members wm
                           WHERE wm.workspace_id = g.workspace_id LIMIT 1))
  FROM   gaps g
  LEFT   JOIN workspaces w ON w.id = g.workspace_id
  WHERE  g.delta <> 0;

  GET DIAGNOSTICS v_prod = ROW_COUNT;

  RAISE NOTICE 'phase-c: % warehouse opening(s), % product opening(s) written. No stock figure changed.', v_wh, v_prod;
END
$opening$;

-- ---------------------------------------------------------------------------
-- 4. The projection
--
-- AFTER INSERT and AFTER DELETE. There is no UPDATE branch on purpose: a
-- movement is a record of something that happened, and editing one is editing
-- history. If a movement was wrong, the correction is a reversing movement —
-- the same rule the journal follows.
--
-- The DELETE branch exists only so a deliberate, reviewed repair leaves the
-- projection consistent rather than silently wrong.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION stock_movements_project()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $project$
DECLARE
  m           record;
  v_sign      int;
  v_transfer  boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    m := NEW; v_sign := 1;
  ELSE
    m := OLD; v_sign := -1;   -- undo what this row contributed
  END IF;

  v_transfer := m.from_warehouse_id IS NOT NULL AND m.to_warehouse_id IS NOT NULL;

  -- ─── Warehouse legs ──────────────────────────────────────────────────────
  IF m.to_warehouse_id IS NOT NULL THEN
    INSERT INTO warehouse_stock (warehouse_id, product_id, quantity, workspace_id, user_id)
    VALUES (
      m.to_warehouse_id,
      m.product_id,
      v_sign * CASE WHEN v_transfer THEN ABS(m.quantity) ELSE m.quantity END,
      m.workspace_id,
      m.user_id
    )
    ON CONFLICT (warehouse_id, product_id) DO UPDATE
      SET quantity   = warehouse_stock.quantity + EXCLUDED.quantity,
          updated_at = now();
  END IF;

  IF m.from_warehouse_id IS NOT NULL THEN
    INSERT INTO warehouse_stock (warehouse_id, product_id, quantity, workspace_id, user_id)
    VALUES (
      m.from_warehouse_id,
      m.product_id,
      v_sign * CASE WHEN v_transfer THEN -ABS(m.quantity) ELSE m.quantity END,
      m.workspace_id,
      m.user_id
    )
    ON CONFLICT (warehouse_id, product_id) DO UPDATE
      SET quantity   = warehouse_stock.quantity + EXCLUDED.quantity,
          updated_at = now();
  END IF;

  -- ─── Product total ───────────────────────────────────────────────────────
  -- A transfer does not change how much of a product exists, only where it is.
  IF NOT v_transfer THEN
    UPDATE products
       SET quantity = COALESCE(quantity, 0) + (v_sign * m.quantity)
     WHERE id = m.product_id
       -- The movement's workspace must match the product's. Without this a
       -- movement carrying another workspace's product id would move THEIR
       -- stock — lesson 17, which is exactly how it happened last time.
       AND (m.workspace_id IS NULL OR workspace_id = m.workspace_id);
  END IF;

  RETURN NULL;   -- AFTER trigger; the return value is ignored
END
$project$;

COMMENT ON FUNCTION stock_movements_project() IS
  'Maintains products.quantity and warehouse_stock.quantity from stock_movements. Phase C. Application code must not write either figure directly.';

DROP TRIGGER IF EXISTS stock_movements_project_trg ON stock_movements;
CREATE TRIGGER stock_movements_project_trg
  AFTER INSERT OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION stock_movements_project();

-- ---------------------------------------------------------------------------
-- 5. warehouse_transfer_stock — stop writing the projection by hand
--
-- The function did three things: check, move warehouse_stock, record a
-- movement. The middle one is now the trigger's job, and doing both would move
-- the stock TWICE.
--
-- Everything else is unchanged, including the `FOR UPDATE` lock — that lock is
-- not about maintaining the balance, it is about two transfers of the last unit
-- both reading it as available (lesson 14), and it is still needed.
-- ---------------------------------------------------------------------------

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

  PERFORM 1 FROM warehouses
   WHERE id IN (v_from, v_to) AND workspace_id = p_workspace_id
   HAVING COUNT(*) = 2;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WAREHOUSE_NOT_IN_WORKSPACE' USING ERRCODE = 'P0001';
  END IF;

  -- Lock the source row so the availability check cannot be raced. The row is
  -- read, not written — the trigger writes it when the movement lands.
  SELECT quantity INTO v_available
    FROM warehouse_stock
   WHERE warehouse_id = v_from AND product_id = v_product
   FOR UPDATE;

  IF v_available IS NULL OR v_available < v_qty THEN
    RAISE EXCEPTION 'WAREHOUSE_INSUFFICIENT_STOCK' USING ERRCODE = 'P0001';
  END IF;

  -- The ONLY write. stock_movements_project() moves both warehouse rows.
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

-- ---------------------------------------------------------------------------
-- 6. The reconciliation view
--
-- What the movement log says, next to what the projections say. These three
-- columns must agree, and a report that computes both from the same place
-- would never be able to tell you they had stopped agreeing (lesson 6).
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS stock_on_hand;

CREATE VIEW stock_on_hand AS
SELECT
  p.id                                  AS product_id,
  p.workspace_id,
  p.name                                AS product_name,
  p.sku,
  COALESCE(SUM(
    CASE WHEN m.from_warehouse_id IS NOT NULL AND m.to_warehouse_id IS NOT NULL
         THEN 0 ELSE m.quantity END
  ), 0)                                 AS movement_quantity,
  COALESCE(p.quantity, 0)               AS projected_quantity,
  COALESCE(p.quantity, 0) - COALESCE(SUM(
    CASE WHEN m.from_warehouse_id IS NOT NULL AND m.to_warehouse_id IS NOT NULL
         THEN 0 ELSE m.quantity END
  ), 0)                                 AS drift
FROM   products p
LEFT   JOIN stock_movements m ON m.product_id = p.id
GROUP  BY p.id, p.workspace_id, p.name, p.sku, p.quantity;

-- RLS on the tables underneath only applies if the view runs as the caller.
-- See phase-b-03 for what happens when this is forgotten.
ALTER VIEW stock_on_hand SET (security_invoker = true);

COMMENT ON VIEW stock_on_hand IS
  'Reconciliation: SUM(stock_movements) against the projected products.quantity. `drift` must be zero for every row. Anything else means something wrote the projection directly. Phase C.';

COMMIT;

-- ============================================================================
-- VERIFY — run all three. The first two must return zero rows.
-- ============================================================================
--
-- 1) Product-level drift.
--
-- SELECT * FROM stock_on_hand WHERE drift <> 0 ORDER BY ABS(drift) DESC;
--
-- 2) Warehouse-level drift.
--
-- WITH attributed AS (
--   SELECT warehouse_id, product_id, SUM(qty) AS qty FROM (
--     SELECT m.to_warehouse_id AS warehouse_id, m.product_id,
--            CASE WHEN m.from_warehouse_id IS NOT NULL THEN ABS(m.quantity)
--                 ELSE m.quantity END AS qty
--     FROM stock_movements m WHERE m.to_warehouse_id IS NOT NULL
--     UNION ALL
--     SELECT m.from_warehouse_id, m.product_id,
--            CASE WHEN m.to_warehouse_id IS NOT NULL THEN -ABS(m.quantity)
--                 ELSE m.quantity END
--     FROM stock_movements m WHERE m.from_warehouse_id IS NOT NULL
--   ) legs GROUP BY warehouse_id, product_id
-- )
-- SELECT ws.warehouse_id, ws.product_id, ws.quantity, COALESCE(a.qty, 0) AS from_movements
-- FROM   warehouse_stock ws
-- LEFT   JOIN attributed a ON a.warehouse_id = ws.warehouse_id AND a.product_id = ws.product_id
-- WHERE  ws.quantity <> COALESCE(a.qty, 0);
--
-- 3) How much of the current stock is unexplained — the opening movements.
--    Not an error. A large number here means most inventory predates the log,
--    which is expected on the first run and should shrink over time.
--
-- SELECT COUNT(*) AS opening_rows, SUM(quantity) AS opening_units
-- FROM   stock_movements WHERE reference_type = 'phase_c_opening';
