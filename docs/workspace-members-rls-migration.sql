-- ============================================
-- workspace_members row-level security
-- Run manually against the Supabase/Postgres database.
--
-- Production symptom:
--   POST /api/workspaces/:id/members/direct -> 500
--   "new row violates row-level security policy for table workspace_members"
--   (Postgres 42501)
--
-- The table has RLS enabled but no INSERT policy, so every insert is denied by
-- default. The backend connects with the service_role key, which normally
-- bypasses RLS entirely — so seeing 42501 in production means the key that
-- instance is running with is NOT the service_role key. Check the boot log:
--
--     🔑 [SUPABASE_SERVICE_KEY] role claim = "service_role"
--
-- If that line says "anon" on Render, fix SUPABASE_SERVICE_KEY there first;
-- these policies are the belt to that braces, and are worth having regardless
-- so the table is not relying on a bypass to be writable.
--
-- The policies below scope every operation to workspaces the caller owns,
-- matching what the service already enforces in `requireRole(..., 'owner')`.
-- ============================================

alter table workspace_members enable row level security;

-- Read: you can see the membership rows of any workspace you belong to.
drop policy if exists workspace_members_select on workspace_members;
create policy workspace_members_select on workspace_members
  for select
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- Write: only the workspace owner adds, changes or removes colleagues.
drop policy if exists workspace_members_insert on workspace_members;
create policy workspace_members_insert on workspace_members
  for insert
  with check (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

drop policy if exists workspace_members_update on workspace_members;
create policy workspace_members_update on workspace_members
  for update
  using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

drop policy if exists workspace_members_delete on workspace_members;
create policy workspace_members_delete on workspace_members
  for delete
  using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );
