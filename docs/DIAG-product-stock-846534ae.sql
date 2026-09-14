-- docs/DIAG-product-stock-846534ae.sql
-- READ-ONLY. Why does product 846534ae-… still show a negative stock after a refill of 99?
-- Run the whole file; each SELECT answers one question. Send all outputs.

-- 1) What the product row holds, and what its movements add up to
SELECT p.id, p.name, p.quantity AS stored_quantity,
       COALESCE((SELECT SUM(CASE WHEN m.from_warehouse_id IS NOT NULL AND m.to_warehouse_id IS NOT NULL
                                 THEN 0 ELSE m.quantity END)
                   FROM public.stock_movements m WHERE m.product_id = p.id), 0) AS movements_total,
       p.updated_at
FROM public.products p
WHERE p.id = '846534ae-ad1a-484c-ad79-d487fe78f955';

-- 2) The last 30 movements (newest first): was the +99 recorded, and when?
SELECT m.created_at, m.type, m.quantity, m.reference_type, m.reference_id, m.notes
FROM public.stock_movements m
WHERE m.product_id = '846534ae-ad1a-484c-ad79-d487fe78f955'
ORDER BY m.created_at DESC
LIMIT 30;

-- 3) Per-warehouse stock
SELECT ws.warehouse_id, ws.quantity, ws.updated_at
FROM public.warehouse_stock ws
WHERE ws.product_id = '846534ae-ad1a-484c-ad79-d487fe78f955';

-- 4) Is the projection trigger installed?
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'stock_movements_project_trg';
