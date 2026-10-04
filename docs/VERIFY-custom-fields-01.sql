-- ============================================================================
-- VERIFY — docs/custom-fields-01-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'table ' || t.name || ' exists' AS check, to_regclass('public.' || t.name) IS NOT NULL AS ok
FROM (VALUES ('custom_field_definitions'), ('custom_field_values')) AS t(name)

UNION ALL
SELECT 'RLS enabled on ' || c.relname, c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname IN ('custom_field_definitions', 'custom_field_values')

UNION ALL
SELECT 'clients cannot read ' || t.name, NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = t.name
     AND grantee IN ('anon', 'authenticated')
)
FROM (VALUES ('custom_field_definitions'), ('custom_field_values')) AS t(name)

UNION ALL
SELECT 'constraint ' || c.name, EXISTS (
  SELECT 1 FROM pg_constraint
   WHERE conrelid = 'public.custom_field_definitions'::regclass AND conname = c.name
)
FROM (VALUES
  ('custom_field_choice_has_choices'),
  ('custom_field_formula_has_formula'),
  ('custom_field_formula_not_required')
) AS c(name)

UNION ALL
SELECT 'a key is unique per entity (unique index)', EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'custom_field_definitions_key'
)

UNION ALL
SELECT 'no custom field on a financial table', NOT EXISTS (
  SELECT 1 FROM public.custom_field_definitions
   WHERE entity_type NOT IN ('customer', 'supplier', 'product')
);
