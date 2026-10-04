-- ============================================================================
-- VERIFY — docs/campaigns-01-migration.sql
-- Read-only. Every row should say ok = true.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

SELECT 'table ' || t.name || ' exists' AS check, to_regclass('public.' || t.name) IS NOT NULL AS ok
FROM (VALUES ('customer_campaigns'), ('campaign_recipients'), ('customer_contact_optouts')) AS t(name)

UNION ALL
SELECT 'the email outbox it sends through exists', to_regclass('public.email_outbox') IS NOT NULL

UNION ALL
SELECT 'RLS enabled on ' || c.relname, c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN ('customer_campaigns', 'campaign_recipients', 'customer_contact_optouts')

UNION ALL
SELECT 'clients cannot read ' || t.name, NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = t.name
     AND grantee IN ('anon', 'authenticated')
)
FROM (VALUES ('customer_campaigns'), ('campaign_recipients'), ('customer_contact_optouts')) AS t(name)

UNION ALL
SELECT 'the backend role cannot DELETE from ' || t.name, NOT EXISTS (
  SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = t.name
     AND grantee = 'service_role' AND privilege_type = 'DELETE'
)
FROM (VALUES ('customer_campaigns'), ('campaign_recipients'), ('customer_contact_optouts')) AS t(name)

UNION ALL
SELECT 'function campaign_launch exists', EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'campaign_launch'
)

UNION ALL
SELECT 'clients cannot execute campaign_launch', NOT EXISTS (
  SELECT 1 FROM information_schema.routine_privileges
   WHERE routine_schema = 'public' AND routine_name = 'campaign_launch'
     AND grantee IN ('anon', 'authenticated', 'PUBLIC')
)

UNION ALL
SELECT 'one recipient row per customer per campaign', EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'campaign_recipients_one_per_customer'
)

UNION ALL
SELECT 'history triggers are in place', (
  SELECT COUNT(*) = 2 FROM pg_trigger
   WHERE tgname IN ('customer_campaigns_history_trg', 'campaign_recipients_history_trg')
)

UNION ALL
SELECT 'no recipient is both sent and skipped', NOT EXISTS (
  SELECT 1 FROM public.campaign_recipients
   WHERE (outbox_id IS NOT NULL) = (skip_reason IS NOT NULL)
);
