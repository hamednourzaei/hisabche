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

-- ─── The recursion trap, and how these policies avoid it ────────────────────
--
-- A policy ON `workspace_members` may NOT subquery `workspace_members`:
-- reading the table runs the policy, which reads the table, which runs the
-- policy. Postgres aborts with `42P17: infinite recursion detected in policy`.
--
-- The first version of this file did exactly that:
--
--   using (workspace_id in (
--     select workspace_id from workspace_members where user_id = auth.uid()))
--
-- and it could never once have succeeded. It went unnoticed for a long time
-- because the backend connects with the service role, which bypasses RLS
-- entirely — nothing had ever read this table as a logged-in user until an RLS
-- test did, and it failed on the first query.
--
-- Subquerying `workspaces` is the same trap by a longer road, because the
-- policy on `workspaces` subqueries `workspace_members` right back.
--
-- So both sides go through SECURITY DEFINER functions, which execute as their
-- owner and therefore do not re-enter any policy.

create or replace function auth_owned_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select w.id from workspaces w where w.owner_id = auth.uid()
$$;

revoke all on function auth_owned_workspace_ids() from public;
grant execute on function auth_owned_workspace_ids() to authenticated;

-- Read, part one: your own membership row.
--
-- No subquery at all, so nothing can loop. This is what the login path needs
-- before it knows which workspaces exist, and it leaks nothing — the row is
-- about the person reading it.
drop policy if exists workspace_members_select on workspace_members;
drop policy if exists workspace_members_own_row on workspace_members;
create policy workspace_members_own_row on workspace_members
  for select
  using (user_id = auth.uid());

-- Read, part two: your colleagues in a workspace you belong to.
--
-- Through the SECURITY DEFINER helper. Two SELECT policies are OR'd together,
-- so between them a member sees their own row and everyone they share a
-- workspace with — the same access the recursive version intended.
drop policy if exists workspace_members_colleagues on workspace_members;
create policy workspace_members_colleagues on workspace_members
  for select
  using (is_workspace_member(workspace_id, auth.uid()));

-- Write: only the workspace owner adds, changes or removes colleagues.
drop policy if exists workspace_members_insert on workspace_members;
create policy workspace_members_insert on workspace_members
  for insert
  with check (workspace_id in (select auth_owned_workspace_ids()));

drop policy if exists workspace_members_update on workspace_members;
create policy workspace_members_update on workspace_members
  for update
  using (workspace_id in (select auth_owned_workspace_ids()));

drop policy if exists workspace_members_delete on workspace_members;
create policy workspace_members_delete on workspace_members
  for delete
  using (workspace_id in (select auth_owned_workspace_ids()));
