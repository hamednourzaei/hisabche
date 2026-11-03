-- ============================================================================
-- docs/VERIFY-cycle-count-03.sql
-- READ-ONLY. One row per check: check_name | expected | actual | pass.
-- Run after docs/cycle-count-03-migration.sql. «Success. No rows returned» is NOT a pass.
-- ============================================================================

WITH f AS (
  SELECT p.oid, p.prosecdef, obj_description(p.oid, 'pg_proc') AS note
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'cycle_count_finish'
),
role_check AS (
  SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
   WHERE c.conname = 'accounts_role_check' AND c.conrelid = 'public.accounts'::regclass
),
status_check AS (
  SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
   WHERE c.conname = 'cycle_counts_status_check' AND c.conrelid = 'public.cycle_counts'::regclass
)
SELECT 'cycle_count_finish exists once' AS check_name, '1' AS expected, count(*)::text AS actual, count(*) = 1 AS pass FROM f
UNION ALL
SELECT 'cycle_count_finish is SECURITY DEFINER', 'true', COALESCE((SELECT prosecdef::text FROM f LIMIT 1), 'missing'),
       COALESCE((SELECT prosecdef FROM f LIMIT 1), false)
UNION ALL
SELECT 'cycle_count_finish version marker', 'cycle-count-03:rev1', COALESCE((SELECT note FROM f LIMIT 1), 'missing'),
       COALESCE((SELECT note = 'cycle-count-03:rev1' FROM f LIMIT 1), false)
UNION ALL
SELECT 'service_role may execute cycle_count_finish', 'true',
       COALESCE((SELECT has_function_privilege('service_role', oid, 'EXECUTE')::text FROM f LIMIT 1), 'missing'),
       COALESCE((SELECT has_function_privilege('service_role', oid, 'EXECUTE') FROM f LIMIT 1), false)
UNION ALL
SELECT 'authenticated may NOT execute cycle_count_finish', 'false',
       COALESCE((SELECT has_function_privilege('authenticated', oid, 'EXECUTE')::text FROM f LIMIT 1), 'missing'),
       COALESCE((SELECT NOT has_function_privilege('authenticated', oid, 'EXECUTE') FROM f LIMIT 1), false)
UNION ALL
SELECT 'accounts_role_check lists inventory_shrinkage', 'true',
       COALESCE((SELECT (def LIKE '%inventory_shrinkage%')::text FROM role_check), 'missing'),
       COALESCE((SELECT def LIKE '%inventory_shrinkage%' FROM role_check), false)
UNION ALL
SELECT 'accounts_role_check lists inventory_gain', 'true',
       COALESCE((SELECT (def LIKE '%inventory_gain%')::text FROM role_check), 'missing'),
       COALESCE((SELECT def LIKE '%inventory_gain%' FROM role_check), false)
UNION ALL
SELECT 'accounts_role_check still lists customer_advances', 'true',
       COALESCE((SELECT (def LIKE '%customer_advances%')::text FROM role_check), 'missing'),
       COALESCE((SELECT def LIKE '%customer_advances%' FROM role_check), false)
UNION ALL
SELECT 'cycle_counts_status_check lists pending_accounts', 'true',
       COALESCE((SELECT (def LIKE '%pending_accounts%')::text FROM status_check), 'missing'),
       COALESCE((SELECT def LIKE '%pending_accounts%' FROM status_check), false)
UNION ALL
SELECT 'cycle_counts.journal_entry_id exists', 'true',
       (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cycle_counts' AND column_name = 'journal_entry_id'))::text,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cycle_counts' AND column_name = 'journal_entry_id');
