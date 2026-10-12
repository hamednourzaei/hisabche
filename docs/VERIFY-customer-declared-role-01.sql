-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY — docs/customer-declared-role-01-migration.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- READ-ONLY. One statement; run it after the migration and send the output.
-- Every row should say ok = true.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
  'column customers.declared_role exists' AS check_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'customers'
       AND column_name = 'declared_role'
       AND data_type = 'text'
       AND is_nullable = 'YES'
  ) AS ok
UNION ALL
SELECT
  'constraint customers_declared_role_check is validated' AS check_name,
  COALESCE((
    SELECT convalidated
      FROM pg_constraint
     WHERE conname = 'customers_declared_role_check'
       AND conrelid = 'public.customers'::regclass
  ), false) AS ok;
