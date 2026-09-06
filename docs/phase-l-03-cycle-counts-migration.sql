-- ============================================================================
-- docs/phase-l-03-cycle-counts-migration.sql
--
-- PHASE L · L2 — counting the shelves, as a document.
--
-- ---------------------------------------------------------------------------
-- THE DOMAIN ALREADY EXISTS AND NOTHING REACHES IT
--
-- `backend/src/services/inventory-costing/stock-count.domain.ts` already:
--
--   • computes variance as counted − expected
--   • values a SHORTAGE from the cost layers oldest-first, the same order a
--     sale consumes them
--   • values a SURPLUS at the current average, because no purchase history
--     exists for goods that appeared from nowhere
--   • keeps zero-variance lines, so «400 of 410 matched» stays distinguishable
--     from «10 products were counted»
--
-- It is covered by tests and has ZERO production consumers — there is no
-- table, no service and no route. This migration is the table it needs.
--
-- ---------------------------------------------------------------------------
-- ⚠️ A COUNT IS A FINANCIAL EVENT, NOT A CORRECTION
--
-- The tempting implementation is `UPDATE products SET quantity = counted`.
-- It is forbidden here for two reasons the domain's own header states:
--
--   1. Ten missing bottles are money that left the business. Overwriting the
--      quantity makes the balance sheet disagree with the shelves in the
--      opposite direction.
--   2. It destroys the evidence — a quantity that changed with no record of why.
--
-- So: variance → ADJUSTMENT stock movement → journal entry. The same path
-- every other stock change takes. Since Phase C, `stock_movements` is the only
-- thing that moves quantity anyway; `products.quantity` is a projection
-- maintained by trigger and writing it directly is already forbidden.
--
-- ---------------------------------------------------------------------------
-- ⚠️ `expected_qty` IS FROZEN ON THE LINE, DELIBERATELY
--
-- It records what the system believed AT THE MOMENT OF COUNTING. Recomputing
-- it at completion time would compare the shelf against a quantity that has
-- moved since — every sale made during the count would read as a shortage.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK / MITIGATION
--
--   DROP TABLE IF EXISTS cycle_count_lines;
--   DROP TABLE IF EXISTS cycle_counts;
--
-- ⚠️ Safe only before any count has been COMPLETED. After that these rows are
-- the evidence behind adjustment movements that are already in the ledger, and
-- dropping them leaves those adjustments unexplained.
--
-- SAFE TO RE-RUN.
-- ============================================================================

-- ============================================================================
-- PRE-MIGRATION VERIFICATION — run first, keep the output.
-- ============================================================================
--
-- P1. Do these already exist? (Expected: no rows.)
--
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('cycle_counts', 'cycle_count_lines');
--
-- P2. Are there already ADJUSTMENT movements with no document behind them?
--     These predate cycle counts and stay as they are — nothing is backfilled.
--
--   SELECT COUNT(*) AS undocumented_adjustments
--   FROM   stock_movements
--   WHERE  type = 'adjustment' AND reference_id IS NULL;
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The count
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cycle_counts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL,

  -- A count is always OF somewhere. Counting «the business» is not a thing a
  -- person can do with a clipboard.
  warehouse_id   uuid NOT NULL,

  count_number   text,
  status         text NOT NULL DEFAULT 'draft',

  -- Who started it and who closed it, separately — the same reasoning as the
  -- transfer document. «Did one person both count and approve the write-off»
  -- is the question an auditor asks.
  created_by     uuid,
  completed_by   uuid,

  started_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  cancelled_at   timestamptz,

  notes          text,

  -- Frozen at completion from the priced lines, so the report does not have to
  -- re-derive a valuation whose cost layers have since moved on.
  shortage_value numeric(18, 4),
  surplus_value  numeric(18, 4),
  net_loss       numeric(18, 4),

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  -- draft → counting → completed. `cancelled` is terminal and reachable only
  -- before completion: once the adjustment movements are written, the count is
  -- part of the ledger's history and «cancelled» would deny an effect that
  -- exists.
  CONSTRAINT cycle_counts_status_check CHECK (
    status IN ('draft', 'counting', 'completed', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS cycle_counts_workspace_status_idx
  ON cycle_counts (workspace_id, status);

CREATE INDEX IF NOT EXISTS cycle_counts_warehouse_idx
  ON cycle_counts (warehouse_id);

CREATE UNIQUE INDEX IF NOT EXISTS cycle_counts_number_idx
  ON cycle_counts (workspace_id, count_number)
  WHERE count_number IS NOT NULL;

COMMENT ON TABLE cycle_counts IS
  'L2 — a stock count as a document. The variance it produces becomes an ADJUSTMENT stock movement and a journal entry; `UPDATE products SET quantity` is forbidden (Phase C makes products.quantity a projection anyway). Pricing is done by stock-count.domain.ts, which already existed with no caller.';

-- ---------------------------------------------------------------------------
-- 2. The lines
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cycle_count_lines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL,
  count_id       uuid NOT NULL REFERENCES cycle_counts (id) ON DELETE CASCADE,
  product_id     uuid NOT NULL,

  /**
   * ⚠️ WHAT THE SYSTEM BELIEVED WHEN THE LINE WAS RAISED. Frozen.
   *
   * Recomputing this at completion would compare the shelf against a quantity
   * that has moved since — every sale made during the count would read as a
   * shortage, and the write-off would be exactly the day's takings.
   */
  expected_qty   numeric(18, 4) NOT NULL,

  /** What a person actually found. NULL until they have counted it. */
  counted_qty    numeric(18, 4),

  /**
   * counted − expected, frozen at completion. Negative is a shortage.
   *
   * Stored rather than derived so the completed document keeps saying the same
   * thing after the layers it was priced from have been consumed.
   */
  variance_qty   numeric(18, 4),
  variance_value numeric(18, 4),

  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),

  -- One line per product per count. Two would each produce their own
  -- adjustment movement and the shelf would be corrected twice.
  CONSTRAINT cycle_count_lines_unique UNIQUE (count_id, product_id)
);

CREATE INDEX IF NOT EXISTS cycle_count_lines_count_idx
  ON cycle_count_lines (count_id);

CREATE INDEX IF NOT EXISTS cycle_count_lines_product_idx
  ON cycle_count_lines (workspace_id, product_id);

COMMENT ON COLUMN cycle_count_lines.expected_qty IS
  'What the system believed when the line was raised — FROZEN. Recomputing at completion would read every sale made during the count as a shortage.';

COMMENT ON COLUMN cycle_count_lines.counted_qty IS
  'What a person found. NULL means «not yet counted», which is different from «counted zero» — and a count that treated the two the same would write off every product nobody got to.';

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE cycle_counts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_count_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cycle_counts_workspace ON cycle_counts;
CREATE POLICY cycle_counts_workspace ON cycle_counts
  FOR ALL
  USING (EXISTS (SELECT 1 FROM auth_workspace_ids() w WHERE w = cycle_counts.workspace_id))
  WITH CHECK (EXISTS (SELECT 1 FROM auth_workspace_ids() w WHERE w = cycle_counts.workspace_id));

DROP POLICY IF EXISTS cycle_count_lines_workspace ON cycle_count_lines;
CREATE POLICY cycle_count_lines_workspace ON cycle_count_lines
  FOR ALL
  USING (EXISTS (SELECT 1 FROM auth_workspace_ids() w WHERE w = cycle_count_lines.workspace_id))
  WITH CHECK (
    EXISTS (SELECT 1 FROM auth_workspace_ids() w WHERE w = cycle_count_lines.workspace_id)
  );

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
-- ============================================================================
--
-- V1. Both tables exist.
--
--   SELECT table_name, column_name, data_type FROM information_schema.columns
--   WHERE  table_name IN ('cycle_counts', 'cycle_count_lines')
--   ORDER  BY table_name, ordinal_position;
--
-- V2. Nothing was created — this is a new capability, not a backfill.
--
--   SELECT COUNT(*) FROM cycle_counts;        -- expect 0
--   SELECT COUNT(*) FROM cycle_count_lines;   -- expect 0
--
-- V3. RLS is on both.
--
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE  relname IN ('cycle_counts', 'cycle_count_lines');
--
-- V4. The status constraint accepts exactly four states.
--
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE  conname = 'cycle_counts_status_check';
--
-- V5. ⚠️ AFTER THE FIRST COUNT IS COMPLETED — every variance produced a
--     movement. This must return NO rows; one here is stock written off with
--     nothing in the movement log to show for it.
--
--   SELECT l.id, l.product_id, l.variance_qty
--   FROM   cycle_count_lines l
--   JOIN   cycle_counts c ON c.id = l.count_id
--   WHERE  c.status = 'completed' AND l.variance_qty <> 0
--     AND  NOT EXISTS (
--            SELECT 1 FROM stock_movements m
--            WHERE  m.reference_type = 'cycle_count' AND m.reference_id = c.id
--              AND  m.product_id = l.product_id);
--
-- ============================================================================
