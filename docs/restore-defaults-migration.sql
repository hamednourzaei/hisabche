-- ============================================================================
-- docs/restore-defaults-migration.sql
--
-- The column defaults the rebuild lost.
--
-- ---------------------------------------------------------------------------
-- WHAT WENT WRONG
--
-- `base-schema-migration.sql` was generated from a dump that recorded names,
-- types and NOT NULL — and no DEFAULTS. Its header says so plainly, and it was
-- the right trade at the time: inventing a default is worse than omitting one.
--
-- It stopped being harmless the first time a user signed in.
--
--     workspaces           created ✓
--     workspace_members    INSERT { workspace_id, user_id, role: 'owner' }
--                          → has_access is NOT NULL with no default
--                          → 23502 not-null violation
--                          → 500 on /workspaces/:id/members
--
-- And with no membership row, `requireWorkspace()` throws for every subsequent
-- request. Which is why the console showed a hundred 403s and one 500: the 500
-- is the cause and the 403s are all consequence.
--
-- ---------------------------------------------------------------------------
-- TWO ANSWERS, NOT ONE
--
-- For each NOT NULL column with no default there are two safe moves, and which
-- one is right depends on whether the value can be INFERRED:
--
--   1. INFERABLE      a boolean flag, a timestamp, a counter, a JSON bag.
--                     The default is obvious from the type and the name, and
--                     the code already behaves as if it is there.
--                     → restore the default
--
--   2. NOT INFERABLE  `workspaces.slug`, `invoices.public_token`,
--                     `billing_plans.key`. These are identity. A default of
--                     `''` would let two workspaces share an empty slug and a
--                     dozen invoices share an empty public token — bad data
--                     that looks fine until somebody follows a share link to
--                     the wrong invoice.
--                     → DROP NOT NULL instead
--
-- ⚠️ Dropping NOT NULL is the more conservative of the two. A NULL is visible,
-- queryable and fails loudly at the point of use. A wrong default is invisible
-- and fails much later, somewhere else.
--
-- ---------------------------------------------------------------------------
-- ⚠️ NOT ONE TRANSACTION, AND THAT IS DELIBERATE
--
-- The first version wrapped everything in BEGIN/COMMIT. It deadlocked:
--
--     40P01: deadlock detected
--     Process A waits for AccessExclusiveLock on relation 24409
--     Process B waits for AccessShareLock on relation 24813
--
-- `ALTER TABLE` takes an ACCESS EXCLUSIVE lock, and a single transaction doing
-- a hundred of them holds every one until it commits. Meanwhile the live API
-- is reading those same tables and taking ACCESS SHARE locks in a different
-- order. Two processes, each holding what the other wants.
--
-- ⚠️ CORRECTION — this file does NOT fully solve that, and saying it did was
-- wrong. A `DO $$ … $$` block is ONE statement in ONE transaction, and the
-- `BEGIN … EXCEPTION … END` inside it is a SUBTRANSACTION, not a commit. A
-- lock taken by a subtransaction that succeeds is held by the parent until the
-- whole block ends — so section 2 still holds ~100 ACCESS EXCLUSIVE locks at
-- once.
--
-- What `lock_timeout` and the handlers DO achieve: a blocked statement gives up
-- cleanly and is named, instead of the whole run dying on a deadlock. That is
-- better, and it is treating the symptom.
--
-- For the real fix use `docs/_generate-default-fixes.sql`, which emits these
-- statements as text so they run at the TOP LEVEL — genuinely one lock at a
-- time. Use this file only when the API is stopped, where holding every lock
-- at once costs nothing.
--
-- Every ALTER here is idempotent — `SET DEFAULT` and `DROP NOT NULL` both
-- state a destination rather than a change — so a partial run is not a broken
-- run. Run it again and it finishes the rest.
--
-- `lock_timeout` makes a blocked statement give up in five seconds instead of
-- waiting for a deadlock detector to notice. A table that is busy is SKIPPED
-- and NAMED at the end, not silently passed over.
--
-- SAFE TO RE-RUN. Expected to need it, if the API is under load.
-- ============================================================================

-- Give up rather than queue behind a long read. Five seconds is far longer
-- than any ALTER here needs and far shorter than a user waiting on a request.
SET lock_timeout = '5s';

-- ─── 1. The one that is blocking everything ─────────────────────────────────
--
-- `workspace_members.has_access` decides whether a membership counts:
--
--     .eq('has_access', true).is('suspended_at', null)
--
-- Every workspace resolution runs that query. `workspace.service.ts` inserts
-- `{ workspace_id, user_id, role }` and has never set `has_access`, because
-- the column had `DEFAULT true` since the day it was created.
--
-- ⚠️ `true`, not `false`. A member added by an invite is active immediately;
-- suspension is what `suspended_at` records. Defaulting to `false` would
-- create every member in a state nothing in the product knows how to leave.

DO $$
BEGIN
  ALTER TABLE workspace_members ALTER COLUMN has_access SET DEFAULT true;

  -- Repair rows already created without it. On a fresh database this touches
  -- nothing; on the one that has been failing since the rebuild it is the fix.
  UPDATE workspace_members SET has_access = true WHERE has_access IS NULL;

  RAISE NOTICE 'workspace_members.has_access: DEFAULT true restored';
EXCEPTION WHEN lock_not_available THEN
  -- The one statement that must not be missed. If it could not get the lock,
  -- say so loudly rather than let the reader assume the 403s are fixed.
  RAISE WARNING 'workspace_members is LOCKED — has_access was NOT fixed. Stop the API and run this again.';
END $$;

-- ─── 2. Inferable defaults, restored ────────────────────────────────────────
--
-- Booleans, timestamps, counters and JSON bags across every rebuilt table.
--
-- The rules, applied by name and type:
--
--   is_read · is_archived · is_pinned      false   — new things are unread
--   is_active · is_enabled · has_access     true    — new things are usable
--   *_at (timestamp)                        now()
--   integer / numeric counters              0
--   jsonb                                   '{}' or '[]' by name
--
-- ⚠️ `is_active` defaults to TRUE and the read flags to FALSE, and that
-- asymmetry is deliberate: a newly created customer is active, and a newly
-- created notification has not been read. A single blanket default would get
-- one of the two backwards on every table.

DO $$
DECLARE
  r RECORD;
  v_default TEXT;
  v_done    integer := 0;
  v_skipped text[] := ARRAY[]::text[];
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.is_nullable = 'NO'
      AND c.column_default IS NULL
      AND c.column_name <> 'id'
  LOOP
    v_default := CASE
      -- Read/archive/pin flags: a new row has not been read.
      WHEN r.data_type = 'boolean'
       AND r.column_name ~ '^(is_read|is_archived|is_pinned|is_deleted|is_locked|is_final|is_group|is_system)$'
        THEN 'false'

      -- Usability flags: a new row is usable.
      WHEN r.data_type = 'boolean'
        THEN 'true'

      WHEN r.data_type LIKE 'timestamp%' AND r.column_name LIKE '%\_at'
        THEN 'now()'

      WHEN r.data_type IN ('integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision')
        THEN '0'

      -- `_history`, `_snapshot`, `_outcomes`, `features`, `limits` read as
      -- lists in the code; the rest as objects.
      WHEN r.data_type = 'jsonb' AND r.column_name ~ '(history|snapshot|outcomes|features|items|list)$'
        THEN '''[]''::jsonb'
      WHEN r.data_type = 'jsonb'
        THEN '''{}''::jsonb'

      ELSE NULL
    END;

    IF v_default IS NULL THEN CONTINUE; END IF;

    -- Each ALTER on its own. A table the API is reading right now blocks for
    -- five seconds, times out, and is recorded — the other hundred still get
    -- their defaults.
    BEGIN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT %s',
        r.table_name, r.column_name, v_default
      );
      v_done := v_done + 1;
    EXCEPTION
      WHEN lock_not_available THEN
        v_skipped := array_append(v_skipped, r.table_name || '.' || r.column_name);
      WHEN OTHERS THEN
        v_skipped := array_append(v_skipped, r.table_name || '.' || r.column_name || ' (' || SQLERRM || ')');
    END;
  END LOOP;

  RAISE NOTICE 'defaults restored on % columns', v_done;

  IF array_length(v_skipped, 1) > 0 THEN
    RAISE WARNING 'skipped % — run this file again: %',
      array_length(v_skipped, 1), array_to_string(v_skipped, ', ');
  END IF;
END $$;

-- ─── 3. REMOVED ────────────────────────────────────────────────────────────
--
-- ⚠️ This section emitted `DROP NOT NULL` for every text/uuid column that was
-- NOT NULL with no default — about two hundred of them, including
-- `invoice_items.invoice_id`, `ledger_entries.account_id` and
-- `workspace_members.user_id`.
--
-- Those are foreign keys and required business fields. Relaxing them permits
-- orphan rows in an accounting system: an invoice line belonging to no
-- invoice, a ledger entry with no account. Silent, and unrecoverable.
--
-- The test I should have applied: these columns were NOT NULL in the original
-- database and the product ran against it for a long time, so the code sets
-- them. A NOT NULL column with no default only breaks when the code relies on
-- the database to fill it in — which is knowable only because it USED to have
-- a default that the rebuild dropped. `has_access` is that column. Sections 1
-- and 2 are the entire fix.

-- ─── Prove it ───────────────────────────────────────────────────────────────
--
-- Lists NOT NULL columns with no default that this file did not give one.
--
-- ⚠️ Rows here are EXPECTED and mostly fine — they are foreign keys and
-- required fields the application sets itself. This is a reference list, not a
-- failure list. Act on one only when an insert actually raises `23502` on it.

SELECT
  c.table_name,
  c.column_name,
  c.data_type
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_schema = c.table_schema AND t.table_name = c.table_name
WHERE c.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND c.is_nullable = 'NO'
  AND c.column_default IS NULL
  AND c.column_name NOT IN ('id', 'workspace_id')
  -- Primary keys are NOT NULL by definition and belong here.
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage k
      ON k.constraint_name = tc.constraint_name
     AND k.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = c.table_name
      AND tc.constraint_type = 'PRIMARY KEY'
      AND k.column_name = c.column_name
  )
ORDER BY 1, 2;
