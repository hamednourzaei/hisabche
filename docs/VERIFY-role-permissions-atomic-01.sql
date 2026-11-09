-- VERIFY role-permissions-atomic-01 — read-only. Every row must say ok = true.
SELECT 'function exists' AS check,
       to_regprocedure('public.role_update_with_permissions(uuid, boolean, text, boolean, text, uuid[])') IS NOT NULL AS ok
UNION ALL
SELECT 'revision', obj_description(to_regprocedure('public.role_update_with_permissions(uuid, boolean, text, boolean, text, uuid[])'), 'pg_proc') = 'role-permissions-atomic-01:rev1'
UNION ALL
SELECT 'anon cannot execute', NOT has_function_privilege('anon', 'public.role_update_with_permissions(uuid, boolean, text, boolean, text, uuid[])', 'EXECUTE')
UNION ALL
SELECT 'authenticated cannot execute', NOT has_function_privilege('authenticated', 'public.role_update_with_permissions(uuid, boolean, text, boolean, text, uuid[])', 'EXECUTE')
UNION ALL
SELECT 'service_role can execute', has_function_privilege('service_role', 'public.role_update_with_permissions(uuid, boolean, text, boolean, text, uuid[])', 'EXECUTE');
