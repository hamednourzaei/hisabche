-- docs/VERIFY-purchase-variant-binding-01.sql — every row must say ok = true.
SELECT 'purchase_order_items.variant_id exists' AS check_name,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'purchase_order_items'
                  AND column_name = 'variant_id') AS ok
UNION ALL
SELECT 'variant FK present',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_items_variant_fk')
UNION ALL
SELECT 'variant FK validated',
       NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'purchase_order_items_variant_fk' AND NOT convalidated)
UNION ALL
SELECT 'variant index present',
       EXISTS (SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public'
                  AND indexname = 'purchase_order_items_variant_idx')
UNION ALL
SELECT 'no line names a variant of another product (orphan identity)',
       NOT EXISTS (
         SELECT 1 FROM public.purchase_order_items poi
           JOIN public.product_variants pv ON pv.id = poi.variant_id
          WHERE pv.template_product_id IS DISTINCT FROM poi.product_id
       )
UNION ALL
SELECT 'no line names a variant of another workspace',
       NOT EXISTS (
         -- purchase_order_items has no workspace_id: the line's workspace is its order's.
         SELECT 1 FROM public.purchase_order_items poi
           JOIN public.purchase_orders po ON po.id = poi.purchase_order_id
           JOIN public.product_variants pv ON pv.id = poi.variant_id
          WHERE pv.workspace_id IS DISTINCT FROM po.workspace_id
       );

-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
