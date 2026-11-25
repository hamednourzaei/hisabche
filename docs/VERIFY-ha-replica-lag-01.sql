-- ============================================================================
-- docs/VERIFY-ha-replica-lag-01.sql
-- Post-migration verification query for docs/ha-replica-lag-01-migration.sql
-- ============================================================================

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS is_security_definer,
  p.proconfig AS search_path_config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'get_replication_lag_ms';

SELECT
  has_function_privilege('anon', 'public.get_replication_lag_ms()', 'EXECUTE') AS anon_exec,
  has_function_privilege('authenticated', 'public.get_replication_lag_ms()', 'EXECUTE') AS auth_exec;
