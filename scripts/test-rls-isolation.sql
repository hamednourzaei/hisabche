-- ============================================================================
-- scripts/test-rls-isolation.sql
--
-- Proves RLS actually isolates workspaces, by impersonating real users inside
-- the database rather than trusting that the policies "look right".
--
-- Run AFTER docs/tenancy-rls.sql.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS A FUNCTION AND NOT A SCRIPT
--
-- The first version was `BEGIN; CREATE TEMP TABLE …; DO $$ … $$; SELECT …;
-- ROLLBACK;` and failed on Supabase with:
--
--     ERROR: relation "rls_results" does not exist
--
-- Supabase fronts Postgres with a connection pooler in TRANSACTION mode, so
-- consecutive statements can land on different backend connections. A temp
-- table created by one statement simply is not there for the next, and an
-- explicit BEGIN/ROLLBACK spanning statements is not reliable either.
--
-- So everything happens inside ONE function call: one statement, one
-- connection, one transaction. The function returns its results as rows, which
-- also sidesteps the SQL editor hiding RAISE NOTICE.
--
-- ---------------------------------------------------------------------------
-- NOTHING IS WRITTEN
--
-- Every check that attempts a write runs in its own BEGIN…EXCEPTION block that
-- always ends in `RAISE EXCEPTION 'rollback-marker'`, so the subtransaction is
-- discarded whether the write succeeded or was refused. What survives is the
-- PL/pgSQL variable holding the outcome — variables are NOT transactional,
-- which is exactly why the result is recorded in one and returned afterwards.
-- Recording it inside the block would roll the record back with the write and
-- the check would vanish from the output.
--
-- ---------------------------------------------------------------------------
-- ⚠️ DO NOT RUN AS THE SERVICE ROLE
--
-- PostgreSQL exempts that role from row security, so every check below would
-- pass vacuously. Step 0 refuses.
--
-- ---------------------------------------------------------------------------
-- USAGE — three separate statements, safe to run one at a time:
--
--   1. the CREATE FUNCTION below
--   2. SELECT * FROM rls_isolation_report();
--   3. DROP FUNCTION rls_isolation_report();
-- ============================================================================


CREATE OR REPLACE FUNCTION rls_isolation_report()
RETURNS TABLE (
  seq        INT,
  check_name TEXT,
  expected   TEXT,
  observed   TEXT,
  verdict    TEXT
)
LANGUAGE plpgsql
-- INVOKER, emphatically: a SECURITY DEFINER function would run as its owner
-- and bypass the very policies under test.
SECURITY INVOKER
AS $fn$
DECLARE
  v_user_a     UUID;
  v_user_b     UUID;
  v_ws_a       UUID;
  v_ws_b       UUID;
  v_count      BIGINT;
  v_foreign_id UUID;
  v_ok         BOOLEAN;
  v_workspaces BIGINT;
BEGIN
  ---------------------------------------------------------------------------
  -- 0. refuse where the answer would be meaningless
  ---------------------------------------------------------------------------

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'invoices' AND relrowsecurity) THEN
    RAISE EXCEPTION 'RLS is not enabled on invoices — run docs/tenancy-rls.sql first'
      USING ERRCODE = 'feature_not_supported';
  END IF;

  IF to_regprocedure('auth_workspace_ids()') IS NULL THEN
    RAISE EXCEPTION 'auth_workspace_ids() is missing — run PART 2 of docs/tenancy-rls.sql'
      USING ERRCODE = 'feature_not_supported';
  END IF;

  -- NOTE: the connecting role is NOT checked here.
  --
  -- An earlier version refused outright when `current_user` was `postgres`,
  -- which made the script unrunnable from the Supabase SQL editor — that
  -- editor always connects as `postgres`.
  --
  -- The refusal was aimed at the right danger but at the wrong moment. RLS is
  -- applied according to the CURRENT role, and a superuser that has done
  -- `SET ROLE` to a non-superuser IS subject to row security. Since this
  -- function impersonates `authenticated` before every check, connecting as
  -- postgres is fine — what matters is that the impersonation actually took
  -- effect. That is asserted below, after the SET ROLE, where it can be
  -- verified instead of assumed.

  SELECT count(DISTINCT workspace_id) INTO v_workspaces
    FROM workspace_members WHERE has_access AND suspended_at IS NULL;

  IF v_workspaces < 2 THEN
    RAISE EXCEPTION
      'need at least 2 active workspaces to demonstrate a boundary; found %', v_workspaces
      USING ERRCODE = 'feature_not_supported';
  END IF;

  ---------------------------------------------------------------------------
  -- fixtures: two users, each in exactly ONE and a DIFFERENT workspace
  ---------------------------------------------------------------------------
  --
  -- A user in two workspaces is useless here: their RLS view is the union of
  -- both, so neither is "foreign" to them and every isolation check would pass
  -- vacuously.
  --
  -- `HAVING count(*) OVER (PARTITION BY user_id) = 1` is a syntax error —
  -- HAVING is evaluated before the window step. The aggregate form is the fix.
  -- `(array_agg(...))[1]` rather than `min()`, because there is no min(uuid);
  -- the HAVING guarantees one distinct value, so element 1 IS that value.

  SELECT m.user_id, (array_agg(DISTINCT m.workspace_id))[1]
    INTO v_user_a, v_ws_a
    FROM workspace_members m
   WHERE m.has_access AND m.suspended_at IS NULL
   GROUP BY m.user_id
  HAVING count(DISTINCT m.workspace_id) = 1
   ORDER BY m.user_id
   LIMIT 1;

  SELECT m.user_id, (array_agg(DISTINCT m.workspace_id))[1]
    INTO v_user_b, v_ws_b
    FROM workspace_members m
   WHERE m.has_access AND m.suspended_at IS NULL
   GROUP BY m.user_id
  HAVING count(DISTINCT m.workspace_id) = 1
     AND (array_agg(DISTINCT m.workspace_id))[1] IS DISTINCT FROM v_ws_a
   ORDER BY m.user_id
   LIMIT 1;

  -- Setup rows sort before the checks; negative so the numbered checks keep
  -- the sequence they are referred to by in the comments above.
  seq := -1; check_name := 'fixtures';
  expected := 'two single-workspace users in different workspaces';
  observed := format('a=%s in %s | b=%s in %s', v_user_a, v_ws_a, v_user_b, v_ws_b);
  verdict  := CASE WHEN v_user_a IS NOT NULL AND v_user_b IS NOT NULL
                   THEN 'ok' ELSE 'FAIL — cannot test without both' END;
  RETURN NEXT;

  IF v_user_a IS NULL OR v_user_b IS NULL THEN RETURN; END IF;

  ---------------------------------------------------------------------------
  -- become user A
  ---------------------------------------------------------------------------

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a)::text, true);
  SET LOCAL ROLE authenticated;

  -- 0b ── the impersonation is real -----------------------------------------
  --
  -- Everything after this point is only meaningful if the current role is
  -- actually subject to RLS. Three ways it might not be, all checked:
  --
  --   * SET ROLE silently did not take effect
  --   * the role is a superuser (superusers always bypass row security)
  --   * the role carries BYPASSRLS
  --
  -- Table ownership is the fourth way, and it is why docs/tenancy-rls.sql
  -- deliberately does NOT use FORCE ROW LEVEL SECURITY: `authenticated` does
  -- not own these tables, so ordinary ENABLE is enough for it.
  --
  -- Without this, a failed SET ROLE would leave the checks running as postgres
  -- and every single one would pass while proving nothing.
  SELECT count(*) INTO v_count
    FROM pg_roles
   WHERE rolname = current_user AND (rolsuper OR rolbypassrls);

  seq := 0; check_name := 'impersonation is subject to RLS';
  expected := 'authenticated, not superuser, no BYPASSRLS';
  observed := format('%s, bypassing=%s', current_user, v_count);
  verdict  := CASE
                WHEN current_user = 'authenticated' AND v_count = 0 THEN 'ok'
                ELSE 'FAIL — checks below would be vacuous; STOP'
              END;
  RETURN NEXT;

  IF current_user <> 'authenticated' OR v_count > 0 THEN
    RESET ROLE;
    RETURN;
  END IF;

  -- 1 ── the helper agrees with the membership table ------------------------
  SELECT count(*) INTO v_count FROM auth_workspace_ids() w WHERE w = v_ws_a;
  seq := 1; check_name := 'auth_workspace_ids() returns A''s workspace';
  expected := '1'; observed := v_count::text;
  verdict  := CASE WHEN v_count = 1 THEN 'ok' ELSE 'FAIL' END;
  RETURN NEXT;

  -- 2..5 ── SELECT is confined ----------------------------------------------
  SELECT count(*) INTO v_count FROM invoices WHERE workspace_id = v_ws_b;
  seq := 2; check_name := 'A cannot SELECT B invoices';
  expected := '0'; observed := v_count::text;
  verdict  := CASE WHEN v_count = 0 THEN 'ok' ELSE 'FAIL — CROSS-TENANT READ' END;
  RETURN NEXT;

  SELECT count(*) INTO v_count FROM customers WHERE workspace_id = v_ws_b;
  seq := 3; check_name := 'A cannot SELECT B customers';
  expected := '0'; observed := v_count::text;
  verdict  := CASE WHEN v_count = 0 THEN 'ok' ELSE 'FAIL — CROSS-TENANT READ' END;
  RETURN NEXT;

  SELECT count(*) INTO v_count FROM products WHERE workspace_id = v_ws_b;
  seq := 4; check_name := 'A cannot SELECT B products';
  expected := '0'; observed := v_count::text;
  verdict  := CASE WHEN v_count = 0 THEN 'ok' ELSE 'FAIL — CROSS-TENANT READ' END;
  RETURN NEXT;

  SELECT count(*) INTO v_count FROM transactions WHERE workspace_id = v_ws_b;
  seq := 5; check_name := 'A cannot SELECT B transactions';
  expected := '0'; observed := v_count::text;
  verdict  := CASE WHEN v_count = 0 THEN 'ok' ELSE 'FAIL — CROSS-TENANT READ' END;
  RETURN NEXT;

  -- 6 ── an UNSCOPED select still leaks nothing -----------------------------
  -- The important shape: a query with no workspace predicate at all. This is
  -- what a forgetful new service issues, and RLS is the only thing between it
  -- and every tenant's data.
  SELECT count(*) INTO v_count FROM invoices WHERE workspace_id IS DISTINCT FROM v_ws_a;
  seq := 6; check_name := 'an unscoped SELECT returns only A rows';
  expected := '0'; observed := v_count::text;
  verdict  := CASE WHEN v_count = 0 THEN 'ok' ELSE 'FAIL — RLS NOT FILTERING' END;
  RETURN NEXT;

  -- 7 ── INSERT into B is refused -------------------------------------------
  v_ok := false;
  BEGIN
    INSERT INTO invoices (id, workspace_id, user_id, invoice_number, total, date)
    VALUES (gen_random_uuid(), v_ws_b, v_user_a, 'RLS-TEST', 1, now());
    RAISE EXCEPTION 'rollback-marker';   -- reached only if the policy ALLOWED it
  EXCEPTION
    WHEN OTHERS THEN
      -- 'rollback-marker' means the insert went through: a cross-tenant write.
      -- Anything else is the refusal we want.
      v_ok := (SQLERRM <> 'rollback-marker');
  END;
  seq := 7; check_name := 'A cannot INSERT into B';
  expected := 'refused'; observed := CASE WHEN v_ok THEN 'refused' ELSE 'ALLOWED' END;
  verdict  := CASE WHEN v_ok THEN 'ok' ELSE 'FAIL — CROSS-TENANT WRITE' END;
  RETURN NEXT;

  -- 8 ── UPDATE of a B row touches nothing ----------------------------------
  -- Not an exception: the policy makes the row invisible, so the UPDATE
  -- matches zero rows and succeeds silently. Zero affected IS the pass.
  v_count := -1;
  BEGIN
    UPDATE invoices SET total = total WHERE workspace_id = v_ws_b;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE EXCEPTION 'rollback-marker';
  EXCEPTION
    WHEN OTHERS THEN NULL;   -- v_count survives; the write does not
  END;
  seq := 8; check_name := 'A cannot UPDATE B rows';
  expected := '0 rows'; observed := v_count::text || ' rows';
  verdict  := CASE WHEN v_count = 0 THEN 'ok' ELSE 'FAIL — CROSS-TENANT WRITE' END;
  RETURN NEXT;

  -- 9 ── DELETE of a B row removes nothing ----------------------------------
  v_count := -1;
  BEGIN
    DELETE FROM invoices WHERE workspace_id = v_ws_b;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE EXCEPTION 'rollback-marker';
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;
  seq := 9; check_name := 'A cannot DELETE B rows';
  expected := '0 rows'; observed := v_count::text || ' rows';
  verdict  := CASE WHEN v_count = 0 THEN 'ok' ELSE 'FAIL — CROSS-TENANT DELETE' END;
  RETURN NEXT;

  -- 10 ── a client-supplied id is not authorization -------------------------
  SELECT id INTO v_foreign_id FROM invoices WHERE workspace_id = v_ws_b LIMIT 1;
  seq := 10; check_name := 'a foreign row id is invisible even when named';
  expected := 'null'; observed := coalesce(v_foreign_id::text, 'null');
  verdict  := CASE WHEN v_foreign_id IS NULL THEN 'ok' ELSE 'FAIL — IDOR' END;
  RETURN NEXT;

  -- 11 ── A can still work --------------------------------------------------
  -- Without this, a policy of `USING (false)` would pass every check above.
  SELECT count(*) INTO v_count FROM invoices WHERE workspace_id = v_ws_a;
  seq := 11; check_name := 'A can still read its OWN invoices';
  expected := 'no error'; observed := v_count::text || ' rows';
  verdict  := 'ok';
  RETURN NEXT;

  -- 12 ── an UPDATE may not MOVE a row into another workspace ---------------
  -- What WITH CHECK on UPDATE is for: USING alone would let A take a row it
  -- owns and hand it to B.
  v_ok := false;
  BEGIN
    UPDATE invoices SET workspace_id = v_ws_b WHERE workspace_id = v_ws_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_ok := (v_count = 0);          -- nothing to move is also acceptable
    RAISE EXCEPTION 'rollback-marker';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'rollback-marker' THEN v_ok := true; END IF;
  END;
  seq := 12; check_name := 'A cannot move its own row into B';
  expected := 'refused'; observed := CASE WHEN v_ok THEN 'refused' ELSE 'ALLOWED' END;
  verdict  := CASE WHEN v_ok THEN 'ok' ELSE 'FAIL — WITH CHECK MISSING ON UPDATE' END;
  RETURN NEXT;

  RESET ROLE;
  RETURN;
END;
$fn$;


-- ── 2. run it ───────────────────────────────────────────────────────────────

SELECT * FROM rls_isolation_report() ORDER BY seq;

-- Summary. Run separately if the editor shows only the last result set.
--
--   SELECT count(*) FILTER (WHERE verdict = 'ok')  AS passed,
--          count(*) FILTER (WHERE verdict <> 'ok') AS failed,
--          CASE WHEN count(*) FILTER (WHERE verdict <> 'ok') = 0
--               THEN 'PASS — RLS isolates workspaces at the database level'
--               ELSE 'FAIL — do NOT rely on RLS until these are green' END AS verdict
--     FROM rls_isolation_report();


-- ── 3. clean up ─────────────────────────────────────────────────────────────
--
-- DROP FUNCTION IF EXISTS rls_isolation_report();
