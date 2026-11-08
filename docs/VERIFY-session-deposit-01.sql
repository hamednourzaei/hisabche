-- ============================================================================
-- docs/VERIFY-session-deposit-01.sql — run AFTER session-deposit-01. Read-only.
-- One row, every check in it.
-- ============================================================================
SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'order_deposits'
       AND column_name = 'source_type' AND is_nullable = 'NO'
  ) AS column_exists_not_null,
  EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_deposits_source_type_known'
  ) AS check_exists,
  (SELECT count(*) FROM public.order_deposits
    WHERE source_type NOT IN ('sales_order', 'service_session')) = 0 AS no_unknown_source,
  (
    EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'order_deposits'
               AND column_name = 'source_type' AND is_nullable = 'NO')
    AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_deposits_source_type_known')
  ) AS ok;
