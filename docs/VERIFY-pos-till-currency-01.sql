-- ============================================================================
-- docs/VERIFY-pos-till-currency-01.sql
--
-- Verification query for pos-till-currency-01-migration.sql.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================================================

SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pos_sessions'
      AND column_name = 'currency'
  ) AS currency_column_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pos_sessions'
      AND column_name = 'currency'
      AND is_nullable = 'YES'
  ) AS currency_is_nullable,
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pos_sessions_currency_check'
      AND conrelid = 'public.pos_sessions'::regclass
  ) AS currency_check_exists,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'pos_sessions'
      AND indexname = 'pos_sessions_one_open'
      AND indexdef LIKE '%currency%'
  ) AS currency_index_updated,
  (
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'pos_sessions'
        AND column_name = 'currency'
        AND is_nullable = 'YES'
    ) AND
    EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'pos_sessions_currency_check'
        AND conrelid = 'public.pos_sessions'::regclass
    ) AND
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'pos_sessions'
        AND indexname = 'pos_sessions_one_open'
        AND indexdef LIKE '%currency%'
    )
  ) AS ok;
