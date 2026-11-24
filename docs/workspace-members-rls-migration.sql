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
set search_path = public
as $$
  select workspace_id from workspace_members
  where user_id = (select auth.uid())
    and role = 'owner'
    and has_access = true
    and suspended_at is null
$$;

revoke all on function auth_owned_workspace_ids() from public, anon;
grant execute on function auth_owned_workspace_ids() to authenticated, service_role;

-- Self-contained: define the colleague-read helper here too (idempotent), so
-- this migration converges even if run before rls-performance-migration.sql.
-- SECURITY DEFINER + STABLE: runs as owner (no policy re-entry) and is evaluated
-- once per statement, not per row.
create or replace function is_workspace_member(_workspace_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = _workspace_id
      and user_id = _user_id
      and has_access = true
      and suspended_at is null
  );
$$;

revoke all on function is_workspace_member(uuid, uuid) from public, anon;
grant execute on function is_workspace_member(uuid, uuid) to authenticated, service_role;

-- Read: your own membership row, plus your colleagues in any workspace you
-- belong to.
--
-- ⚠️ ONE policy, not two. The earlier version created `workspace_members_own_row`
-- and `workspace_members_colleagues` as two permissive SELECT policies with no
-- TO clause (→ PUBLIC). Postgres OR's them — same rows — but every role ended
-- up with two permissive SELECT policies (multiple_permissive_policies), and
-- the bare auth.uid() calls were evaluated per row (auth_rls_initplan).
-- The OR below is exactly the access the pair produced, now scoped to
-- authenticated and evaluated once per statement.
--
-- No subquery on `workspaces` or on `workspace_members` itself: the helper is
-- SECURITY DEFINER, so nothing can loop (42P17).
drop policy if exists workspace_members_select on workspace_members;
drop policy if exists workspace_members_own_row on workspace_members;
drop policy if exists workspace_members_colleagues on workspace_members;
create policy workspace_members_own_row on workspace_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or is_workspace_member(workspace_id, (select auth.uid()))
  );

-- Write: only the workspace owner adds, changes or removes colleagues.
-- These predate the V61 backend-only rule and keep their original form (no
-- TO clause): the owner-scoped check below is the boundary, and the lockdown
-- guard in migration-client-lockdown.test.ts reviews them via the legacy path
-- in rls-performance-migration.sql, which creates the same policies.
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
