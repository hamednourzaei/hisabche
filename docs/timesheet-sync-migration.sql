-- ============================================================================
-- docs/timesheet-sync-migration.sql
--
-- Bring `time_entries` into the sync protocol.
--
-- ---------------------------------------------------------------------------
-- WHY THIS ONE TABLE AND NOT THE OTHER FIVE
--
-- Offline write is correct exactly where the work happens away from a signal.
-- A worker on a site logs hours with no connection — that is the case
-- offline-first exists for.
--
-- The rest of the Tier 2 sweep is deliberately excluded, and the reasoning is
-- recorded next to the enum in `packages/validation/src/schemas/
-- sync-protocol.schema.ts` so it is read by whoever next asks "why isn't X
-- syncable":
--
--   budgets, dimensions   configuration. Two devices editing a spending limit
--                         offline produce two contradictory ceilings.
--   bank_statements       imported from a file. An offline import that syncs
--                         later doubles a bank account's movements.
--   exchange_rates        reference data. What matters is the rate FROZEN onto
--                         the document, not a device's copy of the table.
--   fixed_assets          depreciation is derived by the server from a
--                         schedule; a device deriving its own disagrees.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── 1. The columns the protocol requires ───────────────────────────────────
--
-- `version` is the optimistic-concurrency token: the client sends the version
-- it believes, and the server refuses a write built on a stale one rather than
-- applying it over a newer edit.

ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- A soft delete, so a device that deleted an entry offline can sync that fact
-- rather than having the row silently reappear on the next pull.
CREATE INDEX IF NOT EXISTS time_entries_live_idx
  ON time_entries (workspace_id, project_id)
  WHERE deleted_at IS NULL;

-- ─── 2. Version bump and change log ─────────────────────────────────────────
--
-- Both are triggers, in the same transaction as the row they describe. Written
-- in application code they would be a second statement that can fail on its
-- own, and a change log that is missing an entry is worse than none: a client
-- resuming from a cursor would skip the row forever.

DROP TRIGGER IF EXISTS time_entries_bump_version_trg ON time_entries;
CREATE TRIGGER time_entries_bump_version_trg
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();

DROP TRIGGER IF EXISTS time_entries_change_log_trg ON time_entries;
CREATE TRIGGER time_entries_change_log_trg
  AFTER INSERT OR UPDATE OR DELETE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('time_entry');

-- ─── 3. Billed hours are not editable ───────────────────────────────────────
--
-- `invoice_id` IS the lock — its presence means these hours are on a bill that
-- may already have been paid. A device that was offline when the invoice was
-- raised will try to push its own copy of the entry; without this guard that
-- push silently rewrites hours somebody has been charged for.
--
-- The push is refused instead, which surfaces it in the conflict queue where a
-- person decides — the same place every other financial disagreement lands.

CREATE OR REPLACE FUNCTION time_entries_guard_billed() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.invoice_id IS NOT NULL
     AND (NEW.minutes, NEW.billable, NEW.rate_minor, NEW.on_date, NEW.employee_id, NEW.project_id)
         IS DISTINCT FROM
         (OLD.minutes, OLD.billable, OLD.rate_minor, OLD.on_date, OLD.employee_id, OLD.project_id)
  THEN
    RAISE EXCEPTION 'TIMESHEET_ALREADY_BILLED: entry % is on invoice %', OLD.id, OLD.invoice_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS time_entries_guard_billed_trg ON time_entries;
CREATE TRIGGER time_entries_guard_billed_trg
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION time_entries_guard_billed();

COMMIT;
