-- ============================================================================
-- docs/workspace-owner-invariant.sql
--
-- Enforces, in the database, that a workspace has AT MOST ONE owner.
--
-- Application code can be bypassed — a stray SQL console, a future service, a
-- retried insert. Ownership decides who can transfer the business and who can
-- remove members, so it is enforced where it cannot be argued with.
--
-- ---------------------------------------------------------------------------
-- ORDER
--
--   PART 1  ANALYSE   read-only. Does the invariant already hold?
--   PART 2  ENFORCE   the unique index. Run only when PART 1 is clean.
--
-- PART 2 FAILS if any workspace already has two owners, and that is correct:
-- deciding which of two owners is the real one is a business question, and
-- silently demoting one would be exactly the kind of guess this migration set
-- refuses to make.
--
-- Runs in psql or the Supabase SQL editor. No backslash meta-commands.
-- ============================================================================


-- ############################################################################
-- PART 1 — ANALYSE (read-only; safe on production)
-- ############################################################################

SELECT
  w.id            AS workspace_id,
  w.name,
  count(*) FILTER (WHERE m.role = 'owner')   AS owners,
  count(*) FILTER (WHERE m.role = 'manager') AS managers,
  count(*) FILTER (WHERE m.role = 'seller')  AS sellers,
  count(*) FILTER (WHERE m.role NOT IN ('owner', 'manager', 'seller')
                      OR m.role IS NULL)     AS unknown_role,
  CASE
    WHEN count(*) FILTER (WHERE m.role = 'owner') = 1 THEN 'OK'
    WHEN count(*) FILTER (WHERE m.role = 'owner') = 0 THEN 'NO OWNER — needs an explicit ownership assignment'
    ELSE 'MULTIPLE OWNERS — a human must decide which one is real'
  END AS verdict
FROM workspaces w
LEFT JOIN workspace_members m ON m.workspace_id = w.id
GROUP BY w.id, w.name
ORDER BY count(*) FILTER (WHERE m.role = 'owner') DESC, w.name;

-- Any role value that is not owner/manager/seller. The product model has three
-- roles; anything else is legacy and must be mapped deliberately, not by the
-- application quietly treating it as privileged. Note in particular the value
-- 'admin': workflow.service.ts accepts it as an approver override, so if rows
-- carry it, decide whether it means 'manager' before enforcing anything.
SELECT role, count(*) AS members
  FROM workspace_members
 GROUP BY role
 ORDER BY count(*) DESC;


-- ############################################################################
-- PART 2 — ENFORCE (run only when PART 1 shows no MULTIPLE OWNERS)
-- ############################################################################
--
-- A PARTIAL unique index, not a table constraint: uniqueness applies only to
-- rows where role = 'owner', so a workspace may still hold any number of
-- managers and sellers.
--
-- This makes "add a second owner" fail loudly. Ownership transfer therefore
-- has to be an explicit two-step operation inside one transaction — demote the
-- current owner, promote the new one — which is the intended behaviour: there
-- is no code path that can create a second owner by accident.

CREATE UNIQUE INDEX IF NOT EXISTS workspace_single_owner_idx
  ON workspace_members (workspace_id)
  WHERE role = 'owner';

-- Confirm it exists and is valid.
SELECT
  i.indexrelid::regclass AS index_name,
  i.indisunique          AS is_unique,
  i.indisvalid           AS is_valid,
  CASE WHEN i.indisunique AND i.indisvalid
       THEN 'OK — a workspace can no longer gain a second owner'
       ELSE 'PROBLEM — index is not a valid unique index' END AS verdict
FROM pg_index i
WHERE i.indexrelid = 'workspace_single_owner_idx'::regclass;


-- ############################################################################
-- ROLLBACK
-- ############################################################################
--
-- Dropping the index removes only the guarantee; it touches no membership row.
--
-- DROP INDEX IF EXISTS workspace_single_owner_idx;
