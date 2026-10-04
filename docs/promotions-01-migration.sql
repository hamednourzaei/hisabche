-- ============================================================================
-- PROMOTIONS — 01 (capabilities #114–#117). Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-promotions-01.sql.
--
-- A promotion is a rule that lowers the SUGGESTED unit price of a sale line
-- when a product is picked on an invoice: a percentage, or a fixed amount in a
-- named currency; for every product or some; for every customer or some; always
-- or between two days.
--
-- It changes no invoice already written, posts nothing to the ledger, and is
-- never deleted: retiring one sets is_active = false, so the price on an old
-- invoice can still be explained.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.promotions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name         text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  kind         text NOT NULL CHECK (kind IN ('percentage', 'fixed_amount')),
  value        numeric NOT NULL CHECK (value > 0),
  -- The currency of a fixed amount. NULL for a percentage.
  currency     text,
  stacking     text NOT NULL DEFAULT 'exclusive' CHECK (stacking IN ('exclusive', 'stacking')),
  -- NULL = every product / every customer. An empty array would cover nothing
  -- and is refused.
  product_ids  uuid[],
  customer_ids uuid[],
  valid_from   date,
  valid_to     date,
  is_active    boolean NOT NULL DEFAULT true,
  created_by   uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT promotions_percent_in_range
    CHECK (kind <> 'percentage' OR value <= 100),
  -- `currency IS NOT NULL` is spelled out: a CHECK passes on NULL, so a pattern
  -- match alone would accept a fixed amount with no currency.
  CONSTRAINT promotions_fixed_has_currency
    CHECK (kind <> 'fixed_amount' OR (currency IS NOT NULL AND currency ~ '^[A-Z]{3}$')),
  CONSTRAINT promotions_window_in_order
    CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to),
  CONSTRAINT promotions_products_not_empty
    CHECK (product_ids IS NULL OR cardinality(product_ids) > 0),
  CONSTRAINT promotions_customers_not_empty
    CHECK (customer_ids IS NULL OR cardinality(customer_ids) > 0)
);

COMMENT ON TABLE public.promotions IS
  'Rules that lower the suggested unit price of a sale line. Retired with is_active = false, never deleted.';

CREATE INDEX IF NOT EXISTS promotions_workspace_active_idx
  ON public.promotions (workspace_id, is_active);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promotions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.promotions TO service_role;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Removes every promotion. Invoices keep the prices they were written with.
--
--   DROP TABLE IF EXISTS public.promotions;
