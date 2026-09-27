-- ============================================================================
-- VERIFY-sync-path.sql — read-only. Step 7 of the deploy order: the table
-- exists (confirmed 27 Sep 2026: to_regclass = sync_change_log); this checks
-- that the path behind it is actually live. Send the four results back.
-- ============================================================================

-- 1. Which tables record their writes into the log (expect: invoices,
--    customers, products, transactions — and time_entries if that migration
--    ran). A table missing here is one desktop never hears about.
SELECT c.relname AS table_name, t.tgname AS trigger_name, t.tgenabled AS enabled
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_proc p ON p.oid = t.tgfoid
 WHERE p.proname = 'sync_record_change'
   AND NOT t.tgisinternal
 ORDER BY c.relname;

-- 2. The version bump that optimistic concurrency relies on (expect invoices,
--    customers, products).
SELECT c.relname AS table_name, t.tgname AS trigger_name, t.tgenabled AS enabled
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_proc p ON p.oid = t.tgfoid
 WHERE p.proname = 'sync_bump_version'
   AND NOT t.tgisinternal
 ORDER BY c.relname;

-- 3. Is the log actually being written? Entries per entity in the last 7 days.
--    Zero everywhere while the shop is working = the triggers are not firing.
SELECT entity_type, operation, count(*) AS changes, max(created_at) AS latest
  FROM public.sync_change_log
 WHERE created_at > now() - interval '7 days'
 GROUP BY entity_type, operation
 ORDER BY entity_type, operation;

-- 4. Cross-check against the source: invoices changed in the last 7 days vs
--    invoice entries in the log. The log count should be >= the invoice count
--    (one row per write; an edited invoice appears more than once).
SELECT
  (SELECT count(*) FROM public.invoices WHERE updated_at > now() - interval '7 days') AS invoices_changed,
  (SELECT count(DISTINCT entity_id) FROM public.sync_change_log
    WHERE entity_type = 'invoice' AND created_at > now() - interval '7 days') AS invoices_in_log;
