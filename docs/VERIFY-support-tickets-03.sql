-- ============================================
-- docs/VERIFY-support-tickets-03.sql
-- Post-migration verification for support-tickets-03-atomic-sla-migration.sql.
-- Status target after human execution: Post-migration verification query generated - PENDING HUMAN CONFIRMATION.
-- ============================================

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'support_ticket_events'
  AND column_name IN ('correlation_id', 'notification_status')
ORDER BY column_name;

SELECT proname, prosecdef, proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'transition_support_ticket',
    'add_support_ticket_comment',
    'sweep_support_ticket_slas'
  )
ORDER BY p.proname;
