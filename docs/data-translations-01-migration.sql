-- ============================================================================
-- docs/data-translations-01-migration.sql
--
-- V61 B.2.21 — Data-level translations (`translations jsonb` `{ fa, af, en }`)
--
-- Additive, idempotent. Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_products_translations_gin
  ON public.products USING gin (translations);

DO $$
BEGIN
  IF to_regclass('public.units') IS NOT NULL THEN
    ALTER TABLE public.units
      ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
  IF to_regclass('public.categories') IS NOT NULL THEN
    ALTER TABLE public.categories
      ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
  IF to_regclass('public.service_catalog') IS NOT NULL THEN
    ALTER TABLE public.service_catalog
      ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Rollback (manual reference):
-- ALTER TABLE public.products DROP COLUMN IF EXISTS translations;
