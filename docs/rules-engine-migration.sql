-- ============================================================================
-- docs/rules-engine-migration.sql
--
-- Business rules a workspace can change without a deploy.
--
-- A rule produces a DECISION and never performs one. "Discount over 15% needs
-- the sales manager" is a rule; applying the discount, starting the approval
-- and refusing the save are all the domain's job. That is why there is no
-- `allow` action and no expression column: a rule can require an approval or
-- block a document, never widen what somebody may do, and nothing here is
-- evaluated as code.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS business_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  name          text NOT NULL,
  entity        text NOT NULL,
  -- { match: 'all' | 'any', conditions: [{ field, operator, value }] }
  -- A closed operator set over named fields. Never an expression to parse: a
  -- rule engine that evaluates strings is a remote code execution feature the
  -- customer configures themselves.
  conditions    jsonb NOT NULL DEFAULT '{"match":"all","conditions":[]}'::jsonb,
  actions       jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Lower runs first. Ties break on id in the domain, so evaluation order
  -- never varies between runs or between replicas.
  priority      integer NOT NULL DEFAULT 100,
  active        boolean NOT NULL DEFAULT true,
  stop_on_match boolean NOT NULL DEFAULT false,
  deleted_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  CONSTRAINT business_rules_entity_check CHECK (
    entity IN ('invoice', 'payment', 'purchase_order', 'journal_entry', 'customer', 'product')
  )
);

CREATE INDEX IF NOT EXISTS business_rules_lookup_idx
  ON business_rules (workspace_id, entity, priority)
  WHERE active = true AND deleted_at IS NULL;

-- Which rule decided what, on which document. This is the answer to "why did
-- this invoice need approval", and it is why a rule is deactivated rather than
-- deleted once it has decided anything.
CREATE TABLE IF NOT EXISTS rule_decisions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  rule_id      uuid,
  rule_name    text NOT NULL,
  entity       text NOT NULL,
  entity_id    uuid,
  action_kind  text NOT NULL,
  action       jsonb NOT NULL DEFAULT '{}'::jsonb,
  facts        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rule_decisions_entity_idx
  ON rule_decisions (workspace_id, entity, entity_id);

ALTER TABLE business_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_decisions  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_rules_workspace_members ON business_rules;
CREATE POLICY business_rules_workspace_members ON business_rules
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

DROP POLICY IF EXISTS rule_decisions_workspace_members ON rule_decisions;
CREATE POLICY rule_decisions_workspace_members ON rule_decisions
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

-- ─── Workflows grow a workspace ─────────────────────────────────────────────
-- `workflows` was queried with NO workspace filter when routing an invoice to
-- approval, so the first active invoice workflow in the entire database
-- started approvals on every shop's invoices.

ALTER TABLE workflows ADD COLUMN IF NOT EXISTS workspace_id uuid;

CREATE INDEX IF NOT EXISTS workflows_workspace_idx
  ON workflows (workspace_id, entity_type)
  WHERE is_active = true AND deleted_at IS NULL;

COMMIT;
