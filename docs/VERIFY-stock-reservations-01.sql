-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY-stock-reservations-01.sql
-- Companion verification for docs/stock-reservations-01-migration.sql
-- Run AFTER the migration, by a person. Read-only.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. The table exists with the terminal-state rule.
SELECT conname
  FROM pg_constraint
 WHERE conrelid = 'public.stock_reservations'::regclass
   AND conname IN (
     'stock_reservations_quantity_positive',
     'stock_reservations_status',
     'stock_reservations_state_terminal'
   );
-- EXPECT: exactly 3 rows.

-- 2. The idempotency unique index is partial and present.
SELECT indexname FROM pg_indexes
 WHERE tablename = 'stock_reservations'
   AND indexname = 'stock_reservations_idempotency';
-- EXPECT: 1 row.

-- 3. The four functions exist.
SELECT proname FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname IN (
     'stock_available',
     'stock_reserve',
     'stock_release_reservation',
     'stock_settle_reservation'
   );
-- EXPECT: exactly 4 rows.

-- 4. No reservation breaches its stock: every active hold must fit inside
--    on-hand minus the OTHER active holds of the same product+warehouse.
--    (An aggregate over the whole table — cheap enough for a one-off check.)
WITH per_cell AS (
  SELECT workspace_id, warehouse_id, product_id,
         SUM(quantity) AS held
    FROM public.stock_reservations
   WHERE status = 'active'
   GROUP BY 1, 2, 3
)
SELECT c.workspace_id, c.warehouse_id, c.product_id, c.held, w.quantity AS on_hand
  FROM per_cell c
  JOIN public.warehouse_stock w
    ON w.workspace_id = c.workspace_id
   AND w.warehouse_id = c.warehouse_id
   AND w.product_id = c.product_id
 WHERE c.held > w.quantity;
-- EXPECT: 0 rows (empty = every hold is covered by real stock).

-- 5. No active reservation belongs to a warehouse outside its workspace.
SELECT r.id
  FROM public.stock_reservations r
  LEFT JOIN public.warehouses w ON w.id = r.warehouse_id
 WHERE w.id IS NULL OR w.workspace_id IS DISTINCT FROM r.workspace_id;
-- EXPECT: 0 rows.

-- RLS on and the public keys locked out (expect ok = true).
SELECT 'rls_and_public_locked' AS check_name,
       bool_and(c.relrowsecurity)
       AND NOT bool_or(has_table_privilege('anon', c.oid, 'SELECT'))
       AND NOT bool_or(has_table_privilege('authenticated', c.oid, 'SELECT')) AS ok
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('stock_reservations');
