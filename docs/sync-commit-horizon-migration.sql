-- ============================================================================
-- Migration: docs/sync-commit-horizon-migration.sql
-- Name: Commit Horizon Sync Pull via xid8 and pg_snapshot_xmin
-- Phase: Universal Core / Launch Critical
-- Date: 2026-10-26
--
-- Purpose:
--   Eliminates the in-flight commit-order hazard in sync_change_log without
--   write serialization or sleep heuristics. Every log entry records its
--   Postgres transaction ID (xid8). The pull query returns only entries whose
--   txid is strictly less than pg_snapshot_xmin(pg_current_snapshot()),
--   guaranteeing that no in-flight transaction with a smaller sync_version
--   can commit later.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.sync_pull_changes(uuid, bigint, int);
--   DROP INDEX IF EXISTS public.sync_change_log_ws_version_idx;
--   DROP INDEX IF EXISTS public.sync_change_log_txid_idx;
--   ALTER TABLE public.sync_change_log DROP COLUMN IF EXISTS txid;
-- ============================================================================

-- ── 1. Add txid to sync_change_log ──────────────────────────────────────────

ALTER TABLE public.sync_change_log
  ADD COLUMN IF NOT EXISTS txid xid8 DEFAULT pg_current_xact_id();

-- Rename misnamed index if present, or create with proper name
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'sync_change_log_txid_idx' AND tablename = 'sync_change_log')
     AND NOT EXISTS (
       SELECT 1 FROM pg_attribute a
       JOIN pg_class c ON a.attrelid = c.oid
       WHERE c.relname = 'sync_change_log_txid_idx' AND a.attname = 'txid'
     ) THEN
    ALTER INDEX public.sync_change_log_txid_idx RENAME TO sync_change_log_ws_version_idx;
  ELSIF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'sync_change_log_ws_version_idx') THEN
    CREATE INDEX sync_change_log_ws_version_idx ON public.sync_change_log (workspace_id, sync_version);
  END IF;
END $$;

-- Dedicated index on txid to accelerate horizon filtering
CREATE INDEX IF NOT EXISTS sync_change_log_txid_idx
  ON public.sync_change_log (txid);

-- ── 2. The Commit-Horizon Pull Function ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_pull_changes(
  p_workspace_id uuid,
  p_cursor       bigint,
  p_limit        int
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
  ORDER BY s.sync_version ASC
  LIMIT p_limit;
$fn$;

-- ── 3. Hardened Permissions ────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.sync_pull_changes(uuid, bigint, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_pull_changes(uuid, bigint, int) FROM anon;
REVOKE ALL ON FUNCTION public.sync_pull_changes(uuid, bigint, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_pull_changes(uuid, bigint, int) TO service_role;
