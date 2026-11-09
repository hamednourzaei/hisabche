-- docs/VERIFY-advances-03.sql — read-only. Every row must be ok = true.
SELECT 'document column exists' AS "check",
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'order_deposits'
                 AND column_name = 'document' AND data_type = 'jsonb') AS ok
UNION ALL
SELECT 'shape constraint present',
       EXISTS (SELECT 1 FROM pg_constraint
               WHERE conname = 'order_deposits_document_shape'
                 AND conrelid = 'public.order_deposits'::regclass)
UNION ALL
SELECT 'frozen trigger present',
       EXISTS (SELECT 1 FROM pg_trigger
               WHERE tgname = 'order_deposits_document_frozen_trg'
                 AND tgrelid = 'public.order_deposits'::regclass AND NOT tgisinternal)
UNION ALL
SELECT 'trigger function not callable by clients',
       NOT has_function_privilege('authenticated', 'public.order_deposits_document_frozen()', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public.order_deposits_document_frozen()', 'EXECUTE')
UNION ALL
SELECT 'no non-advance row has a document',
       NOT EXISTS (SELECT 1 FROM public.order_deposits
                   WHERE document IS NOT NULL AND source_type NOT IN ('pre_sale', 'pre_purchase'));
