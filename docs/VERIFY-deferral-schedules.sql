-- ============================================================================
-- docs/VERIFY-deferral-schedules.sql
--
-- Verification query for Option 4 (Deferred Revenue).
-- ============================================================================

SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('deferral_schedules', 'deferral_schedule_lines')
ORDER BY table_name, ordinal_position;
