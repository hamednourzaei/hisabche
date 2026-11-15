-- ============================================
-- VERIFY-fresh-install-defaults-01.sql - run AFTER fresh-install-defaults-01. Read-only, one row.
-- Every column must be true.
-- ============================================
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'profiles'
             AND column_name = 'business_types' AND column_default IS NOT NULL) AS profiles_business_types_has_default,
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'interactions'
             AND column_name = 'status' AND column_default LIKE '%pending%') AS interactions_status_has_default,
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'invoice_items'
             AND column_name = 'unit' AND column_default LIKE '%piece%') AS invoice_items_unit_has_default;
-- Post-migration verification query generated - PENDING HUMAN CONFIRMATION
