-- ============================================================================
-- docs/rls-performance-migration.sql
--
-- The RLS change with the largest measurable effect, and the smallest diff.
--
-- ---------------------------------------------------------------------------
-- `auth.uid()` IS EVALUATED PER ROW. `(select auth.uid())` IS EVALUATED ONCE.
--
-- Postgres cannot prove that `auth.uid()` returns the same answer for every
-- row, so inside a policy it calls the function again for each one. Wrapped as
-- a scalar subquery, the planner lifts it into an InitPlan and evaluates it a
-- single time for the whole statement.
--
-- On a table with fifty thousand rows that is fifty thousand function calls
-- against one. It is Supabase's own top RLS-performance recommendation, and it
-- changes no behaviour whatsoever — the same rows come back.
--
-- ---------------------------------------------------------------------------
-- WHY MOST OF THIS SCHEMA WAS ALREADY FAST
--
-- The tenant policies were written as:
--
--     workspace_id IN (SELECT auth_workspace_ids())
--
-- Already a subquery, already an InitPlan. What was NOT wrapped were the
-- direct `= auth.uid()` comparisons on the per-user tables — `workspace_members`,
-- `member_branches`, `ui_visibility_profiles`, `billing_events` — and those are
-- exactly the tables every request reads to establish who the caller is.
--
-- ---------------------------------------------------------------------------
-- ⚠️ THE INDEX IS THE OTHER HALF
--
-- A policy of `workspace_id IN (…)` is only fast if `workspace_id` is indexed.
-- Without an index the planner has a cheap predicate and still scans the table
-- to apply it. `hardening-migration.sql` creates those indexes; this file is
-- half the fix and says so.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ⚠️ THE HELPERS COME FIRST, BEFORE ANY POLICY THAT CALLS THEM.
--
-- The first draft of this file defined the policies at the top and the
-- functions at the bottom — which reads naturally and fails immediately:
--
--     42883: function is_workspace_member(uuid, uuid) does not exist
--
-- A policy body is parsed when the policy is created, not when it runs. The
-- function has to exist by then.

-- ─── The SECURITY DEFINER helpers ───────────────────────────────────────────
--
-- Re-declared STABLE and with a pinned `search_path`.
--
-- ⚠️ `SET search_path` is not a style preference on a SECURITY DEFINER
-- function. Without it, a caller who can create objects could shadow
-- `workspace_members` with a table of their own and the function — running as
-- its owner — would read theirs instead.
--
-- STABLE tells the planner the result cannot change within one statement,
-- which lets it call these once rather than per row. They already only read.

CREATE OR REPLACE FUNCTION auth_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM workspace_members
  WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND has_access = true
      AND suspended_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION auth_owned_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM workspace_members
  WHERE user_id = auth.uid()
    AND role = 'owner'
    AND has_access = true
    AND suspended_at IS NULL;
$$;

-- ⚠️ These run as their owner and bypass RLS by design. Nothing else should:
-- revoke the default grant so they cannot be called straight from the Data API
-- by an anonymous client.
REVOKE EXECUTE ON FUNCTION auth_workspace_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION is_workspace_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION auth_owned_workspace_ids() FROM anon;


-- ─── workspace_members ──────────────────────────────────────────────────────
--
-- The hottest table in the schema: every authenticated request reads it to
-- find out which workspaces the caller belongs to.
--
-- ⚠️ Neither policy may subquery `workspaces`, and no policy on `workspaces`
-- may subquery this — that pair is what produced `42P17: infinite recursion`,
-- and it was broken from the first day while nobody noticed, because the
-- backend connects with `service_role` and bypasses RLS entirely.

DROP POLICY IF EXISTS workspace_members_own_row ON workspace_members;
CREATE POLICY workspace_members_own_row ON workspace_members
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS workspace_members_colleagues ON workspace_members;
CREATE POLICY workspace_members_colleagues ON workspace_members
  FOR SELECT TO authenticated
  -- SECURITY DEFINER, so reading `workspace_members` inside it does not
  -- re-enter this policy.
  USING (is_workspace_member(workspace_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS workspace_members_insert ON workspace_members;
CREATE POLICY workspace_members_insert ON workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT auth_owned_workspace_ids()));

DROP POLICY IF EXISTS workspace_members_update ON workspace_members;
CREATE POLICY workspace_members_update ON workspace_members
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT auth_owned_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT auth_owned_workspace_ids()));

DROP POLICY IF EXISTS workspace_members_delete ON workspace_members;
CREATE POLICY workspace_members_delete ON workspace_members
  FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT auth_owned_workspace_ids()));

-- ─── The per-user tables ────────────────────────────────────────────────────
--
-- These four are keyed by `user_id` rather than `workspace_id`, and that is
-- correct rather than an oversight:
--
--   member_branches           which branches THIS person is pinned to
--   ui_visibility_profiles    what THIS person has hidden in their interface
--   billing_events            what THIS person was charged
--   notifications             what is waiting for THIS person
--
-- They are the documented exceptions to the workspace rule.

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'member_branches',
    'ui_visibility_profiles',
    'billing_events',
    'notifications'
  ] LOOP
    -- Skip anything this database does not have, so the file stays runnable
    -- against a partial schema rather than failing halfway.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_table
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_own_rows', v_table);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR SELECT TO authenticated
        USING (user_id = (SELECT auth.uid()))
    $p$, v_table || '_own_rows', v_table);

    RAISE NOTICE 'policy rewritten: %', v_table;
  END LOOP;
END $$;

-- ─── Indexes the policies depend on ─────────────────────────────────────────
--
-- A policy is a WHERE clause. Without an index behind it, Postgres applies a
-- cheap predicate to every row it reads — which is a full scan wearing a
-- security hat.

CREATE INDEX IF NOT EXISTS workspace_members_user_idx
  ON workspace_members (user_id);

CREATE INDEX IF NOT EXISTS workspace_members_workspace_idx
  ON workspace_members (workspace_id);

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'member_branches',
    'ui_visibility_profiles',
    'billing_events',
    'notifications'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_table
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (user_id)',
      v_table || '_user_idx', v_table
    );
  END LOOP;
END $$;

COMMIT;
