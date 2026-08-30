-- ============================================================================
-- docs/rls-recursion-fix-migration.sql
--
-- Fix `42P17: infinite recursion detected in policy for relation
-- "workspace_members"`.
--
-- ---------------------------------------------------------------------------
-- THE DEFECT
--
-- A policy that already existed in the live database reads the very table it
-- protects:
--
--   POLICY workspace_members_select ON workspace_members
--     USING (workspace_id IN (
--       SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
--     ))
--
-- Reading `workspace_members` runs the policy, which reads
-- `workspace_members`, which runs the policy. Postgres detects the loop and
-- aborts the statement.
--
-- ---------------------------------------------------------------------------
-- WHY IT WAS INVISIBLE UNTIL NOW
--
-- The backend connects with the service role, which bypasses RLS entirely, so
-- every server-side query worked. Nothing had ever queried this table AS a
-- logged-in user — the moment `_verify-rls.sql` did, it failed immediately.
--
-- That is the whole argument for testing RLS as a real role rather than
-- reading `pg_policies` and calling it proven: the policy existed, looked
-- correct in the catalogue, and could never once have succeeded.
--
-- ---------------------------------------------------------------------------
-- THE FIX
--
-- Read membership through a SECURITY DEFINER function. It executes as its
-- owner, so the read inside it does not re-enter the policy, and the loop
-- cannot form. `tenancy-rls.sql` already defines exactly this — the recursive
-- policy simply predates it and was never replaced.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── 1. The membership oracle ───────────────────────────────────────────────
--
-- Recreated here rather than assumed, so this file fixes the database whatever
-- order things ran in.
--
-- STABLE, so Postgres evaluates it once per statement instead of once per row
-- — on a large table that is the difference between an index scan and a
-- subquery per row.

CREATE OR REPLACE FUNCTION auth_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.workspace_id
    FROM workspace_members m
   WHERE m.user_id = auth.uid()
     AND m.has_access = true
     AND m.suspended_at IS NULL
$$;

REVOKE ALL ON FUNCTION auth_workspace_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_workspace_ids() TO authenticated;

-- ─── 1b. The other membership helper, made non-recursive ────────────────────
--
-- `is_workspace_member(workspace_id, user_id)` already existed and is used by
-- the policy `workspace members can view members` ON workspace_members. If it
-- is not SECURITY DEFINER it reads `workspace_members` under the caller's own
-- rights, which re-enters that table's policy — the same loop by another road.
--
-- Recreated as SECURITY DEFINER. Same signature and same answer, so every
-- policy already using it keeps working.

CREATE OR REPLACE FUNCTION is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM workspace_members m
     WHERE m.workspace_id = _workspace_id
       AND m.user_id = _user_id
       AND m.has_access = true
       AND m.suspended_at IS NULL
  )
$$;

REVOKE ALL ON FUNCTION is_workspace_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_workspace_member(uuid, uuid) TO authenticated;

-- ─── 1c. Workspace ownership, without reading either table under RLS ────────
--
-- `workspace_members_insert` and `workspace_members_delete` test ownership by
-- subquerying `workspaces` — and the policy on `workspaces` subqueries
-- `workspace_members`. Querying either one walks into the other, which is the
-- mutual recursion the first fix did not close.

CREATE OR REPLACE FUNCTION auth_owned_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT w.id FROM workspaces w WHERE w.owner_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION auth_owned_workspace_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_owned_workspace_ids() TO authenticated;

-- ─── 2. Remove the recursive policy ─────────────────────────────────────────
--
-- Dropped, not rewritten: a second SELECT policy on this table already exists
-- and is correct — `workspace members can view members`, which goes through
-- `is_workspace_member(...)`, a SECURITY DEFINER function. Two SELECT policies
-- are OR'd together, so removing the broken one loses no access at all.

DROP POLICY IF EXISTS workspace_members_select ON workspace_members;

-- A member may always read their OWN membership row. This is what the login
-- path needs before it knows which workspaces exist, and it cannot recurse
-- because it never leaves the row being tested.
DROP POLICY IF EXISTS workspace_members_own_row ON workspace_members;
CREATE POLICY workspace_members_own_row ON workspace_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ─── 3. Route every other policy through the function ───────────────────────
--
-- `live-reconciliation-migration.sql` wrote the inline subquery form for the
-- tables it scoped. That form does not recurse — a policy on `suppliers`
-- reading `workspace_members` is a different table — but it does re-enter the
-- membership table's own policy on every check, which is both slower and one
-- edit away from looping again.
--
-- Rewritten to the oracle: same rule, evaluated once, no re-entry.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'audit_logs', 'stock_movements', 'suppliers', 'purchase_orders',
    'payrolls', 'leaves', 'project_time_entries', 'boms', 'bom_items',
    'work_orders', 'opportunities', 'employees', 'projects', 'departments',
    'exchange_rates'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_workspace_members', t);
      EXECUTE format($f$
        CREATE POLICY %I ON %I
          FOR ALL TO authenticated
          USING (workspace_id IN (SELECT auth_workspace_ids()))
          WITH CHECK (workspace_id IN (SELECT auth_workspace_ids()))
      $f$, t || '_workspace_members', t);
    END IF;
  END LOOP;
END $$;

-- ─── 3b. The two tables at the centre of the loop ───────────────────────────
--
-- Every policy on `workspaces` and `workspace_members` is rewritten to go
-- through a SECURITY DEFINER function. Neither table may subquery the other
-- inside a policy — that is the rule that keeps this from happening again.

DROP POLICY IF EXISTS workspaces_select_policy ON workspaces;
CREATE POLICY workspaces_select_policy ON workspaces
  FOR SELECT TO authenticated
  USING (id IN (SELECT auth_workspace_ids()));

DROP POLICY IF EXISTS workspace_members_insert ON workspace_members;
CREATE POLICY workspace_members_insert ON workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT auth_owned_workspace_ids()));

DROP POLICY IF EXISTS workspace_members_delete ON workspace_members;
CREATE POLICY workspace_members_delete ON workspace_members
  FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT auth_owned_workspace_ids()));

-- ─── 4. The invite table had the same inline form ───────────────────────────

DROP POLICY IF EXISTS workspace_invites_all ON workspace_invites;
CREATE POLICY workspace_invites_all ON workspace_invites
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT auth_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT auth_workspace_ids()));

COMMIT;

-- ============================================================================
-- Proof. Every policy that still reads `workspace_members` directly is a
-- candidate for the same failure. This should return no rows.
-- ============================================================================

SELECT
  tablename,
  policyname,
  'still reads workspace_members inline' AS problem
FROM pg_policies
WHERE schemaname = 'public'
  AND (coalesce(qual, '') LIKE '%FROM workspace_members%'
       OR coalesce(with_check, '') LIKE '%FROM workspace_members%')
ORDER BY tablename, policyname;
