-- ============================================================================
-- docs/personalization-migration.sql
--
-- One row per user per workspace: what THEY have chosen not to see.
--
-- VISIBILITY IS NOT AUTHORIZATION. Nothing in this table grants, revokes or
-- modifies a permission, and nothing here deletes or disables data. It is read
-- AFTER the authorization decision and can only ever narrow it.
--
-- The same person can run their own shop one way and help in somebody else's
-- another, so the profile is keyed by (workspace, user) and not by user alone.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ui_visibility_profiles (
  workspace_id    uuid NOT NULL,
  user_id         uuid NOT NULL,
  modules         jsonb NOT NULL DEFAULT '{}'::jsonb,
  pages           jsonb NOT NULL DEFAULT '{}'::jsonb,
  widgets         jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Expert-level inputs. An ABSENT key here means hidden — the opposite of the
  -- three above, where absent means visible. A new module in an update should
  -- appear; a new expert field should not clutter a shopkeeper's form uninvited.
  advanced_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

-- Suggestions are PROPOSED and never applied. This records what was offered
-- and what the person answered, so the same suggestion is not made twice and
-- "stop suggesting" is honoured.
CREATE TABLE IF NOT EXISTS ui_visibility_suggestions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id      uuid NOT NULL,
  level        text NOT NULL,
  key          text NOT NULL,
  kind         text NOT NULL,
  reason       text NOT NULL,
  -- 'pending' | 'accepted' | 'dismissed' | 'muted'
  answer       text NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now(),
  answered_at  timestamptz,
  CONSTRAINT ui_visibility_suggestions_level_check
    CHECK (level IN ('module', 'page', 'widget', 'field')),
  CONSTRAINT ui_visibility_suggestions_kind_check CHECK (kind IN ('hide', 'show')),
  CONSTRAINT ui_visibility_suggestions_answer_check
    CHECK (answer IN ('pending', 'accepted', 'dismissed', 'muted'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ui_visibility_suggestions_key
  ON ui_visibility_suggestions (workspace_id, user_id, level, key, kind)
  WHERE answer = 'pending';

ALTER TABLE ui_visibility_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ui_visibility_suggestions ENABLE ROW LEVEL SECURITY;

-- A preference is the user's own. Scoped to the workspace like everything
-- else, and then to the person within it: one member's hidden modules are not
-- another member's business.
--
-- ⚠️ One policy per command, not FOR ALL plus a second SELECT policy.
-- `rls-performance-migration.sql` used to add `ui_visibility_profiles_own_rows`
-- (SELECT, user-only) on top of this FOR ALL policy — two permissive SELECT
-- policies for the same role, which Supabase flags as
-- multiple_permissive_policies. The split below keeps one policy per command.
-- Reads are scoped to the user AND their active membership, like every other
-- tenant table (rls-coverage.test.ts): a suspended or removed member must not
-- keep reading workspace rows through a user-only shortcut.
DROP POLICY IF EXISTS ui_visibility_profiles_own ON ui_visibility_profiles;
DROP POLICY IF EXISTS ui_visibility_profiles_own_rows ON ui_visibility_profiles;
DROP POLICY IF EXISTS ui_visibility_profiles_select ON ui_visibility_profiles;
DROP POLICY IF EXISTS ui_visibility_profiles_insert ON ui_visibility_profiles;
DROP POLICY IF EXISTS ui_visibility_profiles_update ON ui_visibility_profiles;
DROP POLICY IF EXISTS ui_visibility_profiles_delete ON ui_visibility_profiles;

CREATE POLICY ui_visibility_profiles_select ON ui_visibility_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
    )
  );

CREATE POLICY ui_visibility_profiles_insert ON ui_visibility_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
    )
  );

CREATE POLICY ui_visibility_profiles_update ON ui_visibility_profiles
  FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
    )
  );

CREATE POLICY ui_visibility_profiles_delete ON ui_visibility_profiles
  FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
    )
  );

DROP POLICY IF EXISTS ui_visibility_suggestions_own ON ui_visibility_suggestions;
CREATE POLICY ui_visibility_suggestions_own ON ui_visibility_suggestions
  FOR ALL TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT auth.uid()) AND has_access = true AND suspended_at IS NULL
    )
  );

COMMIT;
