-- ============================================================================
-- FINDING — why a sandbox answers 403 to its own owner. Read-only.
-- Run BEFORE developer-platform-06b to see the state it repairs.
--
-- has_access = true  and suspended_at IS NULL  → the server lets this person in.
-- Anything else on a sandbox's owner row is the reported fault.
-- ============================================================================

SELECT
  w.id                AS sandbox_id,
  w.name              AS sandbox_name,
  w.sandbox_of        AS real_business_id,
  m.user_id IS NOT NULL AS owner_has_membership_row,
  m.role,
  m.has_access,
  m.suspended_at,
  (m.has_access IS TRUE AND m.suspended_at IS NULL) AS server_lets_owner_in
FROM public.workspaces w
LEFT JOIN public.workspace_members m
       ON m.workspace_id = w.id AND m.user_id = w.owner_id
WHERE w.is_sandbox
ORDER BY w.created_at DESC;

-- The column default the old function relied on.
SELECT column_default, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'workspace_members'
   AND column_name = 'has_access';
