-- VERIFY for docs/rpc-client-revoke-migration.sql — read-only.
-- Expected: one row per existing overload, with anon_can = false,
-- authenticated_can = false, service_role_can = true.
-- Any row with anon_can or authenticated_can = true is still exposed.

SELECT p.oid::regprocedure                                    AS function,
       p.prosecdef                                            AS security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_can,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  AS service_role_can
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN (
     'accounting_post_journal_entry', 'get_next_invoice_number', 'inventory_receive_layer',
     'inventory_release_consumption', 'inventory_valuation', 'payments_cancel',
     'pos_record_order', 'product_units_replace', 'traceability_consume_batch',
     'warehouse_transfer_stock'
   )
 ORDER BY 1;
