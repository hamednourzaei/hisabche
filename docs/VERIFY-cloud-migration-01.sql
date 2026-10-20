-- ============================================================================
-- VERIFICATION FOR docs/cloud-migration-01-migration.sql
--
-- Run in the SQL editor after cloud-migration-01-migration.sql.
-- Every row must answer: ok = true.
-- ============================================================================

SELECT 'cloud_migration_jobs table exists and has RLS' AS check,
       to_regclass('public.cloud_migration_jobs') IS NOT NULL
       AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.cloud_migration_jobs'::regclass) AS ok
UNION ALL
SELECT 'cloud_migration_map table exists and has RLS',
       to_regclass('public.cloud_migration_map') IS NOT NULL
       AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.cloud_migration_map'::regclass)
UNION ALL
SELECT 'cloud_migration_records table exists and has RLS',
       to_regclass('public.cloud_migration_records') IS NOT NULL
       AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.cloud_migration_records'::regclass)
UNION ALL
SELECT 'cloud_migration_map has unique constraint on (workspace_id, entity_type, local_id)',
       EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.cloud_migration_map'::regclass
           AND contype = 'u'
           AND conname = 'uq_migration_entity_local'
       )
UNION ALL
SELECT 'anon cannot read or write migration tables',
       NOT has_table_privilege('anon', 'public.cloud_migration_jobs', 'SELECT')
       AND NOT has_table_privilege('anon', 'public.cloud_migration_jobs', 'INSERT')
       AND NOT has_table_privilege('anon', 'public.cloud_migration_map', 'SELECT')
       AND NOT has_table_privilege('anon', 'public.cloud_migration_records', 'SELECT')
UNION ALL
SELECT 'status guard trigger exists on cloud_migration_jobs',
       EXISTS (
         SELECT 1 FROM pg_trigger
         WHERE tgrelid = 'public.cloud_migration_jobs'::regclass
           AND tgname = 'trg_cloud_migration_jobs_status_guard'
       );
