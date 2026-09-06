-- ============================================================================
-- docs/phase-l-02-product-units-migration.sql
--
-- PHASE L · L1 — Multi-UOM: which units a product may be traded in.
--
-- Requires phase-l-01-units-migration.sql.
--
-- ---------------------------------------------------------------------------
-- ⚠️ READ THIS BEFORE ANYTHING ELSE — WHAT `unit` MEANS TODAY
--
-- Right now `products.unit` and `invoice_items.unit` are DECORATIVE. Nothing
-- converts by them:
--
--     batchUpdateStock() writes `quantity: direction * item.quantity`
--
-- So `products.quantity` is already expressed in the product's own unit, and a
-- line reading «5 kg» has already stored 5.
--
-- THIS MEANS A NAIVE MULTI-UOM ROLL-OUT CORRUPTS EVERY BUSINESS. If the code
-- started converting by `units.conversion_factor`, every historical kilogram
-- line would be re-read as 5 × 1000 = 5000 grams, and `stock_movements` — the
-- source of truth for quantity since Phase C — would be wrong for every
-- weighed product in the product's history.
--
-- ---------------------------------------------------------------------------
-- HOW THIS AVOIDS IT: `product_units` IS OPT-IN ENRICHMENT
--
-- A product with NO rows in this table behaves EXACTLY as it does today:
-- quantity is in the product's own unit, factor 1, nothing converts. That is
-- every existing product on the day this runs.
--
-- A product only gains multi-unit behaviour when somebody deliberately adds
-- rows saying «this product's base is the piece, and one carton is 24 of
-- them». Until then nothing about it changes.
--
-- ⚠️ NOTHING IS BACKFILLED. Seeding an identity row for every product would
-- look harmless and would be a guess about which unit each product's existing
-- quantity is really in — §12. Absence already means «factor 1», so the
-- backfill would add no information and could add a wrong one.
--
-- ---------------------------------------------------------------------------
-- THE CORE RULE (L1)
--
--   Stock movements are ALWAYS in the base unit.
--   Invoices and purchase orders MAY display another unit.
--
-- «1 carton = 24 pieces → entering 2 cartons stores 48 pieces». The conversion
-- happens in the DOMAIN (`unit-conversion.domain.ts`), never in the UI — a
-- conversion enforced only on screen is absent from the API, the importer, the
-- mobile app and every offline write.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK / MITIGATION
--
--   DROP TABLE IF EXISTS product_units;
--
-- Safe while the code still treats absence as factor 1 — which it does by
-- design. Dropping the table returns every product to single-unit behaviour
-- and loses only the declared conversions, not any quantity.
--
-- SAFE TO RE-RUN.
-- ============================================================================

-- ============================================================================
-- PRE-MIGRATION VERIFICATION — run first, keep the output.
-- ============================================================================
--
-- P1. `units` must exist first (phase-l-01).
--
--   SELECT COUNT(*) AS units FROM units;   -- must be > 0
--
-- P2. Does product_units already exist? (Expected: no rows.)
--
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name = 'product_units';
--
-- P3. ⚠️ HOW MANY PRODUCTS WOULD BE AFFECTED IF CONVERSION WERE RETROACTIVE.
--     This is the size of the damage a naive roll-out would do. Every one of
--     these has a non-trivial conversion factor and a non-zero quantity.
--
--   SELECT p.unit, COUNT(*) AS products, SUM(p.quantity) AS total_quantity
--   FROM   products p
--   JOIN   units u ON u.code = p.unit
--   WHERE  u.conversion_factor <> 1 AND p.quantity <> 0
--   GROUP  BY p.unit ORDER BY 2 DESC;
--
--   -- Whatever this returns, it stays untouched: nothing is backfilled and
--   -- absence means factor 1.
--
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS product_units (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             uuid NOT NULL,
  product_id               uuid NOT NULL,
  unit_id                  uuid NOT NULL REFERENCES units (id),

  /**
   * How many BASE units one of this unit is, FOR THIS PRODUCT.
   *
   * ⚠️ Deliberately NOT `units.conversion_factor`. That column converts within
   * a dimension (kg → g) and is the same for everyone. This one is
   * per-product and is the only place «a carton of this product holds 24» can
   * be true while a carton of something else holds 12.
   *
   * The base unit's own row carries 1.
   */
  conversion_factor_to_base numeric(18, 6) NOT NULL,

  /** Exactly one per product — enforced by a partial unique index below. */
  is_base_unit             boolean NOT NULL DEFAULT false,

  /** What a purchase order defaults to. At most one per product. */
  is_purchase_default      boolean NOT NULL DEFAULT false,

  /** What a sales invoice defaults to. At most one per product. */
  is_sale_default          boolean NOT NULL DEFAULT false,

  is_active                boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT product_units_factor_positive CHECK (conversion_factor_to_base > 0),

  -- The base unit converts to itself. A base row with any other factor would
  -- make «convert to base» a lossy operation on the base itself.
  CONSTRAINT product_units_base_factor_is_one
    CHECK (NOT is_base_unit OR conversion_factor_to_base = 1),

  -- One row per (product, unit). Two would make the conversion ambiguous, and
  -- the ambiguity would surface as a wrong quantity in the source of truth.
  CONSTRAINT product_units_unique UNIQUE (product_id, unit_id)
);

-- ⚠️ EXACTLY ONE BASE PER PRODUCT.
--
-- Two bases means «convert to base» has two answers and every stock movement
-- for that product becomes non-deterministic. A partial unique index is how
-- Postgres expresses «at most one row where this is true».
CREATE UNIQUE INDEX IF NOT EXISTS product_units_one_base
  ON product_units (product_id) WHERE is_base_unit;

CREATE UNIQUE INDEX IF NOT EXISTS product_units_one_purchase_default
  ON product_units (product_id) WHERE is_purchase_default;

CREATE UNIQUE INDEX IF NOT EXISTS product_units_one_sale_default
  ON product_units (product_id) WHERE is_sale_default;

CREATE INDEX IF NOT EXISTS product_units_workspace_product_idx
  ON product_units (workspace_id, product_id);

COMMENT ON TABLE product_units IS
  'L1 Multi-UOM — which units a product may be traded in, and what each is worth in the product''s BASE unit. OPT-IN: a product with no rows here behaves exactly as before (quantity in its own unit, factor 1), which is every product on the day this migration ran. Nothing was backfilled — see the migration header for why a backfill would have been a guess.';

COMMENT ON COLUMN product_units.conversion_factor_to_base IS
  'Base units per one of this unit, FOR THIS PRODUCT. Not units.conversion_factor, which converts within a dimension and is the same for everyone — a carton of this product may hold 24 while a carton of another holds 12.';

COMMENT ON COLUMN product_units.is_base_unit IS
  'The unit stock movements are recorded in. Exactly one per product (partial unique index). Two bases would make every conversion for that product non-deterministic.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE product_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_units_workspace ON product_units;
CREATE POLICY product_units_workspace ON product_units
  FOR ALL
  USING (EXISTS (SELECT 1 FROM auth_workspace_ids() w WHERE w = product_units.workspace_id))
  WITH CHECK (EXISTS (SELECT 1 FROM auth_workspace_ids() w WHERE w = product_units.workspace_id));

-- ---------------------------------------------------------------------------
-- A read that shows what a product can be traded in
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS product_unit_options;

CREATE VIEW product_unit_options AS
SELECT
  pu.workspace_id,
  pu.product_id,
  u.id                              AS unit_id,
  u.code                            AS unit_code,
  u.name                            AS unit_name,
  u.name_fa                         AS unit_name_fa,
  u.symbol                          AS unit_symbol,
  u.dimension,
  pu.conversion_factor_to_base,
  pu.is_base_unit,
  pu.is_purchase_default,
  pu.is_sale_default
FROM   product_units pu
JOIN   units u ON u.id = pu.unit_id
WHERE  pu.is_active AND u.is_active;

ALTER VIEW product_unit_options SET (security_invoker = true);

COMMENT ON VIEW product_unit_options IS
  'L1 — the units one product may be traded in, with names resolved. Empty for a product that has not opted in, which the service reads as single-unit (factor 1) rather than as an error.';

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
-- ============================================================================
--
-- V1. The table exists with the columns L1 names.
--
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--   WHERE  table_name = 'product_units' ORDER BY ordinal_position;
--
-- V2. ⚠️ NOTHING WAS BACKFILLED. This must be 0 — every product still behaves
--     exactly as it did before the migration.
--
--   SELECT COUNT(*) AS rows_created FROM product_units;
--
-- V3. The «one base per product» index exists.
--
--   SELECT indexname, indexdef FROM pg_indexes
--   WHERE  tablename = 'product_units' ORDER BY indexname;
--
-- V4. RLS on, view runs as caller.
--
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'product_units';
--   SELECT relname, reloptions   FROM pg_class WHERE relname = 'product_unit_options';
--
-- V5. The constraints actually refuse a bad row. Each of these must FAIL:
--
--   -- a base unit with a factor other than 1
--   INSERT INTO product_units (workspace_id, product_id, unit_id,
--                              conversion_factor_to_base, is_base_unit)
--   SELECT gen_random_uuid(), gen_random_uuid(), id, 24, true FROM units LIMIT 1;
--   -- expect: violates product_units_base_factor_is_one
--
--   -- a zero factor
--   INSERT INTO product_units (workspace_id, product_id, unit_id,
--                              conversion_factor_to_base)
--   SELECT gen_random_uuid(), gen_random_uuid(), id, 0 FROM units LIMIT 1;
--   -- expect: violates product_units_factor_positive
--
-- ============================================================================
