-- ============================================================================
-- docs/VERIFY-invoice-return-06.sql   (read-only; one row; every *_ok must be true)
-- Run AFTER docs/invoice-return-06-scrap-loss-migration.sql.
-- Status until the owner pastes the result: PENDING HUMAN CONFIRMATION.
-- ============================================================================
SELECT
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_invoice_return_scrap_loss' AND NOT tgisinternal) AS trigger_ok,
  NOT has_function_privilege('authenticated', 'public.invoice_return_scrap_loss()', 'EXECUTE') AS fn_private_ok,
  (SELECT pg_get_constraintdef(oid) LIKE '%inventory_loss%' FROM pg_constraint WHERE conname = 'accounts_role_check' LIMIT 1)
    AS role_inventory_loss_ok,
  -- informational: scrap lines written before this migration booked no loss (not backfilled, history stays as it was)
  (SELECT count(*) FROM public.invoice_return_lines WHERE restock_choice = 'scrap') AS legacy_scrap_lines_without_loss;
