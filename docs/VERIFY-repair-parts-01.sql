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
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'repair_ticket_parts'
       AND policyname = 'repair_ticket_parts_tenant'
  ) AS has_repair_ticket_parts_policy;
