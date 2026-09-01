-- ============================================================================
-- docs/FIX-403.sql
--
-- ONE script. Paste it into the Supabase SQL Editor, run it, done.
--
-- ---------------------------------------------------------------------------
-- THE BUG
--
--     userId:      2a51e3d6-…    ← authentication succeeded
--     workspaceId: null          ← requireWorkspaceContext refused
--     status:      403           ← every route except /api/workspaces
--
-- `base-schema-migration.sql` was rebuilt from a dump that recorded names,
-- types and NOT NULL — and no DEFAULTS.
--
--     workspace.service.ts   .insert({ workspace_id, user_id, role: 'owner' })
--     schema                 has_access boolean NOT NULL     ← default lost
--                            → 23502 not-null violation
--                            → no membership row is ever created
--                            → every later request 403
--
-- The code never sets `has_access` because the column carried `DEFAULT true`
-- from the day it was created.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES, AND WHAT IT DELIBERATELY DOES NOT
--
--   DOES      restore defaults on booleans, timestamps, counters and jsonb —
--             columns where the value follows from the type and the name, and
--             the application already behaves as though it is there.
--
--   DOES NOT  touch NOT NULL. An earlier version of this file relaxed every
--             text/uuid NOT NULL column — about two hundred, including
--             `invoice_items.invoice_id`, `ledger_entries.account_id` and
--             `workspace_members.user_id`.
--
--             Those are foreign keys and required business fields. Making them
--             nullable permits orphan rows in an accounting system — an
--             invoice line belonging to no invoice, a ledger entry with no
--             account — and fixes nothing.
--
--             ⚠️ The test that settles it: those columns were NOT NULL in the
--             original database and the product ran against it for a long
--             time, so the code sets them. A NOT NULL column with no default
--             is only a problem when the DATABASE used to fill it in.
--
-- ⚠️ `is_active` defaults TRUE and the read flags FALSE. A newly created
-- customer is active; a newly created notification has not been read. A single
-- blanket boolean rule gets one of the two backwards on every table.
--
-- SAFE TO RE-RUN. Every statement states a destination, not a change.
-- ============================================================================

-- Give up rather than queue behind a long read. Without this an ALTER waits
-- forever for its lock and the editor reports a timeout that reads exactly
-- like the database being down.
SET lock_timeout = '5s';

DO $fix$
DECLARE
  r         RECORD;
  v_default TEXT;
  v_done    integer := 0;
  v_skipped text[]  := ARRAY[]::text[];
  v_access  boolean := false;
BEGIN
  -- ─── 1. The one that is blocking everything ───────────────────────────────
  --
  -- `.eq('has_access', true).is('suspended_at', null)` runs on EVERY workspace
  -- resolution. Without the default there is no membership row to find.
  --
  -- ⚠️ `true`, not `false`. A member added by an invite is active immediately;
  -- suspension is what `suspended_at` records. `false` would create every
  -- member in a state nothing in the product knows how to leave — and the
  -- symptom would be identical, which is what makes it worth stating.
  BEGIN
    ALTER TABLE workspace_members ALTER COLUMN has_access SET DEFAULT true;
    UPDATE workspace_members SET has_access = true WHERE has_access IS NULL;
    v_access := true;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'has_access NOT fixed (%) — the 403s will continue', SQLERRM;
  END;

  -- ─── 2. Every other default the rebuild lost ──────────────────────────────
  --
  -- Reads `pg_catalog` rather than `information_schema`. The latter is a slow,
  -- portable wrapper over these same catalogs, and joining its
  -- `key_column_usage` view per column is quadratic on a schema this size —
  -- slow enough that the editor gives up before it returns.
  FOR r IN
    SELECT
      c.relname                            AS table_name,
      a.attname                            AS column_name,
      format_type(a.atttypid, a.atttypmod) AS data_type
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attnotnull
      AND a.attname <> 'id'
      AND NOT EXISTS (
        SELECT 1 FROM pg_attrdef d
        WHERE d.adrelid = a.attrelid AND d.adnum = a.attnum
      )
  LOOP
    v_default := CASE
      WHEN r.data_type = 'boolean'
       AND r.column_name ~ '^(is_read|is_archived|is_pinned|is_deleted|is_locked|is_final|is_group|is_system)$'
        THEN 'false'
      WHEN r.data_type = 'boolean'
        THEN 'true'
      WHEN r.data_type LIKE 'timestamp%' AND r.column_name LIKE '%\_at'
        THEN 'now()'
      WHEN r.data_type ~ '^(integer|bigint|smallint|numeric|real|double precision)'
        THEN '0'
      WHEN r.data_type = 'jsonb'
       AND r.column_name ~ '(history|snapshot|outcomes|features|items|list)$'
        THEN '''[]''::jsonb'
      WHEN r.data_type = 'jsonb'
        THEN '''{}''::jsonb'
      -- text, uuid, varchar: identity. Left alone on purpose — see the header.
      ELSE NULL
    END;

    IF v_default IS NULL THEN CONTINUE; END IF;

    BEGIN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT %s',
                     r.table_name, r.column_name, v_default);
      v_done := v_done + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Named, not silently passed over. A skipped column is one to re-run,
      -- and a run that hides them looks identical to a run that succeeded.
      v_skipped := array_append(v_skipped, r.table_name || '.' || r.column_name);
    END;
  END LOOP;

  RAISE NOTICE 'has_access fixed: %    defaults restored: %', v_access, v_done;

  IF array_length(v_skipped, 1) > 0 THEN
    RAISE WARNING 'skipped % — run this again: %',
      array_length(v_skipped, 1), array_to_string(v_skipped, ', ');
  END IF;
END $fix$;

-- ============================================================================
-- PROOF
--
-- ⚠️ ONE result set, deliberately. The Supabase SQL Editor displays only the
-- LAST one, so three separate SELECTs would show as a single check and hide
-- the other two — which is how a half-finished run comes to look complete.
--
-- Every row must read PASS.
-- ============================================================================

SELECT check_name, result, detail FROM (

  SELECT 1 AS ord,
    'has_access has a default' AS check_name,
    CASE WHEN EXISTS (
      SELECT 1
      FROM pg_attrdef d
      JOIN pg_class c     ON c.oid = d.adrelid
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.adnum
      WHERE c.relname = 'workspace_members' AND a.attname = 'has_access'
    ) THEN 'PASS' ELSE 'FAIL' END AS result,
    'the column that causes the 403s' AS detail

  UNION ALL
  SELECT 2,
    'no NULL memberships',
    CASE WHEN (SELECT count(*) FROM workspace_members WHERE has_access IS NULL) = 0
      THEN 'PASS' ELSE 'FAIL' END,
    (SELECT count(*)::text || ' rows still NULL'
     FROM workspace_members WHERE has_access IS NULL)

  UNION ALL
  SELECT 3,
    'inferable defaults restored',
    CASE WHEN (
      SELECT count(*)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND a.attnotnull
        AND a.attname <> 'id'
        AND (
          format_type(a.atttypid, a.atttypmod) IN ('boolean', 'jsonb')
          OR format_type(a.atttypid, a.atttypmod) ~ '^(integer|bigint|smallint|numeric|real|double precision)'
          OR (format_type(a.atttypid, a.atttypmod) LIKE 'timestamp%' AND a.attname LIKE '%\_at')
        )
        AND NOT EXISTS (
          SELECT 1 FROM pg_attrdef d
          WHERE d.adrelid = a.attrelid AND d.adnum = a.attnum
        )
    ) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'booleans, timestamps, counters, jsonb'

  UNION ALL
  -- Not pass/fail, and the one that decides whether signing in works RIGHT
  -- NOW. The default fixes the NEXT insert; a user whose membership insert
  -- already failed has no row to repair. If this reads 0, sign out and in
  -- again — onboarding will create the membership that could not exist before.
  SELECT 4,
    'membership rows on record',
    'INFO',
    (SELECT count(*)::text || ' rows' FROM workspace_members)

) checks
ORDER BY ord;
