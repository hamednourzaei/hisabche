-- READ ONLY. Post-migration verification for docs/roll-cutting-01-migration.sql.
-- Run as the owner after the migration. Every column must read TRUE.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.

SELECT
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rolls'
  ) AS rolls_table_exists,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'roll_movements'
  ) AS roll_movements_table_exists,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_rolls_request'
  ) AS rolls_request_unique_exists,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_roll_movements_request'
  ) AS movements_request_unique_exists,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'roll_create'
  ) AS roll_create_exists,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'roll_apply_movement'
  ) AS roll_apply_movement_exists,
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'rolls'
      AND grantee IN ('anon', 'authenticated')
  ) AS rolls_not_client_writable,
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'roll_movements'
      AND grantee IN ('anon', 'authenticated')
  ) AS movements_not_client_writable;
