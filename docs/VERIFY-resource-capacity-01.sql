-- ============================================================================
-- docs/VERIFY-resource-capacity-01.sql
--
-- Post-migration verification for docs/resource-capacity-01-migration.sql.
-- Status: Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================================================

-- 1. btree_gist extension enabled
SELECT extname FROM pg_extension WHERE extname = 'btree_gist';

-- 2. resource_bookings table & exclusion constraint present
SELECT conname, contype
  FROM pg_constraint
 WHERE conrelid = 'public.resource_bookings'::regclass
   AND conname = 'resource_bookings_no_overlap';

-- 3. RLS enabled and workspace_members policy present
SELECT relname, relrowsecurity
  FROM pg_class
 WHERE relname = 'resource_bookings';

SELECT policyname, cmd
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'resource_bookings';

-- 4. Widened resource kinds check
SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint
 WHERE conname IN ('service_resources_kind', 'service_catalog_kind');
