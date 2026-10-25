-- ============================================================================
-- docs/VERIFY-core-divergence.sql
--
-- Verification queries for docs/core-divergence-migration.sql
-- Run after migration to confirm table, columns, indexes, and RLS.
-- ============================================================================

-- 1. Table existence
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'core_divergence'
) AS core_divergence_table_exists;

-- 2. Verify all columns and types
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'core_divergence'
ORDER BY ordinal_position;

-- 3. Verify indexes
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'core_divergence';

-- 4. Verify RLS enabled
SELECT 
  relname, 
  relrowsecurity, 
  relforcerowsecurity
FROM pg_class
WHERE relname = 'core_divergence';

-- 5. ⚠️ THE POLICY MUST FOLLOW THE MEMBERSHIP CHAIN.
--
-- «RLS is on» is not «the policy is right». The previous version of this table
-- used `current_setting('app.current_workspace_id')`, which is set nowhere, so
-- every read denied — including support's. This asserts the policy text names
-- `workspace_members` and `auth.uid()`, the same chain every other table uses.
-- Expect: uses_membership_chain = true, uses_phantom_setting = false.
SELECT
  policyname,
  (qual LIKE '%workspace_members%' AND qual LIKE '%auth.uid()%') AS uses_membership_chain,
  (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%current_setting%' AS uses_phantom_setting,
  qual
FROM pg_policies
WHERE tablename = 'core_divergence';

-- 6. ⚠️ PRIVILEGE CHECK — `anon` MUST NOT REACH TENANT EVIDENCE.
--
-- In Supabase every new table starts with ALL privileges for anon and
-- authenticated. A migration that only grants the narrow set changes nothing.
-- Expect: anon_privileges = 0, authenticated_delete = false.
SELECT
  COUNT(*) FILTER (WHERE grantee = 'anon')                       AS anon_privileges,
  COUNT(*) FILTER (WHERE grantee = 'authenticated'
                     AND privilege_type IN ('DELETE','TRUNCATE','REFERENCES','TRIGGER')) AS authenticated_write_privileges,
  COUNT(*) FILTER (WHERE grantee = 'authenticated'
                     AND privilege_type IN ('SELECT','INSERT'))  AS authenticated_read_insert
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'core_divergence';

-- 7. A row written for one workspace must not be visible to another.
-- Run as a user who is a member of workspace A only; expect 0.
--   SELECT count(*) AS must_be_zero FROM public.core_divergence
--    WHERE workspace_id <> '<workspace-A-uuid>';

