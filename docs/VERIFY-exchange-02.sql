-- docs/VERIFY-exchange-02.sql — every row must say ok = true.
-- Status: Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
SELECT 'fx_cashbox_reconciliations exists' AS check_name,
  to_regclass('public.fx_cashbox_reconciliations') IS NOT NULL AS ok
UNION ALL SELECT 'variance check constraint installed',
  EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'fx_cashbox_variance_math'
       AND conrelid = 'public.fx_cashbox_reconciliations'::regclass
  )
UNION ALL SELECT 'reconciliations written only by fx_reconcile_cashbox',
  NOT has_table_privilege('service_role', 'public.fx_cashbox_reconciliations', 'INSERT')
UNION ALL SELECT 'reconciliations immutable (no service_role update)',
  NOT has_table_privilege('service_role', 'public.fx_cashbox_reconciliations', 'UPDATE')
UNION ALL SELECT 'anon cannot read reconciliations',
  NOT has_table_privilege('anon', 'public.fx_cashbox_reconciliations', 'SELECT')
UNION ALL SELECT 'fx_reconcile_cashbox closed to anon',
  NOT has_function_privilege('anon', 'public.fx_reconcile_cashbox(uuid, uuid, text, bigint, text, text)', 'EXECUTE')
UNION ALL SELECT 'fx_reconcile_cashbox closed to authenticated',
  NOT has_function_privilege('authenticated', 'public.fx_reconcile_cashbox(uuid, uuid, text, bigint, text, text)', 'EXECUTE');
