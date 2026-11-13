-- ============================================================================
-- docs/VERIFY-quality-events-01.sql
-- Post-migration verification for V60 Slice 11 (`quality-events-01-migration.sql`)
-- Status: Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================================================

SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('quality_events', 'warranty_claims')) AS table_count,
  (SELECT count(*) FROM information_schema.triggers WHERE trigger_schema = 'public' AND event_object_table = 'quality_events' AND trigger_name = 'quality_events_no_update_delete') AS immutable_trigger_count,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN ('quality_events', 'warranty_claims') AND c.relrowsecurity = true) AS rls_enabled_count;

-- V61 audit (12 Nov 2026): clients are locked out — RLS on, no policy, and
-- neither anon nor authenticated holds any privilege. Expect ok = true.
SELECT 'clients_locked' AS check_name,
       bool_and(c.relrowsecurity)
       AND NOT bool_or(
             has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
          OR has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE'))
       AND NOT EXISTS (
             SELECT 1 FROM pg_policies p
              WHERE p.schemaname = 'public' AND p.tablename = ANY (ARRAY['quality_events', 'warranty_claims']))
       AND count(*) = 2 AS ok
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('quality_events', 'warranty_claims');
