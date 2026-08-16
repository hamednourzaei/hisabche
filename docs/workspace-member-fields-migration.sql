-- ============================================
-- Workspace member fields (Team & Payroll)
-- Run manually against the Supabase/Postgres database.
--
-- Adding a colleague used to go through an invite flow that only carried an
-- email. The owner now records the person directly — job title and phone
-- included — and decides separately whether that person gets to sign in at
-- all. A bookkeeper on the payroll who never touches the software is a real
-- case, and forcing an auth account for them was the source of most of the
-- invite bugs.
--
--   job_title    what they do, shown in the member table
--   phone        contact number, not a login credential
--   has_access   false = payroll record only, no auth user exists
--   suspended_at set = keeps the row and the history, blocks sign-in.
--                Deleting removes the auth user outright; suspending is the
--                reversible option, which is why they are different columns
--                rather than one status enum.
-- ============================================

alter table workspace_members
  add column if not exists job_title text;

alter table workspace_members
  add column if not exists phone text;

alter table workspace_members
  add column if not exists has_access boolean not null default true;

alter table workspace_members
  add column if not exists suspended_at timestamptz;

-- The member list filters on the workspace and orders by suspension state.
create index if not exists workspace_members_workspace_suspended_idx
  on workspace_members (workspace_id, suspended_at);
