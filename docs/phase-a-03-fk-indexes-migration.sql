-- ============================================================================
-- docs/phase-a-03-fk-indexes-migration.sql
--
-- PHASE A · 3/4 — an index behind every foreign key.
--
-- The audit found 26 foreign keys with no index behind them. Postgres does not
-- create one; it indexes the REFERENCED side (the primary key) automatically and
-- leaves the REFERENCING side bare. Two costs, both silent:
--
--   * every delete or key-update on the parent sequentially scans the whole
--     child table to prove no row references it. Deleting one branch scans every
--     invoice, every payment, every stock movement in the database.
--   * the natural read — "everything belonging to this branch" — has no index
--     either, so a branch filter on the invoice list is a seq scan.
--
-- PRIORITY, per the audit: the six branch keys first. `branches` is being
-- promoted to a first-class entity, which means branch_id moves from a rarely
-- used tag to a filter on nearly every operational read.
--
-- Composite where the read is composite. `invoices (workspace_id, branch_id)`
-- serves both the FK check and the real query — no read filters by branch
-- WITHOUT filtering by workspace first, because workspace_id is the security
-- boundary and comes before everything.
--
-- SECTION 3 is a catalog-driven sweep: it finds any REMAINING unindexed foreign
-- key — including ones added after this file was written — and creates a
-- single-column index for each. It is the safety net, not the plan; a key that
-- deserves a composite gets one by name in section 1 or 2.
--
-- NOT wrapped in one transaction-per-index by choice: CREATE INDEX (without
-- CONCURRENTLY) takes a SHARE lock, blocking writes to that table for the
-- duration. On a small book that is milliseconds. If any of these tables has
-- grown large, run that statement separately with CONCURRENTLY, OUTSIDE a
-- transaction block:
--
--     CREATE INDEX CONCURRENTLY IF NOT EXISTS invoices_branch_idx
--       ON invoices (workspace_id, branch_id);
--
-- SAFE TO RE-RUN. Creates nothing but indexes — no row is read, written or
-- deleted.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Branch keys — highest priority
--
-- Workspace-first composites, because branch is always a filter WITHIN a
-- workspace, never across one.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS invoices_branch_idx
  ON invoices (workspace_id, branch_id);

CREATE INDEX IF NOT EXISTS payments_branch_idx
  ON payments (workspace_id, branch_id);

CREATE INDEX IF NOT EXISTS stock_movements_branch_idx
  ON stock_movements (workspace_id, branch_id);

-- journal_entries_branch_idx already exists (branch-migration.sql). Repeated
-- here so this file is a complete statement of the branch key set; IF NOT
-- EXISTS makes the repetition free.
CREATE INDEX IF NOT EXISTS journal_entries_branch_idx
  ON journal_entries (workspace_id, branch_id);

CREATE INDEX IF NOT EXISTS warehouses_branch_idx
  ON warehouses (branch_id);

-- The branch tree. `parent_branch_id` is walked recursively to build the
-- hierarchy; without this index every level of the walk is a seq scan.
CREATE INDEX IF NOT EXISTS branches_parent_branch_idx
  ON branches (parent_branch_id);

CREATE INDEX IF NOT EXISTS member_branches_branch_idx
  ON member_branches (branch_id);

CREATE INDEX IF NOT EXISTS cost_layers_branch_idx
  ON cost_layers (branch_id);

-- ---------------------------------------------------------------------------
-- 2. The remaining named keys from the audit
--
-- Each of these is a child collection read by its parent id — the classic
-- "load the lines of this document" access path.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS asset_depreciation_schedule_asset_idx
  ON asset_depreciation_schedule (asset_id);

CREATE INDEX IF NOT EXISTS bank_statement_lines_statement_idx
  ON bank_statement_lines (statement_id);

CREATE INDEX IF NOT EXISTS budget_breaches_budget_idx
  ON budget_breaches (budget_id);

CREATE INDEX IF NOT EXISTS budget_commitments_budget_idx
  ON budget_commitments (budget_id);

CREATE INDEX IF NOT EXISTS cost_layers_batch_idx
  ON cost_layers (batch_id);

CREATE INDEX IF NOT EXISTS fx_revaluation_lines_revaluation_idx
  ON fx_revaluation_lines (revaluation_id);

CREATE INDEX IF NOT EXISTS pos_orders_session_idx
  ON pos_orders (session_id);

CREATE INDEX IF NOT EXISTS pos_order_payments_order_idx
  ON pos_order_payments (order_id);

COMMIT;

-- ---------------------------------------------------------------------------
-- 3. Catalog-driven sweep — everything still uncovered
--
-- Finds every foreign key in `public` whose leading column set is not the
-- prefix of any existing index, and creates one. Naming: <table>_<cols>_fk_idx.
--
-- An index created here is CORRECT but not necessarily OPTIMAL — it is
-- single-purpose, covering the constraint. If the query that reads it also
-- filters by workspace_id, add the composite by hand above and drop the
-- generated one.
--
-- Runs outside the transaction above so that a failure on one table does not
-- roll back the sixteen deliberate indexes.
-- ---------------------------------------------------------------------------

DO $sweep$
DECLARE
  fk        record;
  cols      text;
  idx_name  text;
  created   int := 0;
BEGIN
  FOR fk IN
    SELECT
      c.conrelid::regclass::text                            AS tbl,
      c.conname                                             AS constraint_name,
      ARRAY(
        SELECT a.attname
        FROM   unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN   pg_attribute a
          ON   a.attrelid = c.conrelid AND a.attnum = k.attnum
        ORDER  BY k.ord
      )                                                     AS colnames,
      c.conkey                                              AS conkey
    FROM   pg_constraint c
    JOIN   pg_class      t ON t.oid = c.conrelid
    JOIN   pg_namespace  n ON n.oid = t.relnamespace
    WHERE  c.contype = 'f'
      AND  n.nspname = 'public'
      AND  t.relkind = 'r'
      AND  NOT EXISTS (
        -- an index whose LEADING columns are exactly this key's columns
        SELECT 1
        FROM   pg_index i
        WHERE  i.indrelid = c.conrelid
          AND  (i.indkey::smallint[])[0:array_length(c.conkey, 1) - 1]
               OPERATOR(pg_catalog.=) c.conkey
      )
  LOOP
    cols     := array_to_string(ARRAY(SELECT quote_ident(x) FROM unnest(fk.colnames) x), ', ');
    idx_name := left(
      regexp_replace(fk.tbl, '^public\.', '') || '_' ||
      array_to_string(fk.colnames, '_') || '_fk_idx',
      63
    );

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%s)', idx_name, fk.tbl, cols);
    created := created + 1;
    RAISE NOTICE 'phase-a-03 sweep: created % on %(%) for constraint %',
      idx_name, fk.tbl, cols, fk.constraint_name;
  END LOOP;

  RAISE NOTICE 'phase-a-03 sweep: % index(es) created.', created;
END
$sweep$;

-- ============================================================================
-- VERIFY — must return zero rows after applying.
-- ============================================================================
--
-- SELECT c.conrelid::regclass AS tbl, c.conname
-- FROM   pg_constraint c
-- JOIN   pg_class t     ON t.oid = c.conrelid
-- JOIN   pg_namespace n ON n.oid = t.relnamespace
-- WHERE  c.contype = 'f' AND n.nspname = 'public' AND t.relkind = 'r'
--   AND  NOT EXISTS (
--     SELECT 1 FROM pg_index i
--     WHERE i.indrelid = c.conrelid
--       AND (i.indkey::smallint[])[0:array_length(c.conkey,1)-1] = c.conkey
--   );
