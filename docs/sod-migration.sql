-- ============================================================================
-- docs/sod-migration.sql
--
-- Segregation of duties: the settings, the index of who did what to which
-- document, and the record of every override.
--
-- WHY `sod_actions` IS ITS OWN TABLE
--   It could be a query over audit_logs. It is not, because the audit trail is
--   a narrative written for people and its shape changes with the features
--   that write to it. This is a machine-read index that a CONTROL depends on:
--   if its shape drifts, the control silently stops catching anything.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sod_settings (
  workspace_id   uuid PRIMARY KEY,
  -- 'off'    not enforced. The default, and correct for a one-person shop:
  --          a control that forces people to share a login is worse than none.
  -- 'warn'   enforced, with a recorded override for the workspace owner.
  -- 'strict' enforced with no override.
  mode           text NOT NULL DEFAULT 'off',
  disabled_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sod_settings_mode_check CHECK (mode IN ('off', 'warn', 'strict'))
);

CREATE TABLE IF NOT EXISTS sod_actions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid NOT NULL,
  capability   text NOT NULL,
  actor_id     uuid NOT NULL,
  actor_role   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- The lookup the check makes on every guarded action.
CREATE INDEX IF NOT EXISTS sod_actions_entity_idx
  ON sod_actions (workspace_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS sod_overrides (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  rule_id      text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid NOT NULL,
  capability   text NOT NULL,
  actor_id     uuid NOT NULL,
  -- Never empty. An override with no reason records that somebody bypassed a
  -- separation of duties and not why, which is the same as no control.
  reason       text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sod_overrides_reason_check CHECK (length(btrim(reason)) > 0)
);

CREATE INDEX IF NOT EXISTS sod_overrides_workspace_idx
  ON sod_overrides (workspace_id, created_at DESC);

ALTER TABLE sod_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sod_actions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sod_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sod_settings_workspace_members ON sod_settings;
CREATE POLICY sod_settings_workspace_members ON sod_settings
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS sod_actions_workspace_members ON sod_actions;
CREATE POLICY sod_actions_workspace_members ON sod_actions
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS sod_overrides_workspace_members ON sod_overrides;
CREATE POLICY sod_overrides_workspace_members ON sod_overrides
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
