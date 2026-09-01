-- ============================================================================
-- docs/_repair-owner-memberships.sql
--
-- Run this AFTER `FIX-403.sql`, when its fourth row reported `0 rows`.
--
-- ---------------------------------------------------------------------------
-- WHY THE DEFAULT ALONE WAS NOT ENOUGH
--
-- `FIX-403.sql` restores `has_access DEFAULT true`, which fixes the NEXT
-- insert. It cannot fix an insert that already failed — there is no row to
-- repair. And signing out and in again does not help either:
--
--     workspace.service.ts   createWorkspace() inserts the membership
--                            → and only runs when a workspace is CREATED
--
-- The workspace already exists. Onboarding finds it, creates nothing, and the
-- owner still has no membership. That is the state this repairs.
--
-- ---------------------------------------------------------------------------
-- WHAT IT INFERS, AND WHAT IT REFUSES TO
--
-- `workspaces.owner_id` is recorded truth: the person who created the
-- business. A workspace whose owner is not a member of it is a broken state,
-- not a deliberate one, and restoring that one membership is derivation — not
-- a guess.
--
-- ⚠️ It restores OWNERS ONLY.
--
-- Managers and sellers whose invites failed the same way are NOT recreated,
-- because nothing in the surviving data says who they were or what role they
-- held. Inventing them would hand people access the database has no record of
-- them ever being granted. Once the owner can sign in, they can re-invite.
--
-- SAFE TO RE-RUN. `ON CONFLICT DO NOTHING` on the workspace/user pair.
-- ============================================================================

INSERT INTO workspace_members (workspace_id, user_id, role, has_access)
SELECT w.id, w.owner_id, 'owner', true
FROM workspaces w
WHERE w.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = w.id AND m.user_id = w.owner_id
  );

-- ============================================================================
-- PROOF — one result set, because the editor shows only the last.
-- ============================================================================

SELECT check_name, result, detail FROM (

  SELECT 1 AS ord,
    'every workspace has its owner as a member' AS check_name,
    CASE WHEN (
      SELECT count(*) FROM workspaces w
      WHERE w.owner_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM workspace_members m
          WHERE m.workspace_id = w.id AND m.user_id = w.owner_id
        )
    ) = 0 THEN 'PASS' ELSE 'FAIL' END AS result,
    'an owner who cannot open their own books' AS detail

  UNION ALL
  SELECT 2,
    'memberships are usable',
    CASE WHEN (
      SELECT count(*) FROM workspace_members
      WHERE has_access IS NOT TRUE OR suspended_at IS NOT NULL
    ) = 0 THEN 'PASS' ELSE 'FAIL' END,
    -- Both are what `listAuthorizedWorkspaces` filters on:
    --   .eq('has_access', true).is('suspended_at', null)
    -- A row failing either is invisible to the application and produces the
    -- same 403 as no row at all.
    'has_access true and not suspended'

  UNION ALL
  SELECT 3, 'workspaces', 'INFO', (SELECT count(*)::text FROM workspaces)

  UNION ALL
  SELECT 4, 'memberships', 'INFO', (SELECT count(*)::text FROM workspace_members)

) checks
ORDER BY ord;
