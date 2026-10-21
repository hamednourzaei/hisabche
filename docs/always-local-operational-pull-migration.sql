-- ============================================
-- The operational pull: the change log must carry the operational set.
--
-- WHY
--
-- A device works offline from its local database, and that database is
-- filled through the sync: a snapshot on the first run, the change log
-- (sync_change_log) after it. Today the change log carries products,
-- customers and invoices only, so a warehouse renamed on the server never
-- reaches a device until the next full rebuild — and the operational set
-- (the warehouses the user may work in, the branches, the exchange rates and
-- the stock per warehouse) has nothing to pull at all.
--
-- This adds those four tables to the SAME mechanism: the same change log,
-- the same cursor, the same snapshot. No second mechanism (G2).
--
-- WHAT IT DOES NOT DO
--
-- It does not change what a device may WRITE. The operational tables are the
-- server's to decide; a client that could write a stock row would be
-- inventing stock. The sync service already says so (an empty writable
-- column list for these four entities).
--
-- IDEMPOTENT
--
-- Every statement is safe to run twice: the columns are added only if they
-- are missing, and the triggers are dropped before they are created. The two
-- trigger functions are created with CREATE OR REPLACE, so this file does
-- not depend on the sync engine migration having run first.
--
-- ROLLBACK
--
--   DROP TRIGGER IF EXISTS warehouses_change_log_trg ON warehouses;
--   DROP TRIGGER IF EXISTS branches_change_log_trg ON branches;
--   DROP TRIGGER IF EXISTS exchange_rates_change_log_trg ON exchange_rates;
--   DROP TRIGGER IF EXISTS warehouse_stock_change_log_trg ON warehouse_stock;
--   DROP TRIGGER IF EXISTS warehouses_bump_version_trg ON warehouses;
--   DROP TRIGGER IF EXISTS branches_bump_version_trg ON branches;
--   DROP TRIGGER IF EXISTS exchange_rates_bump_version_trg ON exchange_rates;
--   DROP TRIGGER IF EXISTS warehouse_stock_bump_version_trg ON warehouse_stock;
--   ALTER TABLE warehouses      DROP COLUMN IF EXISTS version;
--   ALTER TABLE branches        DROP COLUMN IF EXISTS version;
--   ALTER TABLE exchange_rates  DROP COLUMN IF EXISTS version;
--   ALTER TABLE warehouse_stock DROP COLUMN IF EXISTS version;
-- ============================================

-- ─── 1. The version column the change log reads ────────────────────────────
-- COALESCE(NEW.version, 1) in the trigger needs the column to exist.
ALTER TABLE warehouses      ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;
ALTER TABLE branches        ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;
ALTER TABLE exchange_rates  ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;
ALTER TABLE warehouse_stock ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;

-- ─── 2. The two trigger functions, self-contained ──────────────────────────
-- The same behaviour as docs/sync-engine-migration.sql, so this file can be
-- run on a server that has not run that one.

CREATE OR REPLACE FUNCTION sync_bump_version() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Monotonic per row, and never trusted from the client: the client SENDS
  -- the version it expects, the server DECIDES the next one.
  NEW.version := COALESCE(OLD.version, 1) + 1;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_record_change() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_workspace UUID;
  v_entity    UUID;
  v_op        TEXT;
  v_version   BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_workspace := OLD.workspace_id;
    v_entity    := OLD.id;
    v_op        := 'delete';
    v_version   := COALESCE(OLD.version, 1);
  ELSE
    v_workspace := NEW.workspace_id;
    v_entity    := NEW.id;
    v_op        := CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END;
    v_version   := COALESCE(NEW.version, 1);
  END IF;

  -- A row with no workspace cannot be routed to any client's pull, so logging
  -- it would create a change nobody can ever receive.
  IF v_workspace IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO sync_change_log (workspace_id, entity_type, entity_id, operation, entity_version, origin_device)
  VALUES (
    v_workspace,
    TG_ARGV[0],
    v_entity,
    v_op,
    v_version,
    current_setting('hisabche.device_id', true)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger functions are called by the table, never by a client.
REVOKE EXECUTE ON FUNCTION sync_bump_version() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION sync_record_change() FROM PUBLIC, anon, authenticated;

-- ─── 3. The version bump on every update ───────────────────────────────────
DROP TRIGGER IF EXISTS warehouses_bump_version_trg ON warehouses;
CREATE TRIGGER warehouses_bump_version_trg
  BEFORE UPDATE ON warehouses
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();

DROP TRIGGER IF EXISTS branches_bump_version_trg ON branches;
CREATE TRIGGER branches_bump_version_trg
  BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();

DROP TRIGGER IF EXISTS exchange_rates_bump_version_trg ON exchange_rates;
CREATE TRIGGER exchange_rates_bump_version_trg
  BEFORE UPDATE ON exchange_rates
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();

DROP TRIGGER IF EXISTS warehouse_stock_bump_version_trg ON warehouse_stock;
CREATE TRIGGER warehouse_stock_bump_version_trg
  BEFORE UPDATE ON warehouse_stock
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();

-- ─── 4. The change log ─────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS warehouses_change_log_trg ON warehouses;
CREATE TRIGGER warehouses_change_log_trg
  AFTER INSERT OR UPDATE OR DELETE ON warehouses
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('warehouse');

DROP TRIGGER IF EXISTS branches_change_log_trg ON branches;
CREATE TRIGGER branches_change_log_trg
  AFTER INSERT OR UPDATE OR DELETE ON branches
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('branch');

DROP TRIGGER IF EXISTS exchange_rates_change_log_trg ON exchange_rates;
CREATE TRIGGER exchange_rates_change_log_trg
  AFTER INSERT OR UPDATE OR DELETE ON exchange_rates
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('exchange_rate');

DROP TRIGGER IF EXISTS warehouse_stock_change_log_trg ON warehouse_stock;
CREATE TRIGGER warehouse_stock_change_log_trg
  AFTER INSERT OR UPDATE OR DELETE ON warehouse_stock
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('product_stock');
