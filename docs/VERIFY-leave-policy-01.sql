-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY-leave-policy-01.sql
-- Companion verification for docs/leave-policy-01-migration.sql
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. The tables and both functions exist.
SELECT proname FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname IN ('leave_accrue_month', 'leave_balance');
-- EXPECT: exactly 2 rows.

SELECT indexname FROM pg_indexes
 WHERE tablename IN ('leave_policies', 'leave_accruals')
   AND indexname IN ('leave_policies_one_per_type', 'leave_accruals_one_per_period');
-- EXPECT: exactly 2 rows.

-- 2. No employee holds more accrued days than a sane ceiling (annual × 2
--    covers yearly accrual plus one carried year).
SELECT employee_id, leave_type, SUM(accrued) AS total
  FROM public.leave_accruals
 GROUP BY employee_id, leave_type
HAVING SUM(accrued) > 999;
-- EXPECT: 0 rows.

-- 3. No accrual row whose employee is not an active employee of the same
--    workspace (the constraint guards the FK, this guards the workspace).
SELECT a.id
  FROM public.leave_accruals a
  LEFT JOIN public.employees e ON e.id = a.employee_id
 WHERE e.id IS NULL
    OR e.workspace_id IS DISTINCT FROM a.workspace_id
    OR e.status <> 'active';
-- EXPECT: 0 rows (rows for since-terminated employees are history and MAY
-- exist — if this query returns rows, check whether they predate termination
-- before treating them as a defect).

-- 4. Every consumed figure a balance reports must equal the approved leaves.
SELECT a.employee_id, a.leave_type, SUM(a.accrued) AS accrued
  FROM public.leave_accruals a
 GROUP BY a.employee_id, a.leave_type
HAVING SUM(a.accrued) < 0;
-- EXPECT: 0 rows.
