-- ============================================================================
-- docs/VERIFY-rfq-purchase-contracts-02.sql — read-only. Run after
-- rfq-purchase-contracts-02-migration.sql; every row should say ok = true.
-- ============================================================================

SELECT 'function_exists' AS check_name,
       to_regprocedure('public.rfq_choose_quotation(uuid, uuid, date)') IS NOT NULL AS ok
UNION ALL
SELECT 'clients_cannot_execute',
       NOT has_function_privilege('anon', 'public.rfq_choose_quotation(uuid, uuid, date)', 'EXECUTE')
   AND NOT has_function_privilege('authenticated', 'public.rfq_choose_quotation(uuid, uuid, date)', 'EXECUTE')
UNION ALL
SELECT 'service_role_can_execute',
       has_function_privilege('service_role', 'public.rfq_choose_quotation(uuid, uuid, date)', 'EXECUTE')
UNION ALL
SELECT 'rfq_index_exists',
       to_regclass('public.supplier_quotations_rfq_idx') IS NOT NULL
UNION ALL
-- At most one chosen quotation per RFQ (the old code could make two).
SELECT 'one_chosen_per_rfq',
       NOT EXISTS (
         SELECT 1 FROM public.supplier_quotations
          WHERE status = 'chosen'
          GROUP BY workspace_id, rfq_id
         HAVING count(*) > 1
       );
