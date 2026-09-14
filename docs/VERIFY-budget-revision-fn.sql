-- docs/VERIFY-budget-revision-fn.sql — the one function VERIFY-budget-planning.sql did not check.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
SELECT 'budget_apply_revision exists' AS check,
       to_regprocedure('public.budget_apply_revision(uuid,uuid,integer,bigint,jsonb,text,text,integer,uuid,jsonb)') IS NOT NULL AS ok
UNION ALL
SELECT 'revision fn not executable by anon/authenticated',
       NOT has_function_privilege('anon', 'public.budget_apply_revision(uuid,uuid,integer,bigint,jsonb,text,text,integer,uuid,jsonb)', 'EXECUTE')
   AND NOT has_function_privilege('authenticated', 'public.budget_apply_revision(uuid,uuid,integer,bigint,jsonb,text,text,integer,uuid,jsonb)', 'EXECUTE')
UNION ALL
SELECT 'revision fn executable by service_role',
       has_function_privilege('service_role', 'public.budget_apply_revision(uuid,uuid,integer,bigint,jsonb,text,text,integer,uuid,jsonb)', 'EXECUTE')
UNION ALL
SELECT 'budget_consumption subtracts consumed_minor',
       pg_get_functiondef('public.budget_consumption(uuid,uuid,uuid,date,date)'::regprocedure) LIKE '%consumed_minor%'
UNION ALL
SELECT 'new rows default to draft',
       (SELECT column_default FROM information_schema.columns
        WHERE table_schema='public' AND table_name='budgets' AND column_name='status') LIKE '%draft%';
