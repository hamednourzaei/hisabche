-- ============================================================================
-- docs/purchase-variant-binding-01-migration.sql             (V55 P2, 11 Nov 2026)
--
-- A purchase line may name the VARIANT it buys.
--
-- WHY
--   An invoice line has named its variant since variant-binding-01, and a stock
--   movement has carried `variant_id` since variant-stock-01 — but a purchase
--   line could not: receiving a purchase order arrived as «N of the product»,
--   and nothing put the goods onto the variant they were bought for. A shop
--   that buys «T-shirt, black, L» had to re-assign the stock by hand.
--
-- MODEL (unchanged from variant-stock-01)
--   The cost layer stays keyed (workspace, product, warehouse) — a variant does
--   NOT get a second costing ledger. What this adds is IDENTITY on the arrival:
--   the receipt's stock movement names the variant, so `product_variant_stock`
--   sees the goods, exactly as an invoice sale names the variant that left.
--
-- HOW
--   1. purchase_order_items.variant_id  + FK (NOT VALID) + index
--   2. Nothing else. `purchase_order_write` inserts lines through
--      `document_write_rows`, which writes whatever keys the backend sends —
--      once the column exists, a line carrying `variant_id` lands in it, and a
--      line without one keeps `variant_id = NULL` (§12: old rows stay unknown).
--
-- SAFETY
--   Additive, idempotent, backward-compatible: every legacy line keeps
--   variant_id = NULL and is never re-validated or re-mapped. Deploy the
--   backend AFTER this file: before it, an order line that names a variant
--   fails the insert (unknown column) — the refusal is loud, not silent.
--
-- ROLLBACK (only while no line names a variant; afterwards the identity is lost):
--   DROP INDEX IF EXISTS public.purchase_order_items_variant_idx;
--   ALTER TABLE public.purchase_order_items DROP CONSTRAINT IF EXISTS purchase_order_items_variant_fk;
--   ALTER TABLE public.purchase_order_items DROP COLUMN IF EXISTS variant_id;
-- ============================================================================

ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS variant_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_items_variant_fk') THEN
    ALTER TABLE public.purchase_order_items
      ADD CONSTRAINT purchase_order_items_variant_fk
      FOREIGN KEY (variant_id) REFERENCES public.product_variants (id) NOT VALID;
  END IF;
END $$;

-- purchase_order_items has NO workspace_id (live FINDING, 8 Nov 2026); the workspace
-- comes through purchase_orders. The first version of this file indexed a column that
-- does not exist and failed on every database (found by journey-retail.pg.test.ts).
CREATE INDEX IF NOT EXISTS purchase_order_items_variant_idx
  ON public.purchase_order_items (product_id, variant_id)
  WHERE variant_id IS NOT NULL;

-- The column is new, so every existing row holds NULL and this cannot fail;
-- it closes the NOT VALID window the same run.
ALTER TABLE public.purchase_order_items
  VALIDATE CONSTRAINT purchase_order_items_variant_fk;

ANALYZE public.purchase_order_items;
