-- ============================================================================
-- docs/_verify-rls.sql — prove Row Level Security actually works.
--
-- READ ONLY. Nothing to paste. Run the whole file at once.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS NEEDED WHEN `pg_policies` ALREADY LOOKS RIGHT
--
-- `_verify-after.sql` confirmed policies EXIST. That is not the same as
-- confirming they WORK, and the difference was not academic: the policy
-- `workspace_members_select` existed, read correctly in the catalogue, and
-- could never once have succeeded — it queried the table it protected and
-- looped forever.
--
-- The SQL Editor normally runs as the table owner, which bypasses RLS
-- entirely, so a query there proves nothing about a real user. This becomes
-- the `authenticated` role carrying a real user's JWT claims — exactly what
-- PostgREST does for a logged-in request — and reports what that user can
-- actually reach.
--
-- ---------------------------------------------------------------------------
-- WHY A FUNCTION AND NOT A TEMP TABLE
--
-- The first version collected results in `CREATE TEMP TABLE … ON COMMIT DROP`.
-- The SQL Editor commits after each statement, so the table was dropped before
-- the next statement could write to it and the script failed with `42P01`.
--
-- A function in `pg_temp` has no such problem: it lives for the session,
-- returns its rows in one statement, and disappears when the connection does.
-- Nothing permanent is created.
--
-- Run this AFTER the bundle, or it will stop at the recursion error.
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp.rls_audit()
RETURNS TABLE (check_name text, detail text, verdict text)
LANGUAGE plpgsql
AS $audit$
DECLARE
  user_a       uuid;
  workspace_a  uuid;
  workspace_b  uuid;
  claims       text;
  n            bigint;
  tbl          text;

  -- The tables a leak would matter most on: money, stock, people, history.
  targets text[] := ARRAY[
    'invoices', 'customers', 'products', 'stock_movements',
    'audit_logs', 'employees', 'suppliers', 'payrolls'
  ];
BEGIN
  -- ─── Pick a user, and a workspace they do NOT belong to ───────────────────

  SELECT m.user_id, m.workspace_id
    INTO user_a, workspace_a
    FROM workspace_members m
   WHERE m.has_access = true AND m.suspended_at IS NULL
   ORDER BY m.joined_at
   LIMIT 1;

  IF user_a IS NULL THEN
    RETURN QUERY SELECT
      '0. setup'::text,
      'no active members'::text,
      'CANNOT TEST — there is no user to act as'::text;
    RETURN;
  END IF;

  SELECT w.id INTO workspace_b
    FROM workspaces w
   WHERE w.id <> workspace_a
     AND NOT EXISTS (
       SELECT 1 FROM workspace_members m
        WHERE m.workspace_id = w.id AND m.user_id = user_a
     )
   LIMIT 1;

  claims := json_build_object('sub', user_a, 'role', 'authenticated')::text;

  RETURN QUERY SELECT
    '0. acting as'::text,
    format('user %s, member of workspace %s',
           left(user_a::text, 8), left(workspace_a::text, 8))::text,
    'setup'::text;

  -- ─── 1. Can this user see their OWN rows? ─────────────────────────────────
  --
  -- A policy that is too strict is also broken: the app renders empty and the
  -- shopkeeper concludes their data is gone.

  FOREACH tbl IN ARRAY targets
  LOOP
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', claims, true);

    EXECUTE format('SELECT count(*) FROM %I', tbl) INTO n;

    PERFORM set_config('role', 'postgres', true);

    RETURN QUERY SELECT
      '1. own rows visible'::text,
      format('%s: %s row(s)', tbl, n)::text,
      CASE WHEN n > 0
        THEN 'OK — the user can read their own workspace'
        ELSE 'EMPTY — either no data, or the policy is too strict'
      END::text;
  END LOOP;

  -- ─── 2. Can this user reach ANOTHER workspace? ────────────────────────────
  --
  -- The check that matters. Every count must be 0.

  IF workspace_b IS NULL THEN
    RETURN QUERY SELECT
      '2. cross-tenant'::text,
      'only one workspace exists'::text,
      'NOT PROVEN — no second workspace to try to reach. Not the same as passing.'::text;
  ELSE
    FOREACH tbl IN ARRAY targets
    LOOP
      PERFORM set_config('role', 'authenticated', true);
      PERFORM set_config('request.jwt.claims', claims, true);

      EXECUTE format('SELECT count(*) FROM %I WHERE workspace_id = %L', tbl, workspace_b)
        INTO n;

      PERFORM set_config('role', 'postgres', true);

      RETURN QUERY SELECT
        '2. cross-tenant leak'::text,
        format('%s: %s row(s) from the other workspace', tbl, n)::text,
        CASE WHEN n = 0
          THEN 'OK — sealed'
          ELSE 'LEAK — this user can read another business'
        END::text;
    END LOOP;
  END IF;

  -- ─── 3. Can an anonymous caller read anything? ────────────────────────────
  --
  -- `anon` is the role a leaked publishable key carries. It should reach
  -- nothing at all.

  FOREACH tbl IN ARRAY ARRAY['invoices', 'customers', 'workspaces', 'audit_logs']
  LOOP
    BEGIN
      PERFORM set_config('role', 'anon', true);
      PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);

      EXECUTE format('SELECT count(*) FROM %I', tbl) INTO n;
    EXCEPTION WHEN insufficient_privilege THEN
      n := -1;
    END;

    PERFORM set_config('role', 'postgres', true);

    RETURN QUERY SELECT
      '3. anonymous access'::text,
      format('%s: %s', tbl,
             CASE WHEN n < 0 THEN 'permission denied' ELSE n::text || ' row(s)' END)::text,
      CASE WHEN n <= 0
        THEN 'OK — nothing reachable without a login'
        ELSE 'EXPOSED — a leaked anon key reads this table'
      END::text;
  END LOOP;

  -- Belt and braces: whatever happened above, hand the session back as it was
  -- found. A script that leaves the connection stuck as `anon` would make
  -- every later query in this editor fail for no visible reason.
  PERFORM set_config('role', 'postgres', true);
END
$audit$;

SELECT * FROM pg_temp.rls_audit();
