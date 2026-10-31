-- ============================================================================
-- Verification Query: Purchase Return Accounting in invoice_return_create
-- File: docs/VERIFY-invoice-return-02.sql
-- ============================================================================

-- Post-migration verification query executed and confirmed by human on live Supabase: CONFIRMED (PASS)

SELECT
  p.proname,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'invoice_return_create';
