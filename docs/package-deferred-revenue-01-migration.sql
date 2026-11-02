-- ============================================================================
-- docs/package-deferred-revenue-01-migration.sql
--
-- M5 (owner decisions of 2 Nov 2026): revenue of a package is recognised at DELIVERY, per GRANT, with the term of a
-- GRANT starting at its first valid consume. Additive and idempotent. NOT RUN by the agent that wrote it.
--
-- WHAT IT ADDS
--   package_credit_ledger.deferred_amount   books-currency NET amount the sale credited to deferred revenue for this GRANT
--                                           (NULL = sold before the cut-over: never released, no backfill)
--   package_credit_ledger.term_months       1 / 6 / 12 snapshot of the package's term at the sale (NULL = never expires)
--   products.package_term_months            the term a package is sold with (NULL = none)
--   package_credit_allocations              append-only: which GRANTs every CONSUME / REVERSAL drew from, how many units,
--                                           how much deferred revenue it released  (Invoice line -> GRANT -> Deferred ->
--                                           CONSUME -> Recognition is auditable from these rows)
--   package_credit_suspensions              append-only SUSPEND / RESUME events of ONE GRANT
--   trigger trg_package_credit_allocate     on EVERY CONSUME / REVERSAL insert, whichever path wrote it (delivery,
--                                           POST /package-credits/consume, a synced device command):
--                                             1. allocates the units over the eligible GRANTs, oldest first;
--                                             2. skips a GRANT that is expired / suspended / not yet sold;
--                                             3. releases the deferred revenue of exactly those GRANTs and posts ONE journal
--                                                entry (debit deferred revenue, credit sales) in the SAME transaction;
--                                             4. a REVERSAL gives back exactly what the CONSUME released, one reversal entry.
--
-- RULES IT KEEPS (the same rule as packages/validation/src/schemas/universal-core/package-grant-allocation.domain.ts,
-- proven against packages/validation/src/__golden__/package-grant-vectors.json by the PGlite scenario)
--   SOLD != ACTIVATED          the term starts on the date of the first valid CONSUME (read from the allocations)
--   fail closed                no eligible GRANT -> INSUFFICIENT_ELIGIBLE_PACKAGE_CREDIT; no deferred-revenue account ->
--                              DEFERRED_REVENUE_ACCOUNT_MISSING; the sale was never booked -> PACKAGE_INVOICE_NOT_BOOKED;
--                              a closed period -> ACCOUNTING_PERIOD_LOCKED (from the journal function). The whole delivery
--                              rolls back in every case.
--   no backfill                a GRANT sold before this migration has deferred_amount NULL and releases nothing.
--                              Consumptions written before this migration have no allocation: they are charged to the oldest
--                              GRANTs with no deferred amount, so they are never counted twice.
--   append-only                allocations and suspensions cannot be updated or deleted.
--
-- NOT DECIDED HERE (owner questions in docs/architecture/universal-business-core/M5-DECISIONS.md)
--   C1 what an EXPIRED GRANT's remainder does after a renewal: nothing here revives it, nothing here writes EXPIRE.
--
-- RUN ORDER: after package-credit-ledger-01, service-delivery-01/02/03, accounts-role-deferred-and-loss-01.
--            Verify with docs/VERIFY-package-deferred-revenue-01.sql.
--
-- ROLLBACK / MITIGATION (history is never edited; the columns and tables are left in place):
--   DROP TRIGGER IF EXISTS trg_package_credit_allocate ON public.package_credit_ledger;
--   -- the allocation, suspension and journal rows already written stay as the audit trail
-- ============================================================================

-- 1. Columns ---------------------------------------------------------------
ALTER TABLE public.package_credit_ledger ADD COLUMN IF NOT EXISTS deferred_amount numeric(18, 2);
ALTER TABLE public.package_credit_ledger ADD COLUMN IF NOT EXISTS term_months smallint;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS package_term_months smallint;

DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pkg_credit_deferred_amount') THEN
    ALTER TABLE public.package_credit_ledger
      ADD CONSTRAINT chk_pkg_credit_deferred_amount
      CHECK (deferred_amount IS NULL OR (entry_type = 'GRANT' AND deferred_amount >= 0));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pkg_credit_term_months') THEN
    ALTER TABLE public.package_credit_ledger
      ADD CONSTRAINT chk_pkg_credit_term_months
      CHECK (term_months IS NULL OR (entry_type = 'GRANT' AND term_months IN (1, 6, 12)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_package_term_months') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_package_term_months
      CHECK (package_term_months IS NULL OR package_term_months IN (1, 6, 12));
  END IF;
END
$guard$;

-- 2. Allocations (append-only) ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.package_credit_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  -- the CONSUME or REVERSAL ledger entry this row belongs to
  entry_id uuid NOT NULL REFERENCES public.package_credit_ledger(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('CONSUME', 'REVERSAL')),
  -- the GRANT the units came from; NULL = balance no GRANT owns (a manual top-up): it releases nothing
  grant_entry_id uuid REFERENCES public.package_credit_ledger(id) ON DELETE RESTRICT,
  quantity numeric(18, 4) NOT NULL CHECK (quantity > 0),
  released_amount numeric(18, 2) NOT NULL DEFAULT 0 CHECK (released_amount >= 0),
  effective_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pkg_alloc_entry_grant
  ON public.package_credit_allocations (entry_id, COALESCE(grant_entry_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_pkg_alloc_grant
  ON public.package_credit_allocations (workspace_id, grant_entry_id);

-- 3. Suspension EVENTS of ONE GRANT (append-only: a GRANT is suspended from a SUSPEND event until a later RESUME event;
--    resuming never edits the earlier row) --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.package_credit_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  grant_entry_id uuid NOT NULL REFERENCES public.package_credit_ledger(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('SUSPEND', 'RESUME')),
  effective_on date NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pkg_susp_grant
  ON public.package_credit_suspensions (workspace_id, grant_entry_id);

CREATE OR REPLACE FUNCTION public.prevent_package_credit_side_table_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  RAISE EXCEPTION 'PACKAGE_CREDIT_HISTORY_IMMUTABLE: % rows are append-only; add a compensating row', TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$fn$;

DROP TRIGGER IF EXISTS trg_pkg_alloc_immutable ON public.package_credit_allocations;
CREATE TRIGGER trg_pkg_alloc_immutable
  BEFORE UPDATE OR DELETE ON public.package_credit_allocations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_package_credit_side_table_mutation();

DROP TRIGGER IF EXISTS trg_pkg_susp_immutable ON public.package_credit_suspensions;
CREATE TRIGGER trg_pkg_susp_immutable
  BEFORE UPDATE OR DELETE ON public.package_credit_suspensions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_package_credit_side_table_mutation();

-- Privileges: a new Supabase table is born with ALL for service_role / anon / authenticated - take it away first.
REVOKE ALL ON public.package_credit_allocations FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.package_credit_suspensions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.package_credit_allocations TO authenticated, service_role;
GRANT SELECT, INSERT ON public.package_credit_suspensions TO service_role;
GRANT SELECT ON public.package_credit_suspensions TO authenticated;

ALTER TABLE public.package_credit_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_credit_suspensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS package_credit_allocations_member_read ON public.package_credit_allocations;
CREATE POLICY package_credit_allocations_member_read ON public.package_credit_allocations
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS package_credit_suspensions_member_read ON public.package_credit_suspensions;
CREATE POLICY package_credit_suspensions_member_read ON public.package_credit_suspensions
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- 4. The allocation + release trigger --------------------------------------
CREATE OR REPLACE FUNCTION public.package_credit_allocate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_grant        public.package_credit_ledger%ROWTYPE;
  v_need         numeric;
  v_legacy_left  numeric;
  v_activated    date;
  v_consumed     numeric;
  v_released     numeric;
  v_adjust       numeric;
  v_legacy_take  numeric;
  v_avail        numeric;
  v_take         numeric;
  v_remaining    numeric;
  v_release      numeric;
  v_total        numeric := 0;
  v_unattr       numeric;
  v_def_acct     uuid;
  v_sales_acct   uuid;
  v_orig_journal uuid;
  v_rev          record;
  v_orig         public.package_credit_ledger%ROWTYPE;
BEGIN
  IF NEW.entry_type = 'CONSUME' THEN
    -- Serialise on the customer exactly as package_credit_consume and the delivery function do (re-entrant).
    PERFORM 1 FROM public.customers WHERE id = NEW.customer_id AND workspace_id = NEW.workspace_id FOR UPDATE;

    v_need := NEW.quantity;

    -- Consumptions written before this migration have no allocation: charge them, oldest first, to GRANTs that carry no
    -- deferred amount (they were sold before the cut-over). Never counted twice, never released.
    SELECT COALESCE(SUM(CASE WHEN c.entry_type = 'CONSUME' THEN c.quantity ELSE -c.quantity END), 0)
      INTO v_legacy_left
      FROM public.package_credit_ledger c
     WHERE c.workspace_id = NEW.workspace_id AND c.customer_id = NEW.customer_id
       AND c.package_product_id = NEW.package_product_id AND c.deleted_at IS NULL
       AND c.id <> NEW.id
       AND c.entry_type IN ('CONSUME', 'REVERSAL')
       AND NOT EXISTS (SELECT 1 FROM public.package_credit_allocations a WHERE a.entry_id = c.id)
       AND NOT (c.entry_type = 'REVERSAL' AND EXISTS (
             SELECT 1 FROM public.package_credit_allocations a2 WHERE a2.entry_id = c.reference_entry_id));
    v_legacy_left := GREATEST(v_legacy_left, 0);

    FOR v_grant IN
      SELECT g.* FROM public.package_credit_ledger g
       WHERE g.workspace_id = NEW.workspace_id AND g.customer_id = NEW.customer_id
         AND g.package_product_id = NEW.package_product_id
         AND g.entry_type = 'GRANT' AND g.deleted_at IS NULL
       ORDER BY g.effective_date, g.id
    LOOP
      EXIT WHEN v_need <= 0;

      SELECT COALESCE(SUM(CASE a.kind WHEN 'CONSUME' THEN a.quantity ELSE -a.quantity END), 0),
             COALESCE(SUM(CASE a.kind WHEN 'CONSUME' THEN a.released_amount ELSE -a.released_amount END), 0)
        INTO v_consumed, v_released
        FROM public.package_credit_allocations a
       WHERE a.grant_entry_id = v_grant.id;

      SELECT COALESCE(SUM(j.quantity), 0) INTO v_adjust
        FROM public.package_credit_ledger j
       WHERE j.workspace_id = NEW.workspace_id AND j.entry_type = 'ADJUSTMENT'
         AND j.reference_entry_id = v_grant.id AND j.deleted_at IS NULL;

      v_legacy_take := 0;
      IF v_grant.deferred_amount IS NULL AND v_legacy_left > 0 THEN
        v_legacy_take := LEAST(v_legacy_left, GREATEST(v_grant.quantity + v_adjust - v_consumed, 0));
        v_legacy_left := v_legacy_left - v_legacy_take;
      END IF;

      -- Eligibility: not before the sale, not past the end of the term (which starts at the first valid consume),
      -- not inside a suspension of THIS GRANT.
      CONTINUE WHEN NEW.effective_date < v_grant.effective_date;

      SELECT MIN(c.effective_date) INTO v_activated
        FROM public.package_credit_allocations a
        JOIN public.package_credit_ledger c ON c.id = a.entry_id
       WHERE a.grant_entry_id = v_grant.id AND a.kind = 'CONSUME'
         AND NOT EXISTS (SELECT 1 FROM public.package_credit_ledger r
                          WHERE r.entry_type = 'REVERSAL' AND r.reference_entry_id = c.id AND r.deleted_at IS NULL);

      CONTINUE WHEN v_grant.term_months IS NOT NULL AND v_activated IS NOT NULL
                AND NEW.effective_date > (v_activated + make_interval(months => v_grant.term_months))::date;

      -- The last suspension event on or before the day decides: SUSPEND stops THIS GRANT only, RESUME lifts it.
      CONTINUE WHEN COALESCE((
        SELECT s.kind FROM public.package_credit_suspensions s
         WHERE s.grant_entry_id = v_grant.id AND s.effective_on <= NEW.effective_date
         ORDER BY s.effective_on DESC, s.created_at DESC, s.id DESC LIMIT 1), 'RESUME') = 'SUSPEND';

      v_avail := round(v_grant.quantity + v_adjust - v_consumed - v_legacy_take, 4);
      CONTINUE WHEN v_avail <= 0;

      v_take := LEAST(v_need, v_avail);
      v_release := 0;
      IF v_grant.deferred_amount IS NOT NULL THEN
        v_remaining := GREATEST(0, round(v_grant.deferred_amount - v_released, 2));
        IF v_take = v_avail AND v_adjust = 0 THEN
          v_release := v_remaining;
        ELSE
          v_release := LEAST(v_remaining, round(v_take * v_grant.deferred_amount / v_grant.quantity, 2));
        END IF;

        -- The sale must be in the books before a single cent of it is released.
        IF v_release > 0 AND NOT EXISTS (
             SELECT 1 FROM public.journal_entries je
              WHERE je.workspace_id = NEW.workspace_id AND je.source_type = 'invoice'
                AND je.source_id = v_grant.source_document_id AND je.status <> 'cancelled') THEN
          RAISE EXCEPTION 'PACKAGE_INVOICE_NOT_BOOKED: the invoice that sold this package has no journal entry' USING ERRCODE = 'P0001';
        END IF;
      END IF;

      INSERT INTO public.package_credit_allocations
        (workspace_id, entry_id, kind, grant_entry_id, quantity, released_amount, effective_date)
      VALUES (NEW.workspace_id, NEW.id, 'CONSUME', v_grant.id, v_take, v_release, NEW.effective_date);

      v_total := round(v_total + v_release, 2);
      v_need := round(v_need - v_take, 4);
    END LOOP;

    IF v_need > 0 THEN
      -- Balance no GRANT owns (a manual top-up): used only after every GRANT, releases nothing.
      SELECT COALESCE(SUM(j.quantity), 0) INTO v_unattr
        FROM public.package_credit_ledger j
       WHERE j.workspace_id = NEW.workspace_id AND j.customer_id = NEW.customer_id
         AND j.package_product_id = NEW.package_product_id AND j.entry_type = 'ADJUSTMENT'
         AND j.reference_entry_id IS NULL AND j.quantity > 0 AND j.deleted_at IS NULL;
      v_unattr := v_unattr - COALESCE((
        SELECT SUM(CASE a.kind WHEN 'CONSUME' THEN a.quantity ELSE -a.quantity END)
          FROM public.package_credit_allocations a
          JOIN public.package_credit_ledger c ON c.id = a.entry_id
         WHERE a.grant_entry_id IS NULL AND c.customer_id = NEW.customer_id
           AND c.package_product_id = NEW.package_product_id), 0);
      IF v_need > v_unattr THEN
        RAISE EXCEPTION 'INSUFFICIENT_ELIGIBLE_PACKAGE_CREDIT: % unit(s) no eligible GRANT could cover', v_need
          USING ERRCODE = 'P0001';
      END IF;
      INSERT INTO public.package_credit_allocations
        (workspace_id, entry_id, kind, grant_entry_id, quantity, released_amount, effective_date)
      VALUES (NEW.workspace_id, NEW.id, 'CONSUME', NULL, v_need, 0, NEW.effective_date);
    END IF;

    IF v_total > 0 THEN
      SELECT id INTO v_def_acct FROM public.accounts
       WHERE workspace_id = NEW.workspace_id AND role = 'deferred_revenue' AND deleted_at IS NULL AND is_active = true LIMIT 1;
      IF v_def_acct IS NULL THEN
        RAISE EXCEPTION 'DEFERRED_REVENUE_ACCOUNT_MISSING' USING ERRCODE = 'P0001';
      END IF;
      SELECT id INTO v_sales_acct FROM public.accounts
       WHERE workspace_id = NEW.workspace_id AND role = 'sales' AND deleted_at IS NULL AND is_active = true LIMIT 1;
      IF v_sales_acct IS NULL THEN
        RAISE EXCEPTION 'SALES_ACCOUNT_MISSING' USING ERRCODE = 'P0001';
      END IF;
      PERFORM public.accounting_post_journal_entry(
        NEW.workspace_id, NULL,
        jsonb_build_object('date', NEW.effective_date::text,
                           'description', 'Package delivery: deferred revenue released',
                           'reference', NEW.id::text, 'status', 'posted',
                           'source_type', 'package_release', 'source_id', NEW.id::text),
        jsonb_build_array(
          jsonb_build_object('account_id', v_def_acct, 'debit', v_total, 'credit', 0),
          jsonb_build_object('account_id', v_sales_acct, 'debit', 0, 'credit', v_total)));
    END IF;

  ELSIF NEW.entry_type = 'REVERSAL' THEN
    -- Give back exactly what the CONSUME allocated and released; a REVERSAL of anything else changes nothing here.
    SELECT * INTO v_orig FROM public.package_credit_ledger
     WHERE id = NEW.reference_entry_id AND workspace_id = NEW.workspace_id AND entry_type = 'CONSUME';
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.package_credit_allocations
      (workspace_id, entry_id, kind, grant_entry_id, quantity, released_amount, effective_date)
    SELECT a.workspace_id, NEW.id, 'REVERSAL', a.grant_entry_id, a.quantity, a.released_amount, NEW.effective_date
      FROM public.package_credit_allocations a
     WHERE a.entry_id = v_orig.id AND a.kind = 'CONSUME';

    SELECT COALESCE(SUM(a.released_amount), 0) INTO v_total
      FROM public.package_credit_allocations a WHERE a.entry_id = v_orig.id AND a.kind = 'CONSUME';

    IF v_total > 0 THEN
      SELECT id INTO v_orig_journal FROM public.journal_entries
       WHERE workspace_id = NEW.workspace_id AND source_type = 'package_release'
         AND source_id = v_orig.id AND status <> 'cancelled' LIMIT 1;
      IF v_orig_journal IS NULL THEN
        RAISE EXCEPTION 'PACKAGE_RELEASE_ENTRY_MISSING: the release being reversed was never posted' USING ERRCODE = 'P0001';
      END IF;
      SELECT id INTO v_def_acct FROM public.accounts
       WHERE workspace_id = NEW.workspace_id AND role = 'deferred_revenue' AND deleted_at IS NULL AND is_active = true LIMIT 1;
      SELECT id INTO v_sales_acct FROM public.accounts
       WHERE workspace_id = NEW.workspace_id AND role = 'sales' AND deleted_at IS NULL AND is_active = true LIMIT 1;
      IF v_def_acct IS NULL OR v_sales_acct IS NULL THEN
        RAISE EXCEPTION 'DEFERRED_REVENUE_ACCOUNT_MISSING' USING ERRCODE = 'P0001';
      END IF;
      PERFORM public.accounting_post_journal_entry(
        NEW.workspace_id, NULL,
        jsonb_build_object('date', NEW.effective_date::text,
                           'description', 'Package delivery cancelled: deferred revenue restored',
                           'reference', NEW.id::text, 'status', 'posted',
                           'source_type', 'package_release_reversal', 'source_id', NEW.id::text,
                           'reversal_of', v_orig_journal::text),
        jsonb_build_array(
          jsonb_build_object('account_id', v_sales_acct, 'debit', v_total, 'credit', 0),
          jsonb_build_object('account_id', v_def_acct, 'debit', 0, 'credit', v_total)));
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.package_credit_allocate() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_package_credit_allocate ON public.package_credit_ledger;
CREATE TRIGGER trg_package_credit_allocate
  AFTER INSERT ON public.package_credit_ledger
  FOR EACH ROW
  WHEN (NEW.entry_type IN ('CONSUME', 'REVERSAL'))
  EXECUTE FUNCTION public.package_credit_allocate();

NOTIFY pgrst, 'reload schema';

-- 5. What the profit report needs from the ledger (B2-5): the net change of the deferred-revenue liability in a window --------
--    credits at the sale minus releases at delivery, books currency. Package revenue is recognised at DELIVERY, so the report's
--    revenue is the invoices' net sales minus this. Read-only; a workspace with no deferred-revenue account gets 0.
CREATE OR REPLACE FUNCTION public.accounting_deferred_revenue_change(
  p_workspace_id uuid, p_from date, p_to date
) RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT COALESCE(SUM(jl.credit - jl.debit), 0)
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON je.id = jl.journal_id
    JOIN public.accounts a ON a.id = jl.account_id
   WHERE je.workspace_id = p_workspace_id AND a.workspace_id = p_workspace_id
     -- 'reversed' originals COUNT: the reversal entry that cancels them is 'posted', and a sum that kept only one of the
     -- two would be wrong by exactly the reversed amount
     AND a.role = 'deferred_revenue' AND je.status IN ('posted', 'reversed')
     AND je.date >= p_from AND je.date <= p_to;
$fn$;

REVOKE ALL ON FUNCTION public.accounting_deferred_revenue_change(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_deferred_revenue_change(uuid, date, date) TO service_role;

NOTIFY pgrst, 'reload schema';
