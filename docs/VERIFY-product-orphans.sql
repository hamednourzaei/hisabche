-- docs/VERIFY-product-orphans.sql
-- READ-ONLY. BUG-001 — has a product with sales or stock history ever been deleted?
-- invoice_items.product_id and stock_movements.product_id have no foreign key,
-- so a deleted product leaves rows pointing at nothing. Expect 0 in both.
SELECT 'invoice_items pointing at a missing product' AS check,
       count(*) AS orphans
FROM public.invoice_items ii
WHERE ii.product_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = ii.product_id)
UNION ALL
SELECT 'stock_movements pointing at a missing product',
       count(*)
FROM public.stock_movements sm
WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = sm.product_id);
