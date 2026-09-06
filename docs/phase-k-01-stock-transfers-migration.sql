-- ============================================================================
-- docs/phase-k-01-stock-transfers-migration.sql
--
-- PHASE K · K0 + K2 + K3 — the inter-branch transfer as a DOCUMENT.
--
-- ---------------------------------------------------------------------------
-- WHAT EXISTS TODAY, AND WHY IT IS NOT ENOUGH
--
-- `warehouse_transfer_stock(workspace, user, payload)` moves stock from one
-- warehouse to another ATOMICALLY: it locks the source, writes two
-- `stock_movements` rows, and returns. That is correct and stays.
--
-- What it cannot express is TIME. A transfer between two branches is not
-- instantaneous — goods are picked, they leave, they travel, they arrive, and
-- someone counts them. Today the stock teleports: it leaves the source and
-- appears at the destination in the same instant, so a van full of goods is
-- recorded as already received, and nothing anywhere says otherwise.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS ADDS
--
--   stock_transfers        the document, with a status lifecycle
--   stock_transfer_lines   what is on it — quantity AND unit
--
-- The atomic RPC is REUSED, not replaced: `ship` and `receive` each call it
-- for their own leg. G2 — one transfer engine, not two.
--
-- ---------------------------------------------------------------------------
-- ⚠️ K0 — `unit_id` EXISTS FROM DAY ONE, DELIBERATELY
--
-- Multi-UOM is L1 and is NOT built yet. A line still records base units today.
-- The column is here now because adding it later would mean altering a table
-- that already holds transfer history — and every existing row would have an
-- ambiguous unit, which is exactly the destructive migration G3 forbids and
-- the audit document warned about.
--
-- It is NULLABLE and has no foreign key yet: `units` does not exist. L1
-- creates that table and adds the reference. A nullable column now means
-- «base unit», which is the truth today and stays true after L1.
--
-- ---------------------------------------------------------------------------
-- ⚠️ K3 — IN-TRANSIT IS DERIVED. THERE IS NO `in_transit_quantity` COLUMN.
--
-- The audit document proposed one on `warehouse_stock`. It is not created
-- here, and the view at the bottom is why: a stored figure would be a THIRD
-- source of truth for quantity beside `stock_movements` (Phase C) and would
-- drift the first time a transfer was cancelled without it being decremented.
--
-- In-transit belongs to no warehouse. It is what has left one and not yet
-- arrived at another, and it is computed from the transfers themselves.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK / MITIGATION
--
--   DROP VIEW IF EXISTS stock_in_transit;
--   DROP TABLE IF EXISTS stock_transfer_lines;
--   DROP TABLE IF EXISTS stock_transfers;
--
-- ⚠️ Safe ONLY before any transfer document has been raised. After that these
-- tables hold the record of goods that moved between branches, and dropping
-- them loses it — the `stock_movements` rows survive, but not who authorised
-- the transfer, when it shipped, or what was received short.
--
-- SAFE TO RE-RUN.
-- ============================================================================

-- ============================================================================
-- PRE-MIGRATION VERIFICATION — run first, keep the output.
-- ============================================================================
--
-- P1. Do these tables already exist? (Expected: no rows. If they DO exist,
--     stop and read them before running this — the columns below may differ.)
--
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('stock_transfers', 'stock_transfer_lines');
--
-- P2. How many transfers have been done with the instantaneous RPC? These
--     have NO document and will not appear in the new tables — they stay
--     visible as `stock_movements` only. Nothing is backfilled: inventing a
--     document for them would mean inventing who approved it (§12).
--
--   SELECT COUNT(*) AS instantaneous_transfers
--   FROM   stock_movements
--   WHERE  from_warehouse_id IS NOT NULL AND to_warehouse_id IS NOT NULL;
--
-- P3. The warehouses that would take part.
--
--   SELECT workspace_id, COUNT(*) AS warehouses
--   FROM   warehouses WHERE deleted_at IS NULL GROUP BY workspace_id
--   ORDER BY 2 DESC;
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The document
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stock_transfers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL,

  -- Where it leaves and where it is going. Both required: a transfer with one
  -- end is an adjustment, and adjustments have their own path.
  from_warehouse_id   uuid NOT NULL,
  to_warehouse_id     uuid NOT NULL,

  -- Human-facing reference, unique per workspace so two branches cannot raise
  -- the same number.
  transfer_number     text,

  status              text NOT NULL DEFAULT 'requested',

  -- Who did each irreversible thing, and when. NOT one `updated_by`: the
  -- person who ships and the person who receives must be distinguishable, or
  -- the document cannot answer the only question an auditor asks of it.
  requested_by        uuid,
  approved_by         uuid,
  shipped_by          uuid,
  received_by         uuid,

  requested_at        timestamptz NOT NULL DEFAULT now(),
  approved_at         timestamptz,
  shipped_at          timestamptz,
  received_at         timestamptz,
  cancelled_at        timestamptz,

  notes               text,
  cancel_reason       text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- The seven states, as a constraint rather than a convention. A status the
  -- code does not know about cannot be written.
  CONSTRAINT stock_transfers_status_check CHECK (
    status IN ('requested', 'approved', 'picking', 'shipped', 'in_transit',
               'received', 'cancelled')
  ),

  -- «Transfer must not silently disappear» — an invariant from the spec. A
  -- transfer to the warehouse it came from is not a transfer.
  CONSTRAINT stock_transfers_distinct_ends CHECK (from_warehouse_id <> to_warehouse_id)
);

CREATE INDEX IF NOT EXISTS stock_transfers_workspace_status_idx
  ON stock_transfers (workspace_id, status);

CREATE INDEX IF NOT EXISTS stock_transfers_from_idx
  ON stock_transfers (from_warehouse_id);

CREATE INDEX IF NOT EXISTS stock_transfers_to_idx
  ON stock_transfers (to_warehouse_id);

-- Unique per workspace, and only when a number was given — a draft raised
-- before numbering must not collide with every other unnumbered draft.
CREATE UNIQUE INDEX IF NOT EXISTS stock_transfers_number_idx
  ON stock_transfers (workspace_id, transfer_number)
  WHERE transfer_number IS NOT NULL;

COMMENT ON TABLE stock_transfers IS
  'The inter-branch transfer DOCUMENT (Phase K). Stock itself still moves through warehouse_transfer_stock() and stock_movements — this records the lifecycle around it: who asked, who approved, when it shipped, who received it. In-transit is DERIVED from this table (see stock_in_transit); there is deliberately no in_transit_quantity column anywhere.';

COMMENT ON COLUMN stock_transfers.status IS
  'requested → approved → picking → shipped → in_transit → received. cancelled is terminal and reachable before shipping only. Enforced in stock_transfer_advance().';

-- ---------------------------------------------------------------------------
-- 2. The lines
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stock_transfer_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL,
  transfer_id         uuid NOT NULL REFERENCES stock_transfers (id) ON DELETE CASCADE,
  product_id          uuid NOT NULL,

  -- numeric, not integer. `products.quantity` was widened to numeric(18,4) in
  -- Phase C for weighed goods; a transfer of 2.5 kg must survive this table.
  quantity            numeric(18, 4) NOT NULL,

  -- ⚠️ K0 — HERE FROM DAY ONE. See the header.
  --
  -- NULL means «base unit», which is the only unit that exists today. L1
  -- creates `units` and adds the foreign key; no existing row becomes
  -- ambiguous, because NULL already has a defined meaning.
  unit_id             uuid,

  -- What was actually received, which is not always what was sent. NULL until
  -- the receiving branch counts. A short receipt is a real event and the
  -- document has to be able to record it rather than assuming the quantity.
  received_quantity   numeric(18, 4),

  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT stock_transfer_lines_quantity_positive CHECK (quantity > 0),
  CONSTRAINT stock_transfer_lines_received_non_negative
    CHECK (received_quantity IS NULL OR received_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS stock_transfer_lines_transfer_idx
  ON stock_transfer_lines (transfer_id);

CREATE INDEX IF NOT EXISTS stock_transfer_lines_product_idx
  ON stock_transfer_lines (workspace_id, product_id);

COMMENT ON COLUMN stock_transfer_lines.unit_id IS
  'K0 — reserved for Multi-UOM (L1). NULL means the product''s base unit, which is the only unit that exists today. Present now so L1 does not have to alter a table holding transfer history — every existing row would otherwise have an ambiguous unit (G3).';

COMMENT ON COLUMN stock_transfer_lines.received_quantity IS
  'What the destination actually counted. NULL until received. Deliberately separate from `quantity`: a short receipt is a real event, and assuming the sent quantity would hide every loss in transit.';

-- ---------------------------------------------------------------------------
-- 3. RLS — the workspace is the only boundary
-- ---------------------------------------------------------------------------

ALTER TABLE stock_transfers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_transfers_workspace ON stock_transfers;
CREATE POLICY stock_transfers_workspace ON stock_transfers
  FOR ALL
  USING (EXISTS (SELECT 1 FROM auth_workspace_ids() w WHERE w = stock_transfers.workspace_id))
  WITH CHECK (EXISTS (SELECT 1 FROM auth_workspace_ids() w WHERE w = stock_transfers.workspace_id));

DROP POLICY IF EXISTS stock_transfer_lines_workspace ON stock_transfer_lines;
CREATE POLICY stock_transfer_lines_workspace ON stock_transfer_lines
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM auth_workspace_ids() w WHERE w = stock_transfer_lines.workspace_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM auth_workspace_ids() w WHERE w = stock_transfer_lines.workspace_id)
  );

-- ---------------------------------------------------------------------------
-- 4. K3 — IN TRANSIT, DERIVED
--
-- What has left a warehouse and not yet arrived anywhere.
--
-- ⚠️ Belongs to NO warehouse. It is reported per (workspace, product) with the
-- origin and destination named, because a crate on a road is not on anybody's
-- shelf — putting it on either side's on-hand is how two branches come to
-- count the same goods.
--
-- `shipped` and `in_transit` both qualify: shipping is the moment the stock
-- left, and `in_transit` is only a later acknowledgement of the same state.
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS stock_in_transit;

CREATE VIEW stock_in_transit AS
SELECT
  t.workspace_id,
  l.product_id,
  t.from_warehouse_id,
  t.to_warehouse_id,
  t.id                                              AS transfer_id,
  t.transfer_number,
  t.shipped_at,
  -- Sent minus received-so-far. A partially received transfer still has the
  -- remainder on the road, and COALESCE keeps an uncounted line at its full
  -- sent quantity rather than collapsing it to zero.
  (l.quantity - COALESCE(l.received_quantity, 0))   AS quantity_in_transit
FROM   stock_transfers t
JOIN   stock_transfer_lines l ON l.transfer_id = t.id
WHERE  t.status IN ('shipped', 'in_transit')
  AND  (l.quantity - COALESCE(l.received_quantity, 0)) > 0;

ALTER VIEW stock_in_transit SET (security_invoker = true);

COMMENT ON VIEW stock_in_transit IS
  'K3 — goods that have left a warehouse and not yet been received. DERIVED from stock_transfers; there is no in_transit_quantity column and there must not be one, because a stored figure would be a third source of truth for quantity beside stock_movements (Phase C) and would drift the first time a transfer was cancelled.';

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
-- ============================================================================
--
-- V1. Both tables exist with the K0 unit column.
--
--   SELECT table_name, column_name, data_type, is_nullable
--   FROM   information_schema.columns
--   WHERE  table_name IN ('stock_transfers', 'stock_transfer_lines')
--   ORDER  BY table_name, ordinal_position;
--
-- V2. The status constraint accepts exactly the seven states.
--
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE  conname = 'stock_transfers_status_check';
--
-- V3. RLS is on, and the view runs as the caller.
--
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE  relname IN ('stock_transfers', 'stock_transfer_lines');
--
--   SELECT c.relname, c.reloptions FROM pg_class c
--   WHERE  c.relname = 'stock_in_transit';
--   -- expect reloptions to contain security_invoker=true
--
-- V4. In transit is empty on a fresh install — nothing has shipped.
--
--   SELECT COUNT(*) FROM stock_in_transit;
--
-- V5. ⚠️ NO in_transit_quantity COLUMN WAS CREATED. This must return no rows;
--     if it ever returns one, a second source of truth has appeared.
--
--   SELECT table_name, column_name FROM information_schema.columns
--   WHERE  column_name = 'in_transit_quantity';
--
-- ============================================================================
