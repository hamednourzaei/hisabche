-- ============================================================================
-- docs/CREATE-MY-WORKSPACE.sql
--
-- Creates the workspace the application cannot create for you.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS NEEDED
--
-- The logs are unambiguous:
--
--     GET /api/workspaces      → 200   (an empty array)
--     everything else          → 403   userId set, workspaceId null
--
-- You are signed in and belong to no workspace. `FIX-403.sql` worked —
-- `has_access` has its default — but there was never a workspace to be a
-- member OF. The reset dropped every table in `public`, and `auth.users`
-- survived, so the account outlived the business.
--
-- ⚠️ And the application cannot fix this itself. There is no onboarding route
-- and nothing in the entire frontend calls `createWorkspace` — the only code
-- that creates a workspace is a backend service with no UI reaching it. A user
-- in this state is permanently stuck: the dashboard fires a hundred requests
-- that all 403, and there is no screen that offers to create anything.
--
-- That is a real product gap, not a database problem. This unblocks you now.
--
-- ---------------------------------------------------------------------------
-- SAFE TO RE-RUN. It creates nothing if you already have a membership.
-- ============================================================================

DO $create$
DECLARE
  -- From the backend logs: the account making the requests.
  v_user_id uuid := '2a51e3d6-e3c9-4947-ab4f-5bbc54a8ec8e';
  v_workspace_id uuid;
BEGIN
  -- Already sorted? Do nothing rather than create a second business.
  IF EXISTS (SELECT 1 FROM workspace_members WHERE user_id = v_user_id AND has_access) THEN
    RAISE NOTICE 'membership already exists — nothing to do';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'user % does not exist in auth.users', v_user_id;
  END IF;

  INSERT INTO workspaces (name, slug, owner_id)
  VALUES ('حسابچه', 'hisabche', v_user_id)
  RETURNING id INTO v_workspace_id;

  -- ⚠️ `has_access` is set EXPLICITLY here rather than left to the default.
  --
  -- The default is now correct, but this script exists precisely because that
  -- default went missing once. A repair script that depends on the thing it is
  -- repairing is a repair script that fails when you need it most.
  INSERT INTO workspace_members (workspace_id, user_id, role, has_access)
  VALUES (v_workspace_id, v_user_id, 'owner', true);

  RAISE NOTICE 'workspace % created, % is its owner', v_workspace_id, v_user_id;
END $create$;

-- ============================================================================
-- PROOF — one result set, because the editor shows only the last.
-- ============================================================================

SELECT check_name, result, detail FROM (

  SELECT 1 AS ord,
    'you have a workspace' AS check_name,
    CASE WHEN EXISTS (
      SELECT 1 FROM workspace_members
      WHERE user_id = '2a51e3d6-e3c9-4947-ab4f-5bbc54a8ec8e'
        AND has_access AND suspended_at IS NULL
    ) THEN 'PASS' ELSE 'FAIL' END AS result,
    -- These are the exact filters `listAuthorizedWorkspaces` applies:
    --   .eq('user_id', …).eq('has_access', true).is('suspended_at', null)
    -- A row that fails any of them is invisible and still produces 403.
    'has_access true, not suspended' AS detail

  UNION ALL
  SELECT 2, 'exactly one workspace',
    CASE WHEN (SELECT count(*) FROM workspaces) = 1 THEN 'PASS' ELSE 'CHECK' END,
    -- ⚠️ More than one is not an error, but `requireWorkspace()` refuses to
    -- guess between them without an explicit id — which reads as a 403 too.
    (SELECT count(*)::text || ' workspaces' FROM workspaces)

  UNION ALL
  SELECT 3, 'workspace', 'INFO',
    coalesce((SELECT name || '  (' || id::text || ')' FROM workspaces LIMIT 1), 'none')

) checks
ORDER BY ord;
