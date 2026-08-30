-- ============================================================================
-- docs/mdm-migration.sql
--
-- The record of every merge, and where an absorbed record went.
--
-- A merge moves invoices, debts and payment history from one identity to
-- another. The absorbed row is soft-deleted and keeps a pointer to its
-- survivor rather than being removed: somebody holding a printed invoice with
-- the old id must still be able to find out what happened to it.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS mdm_merges (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL,
  entity            text NOT NULL,
  survivor_id       uuid NOT NULL,
  absorbed_id       uuid NOT NULL,
  -- The absorbed record exactly as it was. A merge cannot be undone
  -- automatically, but it must always be possible to see what was lost.
  absorbed_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason            text NOT NULL,
  merged_by         uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mdm_merges_entity_check CHECK (entity IN ('customer', 'supplier', 'product')),
  CONSTRAINT mdm_merges_distinct_check CHECK (survivor_id <> absorbed_id),
  CONSTRAINT mdm_merges_reason_check CHECK (length(btrim(reason)) > 0)
);

CREATE INDEX IF NOT EXISTS mdm_merges_workspace_idx
  ON mdm_merges (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS mdm_merges_absorbed_idx
  ON mdm_merges (workspace_id, absorbed_id);

-- Where an absorbed record went. Followed when an old id is looked up.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS merged_into_id uuid;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS merged_into_id uuid;
ALTER TABLE products  ADD COLUMN IF NOT EXISTS merged_into_id uuid;

ALTER TABLE mdm_merges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mdm_merges_workspace_members ON mdm_merges;
CREATE POLICY mdm_merges_workspace_members ON mdm_merges
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
