-- ============================================================================
-- Verification: docs/VERIFY-sync-scope-01.sql
-- Read-only checks for docs/sync-scope-01-migration.sql
-- Every row must return ok = true.
-- ============================================================================

SELECT 'sync_pull_changes_v2_exists' AS check,
       to_regprocedure('public.sync_pull_changes_v2(uuid, bigint, integer, text[])') IS NOT NULL AS ok
UNION ALL
SELECT 'sync_pull_changes_v1_preserved' AS check,
       to_regprocedure('public.sync_pull_changes(uuid, bigint, integer)') IS NOT NULL AS ok
UNION ALL
SELECT 'v2_is_security_definer_with_search_path' AS check,
       EXISTS (
         SELECT 1
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = 'sync_pull_changes_v2'
           AND p.prosecdef = true
           AND 'search_path=public, pg_temp' = ANY(p.proconfig)
       ) AS ok
UNION ALL
SELECT 'v2_revoked_from_anon_and_authenticated' AS check,
       NOT has_function_privilege('anon', 'public.sync_pull_changes_v2(uuid, bigint, integer, text[])', 'EXECUTE')
       AND NOT has_function_privilege('authenticated', 'public.sync_pull_changes_v2(uuid, bigint, integer, text[])', 'EXECUTE') AS ok
UNION ALL
SELECT 'v2_granted_to_service_role' AS check,
       has_function_privilege('service_role', 'public.sync_pull_changes_v2(uuid, bigint, integer, text[])', 'EXECUTE') AS ok;

-- ============================================================================
-- OWNER ACTION ON STAGING (measure before adding any composite index):
-- Run the query below with a real staging workspace_id and inspect Buffers /
-- Index Scan vs Filter rows removed:
--
--   EXPLAIN (ANALYZE, BUFFERS)
--   SELECT * FROM public.sync_pull_changes_v2(
--     '<staging_workspace_id>'::uuid,
--     0,
--     500,
--     ARRAY['invoice','customer','product','transaction','warehouse','branch','exchange_rate','product_stock']
--   );
-- ============================================================================
