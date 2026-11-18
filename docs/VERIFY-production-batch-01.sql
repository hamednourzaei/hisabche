-- ============================================
-- docs/VERIFY-production-batch-01.sql
--
-- Read-only. Run AFTER docs/manufacturing-01-migration.sql and
-- docs/production-batch-01-migration.sql. Every row must say OK.
--
-- Nothing here writes. If a check fails, the site is fixed with the migration,
-- never by editing the data by hand.
-- ============================================

-- 1. The four columns exist, with the defaults the function relies on.
SELECT
  'columns' AS check,
  count(*) FILTER (WHERE column_name = 'scrap_quantity' AND data_type = 'numeric' AND is_nullable = 'NO') AS scrap_ok,
  count(*) FILTER (WHERE column_name = 'rework_quantity' AND data_type = 'numeric' AND is_nullable = 'NO') AS rework_ok,
  count(*) FILTER (WHERE column_name = 'good_quantity' AND data_type = 'numeric') AS good_ok,
  count(*) FILTER (WHERE column_name = 'yield_percent' AND data_type = 'numeric') AS yield_ok
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'work_orders';

-- 2. The invariant is present AND validated (NOT VALID would let bad rows in).
SELECT
  'constraint' AS check,
  conname AS name,
  convalidated AS validated
FROM pg_constraint
WHERE conrelid = 'public.work_orders'::regclass
  AND conname = 'work_orders_output_adds_up';

-- 3. Every completed run adds up: good = quantity − scrap − rework.
SELECT
  'completed runs add up' AS check,
  count(*) FILTER (
    WHERE good_quantity IS DISTINCT FROM quantity - scrap_quantity - rework_quantity
  ) AS broken,
  count(*) AS completed
FROM public.work_orders
WHERE status = 'completed';

-- 4. No negative loss, and no more loss than was started.
SELECT
  'losses are sane' AS check,
  count(*) FILTER (WHERE scrap_quantity < 0 OR rework_quantity < 0) AS negative,
  count(*) FILTER (WHERE scrap_quantity + rework_quantity > quantity) AS more_than_started
FROM public.work_orders;

-- 5. The yield stored on completion matches the three figures.
SELECT
  'yield matches' AS check,
  count(*) FILTER (
    WHERE yield_percent IS NOT NULL
      AND quantity > 0
      AND abs(yield_percent - round(good_quantity / quantity * 100, 4)) > 0.0001
  ) AS mismatched
FROM public.work_orders
WHERE status = 'completed';

-- 6. The function on the database is the one that knows the good quantity.
SELECT
  'function replaced' AS check,
  (position('good_quantity' IN pg_get_functiondef(p.oid)) > 0) AS knows_good_quantity,
  (position('MANUFACTURING_GOOD_QUANTITY_REQUIRED' IN pg_get_functiondef(p.oid)) > 0) AS refuses_zero_good
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'manufacturing_complete';

-- 6b. The report divides the run's cost by the SELLABLE units too, so the
--     report and the history cannot show two different unit costs.
SELECT
  'report replaced' AS check,
  (position('good_quantity' IN pg_get_functiondef(p.oid)) > 0) AS divides_by_good_quantity
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'manufacturing_report';

-- 7. Legacy completed runs carry their output (backfilled from what was received).
SELECT
  'legacy backfilled' AS check,
  count(*) FILTER (WHERE good_quantity IS NULL) AS missing,
  count(*) AS completed
FROM public.work_orders
WHERE status = 'completed';
