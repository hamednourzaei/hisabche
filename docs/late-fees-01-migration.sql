-- ============================================================================
-- LATE PAYMENT FEES — 01 (capability #124). Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-late-fees-01.sql.
--
-- Two tables and no money of their own.
--
--   late_fee_policies     one row per business: how a late fee is worked out.
--                         NO ROW, or is_enabled = false, means NO FEE. Nothing
--                         is charged because a setting was absent.
--
--   late_fee_assessments  one row each time a manager charges a fee on an
--                         overdue invoice (or one installment of it). It keeps
--                         what was overdue, how late, the fee, and the policy
--                         AS IT WAS — so the fee stays explainable after the
--                         policy changes.
--
-- The fee itself is an ordinary SALE INVOICE issued by the backend through the
-- same invoice function every other sale uses; fee_invoice_id points at it.
-- The receivable and the ledger entry are that invoice's, not this table's.
--
-- ⚠️ ONE ASSESSMENT PER (invoice, installment, period): the unique index is
-- what makes a double click, a retry and two managers at once charge once.
--
-- ⚠️ AN ASSESSMENT IS NEVER EDITED OR DELETED. The only change allowed is
-- filling fee_invoice_id once. A fee charged by mistake is corrected the way
-- any invoice is: by cancelling the fee invoice.
--
-- Amounts are integers: hundredths of the currency unit, as invoice lines are.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.late_fee_policies (
  workspace_id      uuid PRIMARY KEY,
  is_enabled        boolean NOT NULL DEFAULT false,
  -- per_period: a fixed amount for every full 30 days late.
  -- percentage: a share of what is overdue, charged once.
  basis             text NOT NULL CHECK (basis IN ('per_period', 'percentage')),
  amount_minor      bigint CHECK (amount_minor > 0),
  currency          text CHECK (currency ~ '^[A-Z]{3}$'),
  percent           numeric(6, 3) CHECK (percent > 0 AND percent <= 100),
  grace_days        integer NOT NULL DEFAULT 0 CHECK (grace_days BETWEEN 0 AND 365),
  -- Never more than this share of what is overdue, however late it is.
  max_share_percent numeric(6, 3) NOT NULL DEFAULT 100
                    CHECK (max_share_percent > 0 AND max_share_percent <= 100),
  updated_by        uuid NOT NULL,
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- A fixed amount always has its currency; a percentage has neither.
  CONSTRAINT late_fee_policy_shape CHECK (
    (basis = 'per_period' AND amount_minor IS NOT NULL AND currency IS NOT NULL AND percent IS NULL)
    OR
    (basis = 'percentage' AND percent IS NOT NULL AND amount_minor IS NULL AND currency IS NULL)
  )
);

COMMENT ON TABLE public.late_fee_policies IS
  'How a business charges a late fee. No row, or is_enabled = false, means no fee.';

CREATE TABLE IF NOT EXISTS public.late_fee_assessments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL,
  invoice_id     uuid NOT NULL,
  -- The installment the fee is for; 0 = the invoice as a whole (no plan).
  seq            integer NOT NULL CHECK (seq >= 0),
  -- per_period: the number of full periods late covered so far. percentage: 0.
  period_no      integer NOT NULL CHECK (period_no >= 0),
  due_date       date NOT NULL,
  days_late      integer NOT NULL CHECK (days_late > 0),
  overdue_minor  bigint NOT NULL CHECK (overdue_minor > 0),
  fee_minor      bigint NOT NULL CHECK (fee_minor > 0),
  currency       text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  -- The policy as it was when the fee was charged.
  policy         jsonb NOT NULL,
  -- The sale invoice that carries the fee. NULL until it has been issued.
  fee_invoice_id uuid,
  assessed_by    uuid NOT NULL,
  assessed_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.late_fee_assessments IS
  'One late fee charged on an overdue invoice or installment, with the policy as it was.';

CREATE UNIQUE INDEX IF NOT EXISTS late_fee_assessments_once
  ON public.late_fee_assessments (workspace_id, invoice_id, seq, period_no);

CREATE INDEX IF NOT EXISTS late_fee_assessments_fee_invoice_idx
  ON public.late_fee_assessments (workspace_id, fee_invoice_id)
  WHERE fee_invoice_id IS NOT NULL;

-- ─── History is forward-only ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.late_fee_assessments_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'LATE_FEE_ASSESSMENT_IMMUTABLE';
  END IF;

  -- The one change allowed: the fee invoice is filled in, once.
  IF OLD.fee_invoice_id IS NOT NULL
     OR NEW.fee_invoice_id IS NULL
     OR (to_jsonb(NEW) - 'fee_invoice_id') IS DISTINCT FROM (to_jsonb(OLD) - 'fee_invoice_id')
  THEN
    RAISE EXCEPTION 'LATE_FEE_ASSESSMENT_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS late_fee_assessments_guard_trg ON public.late_fee_assessments;
CREATE TRIGGER late_fee_assessments_guard_trg
  BEFORE UPDATE OR DELETE ON public.late_fee_assessments
  FOR EACH ROW EXECUTE FUNCTION public.late_fee_assessments_guard();

-- ─── Access ─────────────────────────────────────────────────────────────────

ALTER TABLE public.late_fee_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.late_fee_assessments ENABLE ROW LEVEL SECURITY;

-- On Supabase a new table arrives with ALL privileges already granted to the
-- three API roles; every one is revoked before the backend is granted back.
REVOKE ALL ON public.late_fee_policies FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.late_fee_assessments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.late_fee_policies TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.late_fee_assessments TO service_role;

REVOKE ALL ON FUNCTION public.late_fee_assessments_guard() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Removes the policy and the record of WHY each fee was charged. The fee
-- invoices themselves are ordinary invoices and stay; without the assessment
-- rows a fee could be charged a second time, so do not re-run the migration on
-- a database that has fee invoices without restoring these rows.
--
--   DROP TRIGGER IF EXISTS late_fee_assessments_guard_trg ON public.late_fee_assessments;
--   DROP FUNCTION IF EXISTS public.late_fee_assessments_guard();
--   DROP TABLE IF EXISTS public.late_fee_assessments;
--   DROP TABLE IF EXISTS public.late_fee_policies;
