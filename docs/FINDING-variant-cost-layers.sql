-- ============================================================================
-- docs/FINDING-variant-cost-layers.sql — READ-ONLY (SELECT only).
--
-- Decision D5 (NEEDS_OWNER_DECISION): cost layers are product-keyed today
-- (`cost_layers.product_id`, docs/inventory-costing-migration.sql). Before any
-- variant-keyed costing is designed, this measures how many products would be
-- affected: a product with several active variants whose units sit in ONE pool of
-- layers values every size/colour at the same cost.
--
-- Run each block separately (the SQL editor shows only the last result).
-- ============================================================================

-- 1. Products with more than one active variant, per workspace.
SELECT p.workspace_id,
       COUNT(*) AS products_with_many_variants
  FROM public.products p
  JOIN (SELECT product_id, COUNT(*) AS n
          FROM public.product_variants
         WHERE is_active
         GROUP BY product_id
        HAVING COUNT(*) > 1) v ON v.product_id = p.id
 GROUP BY p.workspace_id
 ORDER BY products_with_many_variants DESC;

-- 2. Of those, how many hold open cost layers (the ones D5 would change).
SELECT cl.workspace_id,
       COUNT(DISTINCT cl.product_id) AS multi_variant_products_with_open_layers,
       COUNT(*)                      AS open_layers
  FROM public.cost_layers cl
  JOIN (SELECT product_id
          FROM public.product_variants
         WHERE is_active
         GROUP BY product_id
        HAVING COUNT(*) > 1) v ON v.product_id = cl.product_id
 WHERE cl.remaining_qty > 0
 GROUP BY cl.workspace_id
 ORDER BY open_layers DESC;
