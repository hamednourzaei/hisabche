-- ============================================================================
-- docs/custom-units-migration.sql
--
-- A business's own unit of measure («طاقه», «بسته‌ی ۶تایی») — request #94.
--
-- WHY A COLUMN AND NOT JUST A ROW: `units` is GLOBAL (phase-l-01 seeds it and
-- it carries no workspace). Inserting a shop's own unit as-is would put that
-- word in every other business's picker. A unit now belongs either to everyone
-- (workspace_id NULL — the seeded list) or to one workspace.
--
-- The UNIQUE on `code` is replaced by two partial uniques, which RELAXES it:
-- every row valid before is still valid.
--   * one global code, as before
--   * one code per workspace, so two shops can both call something «طاقه»
--
-- ADDITIVE AND SAFE TO RE-RUN. No row is changed: existing units stay global.
-- ============================================================================

-- ⚠️ LOCK NOTE: ALTER TABLE needs an exclusive lock on a table the live app
-- reads, so a run during traffic can end with «40P01: deadlock detected».
-- NOTHING is half-applied — the file is one transaction. Re-run it when quiet.

BEGIN;

-- Give up rather than queue behind (or deadlock with) live queries.
SET LOCAL lock_timeout = '5s';

ALTER TABLE units ADD COLUMN IF NOT EXISTS workspace_id uuid;

-- The old global-only uniqueness. Named by the table's own constraint, whatever
-- Postgres called it when `code text NOT NULL UNIQUE` created it.
DO $$
DECLARE
  v_name text;
BEGIN
  SELECT conname INTO v_name
  FROM pg_constraint
  WHERE conrelid = 'units'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) = 'UNIQUE (code)';
  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE units DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS units_global_code_key
  ON units (code) WHERE workspace_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS units_workspace_code_key
  ON units (workspace_id, code) WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS units_workspace_idx
  ON units (workspace_id) WHERE workspace_id IS NOT NULL;

-- A workspace's own unit is never a dimension's base: `units_one_base_per_dimension`
-- allows exactly one base per dimension and that stays the seeded one.

COMMIT;

-- ============================================================================
-- ROLLBACK (only after deleting every workspace unit — a global UNIQUE cannot
-- come back while two workspaces share a code):
--   BEGIN;
--   DELETE FROM units WHERE workspace_id IS NOT NULL;
--   DROP INDEX IF EXISTS units_workspace_code_key;
--   DROP INDEX IF EXISTS units_workspace_idx;
--   DROP INDEX IF EXISTS units_global_code_key;
--   ALTER TABLE units ADD CONSTRAINT units_code_key UNIQUE (code);
--   ALTER TABLE units DROP COLUMN IF EXISTS workspace_id;
--   COMMIT;
--
-- VERIFY (read-only) — the first three should be true, the last 0:
--   SELECT 'units.workspace_id exists' AS item,
--          EXISTS (SELECT 1 FROM information_schema.columns
--                  WHERE table_name = 'units' AND column_name = 'workspace_id')::text AS value
--   UNION ALL
--   SELECT 'global code index',
--          EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'units_global_code_key')::text
--   UNION ALL
--   SELECT 'per-workspace code index',
--          EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'units_workspace_code_key')::text
--   UNION ALL
--   SELECT 'seeded units still global (expected 0 with a workspace)',
--          (SELECT count(*) FROM units WHERE workspace_id IS NOT NULL)::text;
-- ============================================================================
