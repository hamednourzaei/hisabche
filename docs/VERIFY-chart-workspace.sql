-- ============================================================================
-- READ-ONLY. The sales endpoint returns all zeros, yet 3 sales exist in the
-- last 7 days. The dashboard request is scoped to workspace
-- 3f19d3ca-b024-4565-b5e3-47a078585c72 (seen in the production log).
--
-- Are the invoices in THAT workspace?
-- ============================================================================

-- 1. Which workspace each invoice belongs to, next to the one the dashboard asks for.
SELECT  invoice_number,
        type,
        date,
        workspace_id,
        (workspace_id = '3f19d3ca-b024-4565-b5e3-47a078585c72') AS is_dashboard_workspace
FROM    invoices
ORDER BY invoice_number DESC;

-- 2. Every workspace this user is a member of.
--    user 2a51e3d6-e3c9-4947-ab4f-5bbc54a8ec8e (from the same log)
SELECT  wm.workspace_id,
        w.name,
        wm.role,
        wm.has_access,
        wm.suspended_at
FROM    workspace_members wm
LEFT JOIN workspaces w ON w.id = wm.workspace_id
WHERE   wm.user_id = '2a51e3d6-e3c9-4947-ab4f-5bbc54a8ec8e';
