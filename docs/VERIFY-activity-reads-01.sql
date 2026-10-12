-- ============================================================================
-- docs/VERIFY-activity-reads-01.sql
--
-- Verification query for activity-reads-01-migration.sql.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================================================

SELECT
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'activity_reads'
  ) AS activity_reads_table_exists,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'activity_reads'
      AND indexname = 'activity_reads_user_workspace_idx'
  ) AS user_workspace_index_exists,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'activity_mark_read'
  ) AS mark_read_func_exists,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'activity_mark_all_read'
  ) AS mark_all_read_func_exists,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'activity_get_unread_count'
  ) AS get_unread_count_func_exists,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'activity_get_filter_counts'
  ) AS get_filter_counts_func_exists,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'activity_get_unread_ids'
  ) AS get_unread_ids_func_exists,
  (
    EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'activity_reads'
    ) AND
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'activity_reads'
        AND indexname = 'activity_reads_user_workspace_idx'
    ) AND
    EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname = 'activity_mark_read'
    ) AND
    EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname = 'activity_mark_all_read'
    ) AND
    EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname = 'activity_get_unread_count'
    ) AND
    EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname = 'activity_get_filter_counts'
    ) AND
    EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname = 'activity_get_unread_ids'
    )
  ) AS ok;
