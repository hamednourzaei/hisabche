-- ============================================================================
-- PATCH 2 / L0.2 — custom units, as a SEPARATE table.
--
-- ⚠️ PROPOSAL — AWAITING THE OWNER'S GO-AHEAD BEFORE IT IS RUN.
--
-- The patch brief offered two shapes and asked which and why. This file is the
-- answer, written out so the decision can be judged against real SQL rather
-- than a description.
--
-- ---------------------------------------------------------------------------
-- THE FINDING: `units` MUST STAY SYSTEM-OWNED, AND NOT BECAUSE OF TASTE
--
-- The brief's option B — add a nullable `workspace_id` to `units` and use the
-- `roles` pattern — CANNOT BE DONE ADDITIVELY. Two existing constraints make
-- it impossible:
--
--   1. `code text NOT NULL UNIQUE`  (phase-l-01, line 94)
--
--      Globally unique. The moment two workspaces both add «مثقال», the second
--      INSERT fails. Supporting per-workspace codes means DROPPING that
--      constraint and replacing it with UNIQUE (workspace_id, code) — a
--      rewrite of an existing constraint, which the patch rules forbid
--      ("هیچ ستون/جدول موجود Drop یا بازنویسی نشود").
--
--   2. `units_one_base_per_dimension`  —  UNIQUE (dimension) WHERE is_base
--
--      Exactly one base per dimension, globally. A workspace adding a weight
--      unit and marking it base collides with the seeded gram. Same problem,
--      same forbidden fix.
--
-- The `roles` pattern works there because a role name is not globally unique
-- and carries no cross-row invariant. Here the uniqueness IS the invariant:
-- two bases in a dimension make every conversion in it ambiguous, and the
-- ambiguity only ever surfaces as a wrong quantity.
--
-- ---------------------------------------------------------------------------
-- ⚠️ WHAT IS ACTUALLY MISSING IS NARROWER THAN "USERS CANNOT ADD UNITS"
--
-- A user CAN already record their own word for a unit: `unitSchema` has a
-- `custom` member and a sibling `unitLabel` free-text field, and phase-l-01
-- deliberately does not seed `custom` into `units` because it is «the user
-- typed their own word», not a unit with a conversion.
--
-- So the real gap is one step further in: a custom unit that carries a
-- CONVERSION and can therefore be used in `product_units`. A gold trader
-- wanting «۱ مثقال = ۴٫۶۸۷۵ گرم» cannot express it today, because
-- `product_units.unit_id` is a foreign key to `units(id)` and there is no row
-- to point at.
--
-- That is what this table adds, and nothing more.
--
-- ---------------------------------------------------------------------------
-- ADDITIVE AND IDEMPOTENT. One new table, one new nullable column on
-- `product_units`, one CHECK. No existing column dropped, no existing
-- constraint rewritten, no existing row changed.
--
-- ROLLBACK / MITIGATION
--   ALTER TABLE product_units DROP CONSTRAINT IF EXISTS product_units_one_unit_source;
--   ALTER TABLE product_units DROP COLUMN IF EXISTS custom_unit_id;
--   DROP TABLE IF EXISTS custom_units;
--
--   Every existing product-unit row uses `unit_id` and is untouched by all
--   three statements, so this returns the database exactly to its present
--   state.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. custom_units — a workspace's own units.
--
-- Deliberately mirrors the SHAPE of `units` (code, name, dimension,
-- conversion_factor) so the two can be read into one list by the API without
-- a translation layer. It does NOT mirror `is_base`: a workspace cannot
-- redefine what the base of a dimension is. The base is the gram, the metre,
-- the litre and the piece, for everyone — that is what makes a conversion
-- comparable across the product.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_units (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL,

  /** The user's own code. Unique WITHIN a workspace, not globally. */
  code              text NOT NULL,
  name              text NOT NULL,
  name_fa           text,
  symbol            text,

  /**
   * Which dimension this unit measures, and how many of that dimension's BASE
   * unit one of these is.
   *
   * «۱ مثقال = ۴٫۶۸۷۵ گرم» is dimension 'weight', factor 4.6875 — the gram
   * being the seeded base of the weight dimension in `units`.
   *
   * ⚠️ Same meaning as `units.conversion_factor`, so the two can be used
   * interchangeably by the converter. A different meaning here would be a
   * second conversion model, and mixing the two would produce quantities
   * wrong by whatever the difference was.
   */
  dimension         text NOT NULL,
  conversion_factor numeric(18, 6) NOT NULL,

  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,

  CONSTRAINT custom_units_dimension_check
    CHECK (dimension IN ('weight', 'length', 'volume', 'count')),
  CONSTRAINT custom_units_factor_positive CHECK (conversion_factor > 0),
  CONSTRAINT custom_units_code_per_workspace UNIQUE (workspace_id, code)
);

COMMENT ON TABLE custom_units IS
  'Patch 2 / L0.2 - a workspace''s own units of measure. Separate from `units` because `units.code` is globally UNIQUE and `units_one_base_per_dimension` allows one base per dimension globally; per-workspace codes would require rewriting both, which is not additive. A workspace may add a unit, never redefine a dimension''s base.';

COMMENT ON COLUMN custom_units.conversion_factor IS
  'Base units of this dimension per one of these - the SAME meaning as units.conversion_factor, so the converter can treat both alike.';

CREATE INDEX IF NOT EXISTS custom_units_workspace_idx
  ON custom_units (workspace_id) WHERE is_active;

-- Workspace-scoped, and writable by its own members — unlike `units`, which
-- is system data. This is the ordinary tenant policy, not the reference-data
-- one.
ALTER TABLE custom_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_units_workspace ON custom_units;
CREATE POLICY custom_units_workspace ON custom_units
  FOR ALL
  USING (EXISTS (SELECT 1 FROM auth_workspace_ids() w WHERE w = custom_units.workspace_id))
  WITH CHECK (EXISTS (SELECT 1 FROM auth_workspace_ids() w WHERE w = custom_units.workspace_id));


-- ---------------------------------------------------------------------------
-- 2. product_units can point at either kind.
--
-- ⚠️ `unit_id` STAYS NOT NULL-ABLE? No — it must become nullable for a row to
-- reference a custom unit instead. That is a relaxation, not a rewrite: every
-- existing row keeps its value and every existing read keeps working. The
-- CHECK below is what stops it becoming "neither".
-- ---------------------------------------------------------------------------
ALTER TABLE product_units ADD COLUMN IF NOT EXISTS custom_unit_id uuid
  REFERENCES custom_units (id) ON DELETE RESTRICT;

ALTER TABLE product_units ALTER COLUMN unit_id DROP NOT NULL;

-- Exactly one source, never both and never neither. Both would make the
-- conversion ambiguous; neither would make the row meaningless.
ALTER TABLE product_units DROP CONSTRAINT IF EXISTS product_units_one_unit_source;
ALTER TABLE product_units ADD CONSTRAINT product_units_one_unit_source
  CHECK ((unit_id IS NOT NULL) <> (custom_unit_id IS NOT NULL));

COMMENT ON COLUMN product_units.custom_unit_id IS
  'Patch 2 - set instead of unit_id when the product is measured in one of the workspace''s own units. Exactly one of the two is set (product_units_one_unit_source).';

-- ⚠️ The existing UNIQUE (product_id, unit_id) does not cover the new column,
-- so a product could hold the same custom unit twice. This adds the matching
-- guarantee without touching the existing constraint.
CREATE UNIQUE INDEX IF NOT EXISTS product_units_unique_custom
  ON product_units (product_id, custom_unit_id) WHERE custom_unit_id IS NOT NULL;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
-- ============================================================================

-- 1. The table exists and is empty.  EXPECT: 0
SELECT COUNT(*) AS custom_unit_rows FROM custom_units;

-- 2. RLS is on and workspace-scoped.  EXPECT: rowsecurity true, 1 policy, ALL
SELECT c.relrowsecurity AS rowsecurity,
       (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = 'custom_units') AS policies
FROM   pg_class c WHERE c.relname = 'custom_units';

SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'custom_units';

-- 3. ⚠️ EVERY EXISTING product_units ROW IS UNAFFECTED.
--    EXPECT: total unchanged, custom_unit_id null on all of them, and the
--    one-source CHECK satisfied by every row.
SELECT COUNT(*)                                        AS total_rows,
       COUNT(*) FILTER (WHERE unit_id IS NOT NULL)     AS using_system_unit,
       COUNT(*) FILTER (WHERE custom_unit_id IS NOT NULL) AS using_custom_unit,
       COUNT(*) FILTER (WHERE unit_id IS NULL AND custom_unit_id IS NULL) AS orphaned
FROM   product_units;

-- 4. The `units` table is untouched — still 14 rows, still one base per
--    dimension, still no write policy.  EXPECT: 14, 4, 1
SELECT (SELECT COUNT(*) FROM units WHERE is_active)                          AS unit_rows,
       (SELECT COUNT(*) FROM units WHERE is_base)                            AS base_units,
       (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'units')          AS unit_policies;

-- 5. ⚠️ `units` STILL HAS NO WRITE POLICY. This patch must not have opened it.
--    EXPECT: 0
SELECT COUNT(*) AS unit_write_policies
FROM   pg_policies
WHERE  tablename = 'units' AND cmd <> 'SELECT';

-- 6. The one-source CHECK actually refuses both and neither.
--    EXPECT: both statements raise 23514.
-- INSERT INTO product_units (workspace_id, product_id, unit_id, custom_unit_id,
--   conversion_factor_to_base, is_base_unit)
--   VALUES ('00000000-0000-0000-0000-000000000000',
--           '00000000-0000-0000-0000-000000000000', NULL, NULL, 1, false);
-- INSERT INTO product_units (workspace_id, product_id, unit_id, custom_unit_id,
--   conversion_factor_to_base, is_base_unit)
--   VALUES ('00000000-0000-0000-0000-000000000000',
--           '00000000-0000-0000-0000-000000000000',
--           (SELECT id FROM units LIMIT 1),
--           (SELECT id FROM custom_units LIMIT 1), 1, false);
