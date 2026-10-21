-- ============================================================================
-- docs/sync-conflicts-forward-01-migration.sql
--
-- A DECISION ON A CONFLICT IS FINAL.
--
-- WHY THIS FILE EXISTS
--   `sync_conflicts` keeps both sides of a refused financial write and the
--   decision a person made on it. The table accepted any status transition:
--   a conflict that had been decided could be flipped back to 'open', and a
--   row could be marked 'resolved' with no decider and no moment. A decision
--   nobody made, at no time, is not an audit trail — it is a guess with a
--   timestamp missing.
--
-- WHAT THIS DOES (and nothing else)
--   1. Forward only: 'resolved' / 'superseded' can never go back to 'open'.
--   2. A resolved conflict always carries `resolved_at`; a HUMAN decision also
--      carries `resolved_by`. An auto-merge is the machine's decision on a
--      non-financial field, and it is filed without a decider (see 2b).
--
--   The status and resolution vocabularies are NOT changed. The screen reads
--   the state through one pure function (`conflictState`), so no new column
--   and no second vocabulary.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION sync_conflicts_forward_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. A decided conflict is never reopened. Backwards only, never forwards:
  --    open -> resolved and open -> superseded stay allowed.
  IF TG_OP = 'UPDATE'
     AND OLD.status IN ('resolved', 'superseded')
     AND NEW.status = 'open' THEN
    RAISE EXCEPTION
      'sync_conflicts: status cannot go back from % to open', OLD.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- 2a. A resolved conflict always has a moment. «Resolved at no time» is not
  --     a decision, it is a missing value.
  IF NEW.status = 'resolved' AND NEW.resolved_at IS NULL THEN
    RAISE EXCEPTION
      'sync_conflicts: a resolved conflict needs resolved_at'
      USING ERRCODE = 'not_null_violation';
  END IF;

  -- 2b. A HUMAN decision names the person who made it. An auto-merge does not:
  --     `ConflictService.record` merges a non-financial field itself and files
  --     the row as resolved / 'auto_merge' with no decider. Demanding one here
  --     would reject that write on the live database, the sync path swallows
  --     the failure, and the merge would be lost with no trace — the exact
  --     silent loss this table exists to prevent.
  IF NEW.status = 'resolved'
     AND NEW.resolved_by IS NULL
     AND NEW.resolution IS DISTINCT FROM 'auto_merge' THEN
    RAISE EXCEPTION
      'sync_conflicts: a decided conflict needs resolved_by'
      USING ERRCODE = 'not_null_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- A trigger function is called by the table, not by a client: no role needs
-- EXECUTE, and a client that could call it directly could fire the checks out
-- of context.
REVOKE EXECUTE ON FUNCTION sync_conflicts_forward_only()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS sync_conflicts_forward_only ON sync_conflicts;
CREATE TRIGGER sync_conflicts_forward_only
  BEFORE INSERT OR UPDATE ON sync_conflicts
  FOR EACH ROW EXECUTE FUNCTION sync_conflicts_forward_only();

COMMIT;

-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- BEGIN;
-- DROP TRIGGER IF EXISTS sync_conflicts_forward_only ON sync_conflicts;
-- DROP FUNCTION IF EXISTS sync_conflicts_forward_only();
-- COMMIT;
-- ============================================================================
