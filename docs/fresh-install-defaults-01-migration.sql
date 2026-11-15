-- ============================================
-- fresh-install-defaults-01: the three column defaults a fresh build loses
-- ============================================
-- base-schema-migration.sql (generated from a structure-only dump) creates these columns
-- NOT NULL and WITHOUT a default. The later migrations that meant to give them one use
-- `ADD COLUMN IF NOT EXISTS ... DEFAULT ...`, which is SKIPPED when the column already
-- exists, so on a database built from docs/ the default never arrives and the first write
-- that omits the column fails with 23502:
--
--   profiles.business_types  '{}'      (onboarding-server-state) - every signup failed
--   interactions.status      'pending' (task-assignment)
--   invoice_items.unit       'piece'   (unified-sale-purchase)
--
-- Found by the browser journey's signup on a database built from docs/ (14 Nov 2026).
-- On the live database the defaults are very likely present already; this sets the SAME
-- value, so running it there changes nothing.
--
-- Idempotent (SET DEFAULT is), additive (no data is touched).
-- Rollback: ALTER TABLE ... ALTER COLUMN ... DROP DEFAULT for each line.
-- Owner action: run this file, then docs/VERIFY-fresh-install-defaults-01.sql.
-- ============================================

ALTER TABLE public.profiles ALTER COLUMN business_types SET DEFAULT '{}';
ALTER TABLE public.interactions ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.invoice_items ALTER COLUMN unit SET DEFAULT 'piece';
