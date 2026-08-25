-- ============================================================================
-- docs/tenancy-rls.sql
--
-- Row Level Security for the four shared business entities.
--
-- ---------------------------------------------------------------------------
-- WHY, GIVEN THE BACKEND ALREADY FILTERS
--
-- Because application middleware is one forgotten `.eq()` away from a leak,
-- and this migration found several: an unscoped `GET /api/transactions` that
-- returned every transaction on the platform, an invoice that accepted any
-- customer id, a stock update that moved another shop's inventory, and a
-- public PDF route that fell back to lookup-by-id with no authentication.
--
-- Every one of those was invisible in review. RLS is the layer that does not
-- depend on anyone remembering.
--
-- ---------------------------------------------------------------------------
-- ⚠️ READ THIS BEFORE RUNNING — THE SERVICE ROLE BYPASSES RLS
--
-- backend/src/db.ts connects with SUPABASE_SERVICE_KEY. PostgreSQL exempts
-- that role from row security, so ENABLING RLS DOES NOT PROTECT THE BACKEND
-- API and will not break it either. What it protects is:
--
--   * any client connecting with the anon/publishable key
--   * Supabase Realtime subscriptions, which respect RLS
--   * PostgREST called directly
--   * a future service that forgets its filter
--
-- So this is defence in depth, not a replacement for tenancy.service.ts. Both
-- are required. Do not remove an application-side filter because RLS exists.
--
-- ---------------------------------------------------------------------------
-- ORDER
--
--   PART 1  PRECONDITIONS  read-only. Refuses to proceed if anything is unsafe.
--   PART 2  HELPER         a SECURITY DEFINER membership function.
--   PART 3  POLICIES       per table, per operation.
--   PART 4  ENABLE         turns RLS on. The point of no return.
--   PART 5  VERIFY         proves the policies exist and are enabled.
--
-- Runs in psql or the Supabase SQL editor. No backslash meta-commands.
-- ============================================================================


-- ############################################################################
-- PART 1 — PRECONDITIONS (read-only; safe on production)
-- ############################################################################
--
-- RLS on a table whose `workspace_id` is still NULL makes those rows invisible
-- to every non-service-role caller. The question this gate must answer is not
-- "are any rows NULL?" but "would enabling RLS HIDE something that is visible
-- today?" — and those are different questions.
--
-- ---------------------------------------------------------------------------
-- WHY THE DISTINCTION MATTERS
--
-- SQL equality never matches NULL. So under the OLD backend, whose every read
-- was `.eq('user_id', userId)`, a row with `user_id IS NULL` is ALREADY
-- unreachable — absent from every list, total and report, for every user.
-- Nobody can see it now and nobody will see it after; RLS changes nothing for
-- such a row.
--
-- A row with a real creator but no workspace is the opposite case: the old
-- backend still returns it, so it IS visible today and WOULD disappear. That
-- is the regression this gate exists to prevent, and it still blocks loudly.
--
-- ⚠️ Note which backend is deployed. Once the workspace-scoped backend ships,
-- EVERY `workspace_id IS NULL` row is unreachable regardless of its creator,
-- and both populations are equally dark. This gate deliberately assumes the
-- OLD backend — the more conservative of the two — so that running it before
-- the deploy is safe and running it after is merely stricter than necessary.
-- It is never the other way round.
--
-- An earlier version of this check counted only `workspace_id IS NULL` and so
-- refused on both. That is not caution, it is imprecision: it blocks the
-- migration on rows that no remediation can improve, because there is no
-- creator to derive a workspace from. Only a human who knows the business can
-- place them, and that decision must not hold the security work hostage.
--
-- NOTHING is assumed here. Both populations are counted separately and the
-- already-dark ones are reported, not ignored.

DO $$
DECLARE
  v_table TEXT;
  v_orphaned BIGINT;   -- workspace_id NULL *and* user_id NULL  → already dark
  v_regress  BIGINT;   -- workspace_id NULL *but* user_id set   → would vanish
  v_missing TEXT[] := '{}';
  v_blocking TEXT[] := '{}';
  v_already_dark TEXT[] := '{}';
BEGIN
  FOREACH v_table IN ARRAY ARRAY['invoices', 'customers', 'products', 'transactions'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_name = v_table AND column_name = 'workspace_id'
    ) THEN
      v_missing := v_missing || v_table;
      CONTINUE;
    END IF;

    EXECUTE format(
      'SELECT count(*) FILTER (WHERE user_id IS NULL),
              count(*) FILTER (WHERE user_id IS NOT NULL)
         FROM %I WHERE workspace_id IS NULL', v_table)
       INTO v_orphaned, v_regress;

    IF v_regress > 0 THEN
      v_blocking := v_blocking || format('%s (%s rows)', v_table, v_regress);
    END IF;

    IF v_orphaned > 0 THEN
      v_already_dark := v_already_dark || format('%s (%s rows)', v_table, v_orphaned);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'workspace_id missing on: %. Run docs/tenancy-workspace-migration.sql first.',
      array_to_string(v_missing, ', ')
      USING ERRCODE = 'feature_not_supported';
  END IF;

  -- The real gate. These rows have an owner who can see them today.
  IF array_length(v_blocking, 1) > 0 THEN
    RAISE EXCEPTION
      'rows have a real creator but no workspace: %. They are VISIBLE today and RLS would hide them. Run scripts/check-tenancy-backfill.sql and remediate before enabling RLS.',
      array_to_string(v_blocking, ', ')
      USING ERRCODE = 'feature_not_supported';
  END IF;

  -- Reported, not silently tolerated: they are still a data-quality problem
  -- that someone must eventually resolve. They just are not a reason to leave
  -- the database without row security.
  IF array_length(v_already_dark, 1) > 0 THEN
    RAISE WARNING
      'proceeding: % have neither a workspace nor a creator. These are ALREADY unreachable (user_id IS NULL never matches an equality filter), so RLS hides nothing that anyone can currently see. They still need a human decision — see scripts/check-tenancy-backfill.sql.',
      array_to_string(v_already_dark, ', ');
  END IF;

  RAISE NOTICE 'preconditions OK — every row that anyone can see today maps to a workspace';
END $$;


-- ############################################################################
-- PART 2 — THE MEMBERSHIP HELPER
-- ############################################################################
--
-- SECURITY DEFINER so it can read `workspace_members` even when that table is
-- itself protected. Without it, a policy on `invoices` that subqueries
-- `workspace_members` would recurse through that table's own policy.
--
-- STABLE so PostgreSQL evaluates it once per statement rather than once per
-- row — the difference between an index scan and a per-row subquery on a
-- large invoice table.
--
-- The chain is exactly the one the application enforces:
--   authenticated user -> membership -> has_access -> not suspended.

CREATE OR REPLACE FUNCTION auth_workspace_ids()
RETURNS SETOF UUID
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

COMMENT ON FUNCTION auth_workspace_ids() IS
  'Workspaces the current authenticated user may act in. Mirrors requireWorkspace() in backend/src/services/tenancy.service.ts — keep the two in step.';

-- Locked down: this function is the tenancy oracle, so nothing anonymous may
-- call it.
REVOKE ALL ON FUNCTION auth_workspace_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_workspace_ids() TO authenticated;


-- ############################################################################
-- PART 3 — POLICIES
-- ############################################################################
--
-- One policy per operation rather than one FOR ALL, because SELECT/UPDATE need
-- USING (which rows are visible) while INSERT needs WITH CHECK (which rows may
-- be created). A single FOR ALL policy makes the INSERT case easy to get
-- wrong: without WITH CHECK, a client can insert a row into ANOTHER workspace
-- even though it cannot read it back.

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['invoices', 'customers', 'products', 'transactions'] LOOP

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_ws_select', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_ws_insert', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_ws_update', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_ws_delete', v_table);

    -- READ
    EXECUTE format($f$
      CREATE POLICY %I ON %I FOR SELECT TO authenticated
        USING (workspace_id IN (SELECT auth_workspace_ids()))
    $f$, v_table || '_ws_select', v_table);

    -- CREATE. WITH CHECK is what stops a client writing INTO another workspace.
    EXECUTE format($f$
      CREATE POLICY %I ON %I FOR INSERT TO authenticated
        WITH CHECK (workspace_id IN (SELECT auth_workspace_ids()))
    $f$, v_table || '_ws_insert', v_table);

    -- UPDATE. Both clauses: USING picks which rows may be updated, WITH CHECK
    -- stops the update from MOVING a row into a workspace the caller is not in.
    EXECUTE format($f$
      CREATE POLICY %I ON %I FOR UPDATE TO authenticated
        USING (workspace_id IN (SELECT auth_workspace_ids()))
        WITH CHECK (workspace_id IN (SELECT auth_workspace_ids()))
    $f$, v_table || '_ws_update', v_table);

    -- DELETE
    EXECUTE format($f$
      CREATE POLICY %I ON %I FOR DELETE TO authenticated
        USING (workspace_id IN (SELECT auth_workspace_ids()))
    $f$, v_table || '_ws_delete', v_table);

  END LOOP;
END $$;

-- NOTE ON PLATFORM ADMIN
--
-- There is deliberately NO policy granting a platform administrator access.
-- Platform administration is a separate security domain: an admin is not a
-- member of any customer workspace and must not read or write customer
-- financial data through these tables. The Admin Panel uses the service role
-- for its own aggregate views, which is an explicit, auditable choice rather
-- than an implicit superuser policy hiding here.


-- ############################################################################
-- PART 4 — ENABLE (the point of no return)
-- ############################################################################
--
-- Run only after PART 1 passed. The backend keeps working throughout: it
-- connects as service_role, which bypasses row security.
--
-- FORCE is deliberately NOT used. `FORCE ROW LEVEL SECURITY` would apply these
-- policies to the table OWNER too, which in Supabase includes migration and
-- maintenance paths — and a policy referencing auth.uid() evaluates to NULL
-- there, silently hiding every row from your own migrations.

ALTER TABLE invoices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE products     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;


-- ############################################################################
-- PART 5 — VERIFY
-- ############################################################################

SELECT
  c.relname                       AS table_name,
  c.relrowsecurity                AS rls_enabled,
  count(p.polname)                AS policies,
  count(*) FILTER (WHERE p.polcmd = 'r') AS select_policies,
  count(*) FILTER (WHERE p.polcmd = 'a') AS insert_policies,
  count(*) FILTER (WHERE p.polcmd = 'w') AS update_policies,
  count(*) FILTER (WHERE p.polcmd = 'd') AS delete_policies,
  CASE
    WHEN c.relrowsecurity AND count(p.polname) = 4
      THEN 'OK'
    WHEN NOT c.relrowsecurity
      THEN 'RLS NOT ENABLED'
    ELSE 'INCOMPLETE — expected 4 policies'
  END AS verdict
FROM pg_class c
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE c.relname IN ('invoices', 'customers', 'products', 'transactions')
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;


-- ── Prove isolation with a real session ─────────────────────────────────────
--
-- Policies that exist are not policies that work. Run this as a REAL user, not
-- as the service role, substituting a genuine auth.users id. Expect to see
-- only that user's workspaces.
--
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"sub": "PUT-A-REAL-USER-UUID-HERE"}';
--
--   SELECT count(*) AS visible_invoices FROM invoices;
--   SELECT DISTINCT workspace_id FROM invoices;   -- must match auth_workspace_ids()
--   SELECT * FROM auth_workspace_ids();
--
--   -- must return 0 rows, not an error
--   SELECT count(*) FROM invoices
--    WHERE workspace_id NOT IN (SELECT auth_workspace_ids());
--
--   -- must FAIL with a row-level security violation
--   INSERT INTO invoices (id, workspace_id, user_id, invoice_number, total, date)
--   VALUES (gen_random_uuid(), 'SOME-OTHER-WORKSPACE-UUID',
--           'PUT-A-REAL-USER-UUID-HERE', 'RLS-TEST', 1, now());
--
--   ROLLBACK;


-- ############################################################################
-- ROLLBACK
-- ############################################################################
--
-- Disabling RLS removes the guarantee but touches no row. Safe and instant.
--
-- ALTER TABLE invoices     DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE customers    DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE products     DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
