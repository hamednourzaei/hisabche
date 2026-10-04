-- ============================================================================
-- ATTENDANCE — 01 (capability #100). Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-attendance-01.sql.
--
-- The `attendance` table already exists (base schema) and already carries
-- `workspace_id` (tenant-isolation-closure). What it lacks is the rule that one
-- employee has ONE record per day: without it, two people marking the same
-- employee at the same moment leave two rows, and the day's hours are counted
-- twice.
--
-- ⚠️ THE INDEX IS CREATED ONLY IF NO DUPLICATE EXISTS. This script deletes
-- nothing. If duplicates are found it says so and stops short of the index; the
-- VERIFY query then reports the index as missing, and a person decides which
-- row of each pair is the true one.
--
-- The application works without the index (it reads before it writes); the
-- index is what makes that rule hold under concurrency.
-- ============================================================================

DO $$
DECLARE
  v_duplicates bigint;
BEGIN
  SELECT COUNT(*) INTO v_duplicates
    FROM (
      SELECT 1
        FROM public.attendance
       WHERE workspace_id IS NOT NULL
       GROUP BY workspace_id, employee_id, date
      HAVING COUNT(*) > 1
    ) d;

  IF v_duplicates > 0 THEN
    RAISE NOTICE 'attendance-01: % (employee, day) pairs have more than one row; the unique index was NOT created. Resolve them and run this script again.', v_duplicates;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS attendance_one_per_employee_day
      ON public.attendance (workspace_id, employee_id, date)
      WHERE workspace_id IS NOT NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Removes the rule, not the records.
--
--   DROP INDEX IF EXISTS public.attendance_one_per_employee_day;
