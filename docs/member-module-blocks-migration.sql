-- ============================================================================
-- PER-MEMBER PAGE BLOCKS — additive, idempotent, re-runnable.
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor, then the verification query at the
-- bottom. Nothing in this repository executes DDL against the live database.
-- Status: PENDING HUMAN CONFIRMATION.
--
-- WHAT IT IS FOR
--
-- The owner decides, per person, which parts of the product that person may
-- open — "user 231 works on invoices and nothing else". Role overrides
-- (workspace_role_capabilities) change a whole ROLE; profiles (user_roles) can
-- only ADD. Neither can take a page away from ONE person.
--
-- WHAT A ROW MEANS
--
-- One row = one module (backend PERMISSION_MODULES key: invoices, payments,
-- accounting, inventory, …) this member may NOT use. The server removes that
-- module's capabilities from the member's effective set on every request.
--
--   • It only ever RESTRICTS. A block can never give anyone more than their
--     role already holds.
--   • No rows = no restriction. That is the explicit default (G4), and it is
--     also what every workspace has the moment this table is created.
--   • The owner is never restricted — enforced here by the CHECK below and
--     again in the server, which ignores blocks for the owner.
--
-- The backend reads this table before it exists as "no blocks" (42P01 /
-- PGRST205), so deploying the code first is safe.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.workspace_member_module_blocks (
  workspace_id uuid        NOT NULL,
  user_id      uuid        NOT NULL,
  module_key   text        NOT NULL,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id, module_key),
  CONSTRAINT workspace_member_module_blocks_module_check
    CHECK (module_key ~ '^[a-z_]+$')
);

CREATE INDEX IF NOT EXISTS workspace_member_module_blocks_workspace_idx
  ON public.workspace_member_module_blocks (workspace_id);

-- The server writes with the service role. Members may READ their own
-- workspace's rows (so a client can explain a lock); nobody writes directly.
ALTER TABLE public.workspace_member_module_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_member_module_blocks_members_read ON public.workspace_member_module_blocks;
CREATE POLICY workspace_member_module_blocks_members_read ON public.workspace_member_module_blocks
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
  ));

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- Removing every block restores every member to exactly what their role holds —
-- the behaviour before this feature. It deletes no business data.
--
--   DELETE FROM public.workspace_member_module_blocks;          -- lift all blocks
--   DROP TABLE IF EXISTS public.workspace_member_module_blocks; -- remove feature
--
-- The server treats a missing table as "no blocks", so dropping it is safe.
-- ============================================================================

-- ============================================================================
-- VERIFICATION — run separately, after the migration. Every row: ok = true.
-- ============================================================================
-- SELECT 'table exists' AS check,
--        to_regclass('public.workspace_member_module_blocks') IS NOT NULL AS ok
-- UNION ALL
-- SELECT 'rls enabled',
--        COALESCE((SELECT relrowsecurity FROM pg_class
--                  WHERE oid = to_regclass('public.workspace_member_module_blocks')), false)
-- UNION ALL
-- SELECT 'read policy present',
--        EXISTS (SELECT 1 FROM pg_policies
--                WHERE tablename = 'workspace_member_module_blocks'
--                  AND policyname = 'workspace_member_module_blocks_members_read')
-- UNION ALL
-- SELECT 'no write policy for clients',
--        NOT EXISTS (SELECT 1 FROM pg_policies
--                    WHERE tablename = 'workspace_member_module_blocks'
--                      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL'));
