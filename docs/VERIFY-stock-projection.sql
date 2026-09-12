-- ============================================================================
-- VERIFICATION ONLY — READ-ONLY. Nothing here changes data or schema.
--
-- WHY: /fa/invoices/new records a sale, but the warehouse quantity does not go
-- down. The application NO LONGER writes `products.quantity` at all (Phase C):
-- it inserts a row into `stock_movements`, and a DATABASE TRIGGER
-- (`stock_movements_project_trg`) is what maintains `products.quantity` and
-- `warehouse_stock.quantity` from those rows.
--
-- If that trigger was never applied to this database, the symptom is EXACTLY
-- what was reported: the movement rows pile up correctly and no quantity ever
-- changes. Nothing errors, because nothing is wrong from the application's
-- point of view — it did its half.
--
-- Run these four queries in the Supabase SQL editor and send back the output.
-- ============================================================================


-- ─── 1. Does the projection trigger exist at all? ───────────────────────────
-- EXPECTED: exactly one row, tgenabled = 'O' (enabled, origin).
-- NO ROWS  = the cause. docs/phase-c-01-inventory-source-of-truth-migration.sql
--            has not been applied to this database.

SELECT  t.tgname                                   AS trigger_name,
        t.tgenabled                                AS enabled_flag,
        p.proname                                  AS function_name
FROM    pg_trigger t
JOIN    pg_proc    p ON p.oid = t.tgfoid
WHERE   t.tgrelid = 'public.stock_movements'::regclass
  AND   NOT t.tgisinternal;


-- ─── 2. Are movements actually being written? ──────────────────────────────
-- EXPECTED: recent rows for the sales that were just made.
-- NO ROWS  = a different problem — the application is not recording the sale,
--            and the trigger is not the cause.

SELECT  sm.created_at,
        sm.type,
        sm.quantity,
        sm.reference_type,
        sm.reference_id,
        sm.from_warehouse_id,
        sm.to_warehouse_id,
        p.name  AS product_name
FROM    stock_movements sm
LEFT JOIN products p ON p.id = sm.product_id
ORDER BY sm.created_at DESC
LIMIT 20;


-- ─── 3. Does the stored quantity agree with the movements? ─────────────────
-- This is the real test. `projected` is what the movements say the quantity
-- SHOULD be; `stored` is what `products.quantity` actually holds.
--
-- EXPECTED: `drift` = 0 on every row.
-- drift <> 0 = the projection is not running (or stopped running at some point),
--              and the size of the drift is the amount that was sold while it
--              was not running.
--
-- ⚠️ DO NOT "FIX" THE DRIFT BY UPDATING products.quantity. Read §13 first:
-- report the numbers, then decide. A blind UPDATE would destroy the evidence
-- of how far back the problem goes.

SELECT  p.id,
        p.name,
        COALESCE(p.quantity, 0)                    AS stored,
        COALESCE(SUM(sm.quantity), 0)              AS projected,
        COALESCE(p.quantity, 0)
          - COALESCE(SUM(sm.quantity), 0)          AS drift
FROM    products p
LEFT JOIN stock_movements sm
       ON sm.product_id = p.id
      AND (sm.from_warehouse_id IS NULL OR sm.to_warehouse_id IS NULL)  -- exclude transfers
GROUP BY p.id, p.name, p.quantity
HAVING  COALESCE(p.quantity, 0) - COALESCE(SUM(sm.quantity), 0) <> 0
ORDER BY ABS(COALESCE(p.quantity, 0) - COALESCE(SUM(sm.quantity), 0)) DESC
LIMIT 50;


-- ─── 4. How many warehouses does this workspace have? ──────────────────────
-- Decides whether a sale can be attributed to a warehouse at all.
--
--   1 warehouse  → sales now name it, and `warehouse_stock` will follow.
--   0 or several → the movement stays unattributed ON PURPOSE. Nothing on an
--                  invoice line says which building the goods left, and
--                  picking one would move stock in a warehouse the goods were
--                  never in. `products.quantity` still moves correctly.

SELECT  workspace_id,
        COUNT(*) AS warehouse_count
FROM    warehouses
GROUP BY workspace_id
ORDER BY warehouse_count DESC;
