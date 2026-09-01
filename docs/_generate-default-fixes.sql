-- ============================================================================
-- docs/_generate-default-fixes.sql
--
-- READ-ONLY. Emits the ALTER statements; runs none of them.
--
-- ---------------------------------------------------------------------------
-- ⚠️ WHY THE FIRST VERSION TIMED OUT — IT WAS NEVER LOCKS
--
-- The first version read `information_schema`. That timed out, and I guessed
-- lock contention. The logs disproved it: `/api/health` returns 200 in 1ms and
-- nothing was blocked.
--
-- `information_schema.key_column_usage` is the actual culprit. It is a view
-- over several catalogs with no useful indexes, and joining it per-column
-- against `information_schema.columns` is quadratic on a schema this size.
-- Reading a hundred tables' worth of metadata through it takes longer than the
-- editor is willing to wait.
--
-- This version reads `pg_catalog` directly — `pg_attribute`, `pg_attrdef`,
-- `pg_constraint` — which is what `information_schema` is a slow, portable
-- wrapper around. Same answer, and it returns in milliseconds.
--
-- ---------------------------------------------------------------------------
-- WHAT IT FIXES
--
--     userId:      2a51e3d6-…    ← authentication succeeded
--     workspaceId: null          ← requireWorkspaceContext refused
--     status:      403
--
-- That pair is the whole bug. The user is signed in and has no membership row,
-- because `workspace_members.has_access` is NOT NULL with no default and
-- `workspace.service.ts` inserts `{ workspace_id, user_id, role }` without it —
-- the column carried `DEFAULT true` until the rebuild dropped it.
--
-- ---------------------------------------------------------------------------
-- HOW TO USE
--
--   1. Run this file. It returns one column of SQL text, fast.
--   2. Copy the WHOLE column, including the first line (`SET lock_timeout`).
--   3. Paste into a new query and run it.
--
-- Top-level statements are genuinely one-per-transaction: each takes its lock,
-- commits, and releases before the next begins — unlike a `DO` block, where
-- `BEGIN … EXCEPTION … END` is a subtransaction and every lock is held to the
-- end.
--
-- ⚠️ This emits ONLY defaults. It no longer touches NOT NULL — see section 3
-- for why that was removed.
-- ============================================================================

WITH cols AS (
  SELECT
    c.relname                            AS table_name,
    a.attname                            AS column_name,
    format_type(a.atttypid, a.atttypmod) AS data_type,
    a.attnum,
    c.oid                                AS table_oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'                  -- ordinary tables only
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.attnotnull                     -- NOT NULL
    AND NOT EXISTS (                     -- and no default
      SELECT 1 FROM pg_attrdef d
      WHERE d.adrelid = a.attrelid AND d.adnum = a.attnum
    )
    AND a.attname <> 'id'
),
-- Every column that participates in a primary key, as one cheap scan of
-- pg_constraint rather than a per-column join through key_column_usage.
pk AS (
  SELECT conrelid AS table_oid, unnest(conkey) AS attnum
  FROM pg_constraint
  WHERE contype = 'p'
)
SELECT statement FROM (

  -- ─── 0. lock_timeout, always first ────────────────────────────────────────
  --
  -- ⚠️ An `ALTER TABLE` with no `lock_timeout` waits FOREVER for its lock, so
  -- one busy table hangs the entire paste and the editor reports an upstream
  -- timeout that reads exactly like an outage.
  SELECT -1 AS ord, 'SET lock_timeout = ''5s'';' AS statement

  -- ─── 1. The blocker ───────────────────────────────────────────────────────
  --
  -- `.eq('has_access', true).is('suspended_at', null)` runs on every workspace
  -- resolution. Restore the default, then repair rows already created without
  -- it — on a fresh database the UPDATE touches nothing.
  --
  -- ⚠️ `true`, not `false`. A member added by invite is active immediately;
  -- suspension is what `suspended_at` records. `false` would create every
  -- member in a state nothing in the product knows how to leave.
  UNION ALL
  SELECT 0, 'ALTER TABLE workspace_members ALTER COLUMN has_access SET DEFAULT true;'
  WHERE EXISTS (SELECT 1 FROM cols WHERE table_name = 'workspace_members' AND column_name = 'has_access')

  UNION ALL
  SELECT 1, 'UPDATE workspace_members SET has_access = true WHERE has_access IS NULL;'

  -- ─── 2. Inferable defaults ────────────────────────────────────────────────
  --
  -- ⚠️ `is_active` defaults TRUE and the read flags FALSE. The asymmetry is
  -- deliberate: a new customer is active, a new notification is unread. One
  -- blanket rule gets one of the two backwards on every table.
  UNION ALL
  SELECT 2, format(
    'ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT %s;',
    table_name, column_name,
    CASE
      WHEN data_type = 'boolean'
       AND column_name ~ '^(is_read|is_archived|is_pinned|is_deleted|is_locked|is_final|is_group|is_system)$'
        THEN 'false'
      WHEN data_type = 'boolean' THEN 'true'
      WHEN data_type LIKE 'timestamp%' AND column_name LIKE '%\_at' THEN 'now()'
      WHEN data_type IN ('integer','bigint','smallint','numeric','real','double precision')
        OR data_type LIKE 'numeric(%' THEN '0'
      WHEN data_type = 'jsonb' AND column_name ~ '(history|snapshot|outcomes|features|items|list)$'
        THEN '''[]''::jsonb'
      WHEN data_type = 'jsonb' THEN '''{}''::jsonb'
    END
  )
  FROM cols
  WHERE data_type = 'boolean'
     OR (data_type LIKE 'timestamp%' AND column_name LIKE '%\_at')
     OR data_type IN ('integer','bigint','smallint','numeric','real','double precision')
     OR data_type LIKE 'numeric(%'
     OR data_type = 'jsonb'

  -- ─── 3. REMOVED — it was wrong, and dangerously so ────────────────────────
  --
  -- ⚠️ This section used to emit `DROP NOT NULL` for every `text`/`uuid`
  -- column that was NOT NULL with no default. On this schema that was ~200
  -- statements, and they included:
  --
  --     invoice_items.invoice_id        a line belonging to no invoice
  --     ledger_entries.account_id       a ledger entry with no account
  --     payment_allocations.payment_id  an allocation of nothing
  --     workspace_members.user_id       a membership with no member
  --     workspaces.owner_id             a business nobody owns
  --
  -- Those are FOREIGN KEYS and required business fields, not identity tokens.
  -- Making them nullable does not fix anything; it permits orphan rows in an
  -- accounting system, which is the kind of corruption that happens silently
  -- and cannot be reversed.
  --
  -- The reasoning I should have applied first:
  --
  --   These columns were NOT NULL in the original database and the product ran
  --   against it for a long time. So the code DOES set them. A NOT NULL column
  --   with no default is only a problem when the code relies on the database to
  --   fill it in — and the only way to know that is that it USED to have a
  --   default which the rebuild dropped.
  --
  -- `has_access` is the one column that fits that description, and sections 1
  -- and 2 above are the whole fix. Everything else here was speculative damage
  -- dressed up as thoroughness.
  --
  -- If a text column really does raise `23502` on an insert, fix THAT column
  -- with the error as evidence. Do not pre-emptively relax two hundred of them.

) generated
WHERE statement IS NOT NULL
ORDER BY ord, statement;
