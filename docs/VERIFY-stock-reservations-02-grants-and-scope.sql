-- ============================================================================
-- docs/VERIFY-stock-reservations-02-grants-and-scope.sql
--
-- Read-only. Run after docs/stock-reservations-02-grants-and-scope-migration.sql.
-- Every query answers one question; none writes. Keep the output.
-- ============================================================================

-- 1. The four functions exist with the signature the backend calls.
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN (
     'stock_available',
     'stock_reserve',
     'stock_release_reservation',
     'stock_settle_reservation'
   )
 ORDER BY p.proname;
-- EXPECT: four rows, the arguments exactly as declared in
--         docs/stock-reservations-01-migration.sql.

-- 2. The server can execute them; no client can.
SELECT p.proname,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role',  p.oid, 'EXECUTE') AS service_role_execute
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN (
     'stock_available',
     'stock_reserve',
     'stock_release_reservation',
     'stock_settle_reservation'
   )
 ORDER BY p.proname;
-- EXPECT: anon_execute = false, authenticated_execute = false,
--         service_role_execute = true, on all four rows.

-- 3. `stock_available` scopes BOTH of its reads to the workspace, and pins
--    search_path.
SELECT p.prosecdef AS security_definer,
       p.proconfig AS config,
       position('AND workspace_id = p_workspace' IN pg_get_functiondef(p.oid)) > 0 AS scoped
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname = 'stock_available';
-- EXPECT: scoped = true; config contains 'search_path=public, pg_temp'.
--         security_definer may be false: the function runs as the caller and
--         the grants above are what keep clients out.

-- 4. Stock rows the new rule excludes, counted so the number is visible and not
--    guessed. These rows explain any ATP that dropped to 0 after the migration.
SELECT count(*) AS stock_rows_without_workspace
  FROM public.warehouse_stock
 WHERE workspace_id IS NULL;
-- EXPECT: 0 on a backfilled database. A non-zero count is legacy data, listed
--         by docs/FINDING-db-integrity.sql; map it explicitly (a warehouse owns
--         exactly one workspace) and re-run, or accept that it is not
--         promiseable stock.

-- 5. The callers that depend on these grants now resolve.
SELECT p.proname,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('transition_sales_order', 'deliver_sales_order_partial')
 ORDER BY p.proname;
-- EXPECT: both true when docs/sales-orders-02-migration.sql is applied. Their
--         bodies call stock_available / stock_reserve / release / settle, which
--         is why the missing grants broke sales-order confirmation.
