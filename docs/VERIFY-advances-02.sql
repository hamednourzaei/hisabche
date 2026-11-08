-- ============================================================================
-- docs/VERIFY-advances-02.sql — run AFTER advances-02. Read-only, one row.
-- ============================================================================
SELECT
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_deposits_source_type_known'
           AND pg_get_constraintdef(oid) LIKE '%pre_purchase%') AS kinds_known,
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'order_deposits' AND column_name = 'note') AS note_column,
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_role_check'
           AND pg_get_constraintdef(oid) LIKE '%supplier_advances%') AS role_known,
  to_regprocedure('public.supplier_advance_apply(uuid,uuid,uuid,uuid,bigint,smallint,date,text,uuid,uuid,text)') IS NOT NULL
    AND to_regprocedure('public.supplier_advance_refund(uuid,uuid,uuid,bigint,smallint,date,text,text,text,uuid,uuid,text)') IS NOT NULL
    AS functions_exist,
  NOT has_function_privilege('anon', 'public.supplier_advance_apply(uuid,uuid,uuid,uuid,bigint,smallint,date,text,uuid,uuid,text)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.supplier_advance_apply(uuid,uuid,uuid,uuid,bigint,smallint,date,text,uuid,uuid,text)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.supplier_advance_apply(uuid,uuid,uuid,uuid,bigint,smallint,date,text,uuid,uuid,text)', 'EXECUTE')
    AS apply_service_only,
  (
    EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_deposits_source_type_known'
             AND pg_get_constraintdef(oid) LIKE '%pre_purchase%')
    AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_role_check'
             AND pg_get_constraintdef(oid) LIKE '%supplier_advances%')
    AND to_regprocedure('public.supplier_advance_apply(uuid,uuid,uuid,uuid,bigint,smallint,date,text,uuid,uuid,text)') IS NOT NULL
    AND to_regprocedure('public.supplier_advance_refund(uuid,uuid,uuid,bigint,smallint,date,text,text,text,uuid,uuid,text)') IS NOT NULL
    AND NOT has_function_privilege('anon', 'public.supplier_advance_apply(uuid,uuid,uuid,uuid,bigint,smallint,date,text,uuid,uuid,text)', 'EXECUTE')
  ) AS ok;
