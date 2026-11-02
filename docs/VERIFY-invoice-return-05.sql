-- Read-only. Run after docs/invoice-return-05-core-migration.sql.
-- Every column is expected to be true. PENDING HUMAN CONFIRMATION until you send the row back.
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoice_returns'
      AND column_name IN ('reason_code', 'notes', 'deduction_minor', 'refunded_minor', 'client_request_id')) = 5
    AS return_columns,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoice_return_lines'
      AND column_name = 'condition_code') = 1
    AS line_condition_column,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoice_return_refunds'
      AND column_name = 'client_request_id') = 1
    AND to_regclass('public.invoice_returns_request_idx') IS NOT NULL
    AND to_regclass('public.invoice_return_refunds_request_idx') IS NOT NULL
    AS idempotency_keys,
  to_regclass('public.invoice_return_deductions') IS NOT NULL
    AND to_regclass('public.invoice_return_refunds') IS NOT NULL
    AS new_tables,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'invoice_return_create'
          AND pronamespace = 'public'::regnamespace AND pronargs = 6)
    AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'invoice_return_create'
          AND pronamespace = 'public'::regnamespace AND pronargs = 5)
    AS create_replaced_not_duplicated,
  (SELECT bool_and(position('RETURN_DEDUCTION_EXCEEDS_BASE' IN prosrc) > 0
                   AND position('tax_total' IN prosrc) > 0
                   AND position('v_orig_tax_rate' IN prosrc) = 0)
     FROM pg_proc WHERE proname = 'invoice_return_create' AND pronamespace = 'public'::regnamespace)
    AS create_has_the_new_rules,
  (SELECT count(*) FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname IN ('invoice_return_refund_reserve', 'invoice_return_refund_settle',
                      'invoice_return_refund_fail', 'invoice_return_refund_reconcile')) = 4
    AS refund_functions,
  has_function_privilege('service_role',
    'public.invoice_return_create(uuid, uuid, integer, jsonb, jsonb, jsonb)', 'EXECUTE')
    AND NOT has_function_privilege('anon',
    'public.invoice_return_create(uuid, uuid, integer, jsonb, jsonb, jsonb)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated',
    'public.invoice_return_create(uuid, uuid, integer, jsonb, jsonb, jsonb)', 'EXECUTE')
    AS create_grants;
