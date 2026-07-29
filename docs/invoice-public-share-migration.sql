-- ============================================
-- Invoice public share token migration
-- Run manually against the Supabase/Postgres database.
-- Adds an unguessable per-invoice token used by the public,
-- unauthenticated read-only invoice view (GET /api/public/invoices/:token).
-- Until this migration is run, the app falls back to using the
-- raw invoice id in the public link (see invoice.service.ts /
-- invoice-public.routes.ts "graceful fallback" comments).
-- ============================================

alter table invoices
  add column if not exists public_token uuid not null default gen_random_uuid();

create unique index if not exists invoices_public_token_idx
  on invoices (public_token);
