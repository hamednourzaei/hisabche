-- ============================================
-- docs/VERIFY-project-change-orders-03.sql
-- Post-migration verification for project-change-orders-03-atomic-migration.sql.
-- Status target after human execution: Post-migration verification query generated - PENDING HUMAN CONFIRMATION.
-- ============================================

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'projects' AND column_name = 'budget_version') OR
    (table_name = 'project_change_orders' AND column_name IN ('decision_reason', 'project_version_at_decision'))
  )
ORDER BY table_name, column_name;

SELECT proname, prosecdef, proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('create_project_change_order', 'decide_project_change_order_v2')
ORDER BY p.proname;
