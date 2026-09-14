-- docs/VERIFY-pos-schema.sql — why every /api/pos/* answers 500.
-- Read-only. Run it and send the rows back.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
WITH expected(tbl, col) AS (VALUES
  ('pos_sessions','id'),('pos_sessions','workspace_id'),('pos_sessions','branch_id'),('pos_sessions','status'),
  ('pos_sessions','opening_float_minor'),('pos_sessions','opened_at'),('pos_sessions','opened_by'),
  ('pos_sessions','counted_cash_minor'),('pos_sessions','variance_reason'),('pos_sessions','closed_at'),
  ('pos_sessions','closed_by'),('pos_sessions','was_forced'),('pos_sessions','journal_entry_id'),
  ('pos_orders','id'),('pos_orders','workspace_id'),('pos_orders','session_id'),('pos_orders','order_ref'),
  ('pos_orders','total_minor'),('pos_orders','change_minor'),('pos_orders','status'),('pos_orders','created_at'),
  ('pos_order_payments','method'),('pos_order_payments','amount_minor'),
  ('pos_cash_movements','id'),('pos_cash_movements','workspace_id'),('pos_cash_movements','session_id'),
  ('pos_cash_movements','kind'),('pos_cash_movements','amount_minor'),('pos_cash_movements','reason'),
  ('pos_cash_movements','created_at'),('pos_cash_movements','created_by'),
  ('payments','method'),('payments','status'),('payments','direction'),('payments','amount'),
  ('payments','user_id'),('payments','deleted_at'),('payments','payment_number')
)
SELECT e.tbl, e.col,
       EXISTS (SELECT 1 FROM information_schema.columns c
               WHERE c.table_schema='public' AND c.table_name=e.tbl AND c.column_name=e.col) AS ok
FROM expected e
ORDER BY ok, e.tbl, e.col;
