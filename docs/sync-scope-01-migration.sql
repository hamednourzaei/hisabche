-- ============================================================================
-- Migration: docs/sync-scope-01-migration.sql
-- Name: Module-Scoped Sync Pull (sync_pull_changes_v2)
-- Phase: V62 Slice 5 (§4.6)
-- Date: 2026-11-12
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE
-- Run docs/VERIFY-sync-scope-01.sql immediately after applying this migration.
-- Prerequisite: docs/sync-commit-horizon-migration.sql must already be applied.
--
-- Purpose:
--   Adds `public.sync_pull_changes_v2(p_workspace_id, p_cursor, p_limit, p_entity_types)`
--   so devices pull only the entity types belonging to their installed feature packs.
--   `p_entity_types IS NULL` returns all entity types (backward-compatible).
--   Keeps `public.sync_pull_changes` (v1) intact until all clients send v2.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.sync_pull_changes_v2(uuid, bigint, int, text[]);
-- ============================================================================

DO $$
BEGIN
  IF to_regprocedure('public.sync_pull_changes(uuid, bigint, integer)') IS NULL THEN
    RAISE EXCEPTION 'Run docs/sync-commit-horizon-migration.sql first';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_pull_changes_v2(
  p_workspace_id uuid,
  p_cursor       bigint,
  p_limit        int,
  p_entity_types text[] DEFAULT NULL
) RETURNS TABLE (
  sync_version   bigint,
  workspace_id   uuid,
  entity_type    text,
  entity_id      uuid,
  operation      text,
  entity_version bigint,
  origin_device  text,
  created_at     timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT
    s.sync_version,
    s.workspace_id,
    s.entity_type,
    s.entity_id,
    s.operation,
    s.entity_version,
    s.origin_device,
    s.created_at
  FROM public.sync_change_log s
  WHERE s.workspace_id = p_workspace_id
    AND s.sync_version > p_cursor
    AND (s.txid IS NULL OR s.txid < pg_snapshot_xmin(pg_current_snapshot()))
    AND (p_entity_types IS NULL OR s.entity_type = ANY(p_entity_types))
  ORDER BY s.sync_version ASC
  LIMIT p_limit;
$fn$;

REVOKE ALL ON FUNCTION public.sync_pull_changes_v2(uuid, bigint, int, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_pull_changes_v2(uuid, bigint, int, text[]) FROM anon;
REVOKE ALL ON FUNCTION public.sync_pull_changes_v2(uuid, bigint, int, text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_pull_changes_v2(uuid, bigint, int, text[]) TO service_role;

NOTIFY pgrst, 'reload schema';
