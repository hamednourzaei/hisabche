-- Read-only. Run after docs/invoice-return-03-repair-migration.sql.
-- ok = the live function no longer reads columns that invoice_items does not have,
-- and it restores stock for a sale return.
SELECT
  position('v_item.tax' IN prosrc) = 0        AS no_item_tax_read,
  position('v_item.buy_price' IN prosrc) = 0  AS no_item_buy_price_read,
  position('stock_movements' IN prosrc) > 0   AS restocks_sale_returns,
  position('cost_consumptions' IN prosrc) > 0 AS restores_cost
FROM pg_proc
WHERE proname = 'invoice_return_create' AND pronamespace = 'public'::regnamespace;
