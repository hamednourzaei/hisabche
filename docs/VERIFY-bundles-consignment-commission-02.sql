-- ============================================================================
-- docs/VERIFY-bundles-consignment-commission-02.sql — read-only. Run after
-- bundles-consignment-commission-02-migration.sql; every row should say ok = true.
-- ============================================================================

SELECT 'function_exists' AS check_name,
       to_regprocedure('public.product_bundle_set_items(uuid, uuid, jsonb)') IS NOT NULL AS ok
UNION ALL
SELECT 'clients_cannot_execute',
       NOT has_function_privilege('anon', 'public.product_bundle_set_items(uuid, uuid, jsonb)', 'EXECUTE')
   AND NOT has_function_privilege('authenticated', 'public.product_bundle_set_items(uuid, uuid, jsonb)', 'EXECUTE')
UNION ALL
SELECT 'service_role_can_execute',
       has_function_privilege('service_role', 'public.product_bundle_set_items(uuid, uuid, jsonb)', 'EXECUTE')
UNION ALL
-- Every component belongs to the same business as its bundle (the old code
-- never checked; a false here lists rows to look at, it deletes nothing).
SELECT 'components_same_workspace',
       NOT EXISTS (
         SELECT 1 FROM public.bundle_items b
           JOIN public.products p ON p.id = b.component_product_id
          WHERE p.workspace_id IS DISTINCT FROM b.workspace_id
       )
UNION ALL
-- A product marked «bundle» with no components is what the old partial save left.
SELECT 'no_empty_bundles',
       NOT EXISTS (
         SELECT 1 FROM public.products p
          WHERE p.kind = 'bundle'
            AND NOT EXISTS (SELECT 1 FROM public.bundle_items b WHERE b.bundle_product_id = p.id)
       );
