-- ============================================================================
-- Hisabche Migration Verification: Offering Type (docs/offering-type-01-migration.sql)
-- File: docs/VERIFY-offering-type-01.sql
--
-- PENDING HUMAN CONFIRMATION — run this query after running the migration.
-- Every check must return 0 unexpected rows.
-- ============================================================================

-- 1. Verify column exists and is NOT NULL with default 'goods'
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
  AND column_name = 'offering_type';

-- 2. Verify check constraint is present and valid
SELECT
  conname,
  convalidated,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'chk_products_offering_type';

-- 3. Verify no existing product has an invalid offering_type
SELECT COUNT(*) AS invalid_offering_count
FROM public.products
WHERE offering_type NOT IN ('goods', 'service', 'package');
