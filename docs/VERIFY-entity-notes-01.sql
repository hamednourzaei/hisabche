-- ============================================================================
-- VERIFY — docs/entity-notes-01-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'table entity_notes exists' AS check, to_regclass('public.entity_notes') IS NOT NULL AS ok

UNION ALL
SELECT 'RLS enabled on entity_notes', (
  SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'entity_notes'
)

UNION ALL
SELECT 'clients cannot read entity_notes', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'entity_notes'
     AND grantee IN ('anon', 'authenticated')
)

UNION ALL
SELECT 'the backend role cannot UPDATE or DELETE notes', NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'entity_notes'
     AND grantee = 'service_role' AND privilege_type IN ('UPDATE', 'DELETE')
)

UNION ALL
SELECT 'append-only trigger is in place', EXISTS (
  SELECT 1 FROM pg_trigger
   WHERE tgrelid = 'public.entity_notes'::regclass AND tgname = 'entity_notes_append_only_trg'
)

UNION ALL
SELECT 'index for reading one entity''s notes', EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'entity_notes_entity_idx'
);
