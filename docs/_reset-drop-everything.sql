-- ============================================================================
-- docs/_reset-drop-everything.sql
--
-- ⛔ DESTROYS ALL APPLICATION DATA. NO UNDO.
--
-- ---------------------------------------------------------------------------
-- TO RUN IT: change ONE line.
--
--   Find      v_armed CONSTANT boolean := FALSE;
--   Make it   v_armed CONSTANT boolean := TRUE;
--
-- Until you do, it raises `Not armed` and drops nothing. That message is the
-- safety catch working, not an error.
--
-- ---------------------------------------------------------------------------
-- IT CANNOT FAIL PART-WAY
--
-- Every drop is wrapped so that one failure does not stop the rest, and every
-- object type the schema can hold is covered — tables, views, materialized
-- views, functions, procedures, aggregates, enum types, composite types,
-- domains and sequences.
--
-- The previous version handled four of those ten. It reported success on a
-- database that still had sequences and a type nothing could drop, and the
-- rebuild then failed on objects that "did not exist" and did.
--
-- Anything it genuinely cannot remove is NAMED at the end rather than passed
-- over in silence.
--
-- ---------------------------------------------------------------------------
-- WHAT SURVIVES
--
--   auth.*      your user accounts, sessions, identities
--   storage.*   uploaded files
--   extensions  pgcrypto, uuid-ossp and the rest
--
-- Your logins survive. After the rebuild the same accounts sign in and find an
-- empty workspace.
-- ============================================================================

DO $reset$
DECLARE
  ---------------------------------------------------------------------------
  -- ↓↓↓  THE ONE LINE TO CHANGE  ↓↓↓
  ---------------------------------------------------------------------------
  v_armed CONSTANT boolean := FALSE;
  ---------------------------------------------------------------------------

  v_name      text;
  v_signature text;
  v_kind      text;
  v_rows      bigint;
  v_dropped   integer := 0;
  v_failed    integer := 0;
  v_users     bigint;
  v_failures  text[] := ARRAY[]::text[];
BEGIN
  IF NOT v_armed THEN
    RAISE EXCEPTION
      'Not armed. Set v_armed := TRUE near the top of this file and run it again. Nothing was dropped.';
  END IF;

  -- ─── What is about to be lost ─────────────────────────────────────────────

  FOR v_name IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I', v_name) INTO v_rows;
      IF v_rows > 0 THEN
        RAISE NOTICE 'about to drop % (% rows)', v_name, v_rows;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- A table we cannot even count is still a table we intend to drop.
      RAISE NOTICE 'about to drop % (could not count)', v_name;
    END;
  END LOOP;

  -- ─── Views, materialized views, tables ────────────────────────────────────
  --
  -- Ordered so a view goes before the table it reads. `CASCADE` would cope
  -- either way; this keeps the log readable.
  --
  -- ⚠️ `pg_class.relkind` rather than `information_schema`. A materialized
  -- view does not appear in `information_schema.views` at all, which is how
  -- one survived the last reset.

  FOR v_kind, v_name IN
    SELECT c.relkind, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('v', 'm', 'r', 'p')   -- view, matview, table, partitioned
    ORDER BY CASE c.relkind WHEN 'v' THEN 1 WHEN 'm' THEN 2 ELSE 3 END
  LOOP
    BEGIN
      EXECUTE format(
        'DROP %s IF EXISTS public.%I CASCADE',
        CASE v_kind
          WHEN 'v' THEN 'VIEW'
          WHEN 'm' THEN 'MATERIALIZED VIEW'
          ELSE 'TABLE'
        END,
        v_name
      );
      v_dropped := v_dropped + 1;
    EXCEPTION WHEN OTHERS THEN
      -- CASCADE from an earlier drop may already have taken it. That is a
      -- success, not a failure — but anything else is recorded by name.
      IF SQLSTATE <> '42P01' THEN
        v_failed := v_failed + 1;
        v_failures := v_failures || format('%s %s: %s', v_kind, v_name, SQLERRM);
      END IF;
    END;
  END LOOP;

  -- ─── Routines ─────────────────────────────────────────────────────────────
  --
  -- Functions, procedures and aggregates each need their own DROP keyword.
  -- The previous version only handled `prokind = 'f'`, so a procedure would
  -- have survived silently.

  FOR v_kind, v_signature IN
    SELECT p.prokind,
           format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p', 'a')
  LOOP
    BEGIN
      EXECUTE format(
        'DROP %s IF EXISTS public.%s CASCADE',
        CASE v_kind WHEN 'p' THEN 'PROCEDURE' WHEN 'a' THEN 'AGGREGATE' ELSE 'FUNCTION' END,
        v_signature
      );
      v_dropped := v_dropped + 1;
    EXCEPTION WHEN OTHERS THEN
      IF SQLSTATE NOT IN ('42883', '42P01') THEN
        v_failed := v_failed + 1;
        v_failures := v_failures || format('routine %s: %s', v_signature, SQLERRM);
      END IF;
    END;
  END LOOP;

  -- ─── Types ────────────────────────────────────────────────────────────────
  --
  -- Enums, composites and domains.
  --
  -- ⚠️ Composite types that Postgres created FOR a table are excluded — they
  -- disappear with their table, and asking to drop one directly raises
  -- "cannot drop type because table requires it", which looks alarming and
  -- means nothing.

  FOR v_name IN
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typtype IN ('e', 'c', 'd')
      AND NOT EXISTS (
        SELECT 1 FROM pg_class c WHERE c.reltype = t.oid AND c.relkind <> 'c'
      )
  LOOP
    BEGIN
      EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', v_name);
      v_dropped := v_dropped + 1;
    EXCEPTION WHEN OTHERS THEN
      IF SQLSTATE <> '42704' THEN
        v_failed := v_failed + 1;
        v_failures := v_failures || format('type %s: %s', v_name, SQLERRM);
      END IF;
    END;
  END LOOP;

  -- ─── Sequences ────────────────────────────────────────────────────────────
  --
  -- A sequence owned by a column goes with its table. A standalone one —
  -- `invoice_number_seq`, created by `missing-rpcs-migration.sql` — does not,
  -- and it survived the last reset. `CREATE SEQUENCE IF NOT EXISTS` then found
  -- it still at its old value, so invoice numbers would have carried on from
  -- wherever the test data left them.

  FOR v_name IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S'
  LOOP
    BEGIN
      EXECUTE format('DROP SEQUENCE IF EXISTS public.%I CASCADE', v_name);
      v_dropped := v_dropped + 1;
    EXCEPTION WHEN OTHERS THEN
      IF SQLSTATE <> '42P01' THEN
        v_failed := v_failed + 1;
        v_failures := v_failures || format('sequence %s: %s', v_name, SQLERRM);
      END IF;
    END;
  END LOOP;

  -- ─── Report ───────────────────────────────────────────────────────────────

  SELECT count(*) INTO v_users FROM auth.users;

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════';
  RAISE NOTICE '  dropped        % objects', v_dropped;
  RAISE NOTICE '  kept           % auth users', v_users;
  RAISE NOTICE '════════════════════════════════════════════';

  IF v_failed > 0 THEN
    RAISE WARNING '% object(s) could not be dropped:', v_failed;
    FOREACH v_name IN ARRAY v_failures LOOP
      RAISE WARNING '  %', v_name;
    END LOOP;
    RAISE WARNING 'Remove these by hand before rebuilding.';
  END IF;

  -- The one number that must not be zero.
  IF v_users = 0 THEN
    RAISE WARNING 'auth.users is EMPTY. If you had accounts, restore the backup before rebuilding.';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '  Next: run docs/SETUP-COMPLETE.sql';
  RAISE NOTICE '';
END
$reset$;

-- ─── Prove it ───────────────────────────────────────────────────────────────
--
-- Everything must read 0 except the last. Anything else survived, and the
-- rebuild would run against a database that is not clean.

SELECT
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p'))   AS tables_left,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm'))   AS views_left,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public')                               AS routines_left,
  (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype IN ('e', 'd'))   AS types_left,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S')           AS sequences_left,
  (SELECT count(*) FROM auth.users)                           AS auth_users_kept;
