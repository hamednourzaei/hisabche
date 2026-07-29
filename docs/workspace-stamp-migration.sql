-- ============================================
-- Workspace stamp/signature image migration
-- Run manually against the Supabase/Postgres database.
-- Mirrors the existing `logo_url` column on `workspaces` (added outside
-- of tracked Drizzle migrations — see backend/drizzle/migrations, which
-- still only has the original `logo` column).
-- Adds `stamp_url`, storing the owner's stamp/signature image (PNG/SVG,
-- uploaded as a data URL) so it can be shown on every invoice via
-- InvoiceDocumentBusiness.stampUrl. Until this migration is run, the
-- app degrades gracefully to no-stamp (see workspace.service.ts).
-- ============================================

alter table workspaces
  add column if not exists stamp_url text;
