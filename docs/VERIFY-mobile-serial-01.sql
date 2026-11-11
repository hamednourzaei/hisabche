-- ============================================
-- docs/VERIFY-mobile-serial-01.sql
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================

SELECT
  EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'stock_serials'
       AND column_name = 'reserved_until'
  ) AS has_reserved_until_column,
  EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'stock_serials_reserved_expiry_only_when_reserved'
       AND convalidated = true
  ) AS has_valid_expiry_constraint,
  EXISTS (
    SELECT 1
      FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'stock_serials'
       AND indexname = 'stock_serials_hold_expiry_idx'
  ) AS has_hold_expiry_index,
  EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'serial_hold_with_expiry'
       AND COALESCE(array_to_string(p.proconfig, ','), '') LIKE '%search_path=public, pg_temp%'
  ) AS has_serial_hold_with_expiry_fn,
  EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'serial_release_expired_holds'
       AND COALESCE(array_to_string(p.proconfig, ','), '') LIKE '%search_path=public, pg_temp%'
  ) AS has_serial_release_expired_fn;
