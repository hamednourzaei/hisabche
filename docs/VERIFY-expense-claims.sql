-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- docs/VERIFY-expense-claims.sql — V61 B.2.18 (expense claims & reimbursements)
--
-- RUN ORDER: docs/expense-claims-migration.sql, then this file.
--
-- ⚠️ THE AUDIT OF 12 NOV 2026 FOUND THIS FILE ONLY LISTED COLUMNS. A table with
-- the wrong status vocabulary, a negative amount allowed, no foreign key and the
-- browser roles still able to read every claim would have «verified» clean. Each
-- row below is one rule the migration is supposed to create; every row must say
-- ok = true. The same file is executed by
-- backend/src/__tests__/expense-claims-migration.pg.test.ts on a real Postgres,
-- so the two can never drift apart.

SELECT 'both tables exist' AS check_name,
       to_regclass('public.expense_reports') IS NOT NULL
       AND to_regclass('public.expense_lines') IS NOT NULL AS ok

UNION ALL

-- The tenancy boundary: a claim without workspace_id cannot be scoped, and the
-- service filters every read by it.
SELECT 'expense_reports carries workspace_id NOT NULL',
       EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'expense_reports'
            AND column_name = 'workspace_id' AND is_nullable = 'NO')

UNION ALL

SELECT 'expense_lines carries workspace_id NOT NULL',
       EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'expense_lines'
            AND column_name = 'workspace_id' AND is_nullable = 'NO')

UNION ALL

-- The five statuses are the ones the service gates approve / reject / reimburse
-- on. A sixth value would be a claim no button can move.
SELECT 'status is one of draft, submitted, approved, rejected, reimbursed',
       EXISTS (
         SELECT 1 FROM pg_constraint
          WHERE conrelid = to_regclass('public.expense_reports')::oid
            AND contype = 'c'
            AND pg_get_constraintdef(oid) LIKE '%draft%'
            AND pg_get_constraintdef(oid) LIKE '%submitted%'
            AND pg_get_constraintdef(oid) LIKE '%approved%'
            AND pg_get_constraintdef(oid) LIKE '%rejected%'
            AND pg_get_constraintdef(oid) LIKE '%reimbursed%')

UNION ALL

-- A claim of 0 or -5 is not an expense. Money is integer minor units, so the
-- rule lives in the column, not in a screen.
SELECT 'an expense line amount is positive',
       EXISTS (
         SELECT 1 FROM pg_constraint
          WHERE conrelid = to_regclass('public.expense_lines')::oid
            AND contype = 'c'
            AND pg_get_constraintdef(oid) ~ 'amount_minor[[:space:]]*>[[:space:]]*0')

UNION ALL

-- A line belongs to a claim that exists, and goes away with it (confdeltype 'c'
-- = ON DELETE CASCADE).
SELECT 'a line names an existing claim and cascades with it',
       EXISTS (
         SELECT 1 FROM pg_constraint
          WHERE conrelid = to_regclass('public.expense_lines')::oid
            AND contype = 'f'
            AND confrelid = to_regclass('public.expense_reports')::oid
            AND confdeltype = 'c')

UNION ALL

SELECT 'both lookup indexes exist',
       to_regclass('public.idx_expense_reports_workspace') IS NOT NULL
       AND to_regclass('public.idx_expense_lines_report') IS NOT NULL

UNION ALL

-- On Supabase every new table is born with ALL granted to anon and
-- authenticated; the migration must take it back. Neither role has a policy or a
-- reason to read another workspace's claims.
SELECT 'anon and authenticated hold nothing on either table',
       NOT EXISTS (
         SELECT 1
           FROM unnest(ARRAY['expense_reports', 'expense_lines']) AS t(name)
          CROSS JOIN unnest(ARRAY['anon', 'authenticated']) AS r(role)
          WHERE has_table_privilege(r.role, 'public.' || t.name, 'SELECT')
             OR has_table_privilege(r.role, 'public.' || t.name, 'INSERT')
             OR has_table_privilege(r.role, 'public.' || t.name, 'UPDATE')
             OR has_table_privilege(r.role, 'public.' || t.name, 'DELETE'))

UNION ALL

-- The backend writes both tables with the service role; a missing grant is a
-- feature that fails on the first claim rather than in this query.
SELECT 'service_role may read and write both tables',
       (
         SELECT bool_and(
                  has_table_privilege('service_role', 'public.expense_reports', p)
                  AND has_table_privilege('service_role', 'public.expense_lines', p))
           FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) AS x(p)
       );
