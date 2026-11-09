-- VERIFY cycle-count-04 — read-only. Every row must say ok = true.
SELECT 'function exists' AS check,
       to_regprocedure('public.cycle_count_open(uuid, uuid, uuid, text, uuid[])') IS NOT NULL AS ok
UNION ALL
SELECT 'revision', obj_description(to_regprocedure('public.cycle_count_open(uuid, uuid, uuid, text, uuid[])'), 'pg_proc') = 'cycle-count-04:rev1'
UNION ALL
SELECT 'security definer', (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.cycle_count_open(uuid, uuid, uuid, text, uuid[])'))
UNION ALL
SELECT 'anon cannot execute', NOT has_function_privilege('anon', 'public.cycle_count_open(uuid, uuid, uuid, text, uuid[])', 'EXECUTE')
UNION ALL
SELECT 'authenticated cannot execute', NOT has_function_privilege('authenticated', 'public.cycle_count_open(uuid, uuid, uuid, text, uuid[])', 'EXECUTE')
UNION ALL
SELECT 'service_role can execute', has_function_privilege('service_role', 'public.cycle_count_open(uuid, uuid, uuid, text, uuid[])', 'EXECUTE')
UNION ALL
SELECT 'no count without lines', NOT EXISTS (
  SELECT 1 FROM public.cycle_counts c
   WHERE c.status = 'counting'
     AND NOT EXISTS (SELECT 1 FROM public.cycle_count_lines l WHERE l.count_id = c.id)
);
