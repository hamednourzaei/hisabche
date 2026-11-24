-- ============================================================================
-- docs/VERIFY-ha-writer-fencing-01.sql
--
-- Read-only verification for docs/ha-writer-fencing-01-migration.sql.
-- ============================================================================

-- 1. Both fencing tables exist in public schema.
SELECT
  'writer_fencing_leases and writer_fencing_events tables exist' AS check,
  (
    SELECT count(*) = 2
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('writer_fencing_leases', 'writer_fencing_events')
  ) AS ok;

-- 2. All three RPC functions exist and set safe search_path = public, pg_temp.
SELECT
  'all 3 writer fencing RPCs exist with pinned search_path' AS check,
  (
    SELECT count(*) = 3
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'acquire_or_renew_writer_lease',
        'promote_standby_writer',
        'assert_writer_epoch'
      )
      AND array_to_string(p.proconfig, ',') LIKE '%search_path=public, pg_temp%'
  ) AS ok;

-- 3. anon and authenticated have ZERO table privileges on writer fencing tables.
SELECT
  'anon and authenticated cannot read or write fencing tables' AS check,
  NOT EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name IN ('writer_fencing_leases', 'writer_fencing_events')
      AND grantee IN ('PUBLIC', 'anon', 'authenticated')
  ) AS ok;

-- 4. service_role has EXECUTE on the three fencing functions.
SELECT
  'service_role can execute writer fencing RPCs' AS check,
  (
    has_function_privilege('service_role', 'public.acquire_or_renew_writer_lease(text,text,bigint,integer,text)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.promote_standby_writer(text,bigint,text,text,text,integer,text)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.assert_writer_epoch(text,text,bigint)', 'EXECUTE')
  ) AS ok;
