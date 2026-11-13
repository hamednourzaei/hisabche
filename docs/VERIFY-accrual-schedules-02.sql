-- ============================================================================
-- docs/VERIFY-accrual-schedules-02.sql — read-only. Run after
-- accrual-schedules-02-migration.sql; every row should say ok = true.
-- ============================================================================

SELECT 'function_exists' AS check_name,
       to_regprocedure('public.accrual_schedule_create(uuid, uuid, jsonb, jsonb)') IS NOT NULL AS ok
UNION ALL
SELECT 'clients_cannot_execute',
       NOT has_function_privilege('anon', 'public.accrual_schedule_create(uuid, uuid, jsonb, jsonb)', 'EXECUTE')
   AND NOT has_function_privilege('authenticated', 'public.accrual_schedule_create(uuid, uuid, jsonb, jsonb)', 'EXECUTE')
UNION ALL
SELECT 'service_role_can_execute',
       has_function_privilege('service_role', 'public.accrual_schedule_create(uuid, uuid, jsonb, jsonb)', 'EXECUTE')
UNION ALL
-- A schedule with no periods is what the old two-call write left behind.
-- false here = rows to look at (they are never posted); nothing is deleted.
SELECT 'no_schedule_without_periods',
       NOT EXISTS (
         SELECT 1 FROM public.accrual_schedules s
          WHERE NOT EXISTS (SELECT 1 FROM public.accrual_schedule_periods p WHERE p.schedule_id = s.id)
       )
UNION ALL
SELECT 'periods_add_up',
       NOT EXISTS (
         SELECT 1 FROM public.accrual_schedules s
          WHERE s.total_amount_minor <> (
            SELECT COALESCE(sum(p.amount_minor), 0) FROM public.accrual_schedule_periods p WHERE p.schedule_id = s.id
          )
       );
