-- ============================================================================
-- ✅ RUN AND VERIFIED BY THE OWNER — 2026-09-20.
-- Every row of the verification query below returned ok = true.
-- Do not run again; it is idempotent, but there is nothing left to do.
-- ============================================================================

-- All four tables reported published = true and replica_identity = f.
-- ============================================================================
-- REALTIME PUBLICATION — additive, idempotent, re-runnable.
--
-- ⚠️ THE CLIENT SUBSCRIBES; POSTGRES DECIDES WHETHER TO SPEAK.
--
-- `packages/api/src/supabase/realtime.ts` opens a channel per table and the
-- hooks subscribe to it. That part has always been correct. But Postgres only
-- broadcasts a table that is in the `supabase_realtime` PUBLICATION, and these
-- tables were never added to it — so the subscription connects, reports
-- SUBSCRIBED, and never receives anything.
--
-- The failure is silent by construction: a channel that is told nothing looks
-- exactly like a channel with nothing to tell. That is why the unread badge
-- only moved after a page reload.
--
-- ⚠️ `REPLICA IDENTITY FULL` is required for UPDATE and DELETE.
--
-- With the default (`DEFAULT` = primary key only), an UPDATE broadcasts the
-- key and nothing else, and a row-level `filter` on `workspace_id` cannot be
-- evaluated — so a workspace-filtered subscription silently drops every
-- update. Marking notifications read is an UPDATE, so without this the badge
-- would still not clear live.
--
-- ⚠️ RUN THIS YOURSELF IN THE SQL EDITOR. Nothing in this repository executes
-- DDL against the live database. The verification query is at the bottom.
--
-- ----------------------------------------------------------------------------
-- LOCK NOTE
--
-- `ALTER PUBLICATION ... ADD TABLE` takes a SHARE UPDATE EXCLUSIVE lock on the
-- table: it does NOT block reads or writes, but it does wait behind any
-- running DDL. `REPLICA IDENTITY FULL` takes an ACCESS EXCLUSIVE lock — brief,
-- but it blocks everything on that table while it runs, so prefer a quiet
-- moment. `lock_timeout` makes it fail fast rather than queue.
--
-- ⚠️ COST. `REPLICA IDENTITY FULL` makes Postgres write the OLD row into the
-- WAL on every UPDATE and DELETE. On a hot, wide table that is a real write
-- amplification — which is why only these four are listed, and not every
-- table the app subscribes to.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  target text;
BEGIN
  -- The tables whose changes a user must see WITHOUT reloading the page.
  --
  -- `notifications` is the one the owner reported: issue an invoice, and the
  -- badge beside the bell must move on its own.
  --
  -- `activities` feeds the same bell's panel and the /activities page.
  -- `sync_conflicts` and `workspace_members` change what somebody is allowed
  -- to do, and finding that out on the next reload is too late.
  FOREACH target IN ARRAY ARRAY['notifications', 'activities', 'sync_conflicts', 'workspace_members']
  LOOP
    -- The table may not exist on every environment; skip rather than fail the
    -- whole migration.
    IF to_regclass('public.' || target) IS NULL THEN
      RAISE NOTICE 'skipping %: table does not exist', target;
      CONTINUE;
    END IF;

    -- Idempotent: adding a table that is already published raises 42710.
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = target
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', target);
      RAISE NOTICE 'added % to supabase_realtime', target;
    END IF;

    -- Required for the workspace filter to survive an UPDATE / DELETE.
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', target);
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- Removing a table from the publication stops the live updates and changes
-- nothing else — no data is touched, and the app degrades to what it does
-- today (refresh on the next query or navigation). Safe to run at any time.
--
--   BEGIN;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.activities;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.sync_conflicts;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.workspace_members;
--   -- And, if the WAL volume was the reason:
--   ALTER TABLE public.notifications REPLICA IDENTITY DEFAULT;
--   COMMIT;
--
-- ⚠️ If realtime message volume or WAL size becomes a problem, drop tables
-- from the publication one at a time and watch — do NOT disable the
-- publication itself, which other Supabase features rely on.
-- ============================================================================

-- ============================================================================
-- VERIFICATION — run separately, after the migration.
-- Every row must read ok = true.
-- ============================================================================
-- SELECT t.tablename AS check,
--        (p.tablename IS NOT NULL AND c.relreplident = 'f') AS ok
-- FROM (VALUES ('notifications'), ('activities'), ('sync_conflicts'), ('workspace_members')) AS t(tablename)
-- LEFT JOIN pg_publication_tables p
--   ON p.pubname = 'supabase_realtime' AND p.schemaname = 'public' AND p.tablename = t.tablename
-- LEFT JOIN pg_class c ON c.relname = t.tablename
-- LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public';
--
-- `relreplident = 'f'` is REPLICA IDENTITY FULL. A row with ok = false is
-- either not published, or published without the identity an UPDATE needs.
