-- ============================================================================
-- Verification: docs/VERIFY-sync-commit-horizon.sql
-- Name: Post-migration verification for sync_pull_changes and txid
-- Phase: Universal Core / Launch Critical
-- Date: 2026-10-26
-- ============================================================================

SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sync_change_log'
  AND column_name = 'txid';

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'sync_pull_changes';

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'sync_change_log'
  AND indexname IN ('sync_change_log_ws_version_idx', 'sync_change_log_txid_idx');
