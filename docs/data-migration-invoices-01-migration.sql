-- ============================================================================
-- data-migration-invoices-01 — let the import centre hold invoice jobs
--
-- The import centre could carry two kinds of file: customers and products.
-- Both kinds are named in CHECK constraints on `migration_jobs` and
-- `migration_profiles`, so a job for a third kind is refused by the database
-- (23514) whatever the code allows. This adds 'invoice' to both lists.
--
-- Nothing else changes: no table, no column, no row. An imported invoice is
-- created by the application through the same service a typed one is, and is
-- recorded in the existing `migration_records` table.
--
-- Additive and idempotent: each constraint is dropped if present and added
-- again with the wider list, so running this twice ends in the same place.
-- Existing rows hold 'customer' or 'product', which the wider list still
-- accepts, so the ADD cannot fail on old data.
--
-- Requires: docs/data-migration-center-migration.sql (the two tables).
--
-- ROLLBACK / MITIGATION
--   Only when no row holds 'invoice' (otherwise the ADD fails, which is the
--   database protecting those rows — cancel or finish those jobs first):
--
--     ALTER TABLE migration_jobs DROP CONSTRAINT IF EXISTS migration_jobs_entity_check;
--     ALTER TABLE migration_jobs ADD CONSTRAINT migration_jobs_entity_check
--       CHECK (entity IN ('customer', 'product'));
--     ALTER TABLE migration_profiles DROP CONSTRAINT IF EXISTS migration_profiles_entity_check;
--     ALTER TABLE migration_profiles ADD CONSTRAINT migration_profiles_entity_check
--       CHECK (entity IN ('customer', 'product'));
--
--   Until this file is run the application says so by name
--   (MIGRATION_INVOICE_SCHEMA_REQUIRED) instead of failing with a 500.
-- ============================================================================

ALTER TABLE migration_jobs DROP CONSTRAINT IF EXISTS migration_jobs_entity_check;
ALTER TABLE migration_jobs ADD CONSTRAINT migration_jobs_entity_check
  CHECK (entity IN ('customer', 'product', 'invoice'));

ALTER TABLE migration_profiles DROP CONSTRAINT IF EXISTS migration_profiles_entity_check;
ALTER TABLE migration_profiles ADD CONSTRAINT migration_profiles_entity_check
  CHECK (entity IN ('customer', 'product', 'invoice'));
