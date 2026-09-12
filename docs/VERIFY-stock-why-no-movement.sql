-- ============================================================================
-- VERIFICATION ONLY — READ-ONLY. Nothing here changes data or schema.
--
-- WHAT THE FIRST RESULT ESTABLISHED
--
-- `stock_movements` holds ONE row: an `opening` written by the Phase C
-- backfill. No sale movement has ever been written. So the projection trigger
-- is NOT the cause — there is nothing for it to project. The sale never
-- records that the goods left.
--
-- `batchUpdateStock()` can decline to write a movement in three ways, and all
-- three are SILENT — no error, no log, the invoice saves normally:
--
--   A. the line carries no `product_id`      → `productIds.length === 0`, returns early
--   B. the product is not visible in the invoice's workspace
--                                            → `productMap` is empty, `movements` is []
--   C. the invoice is held for approval      → `if (!isHeld)` skips it on purpose
--
-- These four queries separate them. Run them and send the output.
-- ============================================================================


-- ─── 1. Do the invoice lines carry a product id? ───────────────────────────
-- This is explanation A.
--
-- EXPECTED: `product_id` filled on lines that came from the warehouse picker.
-- NULL     = the line was saved as free text. The picker did not link the
--            product, and no stock can move because nothing says which product.

SELECT  i.invoice_number,
        i.type          AS invoice_type,
        i.status,
        i.date,
        ii.product_name,
        ii.product_id,
        ii.quantity,
        ii.unit
FROM    invoices i
JOIN    invoice_items ii ON ii.invoice_id = i.id
ORDER BY i.created_at DESC
LIMIT 30;


-- ─── 2. Are the products in the same workspace as the invoice? ─────────────
-- This is explanation B, and it is the most likely one if query 1 shows ids.
--
-- `batchUpdateStock` loads products with `.eq('workspace_id', workspaceId)`.
-- A product whose `workspace_id` is NULL — or is a different workspace — never
-- enters the map, so no movement is built for it and NOTHING IS REPORTED.
--
-- EXPECTED: `same_workspace` = true on every row.
-- false or NULL = the cause.

SELECT  p.id,
        p.name,
        p.workspace_id                        AS product_workspace,
        i.workspace_id                        AS invoice_workspace,
        (p.workspace_id IS NOT DISTINCT FROM i.workspace_id) AS same_workspace,
        p.quantity                            AS stored_quantity
FROM    invoice_items ii
JOIN    invoices i ON i.id = ii.invoice_id
JOIN    products p ON p.id = ii.product_id
ORDER BY i.created_at DESC
LIMIT 30;


-- ─── 2b. How many products have no workspace at all? ───────────────────────
-- A blunt version of the same question, across the whole table.
-- Any row here is invisible to every workspace-scoped read.

SELECT  COUNT(*) FILTER (WHERE workspace_id IS NULL) AS products_without_workspace,
        COUNT(*)                                     AS products_total
FROM    products;


-- ─── 3. Is the invoice being held for approval? ────────────────────────────
-- This is explanation C — and it would be CORRECT behaviour, not a bug:
-- goods must not move while a document is waiting for a decision.
--
-- Any row here means those invoices are waiting, and their stock moves when
-- they are approved.

SELECT  wi.id,
        wi.entity_type,
        wi.entity_id,
        wi.status,
        wi.created_at
FROM    workflow_instances wi
WHERE   wi.entity_type = 'invoice'
ORDER BY wi.created_at DESC
LIMIT 20;
