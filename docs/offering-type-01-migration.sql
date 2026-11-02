-- ============================================================================
-- Hisabche Migration: Offering Type Polymorphism (Goods vs Services vs Packages)
-- File: docs/offering-type-01-migration.sql
--
-- RUN ORDER: Run after standard products schema migrations.
-- PENDING HUMAN CONFIRMATION — run docs/VERIFY-offering-type-01.sql after it.
--
-- WHAT IT ADDS (strictly additive, zero breaking changes to existing data):
--   products.offering_type  text NOT NULL DEFAULT 'goods'
--   CHECK constraint        offering_type IN ('goods', 'service', 'package')
--
-- INVARIANTS:
--   1. Existing products default to 'goods' and retain 100% legacy behavior.
--   2. Services and packages do not generate stock movements or consume cost layers.
--   3. All platforms (Web, Desktop, Android) share this discriminator.
--
-- ROLLBACK:
--   ALTER TABLE public.products DROP CONSTRAINT IF EXISTS chk_products_offering_type;
--   ALTER TABLE public.products DROP COLUMN IF EXISTS offering_type;
-- ============================================================================

DO $$
BEGIN
  -- 1. Add column if it does not already exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'offering_type'
  ) THEN
    ALTER TABLE public.products
      ADD COLUMN offering_type text NOT NULL DEFAULT 'goods';
  END IF;

  -- 2. Add check constraint (NOT VALID then VALIDATE per migration guidelines)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_offering_type'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_offering_type
      CHECK (offering_type IN ('goods', 'service', 'package'))
      NOT VALID;

    ALTER TABLE public.products
      VALIDATE CONSTRAINT chk_products_offering_type;
  END IF;
END $$;
