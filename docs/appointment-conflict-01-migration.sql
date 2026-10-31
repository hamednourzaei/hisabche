-- ============================================================================
-- docs/appointment-conflict-01-migration.sql
--
-- Index for the staff overlap query of appointments (BUG-NEW-011).
--
-- SAFE TO RE-RUN. Additive, idempotent.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_appointments_staff_window
  ON public.appointments (workspace_id, staff_employee_id, start_time, end_time)
  WHERE status <> 'cancelled';

-- The overlap test itself runs in the service as one filtered query; this index is
-- what keeps that query cheap once a workspace has thousands of bookings.
-- A database-level exclusion constraint (gist) is NOT added here: existing
-- overlapping rows would make it fail, and that needs a product decision first.

-- ─── ROLLBACK BLOCK ────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS public.idx_appointments_staff_window;
