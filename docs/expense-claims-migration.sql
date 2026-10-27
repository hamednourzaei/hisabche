-- ============================================================================
-- docs/expense-claims-migration.sql
--
-- Option 9: Expense Claims & Employee Reimbursements
-- Tenant-isolated, additive, idempotent.
--
-- RUN ORDER: this file, then docs/VERIFY-expense-claims.sql.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.expense_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'reimbursed')),
  approved_by uuid,
  approved_at timestamptz,
  rejected_reason text,
  payment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expense_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  report_id uuid NOT NULL REFERENCES public.expense_reports(id) ON DELETE CASCADE,
  category text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL,
  receipt_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_reports_workspace
  ON public.expense_reports (workspace_id);

CREATE INDEX IF NOT EXISTS idx_expense_lines_report
  ON public.expense_lines (report_id);

REVOKE ALL ON public.expense_reports FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.expense_lines FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_lines TO service_role;

COMMIT;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- DROP TABLE IF EXISTS public.expense_lines CASCADE;
-- DROP TABLE IF EXISTS public.expense_reports CASCADE;
