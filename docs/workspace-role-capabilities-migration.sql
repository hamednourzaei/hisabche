-- ============================================================================
-- docs/workspace-role-capabilities-migration.sql
--
-- Owner, manager and seller become editable PER WORKSPACE.
--
-- ---------------------------------------------------------------------------
-- MODEL
--
-- The defaults stay the static table in backend/src/services/authorization/
-- authorization.domain.ts (MIN_ROLE). A workspace stores only its CHANGES:
--
--   (workspace_id, role, capability, granted)
--
--   granted = true   the role has it here even though the default says no
--   granted = false  the role does NOT have it here even though the default says yes
--   no row           the default applies
--
-- Enforcement (requireCapability, record scopes, services) reads the effective
-- set = defaults with this workspace's rows applied. One source, one answer.
--
-- WHY PER WORKSPACE, NOT role_permissions: the system roles in `roles` are
-- global rows (workspace_id IS NULL). A grant written there would change the
-- seller role of EVERY business on the platform.
--
-- ---------------------------------------------------------------------------
-- SAFETY
--
--   * The owner can never lose member.manage or workspace.manage — enforced in
--     the domain (OWNER_LOCKED_CAPABILITIES) and here by a CHECK. Otherwise a
--     single click locks a business out of its own permissions screen.
--   * Only the backend writes (service_role). Members may READ their own
--     workspace's rows through RLS; no INSERT/UPDATE/DELETE policy exists.
--   * Existing data: none — every workspace keeps exactly today's behaviour
--     until an owner changes a cell. No backfill.
--
-- ROLLBACK / MITIGATION
--   DROP TABLE IF EXISTS public.workspace_role_capabilities;
-- The backend treats a missing table (42P01) as «no changes»: the static
-- defaults apply, which is today's behaviour.
--
-- ADDITIVE / IDEMPOTENT. SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.workspace_role_capabilities (
  workspace_id uuid        NOT NULL,
  role         text        NOT NULL,
  capability   text        NOT NULL,
  granted      boolean     NOT NULL,
  updated_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, role, capability),
  CONSTRAINT workspace_role_capabilities_role_check
    CHECK (role IN ('owner', 'manager', 'seller')),
  CONSTRAINT workspace_role_capabilities_owner_lock_check
    CHECK (NOT (role = 'owner'
                AND capability IN ('member.manage', 'workspace.manage')
                AND granted = false))
);

CREATE INDEX IF NOT EXISTS workspace_role_capabilities_workspace_idx
  ON public.workspace_role_capabilities (workspace_id);

ALTER TABLE public.workspace_role_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_role_capabilities_members_read ON public.workspace_role_capabilities;
CREATE POLICY workspace_role_capabilities_members_read ON public.workspace_role_capabilities
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

COMMIT;

NOTIFY pgrst, 'reload schema';
