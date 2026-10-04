-- ============================================================================
-- FINANCING — 01 (capabilities #125 loans, #126 investments). Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-financing-01.sql.
--
-- Two REGISTERS, kept beside the books and not inside them:
--
--   loan_facilities       money the business borrowed (loan) or lent out
--                         (receivable_facility): principal, annual rate, dates,
--                         how often interest is charged.
--   investment_holdings   something the business holds: what it cost and what
--                         the owner says it is worth now.
--
-- ⚠️ NEITHER TABLE POSTS TO THE LEDGER. Interest shown from a facility is a
-- calculation (simple interest over actual days), not a journal entry; a
-- holding's value is what a person typed. Which accounts a loan, its interest
-- or a revaluation belong in is the owner's decision and is not made here.
--
-- Amounts are integer minor units of the row's own currency. A row is closed
-- or retired with is_active = false, never deleted.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.loan_facilities (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL,
  kind                text NOT NULL CHECK (kind IN ('loan', 'receivable_facility')),
  counterparty        text NOT NULL CHECK (char_length(btrim(counterparty)) BETWEEN 1 AND 120),
  principal_minor     bigint NOT NULL CHECK (principal_minor > 0),
  currency            text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  annual_rate_percent numeric NOT NULL CHECK (annual_rate_percent >= 0 AND annual_rate_percent <= 1000),
  start_date          date NOT NULL,
  end_date            date,
  charges_per_year    integer NOT NULL CHECK (charges_per_year IN (1, 2, 4, 12)),
  is_active           boolean NOT NULL DEFAULT true,
  created_by          uuid NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT loan_facilities_dates_in_order CHECK (end_date IS NULL OR end_date > start_date)
);

COMMENT ON TABLE public.loan_facilities IS
  'Register of money borrowed or lent. Not a ledger: nothing here posts a journal entry.';

CREATE INDEX IF NOT EXISTS loan_facilities_workspace_idx
  ON public.loan_facilities (workspace_id, is_active);

ALTER TABLE public.loan_facilities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.loan_facilities FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.loan_facilities TO service_role;

CREATE TABLE IF NOT EXISTS public.investment_holdings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL,
  label              text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 120),
  cost_minor         bigint NOT NULL CHECK (cost_minor >= 0),
  market_value_minor bigint NOT NULL CHECK (market_value_minor >= 0),
  currency           text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  -- The day the market value was last stated by a person.
  valued_on          date NOT NULL,
  is_active          boolean NOT NULL DEFAULT true,
  created_by         uuid NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.investment_holdings IS
  'Register of holdings: cost and a person-stated current value. Not a ledger.';

CREATE INDEX IF NOT EXISTS investment_holdings_workspace_idx
  ON public.investment_holdings (workspace_id, is_active);

ALTER TABLE public.investment_holdings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.investment_holdings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.investment_holdings TO service_role;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Removes both registers. No ledger, invoice or payment row depends on them.
--
--   DROP TABLE IF EXISTS public.investment_holdings;
--   DROP TABLE IF EXISTS public.loan_facilities;
