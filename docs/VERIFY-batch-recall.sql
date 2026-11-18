-- docs/VERIFY-batch-recall.sql — every row in the first block must say ok = true.
-- Read-only. Run AFTER docs/batch-recall-migration.sql.

-- ─── Structure ──────────────────────────────────────────────────────────────
SELECT 'stock_batches.recalled_at exists' AS check_name,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'stock_batches'
                  AND column_name = 'recalled_at') AS ok
UNION ALL
SELECT 'stock_batches.recalled_reason exists',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'stock_batches'
                  AND column_name = 'recalled_reason')
UNION ALL
SELECT 'stock_batches.recalled_by exists',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'stock_batches'
                  AND column_name = 'recalled_by')
UNION ALL
SELECT 'recall CHECK present and validated',
       EXISTS (SELECT 1 FROM pg_constraint
                WHERE conname = 'stock_batches_recall_complete'
                  AND conrelid = 'public.stock_batches'::regclass
                  AND convalidated)
UNION ALL
SELECT 'recall index present',
       EXISTS (SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public'
                  AND indexname = 'stock_batches_recalled_idx');

-- ─── The rules that matter ──────────────────────────────────────────────────
-- Every row must be 0: a block always carries a reason, and a reason never
-- exists without a block.
SELECT 'rows blocked without a reason' AS check_name, COUNT(*) AS bad_rows
  FROM public.stock_batches
 WHERE recalled_at IS NOT NULL
   AND (recalled_reason IS NULL OR length(btrim(recalled_reason)) = 0)
UNION ALL
SELECT 'rows carrying a reason without a block',
       COUNT(*)
  FROM public.stock_batches
 WHERE recalled_at IS NULL
   AND recalled_reason IS NOT NULL;

-- ─── What the shop is holding back, reported not judged ─────────────────────
SELECT 'batches currently recalled' AS report_name,
       COUNT(*) AS recalled_batches,
       COALESCE(SUM(remaining_qty), 0) AS recalled_quantity
  FROM public.stock_batches
 WHERE recalled_at IS NOT NULL;
