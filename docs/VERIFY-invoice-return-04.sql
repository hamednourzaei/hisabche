-- Read-only. Run after docs/invoice-return-04-one-per-invoice-migration.sql.
-- trigger_exists        = the BEFORE INSERT trigger is on invoice_returns
-- function_locked_down  = no role but the owner can call the trigger function directly
-- legacy_multi_return_invoices = invoices that ALREADY had more than one return before
--                         the lock (informational: they are left as they are)
SELECT
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'invoice_returns_one_per_invoice_trg'
      AND tgrelid = 'public.invoice_returns'::regclass
      AND NOT tgisinternal
  ) AS trigger_exists,
  NOT has_function_privilege('service_role', 'public.invoice_returns_one_per_invoice()', 'EXECUTE')
    AS function_locked_down,
  (
    SELECT count(*) FROM (
      SELECT original_invoice_id FROM public.invoice_returns
      GROUP BY original_invoice_id HAVING count(*) > 1
    ) d
  ) AS legacy_multi_return_invoices;
