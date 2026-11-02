-- ============================================================================
-- docs/VERIFY-m5-combined.sql
--
-- COMBINED READ-ONLY VERIFY for the whole M5 chain. It writes nothing and never errors on a missing object. It ALWAYS returns rows:
--   check_name | expected | actual | pass
-- Send the whole table back. "Success. No rows returned" is NOT a verification (it is what the SQL editor says after a CREATE
-- statement); this script cannot return that.
--
-- Run it AFTER docs/PROBE-m5-state.sql and after the runbook steps for your state. Every `pass` must be true. The behaviour checks
-- are fingerprints of the installed function text (labelled as such): behaviour itself is proven by the test suites on a disposable
-- database, never by writing data into this one.
-- ============================================================================
WITH checks(ord, check_name, expected, actual, pass) AS (
  VALUES
    -- schema shape
    (1,  'package_credit_ledger.deferred_amount exists', 'true',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='package_credit_ledger' AND column_name='deferred_amount')::text,
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='package_credit_ledger' AND column_name='deferred_amount')),
    (2,  'package_credit_ledger.term_months exists', 'true',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='package_credit_ledger' AND column_name='term_months')::text,
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='package_credit_ledger' AND column_name='term_months')),
    (3,  'products.package_term_months exists', 'true',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='package_term_months')::text,
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='package_term_months')),
    (4,  'package_credit_allocations exists', 'true', (to_regclass('public.package_credit_allocations') IS NOT NULL)::text, to_regclass('public.package_credit_allocations') IS NOT NULL),
    (5,  'package_credit_suspensions exists', 'true', (to_regclass('public.package_credit_suspensions') IS NOT NULL)::text, to_regclass('public.package_credit_suspensions') IS NOT NULL),
    (6,  'suspensions use the EVENT shape (kind + effective_on)', '2',
         (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='package_credit_suspensions' AND column_name IN ('kind','effective_on'))::text,
         (SELECT count(*) = 2 FROM information_schema.columns WHERE table_schema='public' AND table_name='package_credit_suspensions' AND column_name IN ('kind','effective_on'))),
    (7,  'suspensions have NO old interval column (starts_on)', '0',
         (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='package_credit_suspensions' AND column_name='starts_on')::text,
         (SELECT count(*) = 0 FROM information_schema.columns WHERE table_schema='public' AND table_name='package_credit_suspensions' AND column_name='starts_on')),
    -- triggers
    (8,  'trigger trg_package_credit_allocate', 'true', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_package_credit_allocate' AND NOT tgisinternal)::text,
         EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_package_credit_allocate' AND NOT tgisinternal)),
    (9,  'trigger trg_pkg_alloc_immutable', 'true', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_pkg_alloc_immutable' AND NOT tgisinternal)::text,
         EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_pkg_alloc_immutable' AND NOT tgisinternal)),
    (10, 'trigger trg_pkg_susp_immutable', 'true', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_pkg_susp_immutable' AND NOT tgisinternal)::text,
         EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_pkg_susp_immutable' AND NOT tgisinternal)),
    (11, 'trigger trg_invoice_return_scrap_loss', 'true', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_invoice_return_scrap_loss' AND NOT tgisinternal)::text,
         EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_invoice_return_scrap_loss' AND NOT tgisinternal)),
    -- functions exist and are private
    (12, 'invoice_write_document 11-arg exists', 'true',
         (to_regprocedure('public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb)') IS NOT NULL)::text,
         to_regprocedure('public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb)') IS NOT NULL),
    (13, 'accounting_deferred_revenue_change exists', 'true', (to_regprocedure('public.accounting_deferred_revenue_change(uuid, date, date)') IS NOT NULL)::text,
         to_regprocedure('public.accounting_deferred_revenue_change(uuid, date, date)') IS NOT NULL),
    (14, 'accounting_profit_ledger_totals exists', 'true', (to_regprocedure('public.accounting_profit_ledger_totals(uuid, date, date)') IS NOT NULL)::text,
         to_regprocedure('public.accounting_profit_ledger_totals(uuid, date, date)') IS NOT NULL),
    (15, 'ledger functions are not callable by browser roles', 'true',
         COALESCE((NOT has_function_privilege('authenticated', to_regprocedure('public.accounting_deferred_revenue_change(uuid, date, date)'), 'EXECUTE')
                   AND NOT has_function_privilege('authenticated', to_regprocedure('public.accounting_profit_ledger_totals(uuid, date, date)'), 'EXECUTE')), false)::text,
         COALESCE((NOT has_function_privilege('authenticated', to_regprocedure('public.accounting_deferred_revenue_change(uuid, date, date)'), 'EXECUTE')
                   AND NOT has_function_privilege('authenticated', to_regprocedure('public.accounting_profit_ledger_totals(uuid, date, date)'), 'EXECUTE')), false)),
    (16, 'allocation trigger function is not callable', 'true',
         COALESCE(NOT has_function_privilege('authenticated', to_regprocedure('public.package_credit_allocate()'), 'EXECUTE'), false)::text,
         COALESCE(NOT has_function_privilege('authenticated', to_regprocedure('public.package_credit_allocate()'), 'EXECUTE'), false)),
    -- security
    (17, 'RLS enabled on allocations and suspensions', 'true',
         COALESCE((SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN (to_regclass('public.package_credit_allocations'), to_regclass('public.package_credit_suspensions'))), false)::text,
         COALESCE((SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN (to_regclass('public.package_credit_allocations'), to_regclass('public.package_credit_suspensions'))), false)),
    (18, 'no browser role can write allocations or suspensions', '0',
         (SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name IN ('package_credit_allocations','package_credit_suspensions')
            AND grantee IN ('anon','authenticated','PUBLIC') AND privilege_type IN ('INSERT','UPDATE','DELETE'))::text,
         (SELECT count(*) = 0 FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name IN ('package_credit_allocations','package_credit_suspensions')
            AND grantee IN ('anon','authenticated','PUBLIC') AND privilege_type IN ('INSERT','UPDATE','DELETE'))),
    (19, 'accounts_role_check allows deferred_revenue and inventory_loss', 'true',
         COALESCE((SELECT pg_get_constraintdef(oid) LIKE '%deferred_revenue%' AND pg_get_constraintdef(oid) LIKE '%inventory_loss%' FROM pg_constraint WHERE conname='accounts_role_check' LIMIT 1), false)::text,
         COALESCE((SELECT pg_get_constraintdef(oid) LIKE '%deferred_revenue%' AND pg_get_constraintdef(oid) LIKE '%inventory_loss%' FROM pg_constraint WHERE conname='accounts_role_check' LIMIT 1), false)),
    -- behaviour FINGERPRINTS (heuristic, not proof)
    (20, 'FINGERPRINT deferred change counts reversed originals', 'true',
         COALESCE(pg_get_functiondef(to_regprocedure('public.accounting_deferred_revenue_change(uuid, date, date)')) LIKE '%''posted'', ''reversed''%', false)::text,
         COALESCE(pg_get_functiondef(to_regprocedure('public.accounting_deferred_revenue_change(uuid, date, date)')) LIKE '%''posted'', ''reversed''%', false)),
    (21, 'FINGERPRINT profit totals count reversed originals', 'true',
         COALESCE(pg_get_functiondef(to_regprocedure('public.accounting_profit_ledger_totals(uuid, date, date)')) LIKE '%''posted'', ''reversed''%', false)::text,
         COALESCE(pg_get_functiondef(to_regprocedure('public.accounting_profit_ledger_totals(uuid, date, date)')) LIKE '%''posted'', ''reversed''%', false)),
    (22, 'FINGERPRINT allocation reads SUSPEND/RESUME events', 'true',
         COALESCE(pg_get_functiondef(to_regprocedure('public.package_credit_allocate()')) LIKE '%''SUSPEND''%', false)::text,
         COALESCE(pg_get_functiondef(to_regprocedure('public.package_credit_allocate()')) LIKE '%''SUSPEND''%', false)),
    -- version markers (written by the forward-fix)
    (23, 'MARKER package_credit_allocate', 'm5:package_credit_allocate:rev2',
         COALESCE(obj_description(to_regprocedure('public.package_credit_allocate()'), 'pg_proc'), '(none)'),
         COALESCE(obj_description(to_regprocedure('public.package_credit_allocate()'), 'pg_proc'), '') = 'm5:package_credit_allocate:rev2'),
    (24, 'MARKER accounting_deferred_revenue_change', 'm5:accounting_deferred_revenue_change:rev2',
         COALESCE(obj_description(to_regprocedure('public.accounting_deferred_revenue_change(uuid, date, date)'), 'pg_proc'), '(none)'),
         COALESCE(obj_description(to_regprocedure('public.accounting_deferred_revenue_change(uuid, date, date)'), 'pg_proc'), '') = 'm5:accounting_deferred_revenue_change:rev2'),
    (25, 'MARKER accounting_profit_ledger_totals', 'm5:accounting_profit_ledger_totals:rev2',
         COALESCE(obj_description(to_regprocedure('public.accounting_profit_ledger_totals(uuid, date, date)'), 'pg_proc'), '(none)'),
         COALESCE(obj_description(to_regprocedure('public.accounting_profit_ledger_totals(uuid, date, date)'), 'pg_proc'), '') = 'm5:accounting_profit_ledger_totals:rev2'),
    (26, 'MARKER invoice_write_document 11-arg', 'm5:invoice_write_document_11:rev2',
         COALESCE(obj_description(to_regprocedure('public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb)'), 'pg_proc'), '(none)'),
         COALESCE(obj_description(to_regprocedure('public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb)'), 'pg_proc'), '') = 'm5:invoice_write_document_11:rev2'),
    (27, 'MARKER invoice_return_scrap_loss', 'm5:invoice_return_scrap_loss:rev2',
         COALESCE(obj_description(to_regprocedure('public.invoice_return_scrap_loss()'), 'pg_proc'), '(none)'),
         COALESCE(obj_description(to_regprocedure('public.invoice_return_scrap_loss()'), 'pg_proc'), '') = 'm5:invoice_return_scrap_loss:rev2')
)
SELECT check_name, expected, actual, pass FROM checks ORDER BY ord;
