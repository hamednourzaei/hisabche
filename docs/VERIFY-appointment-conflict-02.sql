-- ============================================================================
-- docs/VERIFY-appointment-conflict-02.sql — read-only. Run each block separately.
-- ============================================================================

-- 1. The extension and the constraint exist
SELECT
  EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') AS extension_exists,
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_no_staff_overlap') AS constraint_exists;

-- 2. It is an exclusion constraint on appointments
SELECT contype = 'x' AS ok
  FROM pg_constraint
 WHERE conname = 'appointments_no_staff_overlap' AND conrelid = 'public.appointments'::regclass;

-- 3. Existing overlapping bookings that stopped the migration (empty = none)
SELECT a.id AS first_id, b.id AS second_id, a.workspace_id, a.staff_employee_id,
       a.start_time AS first_start, a.end_time AS first_end,
       b.start_time AS second_start, b.end_time AS second_end
  FROM public.appointments a
  JOIN public.appointments b
    ON a.workspace_id = b.workspace_id
   AND a.staff_employee_id = b.staff_employee_id
   AND a.id < b.id
   AND a.status <> 'cancelled' AND b.status <> 'cancelled'
   AND tstzrange(a.start_time, a.end_time) && tstzrange(b.start_time, b.end_time);
