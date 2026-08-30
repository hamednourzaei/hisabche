-- ============================================================================
-- docs/traceability-migration.sql
--
-- Batches, serial numbers and expiry — WHICH goods left, not just how many.
--
-- The costing core already answers "what did these goods cost". This answers
-- "which goods were they". They meet at one point: a batch or a serial names
-- the cost layer it arrived on, so the profit on a specific bottle is the cost
-- of the specific carton it came in, not an average.
--
-- Tracking is OPT-IN per product. A hardware store needs cost layers and no
-- batches; a pharmacy needs both. Turning this on for everybody would make
-- every sale ask a question most shops cannot answer.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── 1. Which products are tracked, and how ─────────────────────────────────

ALTER TABLE products ADD COLUMN IF NOT EXISTS tracking_mode text NOT NULL DEFAULT 'none';
ALTER TABLE products ADD COLUMN IF NOT EXISTS shelf_life_days integer;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_tracking_mode_check;
ALTER TABLE products ADD CONSTRAINT products_tracking_mode_check
  CHECK (tracking_mode IN ('none', 'batch', 'serial'));

-- ─── 2. Batches ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_batches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL,
  product_id        uuid NOT NULL,
  batch_number      text NOT NULL,
  -- NULL means this batch does not expire. Distinct from a far-future date:
  -- one is a fact about the goods, the other is a guess somebody typed.
  expiry_date       date,
  manufactured_date date,
  received_qty      numeric(18, 4) NOT NULL,
  remaining_qty     numeric(18, 4) NOT NULL,
  -- What ties identity to money.
  cost_layer_id     uuid,
  warehouse_id      uuid,
  received_on       date NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,
  CONSTRAINT stock_batches_qty_check CHECK (
    received_qty > 0 AND remaining_qty >= 0 AND remaining_qty <= received_qty
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_batches_number_key
  ON stock_batches (workspace_id, product_id, batch_number);

-- The FEFO queue: open batches for one product, soonest expiry first. Nulls
-- last, because a batch that does not expire is the one that can wait.
CREATE INDEX IF NOT EXISTS stock_batches_fefo_idx
  ON stock_batches (workspace_id, product_id, expiry_date NULLS LAST, received_on)
  WHERE remaining_qty > 0;

-- ─── 3. Serial numbers ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_serials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL,
  product_id      uuid NOT NULL,
  serial_number   text NOT NULL,
  status          text NOT NULL DEFAULT 'in_stock',
  batch_id        uuid REFERENCES stock_batches (id),
  cost_layer_id   uuid,
  -- What THIS unit cost. Minor units, from its own layer — never an average.
  unit_cost_minor bigint NOT NULL DEFAULT 0,
  warehouse_id    uuid,
  received_on     date NOT NULL,
  -- Where it went, once it went.
  invoice_id      uuid,
  sold_on         date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_serials_status_check
    CHECK (status IN ('in_stock', 'sold', 'returned', 'scrapped'))
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_serials_number_key
  ON stock_serials (workspace_id, product_id, serial_number);

CREATE INDEX IF NOT EXISTS stock_serials_available_idx
  ON stock_serials (workspace_id, product_id) WHERE status = 'in_stock';

-- ─── 4. What each document took ─────────────────────────────────────────────
-- The trail from an invoice line back to the exact physical goods.

CREATE TABLE IF NOT EXISTS lot_allocations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  consumer_type text NOT NULL,
  consumer_id   uuid NOT NULL,
  consumer_line text,
  product_id    uuid NOT NULL,
  batch_id      uuid REFERENCES stock_batches (id),
  serial_id     uuid REFERENCES stock_serials (id),
  quantity      numeric(18, 4) NOT NULL,
  entry_date    date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Exactly one of the two: a row names a batch or a serial, never both and
  -- never neither.
  CONSTRAINT lot_allocations_target_check CHECK (
    (batch_id IS NOT NULL AND serial_id IS NULL) OR
    (batch_id IS NULL AND serial_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS lot_allocations_consumer_idx
  ON lot_allocations (workspace_id, consumer_type, consumer_id);

CREATE INDEX IF NOT EXISTS lot_allocations_batch_idx
  ON lot_allocations (workspace_id, batch_id);

-- ─── 5. Cost layers learn about batches ─────────────────────────────────────

ALTER TABLE cost_layers ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES stock_batches (id);

-- ─── 6. Row level security ──────────────────────────────────────────────────

ALTER TABLE stock_batches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_serials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_allocations ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['stock_batches', 'stock_serials', 'lot_allocations'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_workspace_members', v_table);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR ALL TO authenticated
        USING (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
        ))
        WITH CHECK (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
        ))
    $p$, v_table || '_workspace_members', v_table);
  END LOOP;
END $$;

COMMIT;
