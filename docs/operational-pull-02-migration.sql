-- ============================================================================
-- docs/operational-pull-02-migration.sql
--
-- V70.2 — the four tables the delta pull did not carry.
--
-- WHY
--
-- Four tables had a service on the server, a table in the device's SQLite and a
-- route in the local engine, but no road between the two stores:
--
--   product_variants          a variant priced at one counter was invisible at
--                             the next one, so the same shirt sold at two prices
--   service_delivery_sessions a session delivered by another practitioner never
--                             arrived, and the calendar offered the slot again
--   package_credit_ledger     credits spent elsewhere were offered again — the
--                             device showed a balance the customer no longer had
--   repair_tickets            a ticket opened on another shift was not on the
--                             bench screen of the device that had to do the work
--
-- Each of them already knows `workspace_id` and `id`, so the SAME mechanism
-- carries them: the same `sync_change_log`, the same cursor, the same
-- `sync_pull_changes_v2`, the same snapshot. No second mechanism (G2).
--
-- WHAT IT DOES NOT DO
--
-- It does not make them writable from a device. The sync service refuses every
-- column of these four by name (`WRITABLE[entity] = []`), because a variant's
-- price override, a session's settlement, a credit entry and a ticket's status
-- each move stock, credit or an invoice. Read-only pull, as with warehouses.
--
-- IDEMPOTENT
--
-- Every statement is safe to run twice: columns are added only if missing, and
-- each trigger is dropped before it is created. Both functions are CREATE OR
-- REPLACE, so this file does not depend on sync-engine-migration.sql having
-- been run first — but it DOES depend on the four tables existing, and says so
-- loudly instead of failing halfway through.
--
-- ROLLBACK
--
--   DROP TRIGGER IF EXISTS product_variants_change_log_trg ON product_variants;
--   DROP TRIGGER IF EXISTS service_delivery_sessions_change_log_trg ON service_delivery_sessions;
--   DROP TRIGGER IF EXISTS package_credit_ledger_change_log_trg ON package_credit_ledger;
--   DROP TRIGGER IF EXISTS repair_tickets_change_log_trg ON repair_tickets;
--   DROP TRIGGER IF EXISTS product_variants_bump_version_trg ON product_variants;
--   DROP TRIGGER IF EXISTS service_delivery_sessions_bump_version_trg ON service_delivery_sessions;
--   DROP TRIGGER IF EXISTS package_credit_ledger_bump_version_trg ON package_credit_ledger;
--   DROP TRIGGER IF EXISTS repair_tickets_bump_version_trg ON repair_tickets;
--   ALTER TABLE product_variants           DROP COLUMN IF EXISTS version;
--   ALTER TABLE service_delivery_sessions  DROP COLUMN IF EXISTS version;
--   ALTER TABLE package_credit_ledger      DROP COLUMN IF EXISTS version;
--   ALTER TABLE repair_tickets             DROP COLUMN IF EXISTS version;
--
-- Status: Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- Run docs/VERIFY-operational-pull-02.sql immediately after applying this file.
-- ============================================================================

BEGIN;

-- ─── 0. The four tables must exist ─────────────────────────────────────────
-- Without this the file fails on the first ALTER with a message that does not
-- say which prerequisite is missing.
DO $$
DECLARE
  v_missing TEXT;
BEGIN
  SELECT string_agg(t, ', ') INTO v_missing
  FROM unnest(ARRAY[
    'sync_change_log',
    'product_variants',
    'service_delivery_sessions',
    'package_credit_ledger',
    'repair_tickets'
  ]) AS t
  WHERE to_regclass('public.' || t) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Run the migrations that create these objects first: %', v_missing;
  END IF;
END $$;

-- ─── 1. The version column the change log reads ────────────────────────────
-- COALESCE(NEW.version, 1) in the trigger below needs the column to exist.
ALTER TABLE product_variants          ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;
ALTER TABLE service_delivery_sessions ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;
ALTER TABLE package_credit_ledger     ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;
ALTER TABLE repair_tickets            ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;

-- ─── 2. The two trigger functions, self-contained ──────────────────────────
-- Same behaviour as docs/sync-engine-migration.sql, so this file runs on a
-- server that has not run that one.

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
DROP TRIGGER IF EXISTS product_variants_bump_version_trg ON product_variants;
CREATE TRIGGER product_variants_bump_version_trg
  BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();

DROP TRIGGER IF EXISTS service_delivery_sessions_bump_version_trg ON service_delivery_sessions;
CREATE TRIGGER service_delivery_sessions_bump_version_trg
  BEFORE UPDATE ON service_delivery_sessions
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();

DROP TRIGGER IF EXISTS package_credit_ledger_bump_version_trg ON package_credit_ledger;
CREATE TRIGGER package_credit_ledger_bump_version_trg
  BEFORE UPDATE ON package_credit_ledger
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();

DROP TRIGGER IF EXISTS repair_tickets_bump_version_trg ON repair_tickets;
CREATE TRIGGER repair_tickets_bump_version_trg
  BEFORE UPDATE ON repair_tickets
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();

-- ─── 4. The change log ─────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS product_variants_change_log_trg ON product_variants;
CREATE TRIGGER product_variants_change_log_trg
  AFTER INSERT OR UPDATE OR DELETE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('product_variants');

DROP TRIGGER IF EXISTS service_delivery_sessions_change_log_trg ON service_delivery_sessions;
CREATE TRIGGER service_delivery_sessions_change_log_trg
  AFTER INSERT OR UPDATE OR DELETE ON service_delivery_sessions
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('service_delivery_sessions');

DROP TRIGGER IF EXISTS package_credit_ledger_change_log_trg ON package_credit_ledger;
CREATE TRIGGER package_credit_ledger_change_log_trg
  AFTER INSERT OR UPDATE OR DELETE ON package_credit_ledger
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('package_credit_ledger');

DROP TRIGGER IF EXISTS repair_tickets_change_log_trg ON repair_tickets;
CREATE TRIGGER repair_tickets_change_log_trg
  AFTER INSERT OR UPDATE OR DELETE ON repair_tickets
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('repair_tickets');

COMMIT;
