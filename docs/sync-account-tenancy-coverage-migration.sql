-- ============================================================================
-- Sync entity coverage — completion: accounts and inventory_settings.
--
-- docs/sync-entity-coverage-migration.sql covered four tables. It left accounts
-- out because an early survey of base-schema-migration.sql saw only user_id.
-- That survey was stale: docs/accounting-core-migration.sql (already in this
-- repository, and applied on this database) adds accounts.workspace_id and
-- backfills it from the owning membership. The owner has now confirmed, from
-- information_schema, that accounts has a NOT NULL workspace_id.
--
-- This migration therefore closes the last two gaps:
--   accounts            -> version + bump + change-log trigger ('account')
--   inventory_settings  -> a stable id, so the generic keyset snapshot and the
--                          device's id-based upsert can address the row
--
-- DEPENDENCY: sync-engine-migration.sql and sync-entity-coverage-migration.sql.
-- SAFE TO RE-RUN. Never writes data except a one-time id backfill for rows that
-- have none; existing rows with an id are left exactly as they are.
-- NOT APPLIED BY THE CODING AGENT — the owner runs it.
-- ============================================================================

DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF to_regclass('public.sync_change_log') IS NULL THEN
    v_missing := array_append(v_missing, 'sync_change_log (sync-engine-migration.sql)');
  END IF;
  IF to_regprocedure('public.sync_record_change()') IS NULL THEN
    v_missing := array_append(v_missing, 'sync_record_change() (sync-engine-migration.sql)');
  END IF;
  IF to_regprocedure('public.sync_bump_version()') IS NULL THEN
    v_missing := array_append(v_missing, 'sync_bump_version() (sync-engine-migration.sql)');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='accounts' AND column_name='workspace_id') THEN
    v_missing := array_append(v_missing, 'accounts.workspace_id (accounting-core-migration.sql)');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='accounts' AND column_name='id') THEN
    v_missing := array_append(v_missing, 'accounts.id');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='inventory_settings' AND column_name='workspace_id') THEN
    v_missing := array_append(v_missing, 'inventory_settings.workspace_id');
  END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION
      E'PREFLIGHT FAILED — missing prerequisites: %\nNo trigger was installed.',
      array_to_string(v_missing, ', ')
      USING ERRCODE = 'feature_not_supported';
  END IF;

  RAISE NOTICE 'preflight ok — accounts and inventory_settings can be covered';
END $$;

-- accounts: optimistic version, never client-supplied.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;

DROP TRIGGER IF EXISTS accounts_bump_version_trg ON accounts;
CREATE TRIGGER accounts_bump_version_trg BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();

DROP TRIGGER IF EXISTS accounts_change_log_trg ON accounts;
CREATE TRIGGER accounts_change_log_trg AFTER INSERT OR UPDATE OR DELETE ON accounts
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('account');

-- inventory_settings: the pull keys a page by id and the device upserts by id.
-- The table is workspace-keyed; give each row a stable surrogate id without
-- changing its primary key or any existing caller.
ALTER TABLE inventory_settings ADD COLUMN IF NOT EXISTS id UUID;
UPDATE inventory_settings SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE inventory_settings ALTER COLUMN id SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS inventory_settings_id_key ON inventory_settings (id);

-- The workspace-keyed variant was needed only while the row had no id. The
-- generic function now reads NEW.id and keeps the same protocol entity name.
DROP TRIGGER IF EXISTS inventory_settings_change_log_trg ON inventory_settings;
CREATE TRIGGER inventory_settings_change_log_trg AFTER INSERT OR UPDATE OR DELETE ON inventory_settings
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('inventory_settings');

-- The change log already has RLS enabled by sync-engine-migration.sql; these
-- writers are triggers inside a business transaction, not client-facing paths.
