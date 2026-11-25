-- ============================================================================
-- VERIFY — docs/suppliers-notes-01-migration.sql
-- Read-only. Every row should return ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT
  'table public.suppliers exists' AS check,
  to_regclass('public.suppliers') IS NOT NULL AS ok

UNION ALL
SELECT
  'column public.suppliers.notes exists with type text',
  EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'suppliers'
       AND column_name  = 'notes'
       AND data_type    = 'text'
  )

UNION ALL
SELECT
  'RLS is enabled on public.suppliers',
  COALESCE(
    (
      SELECT c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = 'suppliers'
    ),
    false
  )

UNION ALL
SELECT
  'anon role has no direct grants on public.suppliers',
  NOT EXISTS (
    SELECT 1
      FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND table_name   = 'suppliers'
       AND grantee      = 'anon'
  );
