-- ============================================================================
-- VERIFY-time-entries-unify-01.sql
--
-- Post-migration verification for `docs/time-entries-unify-01-migration.sql`.
-- Status: Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================================================

-- 1. Column & unique index present
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'time_entries'
  AND column_name = 'legacy_project_time_entry_id';

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'time_entries'
  AND indexname = 'time_entries_legacy_pte_uidx';

-- 2. Zero uncopied valid project_time_entries remaining
SELECT COUNT(*)::bigint AS uncopied_project_time_entries
FROM project_time_entries p
WHERE p.workspace_id IS NOT NULL
  AND p.project_id IS NOT NULL
  AND p.employee_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM time_entries t
    WHERE t.id = p.id OR t.legacy_project_time_entry_id = p.id
  );
