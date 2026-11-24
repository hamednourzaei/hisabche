-- ============================================================================
-- Sync entity coverage — four server-owned tables that local routes read but
-- no pull delivered (PART 5 §6.4 / NOT_PULLED_YET in device-sync-state.ts).
--
-- Covered:  cost_layers      -> change-log entity 'cost_layer'
--           stock_batches    -> 'stock_batches'
--           stock_serials    -> 'stock_serials'
--           inventory_settings -> 'inventory_settings' (workspace-keyed row)
--
-- NOT covered: accounts. The live `accounts` table has `user_id`, NOT
-- `workspace_id`; a change-log trigger could not route its rows to any
-- workspace. See docs/FINDING-sync-account-tenancy.sql. This migration does
-- NOT invent a workspace column or a guessed tenant for historical rows.
--
-- DEPENDENCY: run docs/sync-engine-migration.sql first (it creates
-- sync_change_log, sync_record_change() and sync_bump_version()).
-- SAFE TO RE-RUN. Every statement is guarded. NOT applied here — owner runs it.
-- ============================================================================

DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF to_regclass('public.sync_change_log') IS NULL THEN
    v_missing := array_append(v_missing, 'sync_change_log (run sync-engine-migration.sql)');
  END IF;
  IF to_regprocedure('public.sync_record_change()') IS NULL THEN
    v_missing := array_append(v_missing, 'sync_record_change() (run sync-engine-migration.sql)');
  END IF;
  IF to_regprocedure('public.sync_bump_version()') IS NULL THEN
    v_missing := array_append(v_missing, 'sync_bump_version() (run sync-engine-migration.sql)');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='cost_layers' AND column_name='workspace_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='cost_layers' AND column_name='id') THEN
    v_missing := array_append(v_missing, 'cost_layers(id, workspace_id)');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='stock_batches' AND column_name='workspace_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='stock_batches' AND column_name='id') THEN
    v_missing := array_append(v_missing, 'stock_batches(id, workspace_id)');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='stock_serials' AND column_name='workspace_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='stock_serials' AND column_name='id') THEN
    v_missing := array_append(v_missing, 'stock_serials(id, workspace_id)');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='inventory_settings' AND column_name='workspace_id') THEN
    v_missing := array_append(v_missing, 'inventory_settings(workspace_id)');
  END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION
      E'PREFLIGHT FAILED — missing prerequisites: %\n'
      'No trigger was installed. Apply the listed migrations first.',
      array_to_string(v_missing, ', ')
      USING ERRCODE = 'feature_not_supported';
  END IF;

  RAISE NOTICE 'preflight ok — four sync entities can be covered; accounts remains BLOCKED (no workspace_id)';
END $$;

-- Optimistic version on every covered row. Never client-supplied.
ALTER TABLE cost_layers       ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;
ALTER TABLE stock_batches     ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;
ALTER TABLE stock_serials     ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;
ALTER TABLE inventory_settings ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;

-- inventory_settings is keyed by workspace_id (no `id` column). The generic
-- sync_record_change() reads NEW.id and would raise on every write, so this
-- variant uses the workspace key as the entity identity instead.
CREATE OR REPLACE FUNCTION sync_record_workspace_keyed_change()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_workspace UUID;
  v_op        TEXT;
  v_version   BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_workspace := OLD.workspace_id;
    v_op := 'delete';
    v_version := COALESCE(OLD.version, 1);
  ELSE
    v_workspace := NEW.workspace_id;
    v_op := CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END;
    v_version := COALESCE(NEW.version, 1);
  END IF;

  IF v_workspace IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO sync_change_log (workspace_id, entity_type, entity_id, operation, entity_version, origin_device)
  VALUES (v_workspace, TG_ARGV[0], v_workspace, v_op, v_version,
          current_setting('hisabche.device_id', true));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ─── Bump version on update ────────────────────────────────────────────────
DROP TRIGGER IF EXISTS cost_layers_bump_version_trg ON cost_layers;
CREATE TRIGGER cost_layers_bump_version_trg BEFORE UPDATE ON cost_layers
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();
DROP TRIGGER IF EXISTS stock_batches_bump_version_trg ON stock_batches;
CREATE TRIGGER stock_batches_bump_version_trg BEFORE UPDATE ON stock_batches
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();
DROP TRIGGER IF EXISTS stock_serials_bump_version_trg ON stock_serials;
CREATE TRIGGER stock_serials_bump_version_trg BEFORE UPDATE ON stock_serials
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();
DROP TRIGGER IF EXISTS inventory_settings_bump_version_trg ON inventory_settings;
CREATE TRIGGER inventory_settings_bump_version_trg BEFORE UPDATE ON inventory_settings
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();

-- ─── Change log inside the business transaction ───────────────────────────
DROP TRIGGER IF EXISTS cost_layers_change_log_trg ON cost_layers;
CREATE TRIGGER cost_layers_change_log_trg AFTER INSERT OR UPDATE OR DELETE ON cost_layers
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('cost_layer');
DROP TRIGGER IF EXISTS stock_batches_change_log_trg ON stock_batches;
CREATE TRIGGER stock_batches_change_log_trg AFTER INSERT OR UPDATE OR DELETE ON stock_batches
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('stock_batches');
DROP TRIGGER IF EXISTS stock_serials_change_log_trg ON stock_serials;
CREATE TRIGGER stock_serials_change_log_trg AFTER INSERT OR UPDATE OR DELETE ON stock_serials
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('stock_serials');
DROP TRIGGER IF EXISTS inventory_settings_change_log_trg ON inventory_settings;
CREATE TRIGGER inventory_settings_change_log_trg AFTER INSERT OR UPDATE OR DELETE ON inventory_settings
  FOR EACH ROW EXECUTE FUNCTION sync_record_workspace_keyed_change('inventory_settings');

-- The change log already has RLS enabled by sync-engine-migration.sql; these
-- writers are triggers inside a business transaction, not client-facing paths.
