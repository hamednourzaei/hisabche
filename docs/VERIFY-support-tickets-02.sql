-- VERIFY-support-tickets-02.sql (read-only post-migration verification)
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
SELECT
  to_regclass('public.support_ticket_events') IS NOT NULL AS has_events_table,
  to_regclass('public.support_ticket_comments') IS NOT NULL AS has_comments_table,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'support_tickets'
     AND column_name IN ('assigned_to', 'closed_at', 'reopened_at')) AS added_ticket_columns,
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('support_ticket_events', 'support_ticket_comments')) AS rls_policy_count;
