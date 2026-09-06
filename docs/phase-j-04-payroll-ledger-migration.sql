-- ============================================================================
-- docs/phase-j-04-payroll-ledger-migration.sql
--
-- PHASE J · J4 — the account role payroll needs, and the report on journals
-- that never balanced.
--
-- ---------------------------------------------------------------------------
-- WHAT J4 IS ACTUALLY ABOUT HERE
--
-- J4.1 (no new writers to the legacy model) and J4.2 (balanced journals) are
-- already held, and rebuilding them would be the parallel architecture G2
-- forbids:
--
--   ✅ `ledger_entries` is frozen by a trigger (phase-b-01). Every write is
--      refused and the error names the replacement.
--   ✅ `transactions` refuses payment/receipt rows (phase-b-02).
--   ✅ Balance is enforced INSIDE `accounting_post_journal_entry`, in the
--      posting transaction — `JOURNAL_ENTRY_UNBALANCED`. A direct database
--      write cannot get an unbalanced entry in either.
--
-- What is NOT held is the gap J0 found: **payroll writes no journal entry at
-- all**. `updatePayrollStatus()` moves a payroll to `paid` and stops. A salary
-- expense and a cash outflow — both real, both material — happen entirely
-- outside the ledger.
--
-- Every financial statement is therefore short by exactly the payroll. Nothing
-- reports an error, because nothing knows an entry was owed.
--
-- ---------------------------------------------------------------------------
-- WHY A NEW ACCOUNT ROLE
--
-- `accounts.role` is how this system finds accounts — lesson 8: the old code
-- hunted for hardcoded codes ('5000', '1200'), so any business with its own
-- chart of accounts silently got no entries.
--
-- The eleven existing roles have no salary expense among them. Posting payroll
-- to `cogs` would put wages into cost of goods sold and corrupt gross margin;
-- posting to `purchase` is worse. So one role is added, to the same list, in
-- the same way.
--
-- ⚠️ The role is added to the CHECK CONSTRAINT only. No account is created.
-- Seeding a chart of accounts into somebody's live books is a business
-- decision, not a migration's. Until an account carries the role, payroll is
-- recorded and NOT booked — and says so in the log, following the pattern
-- `payments.service.bookPayment` already uses for a missing account.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK / MITIGATION
--
-- The constraint change is reversible, and reverting it is safe ONLY while no
-- account uses the new role:
--
--   UPDATE accounts SET role = NULL WHERE role = 'salary_expense';
--   ALTER TABLE accounts DROP CONSTRAINT accounts_role_check;
--   ALTER TABLE accounts ADD CONSTRAINT accounts_role_check CHECK (
--     role IS NULL OR role IN (
--       'bank','cash','receivable','payable','tax',
--       'inventory','cogs','sales','purchase',
--       'retained_earnings','current_year_earnings'));
--
-- ⚠️ That UPDATE un-roles a real account and payroll stops booking. It is a
-- functional change, not a cleanup.
--
-- SAFE TO RE-RUN.
-- ============================================================================

-- ============================================================================
-- PRE-MIGRATION VERIFICATION — run first, keep the output.
-- ============================================================================
--
-- P1. The current constraint, so the rollback above is checked against reality.
--
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'accounts'::regclass AND conname = 'accounts_role_check';
--
-- P2. Which roles are actually in use? A workspace missing `cash` or `payable`
--     will not book payroll even after this runs — that is the same limitation
--     payments already has, and it is visible here.
--
--   SELECT role, COUNT(*) AS accounts, COUNT(DISTINCT workspace_id) AS workspaces
--   FROM accounts WHERE role IS NOT NULL AND deleted_at IS NULL
--   GROUP BY role ORDER BY 1;
--
-- P3. ⚠️ HOW MUCH PAYROLL IS OUTSIDE THE LEDGER RIGHT NOW.
--     This is the size of the gap. Every one of these is a salary paid that no
--     financial statement includes.
--
--   SELECT COUNT(*) AS paid_payrolls, SUM(net_salary) AS total_unbooked
--   FROM   payrolls WHERE status = 'paid';
--
-- P4. Confirm none of them already has an entry (they should not).
--
--   SELECT COUNT(*) FROM payrolls p
--   WHERE  p.status = 'paid'
--     AND  EXISTS (SELECT 1 FROM journal_entries je
--                  WHERE je.source_type = 'payroll' AND je.source_id = p.id);
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The role
-- ---------------------------------------------------------------------------

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_role_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_role_check CHECK (
  role IS NULL OR role IN (
    'bank', 'cash', 'receivable', 'payable', 'tax',
    'inventory', 'cogs', 'sales', 'purchase',
    'retained_earnings', 'current_year_earnings',
    -- J4 — wages. Deliberately NOT `cogs`: putting salaries into cost of
    -- goods sold corrupts gross margin, which is the one figure a shopkeeper
    -- checks daily.
    'salary_expense'
  )
);

COMMENT ON COLUMN accounts.role IS
  'What this account IS, so the system can find it without knowing a business''s own numbering (lesson 8). NULL means the account plays no automatic part. `salary_expense` added in Phase J (J4) for payroll.';

-- ---------------------------------------------------------------------------
-- 2. The read that shows what is still missing
--
-- A workspace cannot book payroll without BOTH a salary expense account and a
-- cash or bank account. This says which workspaces are ready and which are not,
-- so the gap is visible before someone wonders why their payroll did not post.
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS payroll_posting_readiness;

CREATE VIEW payroll_posting_readiness AS
SELECT
  w.id                                                     AS workspace_id,
  w.name                                                   AS workspace_name,
  BOOL_OR(a.role = 'salary_expense')                       AS has_salary_account,
  BOOL_OR(a.role IN ('cash', 'bank'))                      AS has_cash_account,
  BOOL_OR(a.role = 'salary_expense')
    AND BOOL_OR(a.role IN ('cash', 'bank'))                AS can_post_payroll
FROM   workspaces w
LEFT   JOIN accounts a
  ON   a.workspace_id = w.id AND a.deleted_at IS NULL AND a.is_active
GROUP  BY w.id, w.name;

ALTER VIEW payroll_posting_readiness SET (security_invoker = true);

COMMENT ON VIEW payroll_posting_readiness IS
  'Which workspaces have the accounts payroll needs. A workspace with can_post_payroll = false records payrolls without booking them, and the service says so in the log. Phase J (J4).';

COMMIT;

-- ============================================================================
-- J4.3 — THE REPORT ON HISTORICAL DATA
--
-- ⚠️ THESE ARE QUERIES, NOT REPAIRS. §13: report unhealthy history, never
-- rewrite it without an explicit instruction. Run them, keep the output, and
-- decide separately.
-- ============================================================================
--
-- R1. UNBALANCED POSTED JOURNAL ENTRIES.
--
--     Should be empty: `accounting_post_journal_entry` has refused unbalanced
--     entries since it was written. Rows here predate it or were inserted by
--     something that bypassed it, and each one makes the trial balance wrong
--     by its own difference.
--
--     Compared in MINOR UNITS, not floats — lesson 9. A float comparison here
--     both accepts genuinely unbalanced entries and rejects sound ones.
--
--   SELECT je.id, je.entry_number, je.date, je.source_type, je.workspace_id,
--          SUM(ROUND(jl.debit  * 100))::bigint AS debit_minor,
--          SUM(ROUND(jl.credit * 100))::bigint AS credit_minor,
--          SUM(ROUND(jl.debit * 100))::bigint - SUM(ROUND(jl.credit * 100))::bigint
--            AS difference_minor
--   FROM   journal_entries je
--   JOIN   journal_lines jl ON jl.journal_id = je.id
--   WHERE  je.status = 'posted'
--   GROUP  BY je.id, je.entry_number, je.date, je.source_type, je.workspace_id
--   HAVING SUM(ROUND(jl.debit * 100)) <> SUM(ROUND(jl.credit * 100))
--   ORDER  BY ABS(SUM(ROUND(jl.debit * 100)) - SUM(ROUND(jl.credit * 100))) DESC;
--
-- R2. POSTED ENTRIES WITH NO LINES AT ALL. An entry that accounts for nothing.
--
--   SELECT je.id, je.entry_number, je.date, je.source_type
--   FROM   journal_entries je
--   WHERE  je.status = 'posted'
--     AND  NOT EXISTS (SELECT 1 FROM journal_lines jl WHERE jl.journal_id = je.id);
--
-- R3. ORPHAN LINES — a line whose header is gone. phase-a-01 added the foreign
--     key NOT VALID, so pre-existing orphans were never checked.
--
--   SELECT jl.id, jl.journal_id, jl.account_id, jl.debit, jl.credit
--   FROM   journal_lines jl
--   WHERE  jl.journal_id IS NOT NULL
--     AND  NOT EXISTS (SELECT 1 FROM journal_entries je WHERE je.id = jl.journal_id);
--
-- R4. SEVERITY, so the list can be triaged rather than read end to end.
--
--   SELECT CASE
--            WHEN ABS(d.difference_minor) >= 100000 THEN 'high'
--            WHEN ABS(d.difference_minor) >= 1000   THEN 'medium'
--            ELSE 'low'
--          END AS severity,
--          COUNT(*), SUM(ABS(d.difference_minor)) AS total_minor
--   FROM (
--     SELECT je.id,
--            SUM(ROUND(jl.debit * 100))::bigint - SUM(ROUND(jl.credit * 100))::bigint
--              AS difference_minor
--     FROM   journal_entries je
--     JOIN   journal_lines jl ON jl.journal_id = je.id
--     WHERE  je.status = 'posted'
--     GROUP  BY je.id
--     HAVING SUM(ROUND(jl.debit * 100)) <> SUM(ROUND(jl.credit * 100))
--   ) d
--   GROUP BY 1 ORDER BY 1;
--
-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
-- ============================================================================
--
-- V1. The role is accepted.
--
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'accounts'::regclass AND conname = 'accounts_role_check';
--
-- V2. Which workspaces can book payroll today. A `false` is not an error — it
--     means that business has not created a salary expense account yet.
--
--   SELECT * FROM payroll_posting_readiness ORDER BY can_post_payroll, workspace_name;
--
-- V3. After creating a salary account and marking one payroll paid, an entry
--     exists and balances.
--
--   SELECT je.entry_number, je.date, jl.account_id, jl.debit, jl.credit
--   FROM   journal_entries je
--   JOIN   journal_lines jl ON jl.journal_id = je.id
--   WHERE  je.source_type = 'payroll'
--   ORDER  BY je.created_at DESC LIMIT 10;
