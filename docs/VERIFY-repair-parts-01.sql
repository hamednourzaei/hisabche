-- ============================================
-- docs/VERIFY-repair-parts-01.sql
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================

SELECT
  EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'repair_tickets'
       AND column_name = 'customer_approved'
  ) AS has_customer_approved_column,
  EXISTS (
    SELECT 1
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'repair_ticket_parts'
  ) AS has_repair_ticket_parts_table,
  COALESCE(
    (
      SELECT relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = 'repair_ticket_parts'
    ),
    false
  ) AS repair_ticket_parts_rls_enabled,
  -- The V61 lockdown in the migration DROPS every client policy (RLS on, no policy):
  -- the earlier check here expected the dropped 'repair_ticket_parts_tenant' policy.
  NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'repair_ticket_parts'
  ) AS has_no_client_policy;

-- V61 audit (12 Nov 2026): clients are locked out — RLS on, no policy, and
-- neither anon nor authenticated holds any privilege. Expect ok = true.
SELECT 'clients_locked' AS check_name,
       bool_and(c.relrowsecurity)
       AND NOT bool_or(
             has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
          OR has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE'))
       AND NOT EXISTS (
             SELECT 1 FROM pg_policies p
              WHERE p.schemaname = 'public' AND p.tablename = ANY (ARRAY['repair_ticket_parts']))
       AND count(*) = 1 AS ok
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('repair_ticket_parts');
