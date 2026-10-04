-- ============================================================================
-- VERIFY — docs/price-lists-01-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'table ' || t.name || ' exists' AS check, to_regclass('public.' || t.name) IS NOT NULL AS ok
FROM (VALUES ('price_lists'), ('price_list_items')) AS t(name)

UNION ALL
SELECT 'customers.price_list_id exists', EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'price_list_id'
)

UNION ALL
SELECT 'RLS enabled on ' || c.relname, c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname IN ('price_lists', 'price_list_items')

UNION ALL
SELECT 'clients cannot read ' || t.name, NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = t.name
     AND grantee IN ('anon', 'authenticated')
)
FROM (VALUES ('price_lists'), ('price_list_items')) AS t(name)

UNION ALL
SELECT 'the backend role cannot DELETE from ' || t.name, NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = t.name
     AND grantee = 'service_role' AND privilege_type = 'DELETE'
)
FROM (VALUES ('price_lists'), ('price_list_items')) AS t(name)

UNION ALL
SELECT 'one active list per name (unique index)', EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'price_lists_active_name'
)

UNION ALL
SELECT 'no customer points at a list of another workspace', NOT EXISTS (
  SELECT 1 FROM public.customers c
    JOIN public.price_lists l ON l.id = c.price_list_id
   WHERE c.workspace_id IS DISTINCT FROM l.workspace_id
);
