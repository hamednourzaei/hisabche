-- ═══════════════════════════════════════════════════════════════════════════
-- leave-policy-01-migration.sql                PENDING HUMAN CONFIRMATION
-- V58 · P0-6a — leave policies, the accrual engine and one leave balance
--
-- WHY. Leave existed as rows someone approved, but nothing answered «how
-- many days does this person still have?» — and nothing turned a policy
-- («20 working days a year, accrued monthly») into an entitlement. This
-- migration adds both, with ONE balance rule:
--
--   consumed  = approved leaves (the leaves table stays the only source)
--   accrued   = leave_accruals rows written by leave_accrue_month()
--   remaining = accrued − consumed(approved) − consumed(pending)
--
-- The approved leave IS the consumption. No second ledger of "days used" is
-- written beside it — a second source is how balances drift from reality.
--
-- WHAT IT ADDS
--   public.leave_policies   per workspace + leave type: the entitlement and
--                           how it accrues (monthly / yearly / upfront)
--   public.leave_accruals   one row per employee × type × month
--   public.leave_accrue_month()  idempotent accrual for one month
--   public.leave_balance()       the ONE answer to «what is left»
--
-- ROLLBACK (safe — nothing else refers to these objects yet)
--   DROP FUNCTION IF EXISTS public.leave_balance(uuid, uuid, text);
--   DROP FUNCTION IF EXISTS public.leave_accrue_month(uuid, uuid, date);
--   DROP TABLE IF EXISTS public.leave_accruals;
--   DROP TABLE IF EXISTS public.leave_policies;
--
-- VERIFY: docs/VERIFY-leave-policy-01.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The policy: what a leave type grants and how it accrues.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.leave_policies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL,
  leave_type          text NOT NULL,
  annual_days         numeric(6, 1) NOT NULL,
  -- monthly: annual_days / 12 each month (rounded to half days)
  -- yearly:  the whole year on January 1st
  -- upfront: the whole year on the employee's hire anniversary
  accrual_method      text NOT NULL DEFAULT 'monthly',
  accrual_day         integer,   -- yearly/upfront: day of month (1..28)
  is_paid             boolean NOT NULL DEFAULT true,
  carry_forward_max   numeric(6, 1),  -- NULL = no carry-over allowed
  is_active           boolean NOT NULL DEFAULT true,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_policies_annual_positive
    CHECK (annual_days > 0 AND annual_days * 2 = trunc(annual_days * 2)),
  CONSTRAINT leave_policies_method
    CHECK (accrual_method IN ('monthly', 'yearly', 'upfront')),
  CONSTRAINT leave_policies_carry_nonnegative
    CHECK (carry_forward_max IS NULL OR carry_forward_max >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS leave_policies_one_per_type
  ON public.leave_policies (workspace_id, leave_type);

COMMENT ON TABLE public.leave_policies IS
  'Per workspace + leave type: how many days a year and how they accrue. The entitlement is policy; the consumption is the approved leave — never a second ledger.';

-- ---------------------------------------------------------------------------
-- 2. The accrual rows. One per employee × type × month, written once.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.leave_accruals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  employee_id   uuid NOT NULL,
  leave_type    text NOT NULL,
  period        date NOT NULL,  -- the FIRST of the accrued month
  accrued       numeric(6, 1) NOT NULL,
  policy_id     uuid REFERENCES public.leave_policies (id),
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_accruals_positive CHECK (accrued >= 0),
  CONSTRAINT leave_accruals_period_is_month_start
    CHECK (period = date_trunc('month', period)::date),
  -- An accrual belongs to an employee of the same workspace. Checked here, in
  -- the database, because a job that accures for a stale membership must not
  -- write days onto a person who never worked here.
  CONSTRAINT leave_accruals_employee_fk FOREIGN KEY (employee_id)
    REFERENCES public.employees (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS leave_accruals_one_per_period
  ON public.leave_accruals (workspace_id, employee_id, leave_type, period);

CREATE INDEX IF NOT EXISTS leave_accruals_balance
  ON public.leave_accruals (workspace_id, employee_id, leave_type);

COMMENT ON TABLE public.leave_accruals IS
  'One row per employee × leave type × month. Written only by leave_accrue_month; the unique index is the idempotency.';

-- ---------------------------------------------------------------------------
-- 3. The accrual run: one month, every active employee × active policy.
--
-- ⚠️ IDEMPOTENT. A month accrued twice writes once (the unique index and
-- ON CONFLICT DO NOTHING see to that), so a retried scheduler job or a
-- backfill run never doubles an entitlement.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.leave_accrue_month(
  p_workspace uuid,
  p_actor     uuid,
  p_period    date           -- the FIRST of the month to accrue
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $accrue$
DECLARE
  v_inserted integer := 0;
  v_policy   record;
  v_employee record;
  v_amount   numeric;
  v_accrual_id uuid;
BEGIN
  IF p_period <> date_trunc('month', p_period)::date THEN
    RAISE EXCEPTION 'LEAVE_ACCRUAL_NOT_MONTH_START';
  END IF;

  FOR v_policy IN
    SELECT * FROM leave_policies
     WHERE workspace_id = p_workspace AND is_active
  LOOP
    FOR v_employee IN
      SELECT id, hire_date, termination_date FROM employees
       WHERE workspace_id = p_workspace
         AND status = 'active'
         AND hire_date <= (p_period + interval '1 month - 1 day')::date
         AND (termination_date IS NULL OR termination_date >= p_period)
    LOOP
      -- Upfront pays the year on the hire ANNIVERSARY month (same month of
      -- the year, for employees hired in a PREVIOUS year); yearly pays the
      -- whole year in January; monthly pays a twelfth. Anything else is zero.
      IF v_policy.accrual_method = 'upfront'
         AND NOT (
           EXTRACT(MONTH FROM v_employee.hire_date) = EXTRACT(MONTH FROM p_period)
           AND v_employee.hire_date < date_trunc('year', p_period)::date
         ) THEN
        CONTINUE;
      END IF;
      IF v_policy.accrual_method = 'yearly'
         AND date_trunc('month', p_period) <> date_trunc('year', p_period) THEN
        CONTINUE;
      END IF;

      v_amount := CASE v_policy.accrual_method
        WHEN 'monthly' THEN round((v_policy.annual_days / 12.0) * 2) / 2.0
        ELSE v_policy.annual_days
      END;

      INSERT INTO leave_accruals
        (workspace_id, employee_id, leave_type, period, accrued, policy_id, created_by)
      VALUES
        (p_workspace, v_employee.id, v_policy.leave_type, p_period, v_amount,
         v_policy.id, p_actor)
      ON CONFLICT (workspace_id, employee_id, leave_type, period) DO NOTHING
      RETURNING id INTO v_accrual_id;
      -- Only a row that was actually written counts: the return value is
      -- «what changed», not «who was looked at».
      IF v_accrual_id IS NOT NULL THEN
        v_inserted := v_inserted + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_inserted;
END
$accrue$;

COMMENT ON FUNCTION public.leave_accrue_month IS
  'Accrue one month''s leave entitlement for every active employee × active policy. Idempotent per (employee, type, month).';

-- ---------------------------------------------------------------------------
-- 4. The ONE balance. Approved leave is the consumption; nothing else is.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.leave_balance(
  p_workspace uuid,
  p_employee  uuid,
  p_type      text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $balance$
DECLARE
  v_accrued  numeric;
  v_consumed numeric;
  v_pending  numeric;
  v_policy   leave_policies;
BEGIN
  SELECT COALESCE(SUM(accrued), 0) INTO v_accrued
    FROM leave_accruals
   WHERE workspace_id = p_workspace AND employee_id = p_employee AND leave_type = p_type;

  SELECT COALESCE(SUM(COALESCE(duration_units, total_days)), 0) INTO v_consumed
    FROM leaves
   WHERE workspace_id = p_workspace AND employee_id = p_employee
     AND leave_type = p_type
     AND status = 'approved';

  SELECT COALESCE(SUM(COALESCE(duration_units, total_days)), 0) INTO v_pending
    FROM leaves
   WHERE workspace_id = p_workspace AND employee_id = p_employee
     AND leave_type = p_type
     AND status = 'pending';

  SELECT * INTO v_policy FROM leave_policies
   WHERE workspace_id = p_workspace AND leave_type = p_type AND is_active;

  RETURN jsonb_build_object(
    'accrued', v_accrued,
    'consumed', v_consumed,
    'pending', v_pending,
    'remaining', v_accrued - v_consumed,
    'available_after_pending', v_accrued - v_consumed - v_pending,
    'annual_days', v_policy.annual_days
  );
END
$balance$;

COMMENT ON FUNCTION public.leave_balance IS
  'The one leave balance: accrued (engine) minus consumed (approved leaves), with pending shown but never silently subtracted.';

COMMIT;

-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION

-- Backend-only functions are not callable by clients (see the note in
-- stock-reservations-01-migration.sql; enforced by
-- rpc-not-callable-by-clients.test.ts).
REVOKE ALL ON FUNCTION public.leave_accrue_month(uuid, uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leave_balance(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
