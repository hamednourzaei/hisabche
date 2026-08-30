-- ============================================================================
-- docs/sync-conflicts-migration.sql
--
-- Where a rejected offline mutation goes.
--
-- WHY THIS FILE EXISTS
--   When an offline device sent a stale version, the server refused it and the
--   payload was gone: the only surviving copy was in that device's outbox. If
--   the user cleared the app, reinstalled it, or simply tapped "discard", the
--   work vanished with no record that it had ever been attempted.
--
--   Financial conflicts are not resolved by last-write-wins. Both versions are
--   kept here until somebody with the authority decides, and the decision is
--   recorded next to them.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL,
  entity_type    text NOT NULL,
  entity_id      uuid NOT NULL,
  -- Stable across every retry of the same mutation, so a device that retries
  -- a refused write does not pile up duplicate conflicts to review.
  mutation_id    text NOT NULL,
  operation      text NOT NULL,
  -- BOTH sides, exactly as they were. This is the whole point of the table.
  server_version integer,
  server_row     jsonb NOT NULL,
  client_version integer,
  client_payload jsonb NOT NULL,
  -- Which fields diverge, and which of those are financial.
  divergences    jsonb NOT NULL DEFAULT '[]'::jsonb,
  has_financial_divergence boolean NOT NULL DEFAULT false,
  status         text NOT NULL DEFAULT 'open',
  resolution     text,
  resolution_reason text,
  resolved_row   jsonb,
  resolved_by    uuid,
  resolved_at    timestamptz,
  detected_by    uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sync_conflicts_status_check CHECK (status IN ('open', 'resolved', 'superseded')),
  CONSTRAINT sync_conflicts_resolution_check
    CHECK (resolution IS NULL OR resolution IN ('keep_server', 'keep_client', 'merge', 'auto_merge'))
);

-- One open conflict per attempted mutation. A device retrying the same
-- refused write updates its conflict rather than creating another.
CREATE UNIQUE INDEX IF NOT EXISTS sync_conflicts_mutation_key
  ON sync_conflicts (workspace_id, mutation_id);

CREATE INDEX IF NOT EXISTS sync_conflicts_open_idx
  ON sync_conflicts (workspace_id, created_at DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS sync_conflicts_entity_idx
  ON sync_conflicts (workspace_id, entity_type, entity_id);

-- ─── Row level security ─────────────────────────────────────────────────────
-- A conflict row holds a full copy of a financial record, so it is protected
-- exactly as strictly as the record it came from.

ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_conflicts_workspace_members ON sync_conflicts;
CREATE POLICY sync_conflicts_workspace_members ON sync_conflicts
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

COMMIT;
