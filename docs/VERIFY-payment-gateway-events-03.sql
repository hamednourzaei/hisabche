-- Verification query for docs/payment-gateway-events-03-atomic-internal-migration.sql
SELECT 'provenance column exists' AS check_name,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'payment_gateway_events' AND column_name = 'provenance'
       ) AS ok
UNION ALL
SELECT 'idempotency index exists',
       to_regclass('public.idx_payment_gateway_events_ws_idempotency') IS NOT NULL
UNION ALL
SELECT 'transition_payment_processor_state exists',
       to_regprocedure('public.transition_payment_processor_state(uuid,uuid,text,text,text,integer,text,uuid,boolean,text)') IS NOT NULL
UNION ALL
SELECT 'transition_payment_processor_state revoked from public/anon/authenticated',
       NOT has_function_privilege(
         'anon',
         'public.transition_payment_processor_state(uuid,uuid,text,text,text,integer,text,uuid,boolean,text)',
         'EXECUTE'
       )
       AND NOT has_function_privilege(
         'authenticated',
         'public.transition_payment_processor_state(uuid,uuid,text,text,text,integer,text,uuid,boolean,text)',
         'EXECUTE'
       );
