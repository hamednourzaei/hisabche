-- ============================================================================
-- Verification: docs/VERIFY-business-profile-01.sql
-- Name: Post-migration verification for workspace business profile
-- Phase: Universal Business Type Onboarding & Core Policy Engine
-- Date: 2026-10-27
-- ============================================================================

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'workspaces'
  AND column_name IN (
    'business_types',
    'operating_characteristics',
    'business_profile_updated_at',
    'business_profile_updated_by'
  )
ORDER BY column_name;

SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.workspaces'::regclass
  AND conname = 'workspaces_operating_characteristics_check';
