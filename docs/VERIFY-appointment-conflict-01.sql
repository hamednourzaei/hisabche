-- ============================================================================
-- docs/VERIFY-appointment-conflict-01.sql
--
-- Verification query for appointment-conflict-01-migration.sql.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================================================

SELECT
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'appointments'
      AND indexname = 'idx_appointments_staff_window'
  ) AS index_idx_appointments_staff_window_exists;
