-- ============================================================================
-- docs/advances-02-migration.sql
--
-- پیش‌فروش و پیش‌خرید (pre-sale / pre-purchase) — 8 Nov 2026, owner request:
-- «in /invoices and /invoices/new, with the accounting core, the dashboard and
-- the KPIs in step».
--
-- ONE ENGINE, BOTH DIRECTIONS. A pre-sale and a pre-purchase are ADVANCES:
-- money that moves before the invoice. They live in `order_deposits` (the
-- deposit engine) as their own document (`order_id = id`), with a kind:
--
--   pre_sale       customer pays first   receipt  Dr cash|bank        Cr customer advances (liability)
--                                        apply    Dr customer advances Cr receivable   ← order_deposit_apply (unchanged)
--                                        refund   Dr customer advances Cr cash|bank    ← order_deposit_refund (unchanged)
--   pre_purchase   we pay the supplier   payment  Dr supplier advances Cr cash|bank    (asset)
--                  first                 apply    Dr payable           Cr supplier advances   ← supplier_advance_apply (NEW)
--                                        refund   Dr cash|bank         Cr supplier advances   ← supplier_advance_refund (NEW)
--
-- No revenue and no expense is recognised by an advance: revenue comes with the
-- SALE invoice, cost with the PURCHASE invoice, exactly as before. The dashboard
-- and KPIs therefore stay correct by construction; the open advances are read
-- from the two ledger accounts.
--
-- The two new functions are the customer ones with the sides swapped: the
-- payment is direction 'out' / 'in' with party 'supplier'; the invoice must be
-- a PURCHASE of the same supplier (supplier_id, or customer_id on older rows),
-- in the same currency, final and posted. Same locks, same idempotency key
-- tables, same audit, same «a payment's status decides» balance.
--
-- RUN ORDER: after order-deposit-apply-refund-01, customer-advances-01,
--            cycle-count-03 and session-deposit-01.
-- ADDITIVE, IDEMPOTENT, SAFE TO RE-RUN.
-- ⚠️ NOT run by the assistant. Run it, then docs/VERIFY-advances-02.sql.
--    Status: PENDING HUMAN CONFIRMATION
-- ============================================================================

DO $guard$
BEGIN
  IF to_regprocedure('public.order_deposit_balance(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'ADVANCES_02: run docs/order-deposit-apply-refund-01-migration.sql first.';
  END IF;
  IF to_regclass('public.order_deposit_applications') IS NULL
     OR to_regclass('public.order_deposit_refunds') IS NULL THEN
    RAISE EXCEPTION 'ADVANCES_02: the deposit application/refund tables are missing.';
  END IF;
END
$guard$;

-- ── 1. The document kinds, and what was pre-sold / pre-bought ────────────────
ALTER TABLE public.order_deposits
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'sales_order';
ALTER TABLE public.order_deposits ADD COLUMN IF NOT EXISTS note text;

ALTER TABLE public.order_deposits DROP CONSTRAINT IF EXISTS order_deposits_source_type_known;
ALTER TABLE public.order_deposits ADD CONSTRAINT order_deposits_source_type_known
  CHECK (source_type IN ('sales_order', 'service_session', 'pre_sale', 'pre_purchase'));

ALTER TABLE public.order_deposits DROP CONSTRAINT IF EXISTS order_deposits_note_length;
ALTER TABLE public.order_deposits ADD CONSTRAINT order_deposits_note_length
  CHECK (note IS NULL OR length(note) <= 500);

CREATE INDEX IF NOT EXISTS order_deposits_workspace_kind_idx
  ON public.order_deposits (workspace_id, source_type, created_at DESC);

-- ── 2. The account a supplier prepayment sits in ─────────────────────────────
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_role_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_role_check CHECK (
  role IS NULL OR role IN (
    'bank', 'cash', 'receivable', 'payable', 'tax',
    'inventory', 'cogs', 'sales', 'purchase',
    'retained_earnings', 'current_year_earnings',
    'salary_expense',
    'fx_gain_loss',
    'owner_capital',
    'bank_fees',
    'deferred_revenue',
    'inventory_loss',
    'customer_advances',
    'inventory_shrinkage',
    'inventory_gain',
    -- advances-02: money paid to a supplier before the goods (asset).
    'supplier_advances'
  )
) NOT VALID;
ALTER TABLE public.accounts VALIDATE CONSTRAINT accounts_role_check;

-- ── 3. APPLY a supplier advance to a purchase invoice ────────────────────────
--    Dr payable / Cr supplier advances, one transaction.
CREATE OR REPLACE FUNCTION public.supplier_advance_apply(
  p_workspace_id        uuid,
  p_user_id             uuid,
  p_deposit_id          uuid,
  p_invoice_id          uuid,
  p_amount_minor        bigint,
  p_fraction_digits     smallint,
  p_entry_date          date,
  p_idempotency_key     text,
  p_advances_account_id uuid,
  p_payable_account_id  uuid,
  p_actor_role          text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_dep          public.order_deposits%ROWTYPE;
  v_inv          record;
  v_app          public.order_deposit_applications%ROWTYPE;
  v_balance      jsonb;
  v_remaining    bigint;
  v_amount       numeric(18, 2);
  v_outstanding  numeric(18, 2);
  v_payment_id   uuid;
  v_pay_number   text;
  v_entry_id     uuid;
  v_entry_number text;
  v_application  uuid;
  v_seq          int;
  v_attempt      int := 0;
  v_year         int := EXTRACT(YEAR FROM COALESCE(p_entry_date, CURRENT_DATE))::int;
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'DEPOSIT_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'DEPOSIT_ACTOR_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'DEPOSIT_IDEMPOTENCY_KEY_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'DEPOSIT_AMOUNT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF p_fraction_digits IS NULL OR p_fraction_digits < 0 OR p_fraction_digits > 2 THEN
    RAISE EXCEPTION 'DEPOSIT_CURRENCY_PRECISION_UNSUPPORTED' USING ERRCODE = 'P0001';
  END IF;
  IF p_advances_account_id IS NULL OR p_payable_account_id IS NULL THEN
    RAISE EXCEPTION 'DEPOSIT_ACCOUNTS_MISSING' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_dep
    FROM public.order_deposits
   WHERE id = p_deposit_id AND workspace_id = p_workspace_id
   FOR UPDATE;
  IF v_dep.id IS NULL THEN
    RAISE EXCEPTION 'DEPOSIT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_dep.source_type <> 'pre_purchase' THEN
    RAISE EXCEPTION 'ADVANCE_KIND_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_app
    FROM public.order_deposit_applications
   WHERE workspace_id = p_workspace_id
     AND deposit_id = p_deposit_id
     AND idempotency_key = p_idempotency_key;
  IF v_app.id IS NOT NULL THEN
    IF v_app.invoice_id <> p_invoice_id OR v_app.amount_minor <> p_amount_minor THEN
      RAISE EXCEPTION 'DEPOSIT_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object(
      'replayed', true,
      'application_id', v_app.id,
      'deposit_id', v_app.deposit_id,
      'invoice_id', v_app.invoice_id,
      'amount_minor', v_app.amount_minor,
      'currency', v_app.currency,
      'payment_id', v_app.payment_id,
      'journal_entry_id', v_app.journal_entry_id,
      'balance', public.order_deposit_balance(p_workspace_id, p_deposit_id)
    );
  END IF;

  IF v_dep.posting_status = 'pending_posting' THEN
    RAISE EXCEPTION 'DEPOSIT_PENDING_POSTING' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.journal_entries
     WHERE workspace_id = p_workspace_id
       AND source_type = 'order_deposit'
       AND source_id = v_dep.id
       AND status = 'posted'
  ) THEN
    RAISE EXCEPTION 'DEPOSIT_NOT_BOOKED' USING ERRCODE = 'P0001';
  END IF;
  IF v_dep.currency IS NULL THEN
    RAISE EXCEPTION 'DEPOSIT_CURRENCY_UNKNOWN' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, type, supplier_id, customer_id, currency, total, status
    INTO v_inv
    FROM public.invoices
   WHERE id = p_invoice_id AND workspace_id = p_workspace_id
   FOR UPDATE;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'DEPOSIT_INVOICE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(v_inv.type, '') <> 'purchase' THEN
    RAISE EXCEPTION 'ADVANCE_INVOICE_NOT_PURCHASE' USING ERRCODE = 'P0001';
  END IF;
  -- A purchase names its supplier in supplier_id; older rows used customer_id.
  IF COALESCE(v_inv.supplier_id, v_inv.customer_id) IS DISTINCT FROM v_dep.customer_id THEN
    RAISE EXCEPTION 'DEPOSIT_CUSTOMER_MISMATCH' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.currency IS NULL OR v_inv.currency <> v_dep.currency THEN
    RAISE EXCEPTION 'DEPOSIT_CURRENCY_MISMATCH' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(v_inv.status, '') IN ('', 'draft', 'cancelled') THEN
    RAISE EXCEPTION 'DEPOSIT_INVOICE_NOT_FINAL' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.journal_entries
     WHERE workspace_id = p_workspace_id
       AND source_type = 'invoice'
       AND source_id = v_inv.id
       AND status = 'posted'
  ) THEN
    RAISE EXCEPTION 'DEPOSIT_INVOICE_NOT_POSTED' USING ERRCODE = 'P0001';
  END IF;

  v_amount := ROUND(p_amount_minor::numeric / POWER(10::numeric, p_fraction_digits::numeric), 2);
  IF v_amount <= 0
     OR ROUND(v_amount * POWER(10::numeric, p_fraction_digits::numeric), 0) <> p_amount_minor THEN
    RAISE EXCEPTION 'DEPOSIT_CURRENCY_PRECISION_UNSUPPORTED' USING ERRCODE = 'P0001';
  END IF;

  SELECT v_inv.total - COALESCE((
           SELECT SUM(pa.amount) FROM public.payment_allocations pa
            WHERE pa.workspace_id = p_workspace_id AND pa.invoice_id = v_inv.id
         ), 0)
    INTO v_outstanding;
  IF v_amount > v_outstanding THEN
    RAISE EXCEPTION 'DEPOSIT_APPLY_EXCEEDS_INVOICE' USING ERRCODE = 'P0001';
  END IF;

  v_balance := public.order_deposit_balance(p_workspace_id, p_deposit_id);
  v_remaining := (v_balance ->> 'remaining_minor')::bigint;
  IF p_amount_minor > v_remaining THEN
    RAISE EXCEPTION 'DEPOSIT_INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || ':payments', 7));
  SELECT COALESCE(MAX(substring(payment_number FROM '^PMT-[0-9]{4}-([0-9]+)$')::int), 0) + 1
    INTO v_seq
    FROM public.payments
   WHERE workspace_id = p_workspace_id
     AND payment_number LIKE 'PMT-' || v_year || '-%';
  v_pay_number := 'PMT-' || v_year || '-' || lpad(v_seq::text, 6, '0');

  -- The settlement of the purchase invoice: a payment OUT to the supplier,
  -- allocated to it. No cash moves — the advance already left.
  v_payment_id := public.payments_record(
    p_workspace_id,
    p_user_id,
    jsonb_build_object(
      'payment_number', v_pay_number,
      'direction', 'out',
      'party_type', 'supplier',
      'party_id', v_dep.customer_id,
      'amount', v_amount,
      'currency', v_dep.currency,
      'method', 'supplier_advance',
      'entry_date', COALESCE(p_entry_date, CURRENT_DATE),
      'reference', 'ADVANCE:' || v_dep.id::text,
      'notes', 'Application of supplier advance ' || v_dep.id::text,
      'status', 'posted'
    ),
    jsonb_build_array(jsonb_build_object('invoice_id', p_invoice_id, 'amount', v_amount))
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || ':journal', 11));
  LOOP
    v_attempt := v_attempt + 1;
    SELECT COALESCE(MAX(substring(entry_number FROM '^JV-[0-9]{4}-([0-9]+)$')::int), 0) + 1
      INTO v_seq
      FROM public.journal_entries
     WHERE workspace_id = p_workspace_id
       AND entry_number LIKE 'JV-' || v_year || '-%';
    v_entry_number := 'JV-' || v_year || '-' || lpad(v_seq::text, 6, '0');
    BEGIN
      v_entry_id := public.accounting_post_journal_entry(
        p_workspace_id,
        p_user_id,
        jsonb_build_object(
          'date', COALESCE(p_entry_date, CURRENT_DATE),
          'description', 'تطبیق پیش‌پرداخت با فاکتور خرید ' || p_invoice_id::text,
          'reference', v_pay_number,
          'status', 'posted',
          'entry_number', v_entry_number,
          'source_type', 'payment',
          'source_id', v_payment_id::text
        ),
        jsonb_build_array(
          jsonb_build_object('account_id', p_payable_account_id, 'debit', v_amount, 'credit', 0),
          jsonb_build_object('account_id', p_advances_account_id, 'debit', 0, 'credit', v_amount)
        )
      );
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 5 THEN
        RAISE;
      END IF;
    END;
  END LOOP;

  UPDATE public.payments
     SET journal_entry_id = v_entry_id, updated_at = now()
   WHERE id = v_payment_id AND workspace_id = p_workspace_id;

  INSERT INTO public.order_deposit_applications (
    workspace_id, deposit_id, invoice_id, amount_minor, currency,
    idempotency_key, payment_id, journal_entry_id, created_by
  ) VALUES (
    p_workspace_id, p_deposit_id, p_invoice_id, p_amount_minor, v_dep.currency,
    p_idempotency_key, v_payment_id, v_entry_id, p_user_id
  )
  RETURNING id INTO v_application;

  UPDATE public.order_deposits
     SET applied_invoice_id = COALESCE(applied_invoice_id, p_invoice_id)
   WHERE id = p_deposit_id AND workspace_id = p_workspace_id;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'workspace_id'
  ) THEN
    INSERT INTO public.audit_logs (user_id, workspace_id, action, entity_type, entity_id, old_data, new_data, created_at)
    VALUES (
      p_user_id, p_workspace_id, 'update', 'order_deposit', p_deposit_id,
      jsonb_build_object('remaining_minor', v_remaining),
      jsonb_build_object(
        'event', 'supplier_advance_applied', 'application_id', v_application,
        'invoice_id', p_invoice_id, 'amount_minor', p_amount_minor, 'currency', v_dep.currency,
        'payment_id', v_payment_id, 'journal_entry_id', v_entry_id,
        'idempotency_key', p_idempotency_key
      ),
      now()
    );
  END IF;

  IF to_regclass('public.sod_actions') IS NOT NULL THEN
    INSERT INTO public.sod_actions (workspace_id, entity_type, entity_id, capability, actor_id, actor_role)
    VALUES (p_workspace_id, 'journal_entry', v_entry_id, 'ledger.post', p_user_id, p_actor_role);
  END IF;

  RETURN jsonb_build_object(
    'replayed', false,
    'application_id', v_application,
    'deposit_id', p_deposit_id,
    'invoice_id', p_invoice_id,
    'amount_minor', p_amount_minor,
    'currency', v_dep.currency,
    'payment_id', v_payment_id,
    'payment_number', v_pay_number,
    'journal_entry_id', v_entry_id,
    'entry_number', v_entry_number,
    'balance', public.order_deposit_balance(p_workspace_id, p_deposit_id)
  );
END;
$fn$;

-- ── 4. REFUND an unused supplier advance (the supplier gives money back) ─────
--    Dr cash|bank / Cr supplier advances, one transaction. Reason mandatory.
CREATE OR REPLACE FUNCTION public.supplier_advance_refund(
  p_workspace_id        uuid,
  p_user_id             uuid,
  p_deposit_id          uuid,
  p_amount_minor        bigint,
  p_fraction_digits     smallint,
  p_entry_date          date,
  p_method              text,
  p_reason              text,
  p_idempotency_key     text,
  p_advances_account_id uuid,
  p_money_account_id    uuid,
  p_actor_role          text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_dep          public.order_deposits%ROWTYPE;
  v_ref          public.order_deposit_refunds%ROWTYPE;
  v_balance      jsonb;
  v_remaining    bigint;
  v_amount       numeric(18, 2);
  v_payment_id   uuid;
  v_pay_number   text;
  v_entry_id     uuid;
  v_entry_number text;
  v_refund       uuid;
  v_method       text := COALESCE(NULLIF(btrim(p_method), ''), 'cash');
  v_reason       text;
  v_seq          int;
  v_attempt      int := 0;
  v_year         int := EXTRACT(YEAR FROM COALESCE(p_entry_date, CURRENT_DATE))::int;
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'DEPOSIT_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'DEPOSIT_ACTOR_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'DEPOSIT_IDEMPOTENCY_KEY_INVALID' USING ERRCODE = 'P0001';
  END IF;
  v_reason := btrim(COALESCE(p_reason, ''));
  IF length(v_reason) < 3 THEN
    RAISE EXCEPTION 'DEPOSIT_REFUND_REASON_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF length(v_reason) > 500 THEN
    RAISE EXCEPTION 'DEPOSIT_REFUND_REASON_TOO_LONG' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'DEPOSIT_AMOUNT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF p_fraction_digits IS NULL OR p_fraction_digits < 0 OR p_fraction_digits > 2 THEN
    RAISE EXCEPTION 'DEPOSIT_CURRENCY_PRECISION_UNSUPPORTED' USING ERRCODE = 'P0001';
  END IF;
  IF p_advances_account_id IS NULL OR p_money_account_id IS NULL THEN
    RAISE EXCEPTION 'DEPOSIT_ACCOUNTS_MISSING' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_dep
    FROM public.order_deposits
   WHERE id = p_deposit_id AND workspace_id = p_workspace_id
   FOR UPDATE;
  IF v_dep.id IS NULL THEN
    RAISE EXCEPTION 'DEPOSIT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_dep.source_type <> 'pre_purchase' THEN
    RAISE EXCEPTION 'ADVANCE_KIND_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_ref
    FROM public.order_deposit_refunds
   WHERE workspace_id = p_workspace_id
     AND deposit_id = p_deposit_id
     AND idempotency_key = p_idempotency_key;
  IF v_ref.id IS NOT NULL THEN
    IF v_ref.amount_minor <> p_amount_minor OR v_ref.reason <> v_reason THEN
      RAISE EXCEPTION 'DEPOSIT_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object(
      'replayed', true,
      'refund_id', v_ref.id,
      'deposit_id', v_ref.deposit_id,
      'amount_minor', v_ref.amount_minor,
      'currency', v_ref.currency,
      'method', v_ref.method,
      'reason', v_ref.reason,
      'payment_id', v_ref.payment_id,
      'journal_entry_id', v_ref.journal_entry_id,
      'balance', public.order_deposit_balance(p_workspace_id, p_deposit_id)
    );
  END IF;

  IF v_dep.posting_status = 'pending_posting' THEN
    RAISE EXCEPTION 'DEPOSIT_PENDING_POSTING' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.journal_entries
     WHERE workspace_id = p_workspace_id
       AND source_type = 'order_deposit'
       AND source_id = v_dep.id
       AND status = 'posted'
  ) THEN
    RAISE EXCEPTION 'DEPOSIT_NOT_BOOKED' USING ERRCODE = 'P0001';
  END IF;
  IF v_dep.currency IS NULL THEN
    RAISE EXCEPTION 'DEPOSIT_CURRENCY_UNKNOWN' USING ERRCODE = 'P0001';
  END IF;

  v_amount := ROUND(p_amount_minor::numeric / POWER(10::numeric, p_fraction_digits::numeric), 2);
  IF v_amount <= 0
     OR ROUND(v_amount * POWER(10::numeric, p_fraction_digits::numeric), 0) <> p_amount_minor THEN
    RAISE EXCEPTION 'DEPOSIT_CURRENCY_PRECISION_UNSUPPORTED' USING ERRCODE = 'P0001';
  END IF;

  v_balance := public.order_deposit_balance(p_workspace_id, p_deposit_id);
  v_remaining := (v_balance ->> 'remaining_minor')::bigint;
  IF p_amount_minor > v_remaining THEN
    RAISE EXCEPTION 'DEPOSIT_INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || ':payments', 7));
  SELECT COALESCE(MAX(substring(payment_number FROM '^PMT-[0-9]{4}-([0-9]+)$')::int), 0) + 1
    INTO v_seq
    FROM public.payments
   WHERE workspace_id = p_workspace_id
     AND payment_number LIKE 'PMT-' || v_year || '-%';
  v_pay_number := 'PMT-' || v_year || '-' || lpad(v_seq::text, 6, '0');

  -- Money coming back from the supplier: a payment IN with no allocation.
  v_payment_id := public.payments_record(
    p_workspace_id,
    p_user_id,
    jsonb_build_object(
      'payment_number', v_pay_number,
      'direction', 'in',
      'party_type', 'supplier',
      'party_id', v_dep.customer_id,
      'amount', v_amount,
      'currency', v_dep.currency,
      'method', v_method,
      'entry_date', COALESCE(p_entry_date, CURRENT_DATE),
      'reference', 'ADVANCE-REFUND:' || v_dep.id::text,
      'notes', 'Refund of supplier advance ' || v_dep.id::text,
      'status', 'posted'
    ),
    '[]'::jsonb
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || ':journal', 11));
  LOOP
    v_attempt := v_attempt + 1;
    SELECT COALESCE(MAX(substring(entry_number FROM '^JV-[0-9]{4}-([0-9]+)$')::int), 0) + 1
      INTO v_seq
      FROM public.journal_entries
     WHERE workspace_id = p_workspace_id
       AND entry_number LIKE 'JV-' || v_year || '-%';
    v_entry_number := 'JV-' || v_year || '-' || lpad(v_seq::text, 6, '0');
    BEGIN
      v_entry_id := public.accounting_post_journal_entry(
        p_workspace_id,
        p_user_id,
        jsonb_build_object(
          'date', COALESCE(p_entry_date, CURRENT_DATE),
          'description', 'برگشت پیش‌پرداخت از تأمین‌کننده ' || v_dep.id::text,
          'reference', v_pay_number,
          'status', 'posted',
          'entry_number', v_entry_number,
          'source_type', 'payment',
          'source_id', v_payment_id::text
        ),
        jsonb_build_array(
          jsonb_build_object('account_id', p_money_account_id, 'debit', v_amount, 'credit', 0),
          jsonb_build_object('account_id', p_advances_account_id, 'debit', 0, 'credit', v_amount)
        )
      );
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 5 THEN
        RAISE;
      END IF;
    END;
  END LOOP;

  IF v_entry_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.journal_entries
     WHERE id = v_entry_id AND workspace_id = p_workspace_id AND status = 'posted'
  ) THEN
    RAISE EXCEPTION 'DEPOSIT_REFUND_NOT_POSTED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.payments
     SET journal_entry_id = v_entry_id, updated_at = now()
   WHERE id = v_payment_id AND workspace_id = p_workspace_id;

  INSERT INTO public.order_deposit_refunds (
    workspace_id, deposit_id, amount_minor, currency, method, reason,
    idempotency_key, payment_id, journal_entry_id, created_by
  ) VALUES (
    p_workspace_id, p_deposit_id, p_amount_minor, v_dep.currency, v_method, v_reason,
    p_idempotency_key, v_payment_id, v_entry_id, p_user_id
  )
  RETURNING id INTO v_refund;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'workspace_id'
  ) THEN
    INSERT INTO public.audit_logs (user_id, workspace_id, action, entity_type, entity_id, old_data, new_data, created_at)
    VALUES (
      p_user_id, p_workspace_id, 'update', 'order_deposit', p_deposit_id,
      jsonb_build_object('remaining_minor', v_remaining),
      jsonb_build_object(
        'event', 'supplier_advance_refunded', 'refund_id', v_refund,
        'amount_minor', p_amount_minor, 'currency', v_dep.currency, 'method', v_method,
        'reason', v_reason, 'actor_id', p_user_id, 'occurred_at', now(),
        'payment_id', v_payment_id, 'journal_entry_id', v_entry_id,
        'idempotency_key', p_idempotency_key
      ),
      now()
    );
  END IF;

  IF to_regclass('public.sod_actions') IS NOT NULL THEN
    INSERT INTO public.sod_actions (workspace_id, entity_type, entity_id, capability, actor_id, actor_role)
    VALUES (p_workspace_id, 'journal_entry', v_entry_id, 'ledger.post', p_user_id, p_actor_role);
  END IF;

  RETURN jsonb_build_object(
    'replayed', false,
    'refund_id', v_refund,
    'deposit_id', p_deposit_id,
    'amount_minor', p_amount_minor,
    'currency', v_dep.currency,
    'method', v_method,
    'reason', v_reason,
    'payment_id', v_payment_id,
    'payment_number', v_pay_number,
    'journal_entry_id', v_entry_id,
    'entry_number', v_entry_number,
    'balance', public.order_deposit_balance(p_workspace_id, p_deposit_id)
  );
END;
$fn$;

-- ── 5. Nobody but the server may call these ────────────────────────────────
REVOKE ALL ON FUNCTION public.supplier_advance_apply(uuid, uuid, uuid, uuid, bigint, smallint, date, text, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_advance_apply(uuid, uuid, uuid, uuid, bigint, smallint, date, text, uuid, uuid, text)
  TO service_role;
REVOKE ALL ON FUNCTION public.supplier_advance_refund(uuid, uuid, uuid, bigint, smallint, date, text, text, text, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_advance_refund(uuid, uuid, uuid, bigint, smallint, date, text, text, text, uuid, uuid, text)
  TO service_role;

NOTIFY pgrst, 'reload schema';

-- ── ROLLBACK BLOCK (manual; entries already posted stay — reversing them is a
--    financial decision for a person) ─────────────────────────────────────────
-- DROP FUNCTION IF EXISTS public.supplier_advance_refund(uuid, uuid, uuid, bigint, smallint, date, text, text, text, uuid, uuid, text);
-- DROP FUNCTION IF EXISTS public.supplier_advance_apply(uuid, uuid, uuid, uuid, bigint, smallint, date, text, uuid, uuid, text);
-- ALTER TABLE public.order_deposits DROP CONSTRAINT IF EXISTS order_deposits_note_length;
-- ALTER TABLE public.order_deposits DROP COLUMN IF EXISTS note;
-- (accounts_role_check: re-add it without 'supplier_advances' only once no account carries that role.)
