-- ============================================================================
-- VERIFY — data-migration-invoices-01 (READ ONLY)
--
-- Run after docs/data-migration-invoices-01-migration.sql and report the row.
-- Expected: both `*_allows_invoice` true and `ok` true.
--
-- Status: Post-migration verification query generated — PENDING HUMAN
-- CONFIRMATION. No result has been seen.
-- ============================================================================

WITH checks AS (
  SELECT
    (SELECT pg_get_constraintdef(c.oid)
       FROM pg_constraint c
      WHERE c.conname = 'migration_jobs_entity_check'
        AND c.conrelid = 'migration_jobs'::regclass)     AS jobs_def,
    (SELECT pg_get_constraintdef(c.oid)
       FROM pg_constraint c
      WHERE c.conname = 'migration_profiles_entity_check'
        AND c.conrelid = 'migration_profiles'::regclass) AS profiles_def
)
SELECT
  jobs_def,
  profiles_def,
  COALESCE(jobs_def LIKE '%invoice%', false)     AS jobs_allows_invoice,
  COALESCE(profiles_def LIKE '%invoice%', false) AS profiles_allows_invoice,
  COALESCE(jobs_def LIKE '%invoice%', false)
    AND COALESCE(profiles_def LIKE '%invoice%', false)
    AND COALESCE(jobs_def LIKE '%customer%', false)
    AND COALESCE(jobs_def LIKE '%product%', false) AS ok
FROM checks;
