-- ============================================================================
-- docs/_verify-after.sql
--
-- Did the setup work? Eight checks, ONE result table.
--
-- ---------------------------------------------------------------------------
-- WHY ONE QUERY AND NOT EIGHT
--
-- The previous version was eight separate SELECTs. The Supabase SQL Editor
-- shows only the LAST result set of a multi-statement script — so seven checks
-- ran, passed or failed, and were invisible. The single row that came back
-- looked like the whole answer and was one eighth of it.
--
-- `UNION ALL` puts every verdict in one table. Read the `status` column: any
-- `FAIL` is a real problem, and the `detail` says what to do about it.
--
-- READ-ONLY. Changes nothing.
-- ============================================================================

WITH

-- ─── 1. Do the tables exist? ────────────────────────────────────────────────
tables AS (
  SELECT count(*) AS n
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
),

-- ─── 2. Are the RPCs the services call actually there? ──────────────────────
--
-- Every one of these is a multi-table write. A missing function does not fail
-- at deploy — it fails the first time somebody records a payment.
rpcs AS (
  SELECT
    -- ⚠️ DISTINCT. `count(*)` counts OVERLOADS: a function defined with two
    -- signatures is two rows in `pg_proc`, and the check reported "13 of 12"
    -- — a FAIL that meant everything was present and one function had a second
    -- signature. A verification that fails on a healthy database is worse than
    -- no verification, because the next real failure gets ignored too.
    count(DISTINCT p.proname) FILTER (WHERE p.proname = ANY (ARRAY[
      'accounting_post_journal_entry',
      'accounting_trial_balance',
      'payments_record',
      'payments_cancel',
      'pos_record_order',
      'get_next_invoice_number',
      'inventory_receive_layer',
      'inventory_consume_layers',
      'inventory_release_consumption',
      'inventory_valuation',
      'traceability_consume_batch',
      'warehouse_transfer_stock'
    ])) AS found
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
),

-- ─── 3. The three SECURITY DEFINER helpers ──────────────────────────────────
--
-- Without them every workspace policy fails to compile, and without SECURITY
-- DEFINER they recurse — `42P17`.
helpers AS (
  SELECT
    count(*) FILTER (WHERE p.proname IN
      ('auth_workspace_ids', 'is_workspace_member', 'auth_owned_workspace_ids')) AS found,
    count(*) FILTER (WHERE p.proname IN
      ('auth_workspace_ids', 'is_workspace_member', 'auth_owned_workspace_ids')
      AND p.prosecdef) AS definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
),

-- ─── 4. Tenant tables with RLS off ──────────────────────────────────────────
--
-- The most important number here. A table with `workspace_id` and RLS off is
-- readable by anyone holding the anon key.
rls_off AS (
  SELECT count(*) AS n, string_agg(t.tablename, ', ' ORDER BY t.tablename) AS names
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND NOT t.rowsecurity
    AND EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = t.tablename
        AND c.column_name = 'workspace_id'
    )
),

-- ─── 5. RLS on, but no policy ───────────────────────────────────────────────
--
-- ⚠️ Not always a fault. `sync_change_log` and `sync_mutations` are meant to
-- have none — RLS on with no policy means NOBODY may read, which is the
-- strictest setting and correct for tables only service-role touches.
no_policy AS (
  SELECT count(*) AS n, string_agg(t.tablename, ', ' ORDER BY t.tablename) AS names
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.rowsecurity
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = t.tablename
    )
    -- ⚠️ The deliberate deny-all set. RLS on with NO policy means nobody may
    -- read — the strictest possible state — and every one of these is reached
    -- only by the backend on `service_role`, which bypasses RLS.
    --
    -- Adding a policy to `password_reset_tokens` "for completeness" would turn
    -- a table nobody can read into one somebody can. They are excluded here so
    -- the check reads PASS when the schema is correct, instead of crying CHECK
    -- every time and training the reader to skip it.
    AND t.tablename NOT IN (
      'sync_change_log', 'sync_mutations', 'sync_logs', 'sync_queue',
      'background_jobs', 'checkout_sessions', 'invoice_pdf_cache',
      'journal_lines_archive', 'ledger_entries', 'password_reset_tokens',
      'schema_migrations', 'webhook_events', 'event_log'
    )
),

-- ─── 6. The one-owner rule ──────────────────────────────────────────────────
owner_idx AS (
  SELECT count(*) AS n
  FROM pg_indexes
  WHERE schemaname = 'public' AND indexname = 'workspace_single_owner_idx'
),

-- ─── 7. The ledger's one-sided check ────────────────────────────────────────
--
-- A journal line may have a debit or a credit, never both and never neither.
ledger_check AS (
  SELECT count(*) AS n
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'journal_lines'
    AND c.conname = 'journal_lines_one_sided_check'
    AND c.convalidated
),

-- ─── 8. Indexes on the columns policies filter by ───────────────────────────
--
-- A policy is a WHERE clause. Without an index behind it, Postgres applies the
-- predicate to every row it reads — a full scan wearing a security hat.
policy_idx AS (
  SELECT count(*) AS n
  FROM pg_indexes
  WHERE schemaname = 'public' AND indexdef LIKE '%workspace_id%'
)

SELECT * FROM (
  SELECT 1 AS "#", 'tables created' AS check,
    (SELECT n::text FROM tables) AS value,
    CASE WHEN (SELECT n FROM tables) >= 110 THEN 'PASS' ELSE 'FAIL' END AS status,
    'the bundle creates 112; a view counts separately, so 111 is correct' AS detail

  UNION ALL SELECT 2, 'RPCs present',
    (SELECT found || ' of 12' FROM rpcs),
    CASE WHEN (SELECT found FROM rpcs) = 12 THEN 'PASS' ELSE 'FAIL' END,
    'a missing one fails the first time somebody records a payment'

  UNION ALL SELECT 3, 'RLS helpers',
    (SELECT found || ' of 3, ' || definer || ' SECURITY DEFINER' FROM helpers),
    CASE WHEN (SELECT found FROM helpers) = 3 AND (SELECT definer FROM helpers) = 3
         THEN 'PASS' ELSE 'FAIL' END,
    'without SECURITY DEFINER the membership policy recurses — 42P17'

  UNION ALL SELECT 4, 'tenant tables with RLS OFF',
    (SELECT coalesce(names, '(none)') FROM rls_off),
    CASE WHEN (SELECT n FROM rls_off) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'any table here is readable by anyone with the anon key'

  UNION ALL SELECT 5, 'RLS on but no policy',
    (SELECT coalesce(names, '(none)') FROM no_policy),
    CASE WHEN (SELECT n FROM no_policy) = 0 THEN 'PASS' ELSE 'CHECK' END,
    '13 service-role-only tables are excluded — deny-all is correct for them'

  UNION ALL SELECT 6, 'one owner per workspace',
    (SELECT CASE WHEN n > 0 THEN 'enforced' ELSE 'missing' END FROM owner_idx),
    CASE WHEN (SELECT n FROM owner_idx) > 0 THEN 'PASS' ELSE 'FAIL' END,
    'without it a workspace can gain a second owner'

  UNION ALL SELECT 7, 'ledger one-sided check',
    (SELECT CASE WHEN n > 0 THEN 'validated' ELSE 'missing' END FROM ledger_check),
    CASE WHEN (SELECT n FROM ledger_check) > 0 THEN 'PASS' ELSE 'FAIL' END,
    'a journal line must carry a debit or a credit, never both'

  UNION ALL SELECT 8, 'indexes on workspace_id',
    (SELECT n::text FROM policy_idx),
    CASE WHEN (SELECT n FROM policy_idx) >= 20 THEN 'PASS' ELSE 'CHECK' END,
    'every RLS policy filters on this; without an index it is a full scan'
) checks
ORDER BY "#";
