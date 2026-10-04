-- ============================================================================
-- PRICE LISTS — 01 (capability #19). Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-price-lists-01.sql.
--
-- A price list is a named set of prices for some products, in ONE currency,
-- optionally between two days. A customer can be given one list.
--
-- How a price is chosen when a product is picked on a SALE invoice — one rule,
-- implemented once (packages/validation/src/schemas/pricing.ts):
--
--   1. the customer's price list, if it is active, in date, in the invoice's
--      currency, and has that product;
--   2. otherwise the product's own sell price;
--   then the live promotions apply on top.
--
-- A price list changes no invoice already written: an invoice line keeps the
-- unit price it was issued with.
--
-- Prices are integers: HUNDREDTHS of the list's currency unit — the unit the
-- shared price engine and the invoice lines already count in. Lists and their
-- items are retired (is_active = false), never deleted.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.price_lists (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name         text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  currency     text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  valid_from   date,
  valid_to     date,
  is_active    boolean NOT NULL DEFAULT true,
  created_by   uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT price_lists_window_in_order
    CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
);

COMMENT ON TABLE public.price_lists IS
  'A named set of product prices in one currency. Retired with is_active = false.';

-- One ACTIVE list per name: two «عمده» in a picker cannot be told apart.
CREATE UNIQUE INDEX IF NOT EXISTS price_lists_active_name
  ON public.price_lists (workspace_id, lower(btrim(name)))
  WHERE is_active;

CREATE TABLE IF NOT EXISTS public.price_list_items (
  price_list_id    uuid NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  workspace_id     uuid NOT NULL,
  product_id       uuid NOT NULL,
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor > 0),
  is_active        boolean NOT NULL DEFAULT true,
  updated_by       uuid NOT NULL,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- One price per product per list.
  PRIMARY KEY (price_list_id, product_id)
);

COMMENT ON TABLE public.price_list_items IS
  'The price of one product on one price list, in the list''s currency (hundredths of the unit).';

CREATE INDEX IF NOT EXISTS price_list_items_workspace_idx
  ON public.price_list_items (workspace_id, price_list_id);

-- Which list a customer buys on. NULL = none: the product's own price applies.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS price_list_id uuid;

ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_list_items ENABLE ROW LEVEL SECURITY;

-- On Supabase a new table arrives with ALL privileges already granted to the
-- three API roles; every one is revoked before the backend is granted back.
REVOKE ALL ON public.price_lists FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.price_list_items FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.price_lists TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.price_list_items TO service_role;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Removes the lists and which customer was on which. Invoices keep the prices
-- they were issued with.
--
--   ALTER TABLE public.customers DROP COLUMN IF EXISTS price_list_id;
--   DROP TABLE IF EXISTS public.price_list_items;
--   DROP TABLE IF EXISTS public.price_lists;
