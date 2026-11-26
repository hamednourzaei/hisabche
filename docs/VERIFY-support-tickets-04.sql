-- Verification query for docs/support-tickets-04-atomic-create-assign-migration.sql
SELECT 'create_support_ticket_atomic exists' AS check_name,
       to_regprocedure('public.create_support_ticket_atomic(uuid,uuid,text,text,text,text,text,integer,timestamptz,text)') IS NOT NULL AS ok
UNION ALL
SELECT 'assign_support_ticket_atomic exists',
       to_regprocedure('public.assign_support_ticket_atomic(uuid,uuid,uuid,uuid)') IS NOT NULL
UNION ALL
SELECT 'functions revoked from public/anon/authenticated',
       NOT has_function_privilege('anon', 'public.create_support_ticket_atomic(uuid,uuid,text,text,text,text,text,integer,timestamptz,text)', 'EXECUTE')
       AND NOT has_function_privilege('authenticated', 'public.assign_support_ticket_atomic(uuid,uuid,uuid,uuid)', 'EXECUTE');
