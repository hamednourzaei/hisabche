-- docs/VERIFY-budget-planning.sql — run AFTER budget-planning-migration.sql.
-- Every row should read ok = true. Report the output back; until then:
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION

SELECT 'budgets new columns' AS check,
       COUNT(*) = 10 AS ok
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'budgets'
  AND column_name IN ('name','budget_type','status','version','distribution','notes','approved_by','approved_at','updated_at','created_by')
UNION ALL
SELECT 'commitments.consumed_minor',
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='budget_commitments' AND column_name='consumed_minor')
UNION ALL
SELECT 'budget_revisions table + RLS',
       COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.budget_revisions'::regclass), false)
UNION ALL
SELECT 'immutable trigger',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'budget_revisions_no_update')
UNION ALL
SELECT 'batch fn not executable by anon/authenticated',
       NOT has_function_privilege('anon', 'public.budget_performance_batch(uuid,date,date)', 'EXECUTE')
   AND NOT has_function_privilege('authenticated', 'public.budget_performance_batch(uuid,date,date)', 'EXECUTE')
UNION ALL
SELECT 'batch fn executable by service_role',
       has_function_privilege('service_role', 'public.budget_performance_batch(uuid,date,date)', 'EXECUTE')
UNION ALL
SELECT 'no budget row violates new checks',
       NOT EXISTS (SELECT 1 FROM public.budgets
                   WHERE budget_type NOT IN ('expense','revenue')
                      OR status NOT IN ('draft','pending_approval','approved','archived'));
