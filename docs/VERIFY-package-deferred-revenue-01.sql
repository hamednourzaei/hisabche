-- ============================================================================
-- docs/VERIFY-package-deferred-revenue-01.sql
--
-- Read-only. Run AFTER docs/package-deferred-revenue-01-migration.sql. One row; every `*_ok` must be true.
-- Status of the migration until the owner pastes the result: PENDING HUMAN CONFIRMATION.
-- ============================================================================
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'package_credit_ledger' AND column_name = 'deferred_amount')
    AS ledger_deferred_amount_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'package_credit_ledger' AND column_name = 'term_months')
    AS ledger_term_months_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'package_term_months')
    AS product_term_ok,
  to_regclass('public.package_credit_allocations') IS NOT NULL AS allocations_table_ok,
  to_regclass('public.package_credit_suspensions') IS NOT NULL AS suspensions_table_ok,
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_package_credit_allocate' AND NOT tgisinternal)
    AS allocate_trigger_ok,
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pkg_alloc_immutable' AND NOT tgisinternal)
    AS allocations_append_only_ok,
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pkg_susp_immutable' AND NOT tgisinternal)
    AS suspensions_append_only_ok,
  -- the role check must know the two roles the release and the scrap loss post to
  (SELECT pg_get_constraintdef(oid) LIKE '%deferred_revenue%' AND pg_get_constraintdef(oid) LIKE '%inventory_loss%'
     FROM pg_constraint WHERE conname = 'accounts_role_check' LIMIT 1) AS account_roles_ok,
  -- row level security on both new tables, by workspace membership
  (SELECT bool_and(relrowsecurity) FROM pg_class
    WHERE oid IN ('public.package_credit_allocations'::regclass, 'public.package_credit_suspensions'::regclass))
    AS rls_enabled_ok,
  -- no new table is writable by the browser roles
  NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
               WHERE table_schema = 'public' AND table_name IN ('package_credit_allocations', 'package_credit_suspensions')
                 AND grantee IN ('anon', 'authenticated', 'PUBLIC')
                 AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')) AS no_browser_writes_ok,
  -- the trigger function is not callable by anyone
  NOT has_function_privilege('authenticated', 'public.package_credit_allocate()', 'EXECUTE') AS trigger_fn_private_ok,
  -- legacy facts (informational, expected: every package sold before the cut-over has no deferred amount)
  (SELECT count(*) FROM public.package_credit_ledger WHERE entry_type = 'GRANT' AND deferred_amount IS NULL)
    AS legacy_grants_without_deferred_amount,
  (SELECT count(*) FROM public.package_credit_ledger c
    WHERE c.entry_type = 'CONSUME'
      AND NOT EXISTS (SELECT 1 FROM public.package_credit_allocations a WHERE a.entry_id = c.id))
    AS legacy_consumes_without_allocation;
