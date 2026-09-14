-- docs/VERIFY-invoice-idempotency.sql
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
SELECT 'column exists' AS check,
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'invoices'
                 AND column_name = 'client_request_id') AS ok
UNION ALL
SELECT 'unique partial index on (workspace_id, client_request_id)',
       EXISTS (SELECT 1 FROM pg_indexes
               WHERE schemaname = 'public' AND indexname = 'invoices_client_request_key'
                 AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%workspace_id%'
                 AND indexdef LIKE '%client_request_id%' AND indexdef LIKE '%WHERE%');
