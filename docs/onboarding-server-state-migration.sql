-- ============================================
-- Onboarding completion, stored server-side
-- Run manually against the Supabase/Postgres database.
--
-- Onboarding state lived only in the browser (zustand + localStorage). Clearing
-- site data — or simply signing in from another device or browser — made the
-- wizard reappear to someone who had already finished it and issued dozens of
-- invoices. The answer the user gives belongs to the account, not the browser.
--
--   onboarding_completed_at  set once, on completion. NULL = never finished.
--                            A timestamp rather than a boolean so we can tell
--                            when a business was set up without a second column.
--   business_types           the trades chosen from the searchable list. An
--                            array because a trader may legitimately run more
--                            than one (a shop that also does repairs).
--   store_size               small | medium | large
--   business_note            optional free text from the onboarding form
-- ============================================

alter table profiles
  add column if not exists onboarding_completed_at timestamptz;

alter table profiles
  add column if not exists business_types text[] not null default '{}';

alter table profiles
  add column if not exists store_size text;

alter table profiles
  add column if not exists business_note text;

-- Anyone who already has invoices has plainly finished onboarding; backfill so
-- the wizard does not greet existing users once this ships.
update profiles p
set onboarding_completed_at = now()
where p.onboarding_completed_at is null
  and exists (select 1 from invoices i where i.user_id = p.id);

-- The gate reads this column on every dashboard load.
create index if not exists profiles_onboarding_completed_idx
  on profiles (onboarding_completed_at);
