-- ============================================================================
-- REALTIME FOR THE BUSINESS TABLES — additive, idempotent, re-runnable.
--
-- ✅ RUN on the live database. Post-migration Audit: PASS — its rows in
-- docs/VERIFY-background-jobs-and-realtime-2026-09-26.sql all ok = true
-- (19/19 in total, reported by the user 26 Sep 2026).
--
-- WHY
--
-- Several employees work in one business at once. When one of them issues an
-- invoice, the others' dashboards, invoice lists and stock must move without a
-- reload. The client side for that has existed for a while — `useRealtime` in
-- `packages/api` subscribes, per workspace, to every table below — but
-- `docs/realtime-publication-migration.sql` published only four tables
-- (notifications, activities, sync_conflicts, workspace_members). For every
-- other table the channel connects, reports SUBSCRIBED, and never hears a
-- thing: another employee's work appeared only after a refresh
-- (راهنمای سشن §۷٫۶ — empty and "not allowed to run" render the same).
--
-- WHAT THIS DOES — AND DELIBERATELY DOES NOT
--
--  ✔ Adds each table to the `supabase_realtime` publication.
--  ✔ Skips a table that does not exist, or that has no `workspace_id` column —
--    the client filters every subscription on `workspace_id`, and publishing a
--    table it cannot filter would only produce a subscription error.
--  ✘ Does NOT set `REPLICA IDENTITY FULL`. That writes the OLD row into the WAL
--    on every UPDATE and DELETE, and these are the busiest, widest tables in
--    the system. It is not needed here:
--      - INSERT and UPDATE events carry the NEW row in full, so the
--        `workspace_id` filter is evaluated on it;
--      - DELETE events are not filterable in Supabase Realtime at all — and
--        money rows are never hard-deleted in this system (راهنمای سشن §۱٫۴:
--        reversal, not DELETE).
--    If a live UPDATE is ever found not to arrive, add FULL to that ONE table
--    and measure; do not add it to all of them.
--
-- SECURITY
--
-- The client's `filter` is not an authorization boundary — a client chooses
-- its own filter. Realtime delivers a row only if the subscriber's RLS SELECT
-- policy allows it (docs/tenancy-rls.sql). The verification query therefore
-- also reports whether RLS is enabled on each table: a published table WITHOUT
-- RLS would broadcast rows to anyone who asks for them. Do not accept a row
-- with rls_enabled = false — drop that table from the publication instead.
--
-- LOCK NOTE: `ALTER PUBLICATION ... ADD TABLE` takes SHARE UPDATE EXCLUSIVE —
-- reads and writes continue; it only waits behind running DDL.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  target text;
BEGIN
  -- Exactly the tables `packages/api` subscribes to that were not yet
  -- published (grep `useRealtime({ table:` and `subscribeToChannel(`).
  FOREACH target IN ARRAY ARRAY[
    'invoices', 'transactions', 'customers', 'products',
    'accounts', 'journal_entries', 'journal_lines',
    'interactions', 'opportunities',
    'purchase_orders', 'boms', 'work_orders',
    'projects', 'project_tasks'
  ]
  LOOP
    IF to_regclass('public.' || target) IS NULL THEN
      RAISE NOTICE 'skipping %: table does not exist', target;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = target AND column_name = 'workspace_id'
    ) THEN
      RAISE NOTICE 'skipping %: no workspace_id column, cannot be filtered per workspace', target;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = target
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', target);
      RAISE NOTICE 'added % to supabase_realtime', target;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- Dropping a table from the publication stops its live updates and touches no
-- data; the app falls back to refreshing on the next query, focus or
-- navigation — what it does today. Safe at any time, one table at a time:
--
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.invoices;
--
-- ⚠️ Do NOT disable the publication itself; other Supabase features use it.
-- ============================================================================

-- ============================================================================
-- VERIFICATION — run separately, after the migration.
--
-- Every row whose table exists and has workspace_id must read
-- published = true AND rls_enabled = true. Send the whole result back.
-- ============================================================================
-- SELECT t.tablename,
--        to_regclass('public.' || t.tablename) IS NOT NULL                    AS table_exists,
--        EXISTS (SELECT 1 FROM information_schema.columns c
--                WHERE c.table_schema = 'public' AND c.table_name = t.tablename
--                  AND c.column_name = 'workspace_id')                        AS has_workspace_id,
--        p.tablename IS NOT NULL                                             AS published,
--        COALESCE(cls.relrowsecurity, false)                                 AS rls_enabled
-- FROM (VALUES ('invoices'), ('transactions'), ('customers'), ('products'),
--              ('accounts'), ('journal_entries'), ('journal_lines'),
--              ('interactions'), ('opportunities'),
--              ('purchase_orders'), ('boms'), ('work_orders'),
--              ('projects'), ('project_tasks')) AS t(tablename)
-- LEFT JOIN pg_publication_tables p
--        ON p.pubname = 'supabase_realtime' AND p.schemaname = 'public' AND p.tablename = t.tablename
-- LEFT JOIN pg_class cls
--        ON cls.oid = to_regclass('public.' || t.tablename)
-- ORDER BY t.tablename;
