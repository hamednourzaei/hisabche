-- ============================================
-- workspace-signature-01 — a signature image beside the stamp and the logo
--
-- Owner, 18 Oct 2026: «بعضیا یک مهر، یک امضا و یک لوگو دارن — تعداد عکس‌ها
-- رو بکن ۳ تا». `workspaces` already has `logo_url` and `stamp_url`; this adds
-- the third: `signature_url` (a PNG/SVG data URL, like the other two).
--
-- Additive and idempotent: one nullable column, no default, no backfill — a
-- workspace that never uploaded a signature has none (§12).
--
-- Until this runs the app reads the signature as «none» and refuses to SAVE
-- one with a message naming this file (workspace.service.ts) — it never
-- claims a signature was stored when it was not.
--
-- Rollback / mitigation:
--   alter table public.workspaces drop column if exists signature_url;
--   (Only the uploaded signature images are lost; nothing else reads it.)
-- ============================================

alter table public.workspaces
  add column if not exists signature_url text;

comment on column public.workspaces.signature_url is
  'Owner''s signature image (data URL), printed beside the stamp on every invoice. NULL = none.';
