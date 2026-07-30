-- ============================================
-- Task assignment migration (CRM Interactions -> Tasks)
-- Run manually against the Supabase/Postgres database.
-- Adds the columns needed to turn `interactions` rows into
-- assignable tasks: a status lifecycle, an assigned employee,
-- a denormalized snapshot of the selected customers, a status
-- change history, and an unguessable public_token used by the
-- public, unauthenticated "employee without a site account" view
-- (GET/PATCH /api/public/tasks/:token — see crm.routes.ts).
--
-- Until this migration is run, the backend falls back gracefully
-- (same 42703 "undefined column" catch pattern used in
-- invoice.service.ts / docs/invoice-public-share-migration.sql).
-- ============================================

alter table interactions
  add column if not exists status text not null default 'pending';

alter table interactions
  add column if not exists public_token uuid not null default gen_random_uuid();

alter table interactions
  add column if not exists employee_id uuid;

alter table interactions
  add column if not exists employee_name text;

alter table interactions
  add column if not exists customers_snapshot jsonb not null default '[]'::jsonb;

alter table interactions
  add column if not exists status_history jsonb not null default '[]'::jsonb;

create unique index if not exists interactions_public_token_idx
  on interactions (public_token);

create index if not exists interactions_employee_id_idx
  on interactions (employee_id);
