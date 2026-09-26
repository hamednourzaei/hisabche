-- ============================================================================
-- VERIFY — event-log-claim, member-module-blocks, email-outbox (26 Sep).
-- Read-only. Expected: 16 rows, every one ok = true.
-- Written with to_regclass / to_regprocedure so a part that was NOT installed
-- shows as ok = false instead of aborting the whole query.
-- ============================================================================

-- ─── event-log-claim-migration.sql ──────────────────────────────────────────
SELECT 'event_log: claim columns' AS check,
       (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'event_log'
           AND column_name IN ('claimed_by', 'claim_expires_at')) = 2 AS ok
UNION ALL
SELECT 'event_log: 3 functions',
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname IN ('claim_event_log', 'complete_event_log', 'fail_event_log')) = 3
UNION ALL
SELECT 'event_log: claim uses SKIP LOCKED',
       COALESCE(pg_get_functiondef(to_regprocedure('public.claim_event_log(text, integer, integer, uuid)'))
                ILIKE '%FOR UPDATE SKIP LOCKED%', false)
UNION ALL
SELECT 'event_log: clients cannot claim',
       to_regprocedure('public.claim_event_log(text, integer, integer, uuid)') IS NOT NULL
       AND NOT has_function_privilege('anon', 'public.claim_event_log(text, integer, integer, uuid)', 'EXECUTE')
       AND NOT has_function_privilege('authenticated', 'public.claim_event_log(text, integer, integer, uuid)', 'EXECUTE')

-- ─── member-module-blocks-migration.sql ─────────────────────────────────────
UNION ALL
SELECT 'member blocks: table exists',
       to_regclass('public.workspace_member_module_blocks') IS NOT NULL
UNION ALL
SELECT 'member blocks: rls enabled',
       COALESCE((SELECT relrowsecurity FROM pg_class
                 WHERE oid = to_regclass('public.workspace_member_module_blocks')), false)
UNION ALL
SELECT 'member blocks: read policy present',
       EXISTS (SELECT 1 FROM pg_policies
               WHERE tablename = 'workspace_member_module_blocks'
                 AND policyname = 'workspace_member_module_blocks_members_read')
UNION ALL
SELECT 'member blocks: no write policy for clients',
       NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'workspace_member_module_blocks'
                     AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL'))

-- ─── email-outbox-migration.sql ─────────────────────────────────────────────
UNION ALL
SELECT 'email outbox: table exists',
       to_regclass('public.email_outbox') IS NOT NULL
UNION ALL
SELECT 'email outbox: rls on',
       COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.email_outbox')), false)
UNION ALL
SELECT 'email outbox: no client policies',
       to_regclass('public.email_outbox') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_outbox')
UNION ALL
SELECT 'email outbox: anon cannot read',
       to_regclass('public.email_outbox') IS NOT NULL
       AND NOT has_table_privilege('anon', 'public.email_outbox', 'SELECT')
UNION ALL
SELECT 'email outbox: authenticated cannot read',
       to_regclass('public.email_outbox') IS NOT NULL
       AND NOT has_table_privilege('authenticated', 'public.email_outbox', 'SELECT')
UNION ALL
SELECT 'email outbox: 3 functions',
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname IN ('claim_email_outbox', 'complete_email_outbox', 'fail_email_outbox')) = 3
UNION ALL
SELECT 'email outbox: claim uses SKIP LOCKED',
       COALESCE(pg_get_functiondef(to_regprocedure('public.claim_email_outbox(text, integer, integer, uuid)'))
                ILIKE '%FOR UPDATE SKIP LOCKED%', false)
UNION ALL
SELECT 'email outbox: clients cannot claim',
       to_regprocedure('public.claim_email_outbox(text, integer, integer, uuid)') IS NOT NULL
       AND NOT has_function_privilege('anon', 'public.claim_email_outbox(text, integer, integer, uuid)', 'EXECUTE')
       AND NOT has_function_privilege('authenticated', 'public.claim_email_outbox(text, integer, integer, uuid)', 'EXECUTE');
