-- Verification query for docs/project-change-orders-04-idempotent-lock-migration.sql
SELECT 'create_project_change_order_v2 exists' AS check_name,
       to_regprocedure('public.create_project_change_order_v2(uuid,uuid,uuid,text,bigint,bigint,boolean,numeric,text,integer,text)') IS NOT NULL AS ok
UNION ALL
SELECT 'create_project_change_order_v2 revoked from public/anon/authenticated',
       NOT has_function_privilege(
         'anon',
         'public.create_project_change_order_v2(uuid,uuid,uuid,text,bigint,bigint,boolean,numeric,text,integer,text)',
         'EXECUTE'
       )
       AND NOT has_function_privilege(
         'authenticated',
         'public.create_project_change_order_v2(uuid,uuid,uuid,text,bigint,bigint,boolean,numeric,text,integer,text)',
         'EXECUTE'
       );
