-- ============================================================================
-- READ-ONLY. One question: do the invoice lines name a product?
--
-- ESTABLISHED SO FAR
--   * `stock_movements` holds ONE row — the Phase C opening. No sale movement
--     has ever been written, so the projection trigger is not the cause.
--   * `products_without_workspace = 0` — so the workspace-scoping path in
--     `batchUpdateStock` is not the cause either.
--   * The code path in the repository is complete end to end: the picker sends
--     `id`, the store keeps `productId`, the route maps
--     `item.productId ?? item.product_id`, and the service builds a movement
--     for every line whose product it can see.
--
-- `batchUpdateStock` returns early and SILENTLY when no line carries a
-- product id. This query is the last thing that can distinguish:
--
--   product_id filled  → the lines are fine, and the deployed build on
--                        hisabche.com is older than this code.
--   product_id NULL    → the line was saved as free text: the pick never
--                        linked the product, and no stock can move because
--                        nothing says which product moved.
-- ============================================================================

SELECT  i.invoice_number,
        i.type        AS invoice_type,
        i.status,
        i.created_at,
        ii.product_name,
        ii.product_id,            -- ← THE ANSWER IS THIS COLUMN
        ii.quantity,
        ii.unit
FROM    invoices i
JOIN    invoice_items ii ON ii.invoice_id = i.id
ORDER BY i.created_at DESC
LIMIT 20;
