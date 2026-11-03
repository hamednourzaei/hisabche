-- ============================================
-- variant-binding-01 (V53 P2: legacy NULL)
--
-- A new invoice line can name the variant it sells or buys. Historical lines keep variant_id = NULL;
-- NOTHING is backfilled (a guessed variant would be a false statement about a real sale).
--
-- Additive and re-runnable. Depends on: universal-core-migration.sql (product_variants), invoice_items.
-- Run order: after the universal-core migration; independent of cycle-count-03.
-- Deploy the backend AFTER this migration if you want lines to carry variants; before it, a line that
-- names a variant is refused by the database (42703) rather than silently losing the variant.
--
-- ROLLBACK (only if no line has a variant yet; otherwise the identity is lost):
--   DROP INDEX IF EXISTS public.invoice_items_variant_idx;
--   ALTER TABLE public.invoice_items DROP CONSTRAINT IF EXISTS invoice_items_variant_fk;
--   ALTER TABLE public.invoice_items DROP COLUMN IF EXISTS variant_id;
-- ============================================

ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS variant_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_variant_fk'
  ) THEN
    -- NOT VALID: checked for every new line, never re-checked against history.
    ALTER TABLE public.invoice_items
      ADD CONSTRAINT invoice_items_variant_fk
      FOREIGN KEY (variant_id) REFERENCES public.product_variants (id) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS invoice_items_variant_idx
  ON public.invoice_items (variant_id) WHERE variant_id IS NOT NULL;
