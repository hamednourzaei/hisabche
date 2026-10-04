-- ============================================================================
-- CUSTOM FIELDS — 01 (capabilities #141–#143). Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-custom-fields-01.sql.
--
-- A business can add its own fields to a customer, a supplier or a product:
-- text, number, date, yes/no, a choice from a list, or a FORMULA over its own
-- number fields.
--
-- ⚠️ ONLY THESE THREE. Invoices, payments, the ledger and stock are not
-- extensible: a custom figure there would be an unaudited one. The CHECK below
-- is the rule; the application repeats it.
--
-- Values live in their own table, one row per record, as one JSON object keyed
-- by field key. Nothing is added to `customers`, `suppliers` or `products`.
-- A formula field has no stored value: it is computed when read.
--
-- A field is retired with is_active = false, never deleted, so the values
-- already entered under it are not orphaned.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  entity_type  text NOT NULL CHECK (entity_type IN ('customer', 'supplier', 'product')),
  -- The stable name used in formulas and as the JSON key. Never shown as a label.
  key          text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  label        text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 60),
  field_type   text NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'choice', 'formula')),
  choices      text[],
  formula      text,
  is_required  boolean NOT NULL DEFAULT false,
  is_active    boolean NOT NULL DEFAULT true,
  created_by   uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- `IS NOT NULL` is spelled out: a CHECK passes on NULL.
  CONSTRAINT custom_field_choice_has_choices
    CHECK (field_type <> 'choice' OR (choices IS NOT NULL AND cardinality(choices) BETWEEN 1 AND 50)),
  CONSTRAINT custom_field_formula_has_formula
    CHECK (field_type <> 'formula' OR (formula IS NOT NULL AND char_length(btrim(formula)) BETWEEN 1 AND 300)),
  -- A formula cannot be «required»: nobody types it.
  CONSTRAINT custom_field_formula_not_required
    CHECK (field_type <> 'formula' OR is_required = false)
);

COMMENT ON TABLE public.custom_field_definitions IS
  'Fields a business adds to its customers, suppliers or products. Retired with is_active = false.';

-- The key is the JSON key of the values and the name used in formulas: it is
-- unique per entity for the life of the workspace, retired fields included, so
-- an old value can never be read under a new field's meaning.
CREATE UNIQUE INDEX IF NOT EXISTS custom_field_definitions_key
  ON public.custom_field_definitions (workspace_id, entity_type, key);

ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.custom_field_definitions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.custom_field_definitions TO service_role;

CREATE TABLE IF NOT EXISTS public.custom_field_values (
  workspace_id uuid NOT NULL,
  entity_type  text NOT NULL CHECK (entity_type IN ('customer', 'supplier', 'product')),
  entity_id    uuid NOT NULL,
  -- { "<key>": value, … } — text, number, boolean or an ISO day.
  field_values jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(field_values) = 'object'),
  updated_by   uuid NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, entity_type, entity_id)
);

COMMENT ON TABLE public.custom_field_values IS
  'The custom field values of one record, as one JSON object keyed by field key.';

ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.custom_field_values FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.custom_field_values TO service_role;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Removes the custom fields and everything entered in them. The customers,
-- suppliers and products themselves are untouched.
--
--   DROP TABLE IF EXISTS public.custom_field_values;
--   DROP TABLE IF EXISTS public.custom_field_definitions;
