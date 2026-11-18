-- docs/VERIFY-variant-cost-layers.sql — every row must say ok = true.
-- Read-only. Run AFTER docs/variant-cost-layers-migration.sql.

-- ─── Structure ──────────────────────────────────────────────────────────────
SELECT 'cost_layers.variant_id exists' AS check_name,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'cost_layers'
                  AND column_name = 'variant_id') AS ok
UNION ALL
SELECT 'cost_consumptions.variant_id exists',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'cost_consumptions'
                  AND column_name = 'variant_id')
UNION ALL
SELECT 'cost_layers variant FK present',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cost_layers_variant_fk')
UNION ALL
SELECT 'cost_consumptions variant FK present',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cost_consumptions_variant_fk')
UNION ALL
SELECT 'variant FIFO index present',
       EXISTS (SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public' AND indexname = 'cost_layers_fifo_variant_idx');

-- ─── The rules that matter ──────────────────────────────────────────────────
-- Every row must be 0. Any row above 0 is a cost that crossed variants.
SELECT 'consumptions whose layer belongs to another variant' AS check_name,
       COUNT(*) AS bad_rows
  FROM public.cost_consumptions c
  JOIN public.cost_layers l ON l.id = c.layer_id
 WHERE c.variant_id IS DISTINCT FROM l.variant_id
UNION ALL
-- A layer assigned to a variant that is not a variant of its own product.
SELECT 'layers whose variant is not a variant of their product',
       COUNT(*)
  FROM public.cost_layers l
  JOIN public.product_variants v ON v.id = l.variant_id
 WHERE v.template_product_id <> l.product_id
    OR v.workspace_id <> l.workspace_id;

-- ─── The functions carry the variant ────────────────────────────────────────
SELECT 'inventory_receive_layer reads variant_id' AS check_name,
       position('variant_id' IN pg_get_functiondef(
         'public.inventory_receive_layer(uuid, uuid, jsonb)'::regprocedure)) > 0 AS ok
UNION ALL
SELECT 'inventory_consume_layers matches the variant strictly',
       position('variant_id IS NOT DISTINCT FROM v_variant' IN pg_get_functiondef(
         'public.inventory_consume_layers(uuid, uuid, jsonb)'::regprocedure)) > 0
UNION ALL
SELECT 'inventory_release_consumption keeps the variant',
       position('v_row.variant_id' IN pg_get_functiondef(
         'public.inventory_release_consumption(uuid, uuid, text, uuid)'::regprocedure)) > 0
UNION ALL
SELECT 'inventory_assign_layer_variant exists',
       EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'inventory_assign_layer_variant')
UNION ALL
SELECT 'inventory_assign_layer_variant closed to anon',
       NOT has_function_privilege(
         'anon', 'public.inventory_assign_layer_variant(uuid, uuid, uuid, uuid)', 'EXECUTE')
UNION ALL
SELECT 'inventory_consume_layers closed to anon',
       NOT has_function_privilege(
         'anon', 'public.inventory_consume_layers(uuid, uuid, jsonb)', 'EXECUTE');

-- ─── The backlog this decision creates ──────────────────────────────────────
-- Open, unassigned layers of products that HAVE variants. Under the strict rule
-- these units cannot be sold by a variant until a person assigns them.
-- This is a REPORT, not a failure: 0 is the goal, not a validity condition.
SELECT 'open unassigned layers on multi-variant products' AS report_name,
       COUNT(*) AS open_layers,
       COALESCE(SUM(l.remaining_qty), 0) AS open_quantity
  FROM public.cost_layers l
  JOIN public.products p ON p.id = l.product_id AND p.workspace_id = l.workspace_id
 WHERE l.remaining_qty > 0
   AND l.variant_id IS NULL
   AND EXISTS (
     SELECT 1 FROM public.product_variants v
      WHERE v.template_product_id = p.id
        AND v.workspace_id = p.workspace_id
        AND v.is_active
   );
