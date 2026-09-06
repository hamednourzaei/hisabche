-- ============================================================================
-- docs/phase-l-01-units-migration.sql
--
-- PHASE L · L0.2 — units of measure, and the foundation L1 needs.
--
-- ---------------------------------------------------------------------------
-- THE REQUEST
--
-- «a trader in the iron market should be able to invoice in kilograms, tonnes
-- or grams». That is Multi-UOM (L1), not a new concept — so the units table
-- and the three weight units are seeded here, before L1, with correct
-- conversions.
--
-- Today `unit` is a ZOD ENUM in packages/validation:
--
--     unitSchema = z.enum(['piece','gram','kg','meter','liter','box',
--                          'pack','carton','custom'])
--
-- «tonne» is not in it, so a tonne cannot be recorded — the invoice is REFUSED
-- by validation, and the only fix is a code change and a deploy.
--
-- ---------------------------------------------------------------------------
-- ⚠️ L0.1 — CURRENCIES ARE NOT IN THIS MIGRATION, DELIBERATELY
--
-- L0.1 asked for a `currencies` table seeded with ~180 ISO 4217 codes. It is
-- NOT built, and the reason is recorded rather than worked around:
--
-- `packages/formatting/src/__tests__/currency-policy.test.ts` is a numbered
-- product policy («STAGE 4 §8/§9»). It asserts the four-currency list is
-- deliberate, pins the exact enum, and checks EUR is absent from SEVEN files.
-- §9 additionally requires that an unknown code resolve to `undefined` rather
-- than borrow another currency's precision — so adding currencies without
-- extending `FRACTION_DIGITS` produces money formatted with NO precision
-- contract at all.
--
-- That is a product decision with a written policy behind it, not leftover
-- hardcoding (§21, G2). See .claude/HANDOFF-PHASES-G-TO-O.md for the exact
-- list of what would have to change together.
--
-- ---------------------------------------------------------------------------
-- ⚠️ REFERENCE DATA ONLY. NO TRANSACTIONAL ROW IS TOUCHED.
--
-- One table is created and seeded. No foreign key is added from
-- `products.unit` or `invoice_items.unit`: a historical row carrying a code
-- the seed lacks would make that constraint fail, which is a destructive
-- migration in disguise (G3). P2 below is how you find out whether such rows
-- exist BEFORE anyone considers the constraint.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK / MITIGATION
--
--   DROP TABLE IF EXISTS units;
--
-- Safe while nothing references it. After L1 creates `product_units` with a
-- foreign key, it is load-bearing and this rollback is no longer safe.
--
-- SAFE TO RE-RUN.
-- ============================================================================

-- ============================================================================
-- PRE-MIGRATION VERIFICATION — run first, keep the output.
-- ============================================================================
--
-- P1. Does the table already exist? (Expected: no rows.)
--
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name = 'units';
--
-- P2. ⚠️ WHICH UNIT CODES ARE ACTUALLY IN USE? Every one must appear in the
--     seed, or a future foreign key would orphan real rows. `custom` is
--     expected and is deliberately NOT seeded — see the note at the bottom.
--
--   SELECT unit, COUNT(*) FROM products      GROUP BY unit ORDER BY 2 DESC;
--   SELECT unit, COUNT(*) FROM invoice_items GROUP BY unit ORDER BY 2 DESC;
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Units of measure
--
-- ⚠️ `conversion_factor` is within a DIMENSION, to that dimension's base. It is
-- NOT a per-product factor: «1 carton = 24 pieces» depends on the product and
-- belongs in `product_units`, which L1 creates.
--
-- Weight converts to grams, length to metres, volume to litres. `count` has no
-- universal conversion — a box holds whatever the product says it holds — so
-- those rows carry factor 1 and rely on `product_units` for the real number.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS units (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text NOT NULL UNIQUE,
  name               text NOT NULL,
  name_fa            text,
  symbol             text,

  dimension          text NOT NULL,

  /**
   * How many BASE units of this dimension one of these is.
   *
   * gram 1 · kilogram 1000 · tonne 1000000 — so a tonne is stored and summed
   * as 1 000 000 grams and no total ever depends on which unit was typed.
   *
   * numeric(18,6), not float: 0.001 for a millilitre must be exact, and a
   * float conversion factor puts rounding error into every quantity derived
   * from it.
   */
  conversion_factor  numeric(18, 6) NOT NULL DEFAULT 1,

  /** The dimension's base. Exactly one per dimension — enforced below. */
  is_base            boolean NOT NULL DEFAULT false,

  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT units_dimension_check CHECK (dimension IN ('weight', 'length', 'volume', 'count')),
  CONSTRAINT units_conversion_positive CHECK (conversion_factor > 0)
);

-- One base per dimension. Two bases make every conversion in that dimension
-- ambiguous, and the ambiguity only ever surfaces as a wrong quantity.
CREATE UNIQUE INDEX IF NOT EXISTS units_one_base_per_dimension
  ON units (dimension) WHERE is_base;

CREATE INDEX IF NOT EXISTS units_dimension_idx ON units (dimension) WHERE is_active;

COMMENT ON TABLE units IS
  'Units of measure (Phase L, L0.2). Replaces the zod enum that made tonnes unrecordable for a metals trader. conversion_factor is within a DIMENSION to that dimension''s base; a per-product factor («1 carton = 24 pieces») belongs in product_units, which L1 creates. No foreign key from products.unit yet — see the migration header.';

COMMENT ON COLUMN units.conversion_factor IS
  'Base units of this dimension per one of these. gram 1, kg 1000, ton 1000000. numeric, never float: 0.001 for a millilitre must be exact.';

INSERT INTO units (code, name, name_fa, symbol, dimension, conversion_factor, is_base) VALUES
  -- ─── Weight — the L0.2 request. Base is the gram. ───────────────────────
  ('gram',   'Gram',       'گرم',       'g',  'weight', 1,       true),
  ('kg',     'Kilogram',   'کیلوگرم',   'kg', 'weight', 1000,    false),
  ('ton',    'Tonne',      'تن',        't',  'weight', 1000000, false),
  ('mg',     'Milligram',  'میلی‌گرم',  'mg', 'weight', 0.001,   false),

  -- ─── Length ────────────────────────────────────────────────────────────
  ('meter',  'Metre',      'متر',       'm',  'length', 1,       true),
  ('cm',     'Centimetre', 'سانتی‌متر', 'cm', 'length', 0.01,    false),
  ('km',     'Kilometre',  'کیلومتر',   'km', 'length', 1000,    false),

  -- ─── Volume ────────────────────────────────────────────────────────────
  ('liter',  'Litre',      'لیتر',      'L',  'volume', 1,       true),
  ('ml',     'Millilitre', 'میلی‌لیتر', 'mL', 'volume', 0.001,   false),

  -- ─── Count ─────────────────────────────────────────────────────────────
  -- All factor 1, because there is no universal answer: a box holds whatever
  -- the PRODUCT says it holds, and that lives in product_units (L1). A factor
  -- of 12 on «dozen» would be right for eggs and wrong for everything sold by
  -- the dozen in another size.
  ('piece',  'Piece',      'عدد',       NULL, 'count',  1,       true),
  ('box',    'Box',        'جعبه',      NULL, 'count',  1,       false),
  ('pack',   'Pack',       'بسته',      NULL, 'count',  1,       false),
  ('carton', 'Carton',     'کارتن',     NULL, 'count',  1,       false),
  ('dozen',  'Dozen',      'دوجین',     NULL, 'count',  1,       false)
ON CONFLICT (code) DO NOTHING;

-- ⚠️ `custom` IS DELIBERATELY NOT SEEDED.
--
-- The zod enum has a `custom` member whose label lives in a sibling
-- `unitLabel` column — it is «the user typed their own word», not a unit with
-- a conversion. Seeding it would give it a conversion factor of 1 in an
-- arbitrary dimension, and L1 would then convert by it.

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
-- ============================================================================
--
-- V1. Seeded.
--
--   SELECT COUNT(*) AS units FROM units;   -- expect 14
--
-- V2. Exactly one base per dimension. Every row must show bases = 1.
--
--   SELECT dimension, COUNT(*) FILTER (WHERE is_base) AS bases, COUNT(*) AS total
--   FROM   units GROUP BY dimension ORDER BY 1;
--
-- V3. ⚠️ THE WEIGHT LADDER — the L0.2 request. Must read exactly:
--     mg 0.001 · gram 1 · kg 1000 · ton 1000000
--
--   SELECT code, conversion_factor FROM units
--   WHERE  dimension = 'weight' ORDER BY conversion_factor;
--
-- V4. Every unit already in use is present. A row here is a product whose unit
--     the table does not know — it must be resolved before L1 adds any
--     foreign key. `custom` is expected and correct.
--
--   SELECT DISTINCT p.unit
--   FROM   products p
--   WHERE  p.unit IS NOT NULL AND p.unit <> 'custom'
--     AND  NOT EXISTS (SELECT 1 FROM units u WHERE u.code = p.unit);
--
-- V5. Same for invoice lines.
--
--   SELECT DISTINCT i.unit
--   FROM   invoice_items i
--   WHERE  i.unit IS NOT NULL AND i.unit <> 'custom'
--     AND  NOT EXISTS (SELECT 1 FROM units u WHERE u.code = i.unit);
--
-- V6. `custom` was not seeded.
--
--   SELECT COUNT(*) FROM units WHERE code = 'custom';   -- expect 0
--
-- ============================================================================
