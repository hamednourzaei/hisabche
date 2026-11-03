-- VERIFY audit-hash-01 — one result set; every row must be ok = true.
SELECT 'chain columns exist' AS check_name,
       (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'audit_logs'
           AND column_name IN ('chain_seq', 'prev_hash', 'hash')) = 3 AS ok
UNION ALL
SELECT 'insert trigger exists',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_logs_chain_trigger' AND NOT tgisinternal)
UNION ALL
SELECT 'append-only guard still exists (admin-02)',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_logs_immutable_trigger' AND NOT tgisinternal)
UNION ALL
SELECT 'heads table is closed to anon and authenticated',
       NOT has_table_privilege('anon', 'public.audit_chain_heads', 'SELECT')
   AND NOT has_table_privilege('authenticated', 'public.audit_chain_heads', 'SELECT')
UNION ALL
SELECT 'verify function is closed to anon and authenticated',
       NOT has_function_privilege('anon', 'public.audit_chain_verify(uuid)', 'EXECUTE')
   AND NOT has_function_privilege('authenticated', 'public.audit_chain_verify(uuid)', 'EXECUTE')
UNION ALL
SELECT 'verify function is open to service_role',
       has_function_privilege('service_role', 'public.audit_chain_verify(uuid)', 'EXECUTE')
UNION ALL
SELECT 'no workspace has a chain that fails verification (run per workspace for the reason)',
       NOT EXISTS (
         SELECT 1 FROM public.audit_chain_heads h
          WHERE NOT (SELECT v.ok FROM public.audit_chain_verify(h.workspace_id) v))
UNION ALL
SELECT 'a retention cleanup did not remove the newest row of any chain',
       NOT EXISTS (
         SELECT 1 FROM public.audit_chain_heads h
          WHERE NOT EXISTS (SELECT 1 FROM public.audit_logs a
                             WHERE a.workspace_id = h.workspace_id AND a.chain_seq = h.last_seq));
