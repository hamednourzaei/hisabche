-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY-storage-bin-transfer-01.sql
-- Companion verification for docs/storage-bin-transfer-01-migration.sql
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. The function exists.
SELECT proname FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname = 'storage_move_stock';
-- EXPECT: 1 row.

-- 2. CONSERVATION — the sum of a product's placements can never EXCEED what
--    its warehouse holds. (Placements may cover less than the whole stock —
--    a bin map records where part of the stock sits — but never more.)
SELECT p.workspace_id, p.product_id, SUM(p.quantity) AS placed, w.quantity AS on_hand
  FROM public.storage_location_placements p
  JOIN public.warehouse_stock w
    ON w.workspace_id = p.workspace_id
   AND w.warehouse_id = (
         SELECT l.warehouse_id FROM public.storage_locations l WHERE l.id = p.location_id
       )
   AND w.product_id = p.product_id
 GROUP BY p.workspace_id, p.product_id, w.quantity
HAVING SUM(p.quantity) > w.quantity;
-- EXPECT: 0 rows.

-- 3. No placement points outside its workspace's warehouses.
SELECT pl.id
  FROM public.storage_location_placements pl
  JOIN public.storage_locations l ON l.id = pl.location_id
 WHERE l.workspace_id IS DISTINCT FROM pl.workspace_id;
-- EXPECT: 0 rows.

-- 4. No negative placement survived any path.
SELECT id FROM public.storage_location_placements WHERE quantity < 0;
-- EXPECT: 0 rows.
