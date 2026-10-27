-- ============================================================================
-- Migration: docs/business-profile-01-migration.sql
-- Name: Workspace Business Profile & Operating Characteristics
-- Phase: Universal Business Type Onboarding & Core Policy Engine
-- Date: 2026-10-27
--
-- Purpose:
--   Moves business profile and trade configuration from user account (profiles)
--   to workspace tenancy boundary (public.workspaces), ensuring multi-tenant
--   isolation and consistent profile sharing across all workspace members.
--   Adds operating characteristics block (holdsStock, locations, etc.)
--   with shape and size checks.
--
-- Rollback:
--   ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_operating_characteristics_check;
--   ALTER TABLE public.workspaces DROP COLUMN IF EXISTS business_profile_updated_by;
--   ALTER TABLE public.workspaces DROP COLUMN IF EXISTS business_profile_updated_at;
--   ALTER TABLE public.workspaces DROP COLUMN IF EXISTS operating_characteristics;
--   ALTER TABLE public.workspaces DROP COLUMN IF EXISTS business_types;
-- ============================================================================

-- ── 1. Additive columns on public.workspaces ─────────────────────────────────

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS business_types text[],
  ADD COLUMN IF NOT EXISTS operating_characteristics jsonb,
  ADD COLUMN IF NOT EXISTS business_profile_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS business_profile_updated_by uuid;

-- ── 2. Structural and size constraints on operating_characteristics ──────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_operating_characteristics_check'
  ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_operating_characteristics_check
      CHECK (
        operating_characteristics IS NULL OR
        (jsonb_typeof(operating_characteristics) = 'object' AND pg_column_size(operating_characteristics) < 2048)
      );
  END IF;
END $$;
