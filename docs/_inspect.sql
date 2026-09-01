-- ============================================================================
-- docs/_inspect.sql
--
-- READ-ONLY. Changes nothing. Run it whenever you want to know what is
-- actually in the database.
--
-- ---------------------------------------------------------------------------
-- WHY YOU NEED THIS AFTER A FAILED SETUP
--
-- `SETUP-COMPLETE.sql` is thirty transactions, not one. When it failed at the
-- missing enum, every `COMMIT` before that point had already happened — so the
-- database is now neither empty nor complete. It is somewhere in between, and
-- guessing which is how the next run fails differently.
--
-- Run this, read the five results, then decide.
-- ============================================================================

-- ─── 1. The headline ────────────────────────────────────────────────────────
--
-- Empty database:  0, 0, 0, 0, 0
-- Complete setup:  ~116 tables, ~20 functions, 2 types, 47+ policies
-- Anything else:   partially applied — drop and start again

SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE')       AS tables,
  (SELECT count(*) FROM information_schema.views
    WHERE table_schema = 'public')                                      AS views,
  (SELECT count(*) FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f')                     AS functions,
  (SELECT count(*) FROM pg_type t
     JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e')                     AS enum_types,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')        AS policies,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S')                     AS sequences,
  (SELECT count(*) FROM auth.users)                                     AS auth_users;

-- ─── 2. Which tables exist, and do they hold anything ───────────────────────
--
-- `live_rows` is an estimate from the planner's statistics, not a count. It
-- can read 0 on a table that has rows if ANALYZE has not run since they were
-- inserted — so treat a zero here as "probably empty", not as proof.

SELECT
  c.relname                                    AS table_name,
  c.reltuples::bigint                          AS live_rows_estimate,
  CASE WHEN c.relrowsecurity THEN 'on' ELSE 'OFF' END AS rls,
  (SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- ─── 3. Tenant tables left open ─────────────────────────────────────────────
--
-- A table with `workspace_id` and RLS off is readable by anyone holding the
-- anon key. Expect zero rows. Any row here is a live data leak.

SELECT t.tablename AS tenant_table_with_rls_off
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND NOT t.rowsecurity
  AND EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = t.tablename
      AND c.column_name = 'workspace_id'
  )
ORDER BY 1;

-- ─── 4. Functions and types ─────────────────────────────────────────────────
--
-- The three SECURITY DEFINER helpers must be present and must say `definer`.
-- Without them every workspace policy fails to compile.

SELECT
  p.proname                                          AS function_name,
  CASE WHEN p.prosecdef THEN 'definer' ELSE 'invoker' END AS security,
  pg_get_function_identity_arguments(p.oid)          AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f'
ORDER BY p.proname;

-- ─── 5. Enum types ──────────────────────────────────────────────────────────
--
-- Expect exactly two: `workflow_status` and `workflow_action`. A missing one
-- is what stopped the last run at line 883.

SELECT
  t.typname AS enum_type,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS values
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;
