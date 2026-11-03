-- ============================================================================
-- docs/order-deposit-apply-refund-01-migration.sql
--
-- P1 (V53 owner decision, 3 Nov 2026) — APPLY and REFUND of an order deposit.
--
-- The owner's table:
--
--   receipt            Dr cash | bank            Cr customer advances
--   applied to invoice Dr customer advances      Cr receivable
--   refund             Dr customer advances      Cr cash | bank
--
-- The deposit is a LIABILITY. Applying it settles the customer's invoice
-- without any cash moving; refunding it gives part of the money back. Both
-- change financial state, so both must be ONE transaction:
--
--   lock the deposit -> validate -> settle -> post -> audit -> record
--
-- and a failure anywhere leaves NOTHING behind. Two statements from Node
-- cannot promise that (supabase-js has no transaction), which is why this
-- file exists as a function rather than a service method.
--
-- WHAT IS REUSED, NOT REBUILT
--
--   · `payments_record` (docs/payments-ar-ap-migration.sql +
--     docs/phase-f-01-receivables-projection-migration.sql) writes the
--     payment and its allocation and locks the invoice while it checks what is
--     still owed. `payment_allocations` stays the ONE source of truth for
--     settlement — an apply is a settlement, so it produces a real payment and
--     a real allocation rather than a second, parallel kind of settlement.
--   · `accounting_post_journal_entry` (docs/accounting-core-migration.sql)
--     writes the header and its lines in one transaction, re-checks balance,
--     period lock and account validity while holding it.
--   · The apply entry is source_type 'payment' / source_id <payment id>, the
--     same source the Payments module uses. Cancelling that payment therefore
--     reverses the apply through the existing path: the invoice reopens and
--     the customer's advance comes back. No second reversal engine.
--
-- WHAT IS NEW, AND WHY IT IS NOT A NEW FINANCIAL TRUTH
--
--   · `order_deposit_applications` / `order_deposit_refunds`: the idempotency
--     key and the link (deposit -> invoice -> payment -> journal entry). No
--     amount is ever read from these tables to decide money; the payment's
--     status is what counts, so a cancelled payment stops counting on its own.
--   · `order_deposit_refunds.reason`: a refund must say WHY the money went
--     back. It is mandatory, trimmed, 3..500 characters, stored on the row and
--     copied into the audit row with the actor, the amount, the currency, the
--     payment and the entry. The old 11-argument function is DROPPED, not left
--     beside the new one: an overload without a reason would be a bypass.
--   · `order_deposits.posting_status`: `pending_posting` is the explicit,
--     recoverable state for a receipt that was recorded while the chart of
--     accounts could not express the entry. Nothing is invented and nothing is
--     dropped; the recovery endpoint re-posts it idempotently.
--   · `order_deposits.currency`: the currency the deposit was taken in. Apply
--     refuses an invoice in another currency instead of pretending 1:1.
--
-- MONEY UNITS. `order_deposits.amount_minor` stays integer minor units. The
-- conversion to the ledger's major amount uses the currency's own precision,
-- passed in by the caller from `FRACTION_DIGITS` (AFN 0, USD 2 ...). There is
-- no `/ 100` anywhere in this file. A currency whose precision the payments
-- core cannot store (numeric(18,2)) is refused, not truncated.
--
-- HISTORY. No row is deleted, updated in bulk or backfilled. `posting_status`
-- and `currency` are NULL on every deposit written before this migration and
-- stay NULL: NULL means «this was not recorded», never «zero» and never «posted».
--
-- OFFLINE. These are ONLINE-ONLY operations: they need the row locks and the
-- ledger, and the device has neither. The client matrix
-- (packages/validation/src/schemas/offline-endpoint-matrix.ts) is therefore NOT
-- extended here — no client calls these endpoints yet, and marking a `local`
-- feature's endpoint `online_required` would split that feature in two. When a
-- screen or the device starts using them, that decision belongs in its own
-- change with the queue/conflict rules it implies.
--
-- `payments.method` has no CHECK constraint, so 'order_deposit' needs no
-- widening. The payment is a real payment: cancelling it through the existing
-- payments path (allocation deleted, status 'cancelled') reopens the invoice and
-- stops the balance counting it.
--
-- ADDITIVE and IDEMPOTENT. SAFE TO RE-RUN.
--
-- RUN ORDER:
--   after docs/accounting-core-migration.sql,
--   after docs/payments-ar-ap-migration.sql,
--   after docs/phase-f-01-receivables-projection-migration.sql,
--   after docs/customer-advances-01-migration.sql.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.order_deposit_refund(uuid, uuid, uuid, bigint, smallint, date, text, text, text, uuid, uuid, text);
--   DROP FUNCTION IF EXISTS public.order_deposit_apply(uuid, uuid, uuid, uuid, bigint, smallint, date, text, uuid, uuid, text);
--   DROP FUNCTION IF EXISTS public.order_deposit_balance(uuid, uuid);
--   DROP TABLE IF EXISTS public.order_deposit_refunds;
--   DROP TABLE IF EXISTS public.order_deposit_applications;
--   ALTER TABLE public.order_deposits DROP CONSTRAINT IF EXISTS order_deposits_posting_status_check;
--   ALTER TABLE public.order_deposits DROP COLUMN IF EXISTS journal_entry_id;
--   ALTER TABLE public.order_deposits DROP COLUMN IF EXISTS posting_status;
--   ALTER TABLE public.order_deposits DROP COLUMN IF EXISTS currency;
--   (Posting entries already written are NOT removed: reversing them is a
--   financial decision for a person, not something a rollback does silently.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Prerequisites — fail here, with a name, rather than at 2am in a posting
-- ---------------------------------------------------------------------------

DO $guard$
BEGIN
  IF to_regclass('public.order_deposits') IS NULL THEN
    RAISE EXCEPTION 'ORDER_DEPOSIT_APPLY_REFUND: public.order_deposits is missing (docs/universal-core-migration.sql).';
  END IF;
  IF to_regclass('public.payments') IS NULL
     OR to_regclass('public.payment_allocations') IS NULL THEN
    RAISE EXCEPTION 'ORDER_DEPOSIT_APPLY_REFUND: the payments core is missing (docs/payments-ar-ap-migration.sql).';
  END IF;
  IF to_regprocedure('public.payments_record(uuid,uuid,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'ORDER_DEPOSIT_APPLY_REFUND: public.payments_record(uuid,uuid,jsonb,jsonb) is missing (docs/payments-ar-ap-migration.sql).';
  END IF;
  IF to_regclass('public.journal_entries') IS NULL
     OR to_regclass('public.accounts') IS NULL THEN
    RAISE EXCEPTION 'ORDER_DEPOSIT_APPLY_REFUND: the accounting core is missing (docs/accounting-core-migration.sql).';
  END IF;
  IF to_regprocedure('public.accounting_post_journal_entry(uuid,uuid,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'ORDER_DEPOSIT_APPLY_REFUND: public.accounting_post_journal_entry(uuid,uuid,jsonb,jsonb) is missing (docs/accounting-core-migration.sql).';
  END IF;
  IF to_regclass('public.audit_logs') IS NULL THEN
    RAISE EXCEPTION 'ORDER_DEPOSIT_APPLY_REFUND: public.audit_logs is missing (docs/base-schema-migration.sql).';
  END IF;
  IF to_regclass('public.invoices') IS NULL THEN
    RAISE EXCEPTION 'ORDER_DEPOSIT_APPLY_REFUND: public.invoices is missing (docs/base-schema-migration.sql).';
  END IF;
END
$guard$;

-- ---------------------------------------------------------------------------
-- 1. The deposit learns which currency it was taken in and whether its receipt
--    actually reached the ledger.
-- ---------------------------------------------------------------------------

ALTER TABLE public.order_deposits ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE public.order_deposits ADD COLUMN IF NOT EXISTS posting_status text;
ALTER TABLE public.order_deposits ADD COLUMN IF NOT EXISTS journal_entry_id uuid;

ALTER TABLE public.order_deposits DROP CONSTRAINT IF EXISTS order_deposits_posting_status_check;
ALTER TABLE public.order_deposits ADD CONSTRAINT order_deposits_posting_status_check
  CHECK (posting_status IS NULL OR posting_status IN ('posted', 'pending_posting'));

COMMENT ON COLUMN public.order_deposits.posting_status IS
  'Whether the RECEIPT of this deposit reached the ledger. `posted` = an entry exists; `pending_posting` = the money was recorded but the chart of accounts could not express the entry — an explicit, recoverable state, never a silent skip. NULL = written before the column existed; unknown, never guessed.';

COMMENT ON COLUMN public.order_deposits.currency IS
  'The currency the deposit was taken in (the workspace''s books currency at the time). Apply refuses an invoice in another currency. NULL on rows written before the column existed.';

COMMENT ON COLUMN public.order_deposits.journal_entry_id IS
  'The entry that booked the RECEIPT (Dr cash|bank / Cr customer advances). Application and refund entries are reachable through order_deposit_applications / order_deposit_refunds.';

CREATE INDEX IF NOT EXISTS order_deposits_workspace_order_idx
  ON public.order_deposits (workspace_id, order_id);

-- ---------------------------------------------------------------------------
-- 2. Applications — how much of a deposit settled which invoice
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.order_deposit_applications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL,
  deposit_id        uuid NOT NULL REFERENCES public.order_deposits (id),
  invoice_id        uuid NOT NULL,
  -- Integer minor units of `currency`, exactly as the deposit stores them.
  amount_minor      bigint NOT NULL,
  currency          text NOT NULL,
  idempotency_key   text NOT NULL,
  -- The settlement itself: a real payment and its allocation. The payment's
  -- status decides whether this application still counts.
  payment_id        uuid NOT NULL REFERENCES public.payments (id),
  journal_entry_id  uuid,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_deposit_applications_amount_check CHECK (amount_minor > 0),
  CONSTRAINT order_deposit_applications_key_check
    CHECK (length(idempotency_key) BETWEEN 8 AND 128)
);

-- One application per request key. A replay returns the first result instead
-- of settling the invoice twice.
CREATE UNIQUE INDEX IF NOT EXISTS order_deposit_applications_idem_key
  ON public.order_deposit_applications (workspace_id, deposit_id, idempotency_key);

-- One payment settles one application; the reverse would let two applications
-- claim the same money.
CREATE UNIQUE INDEX IF NOT EXISTS order_deposit_applications_payment_key
  ON public.order_deposit_applications (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS order_deposit_applications_deposit_idx
  ON public.order_deposit_applications (workspace_id, deposit_id);

CREATE INDEX IF NOT EXISTS order_deposit_applications_invoice_idx
  ON public.order_deposit_applications (workspace_id, invoice_id);

-- ---------------------------------------------------------------------------
-- 3. Refunds — how much of a deposit was given back
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.order_deposit_refunds (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL,
  deposit_id        uuid NOT NULL REFERENCES public.order_deposits (id),
  amount_minor      bigint NOT NULL,
  currency          text NOT NULL,
  method            text NOT NULL DEFAULT 'cash',
  -- WHY the money went back. Mandatory: a refund with no stated reason is not
  -- an auditable financial event. Trimmed, 3..500 characters (the same rule the
  -- function enforces, so a direct INSERT cannot store an empty explanation).
  reason            text NOT NULL,
  idempotency_key   text NOT NULL,
  payment_id        uuid NOT NULL REFERENCES public.payments (id),
  journal_entry_id  uuid,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_deposit_refunds_amount_check CHECK (amount_minor > 0),
  CONSTRAINT order_deposit_refunds_key_check
    CHECK (length(idempotency_key) BETWEEN 8 AND 128)
);

CREATE UNIQUE INDEX IF NOT EXISTS order_deposit_refunds_idem_key
  ON public.order_deposit_refunds (workspace_id, deposit_id, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS order_deposit_refunds_payment_key
  ON public.order_deposit_refunds (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS order_deposit_refunds_deposit_idx
  ON public.order_deposit_refunds (workspace_id, deposit_id);

-- The table above is CREATED with `reason`. A database that already ran rev1 of
-- this file has it without the column: add it, refuse to invent an explanation
-- for a row that has none, then make it mandatory. No backfill, no placeholder.
ALTER TABLE public.order_deposit_refunds ADD COLUMN IF NOT EXISTS reason text;

DO $reason_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.order_deposit_refunds WHERE reason IS NULL) THEN
    RAISE EXCEPTION 'ORDER_DEPOSIT_APPLY_REFUND: order_deposit_refunds has rows with no reason. Review them by hand before this migration — a reason is never invented.';
  END IF;
END
$reason_guard$;

ALTER TABLE public.order_deposit_refunds ALTER COLUMN reason SET NOT NULL;

ALTER TABLE public.order_deposit_refunds DROP CONSTRAINT IF EXISTS order_deposit_refunds_reason_check;
ALTER TABLE public.order_deposit_refunds ADD CONSTRAINT order_deposit_refunds_reason_check
  CHECK (length(btrim(reason)) BETWEEN 3 AND 500) NOT VALID;
ALTER TABLE public.order_deposit_refunds VALIDATE CONSTRAINT order_deposit_refunds_reason_check;

COMMENT ON COLUMN public.order_deposit_refunds.reason IS
  'Why the money went back. Mandatory, trimmed, 3..500 characters; the same text is copied into audit_logs.new_data, so the trail cannot be rewritten later.';

-- ---------------------------------------------------------------------------
-- 4. What is left of a deposit — computed, never stored
--
--    Amounts are counted only while their payment is still `posted`. A
--    cancelled payment therefore stops consuming the deposit immediately, with
--    no second write to keep in step.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.order_deposit_balance(
  p_workspace_id uuid,
  p_deposit_id   uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_amount   bigint;
  v_applied  bigint;
  v_refunded bigint;
BEGIN
  IF p_workspace_id IS NULL OR p_deposit_id IS NULL THEN
    RAISE EXCEPTION 'DEPOSIT_BALANCE_ARGUMENT_INVALID' USING ERRCODE = 'P0001';
  END IF;

  SELECT amount_minor INTO v_amount
    FROM public.order_deposits
   WHERE id = p_deposit_id AND workspace_id = p_workspace_id;

  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'DEPOSIT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(a.amount_minor), 0) INTO v_applied
    FROM public.order_deposit_applications a
    JOIN public.payments p
      ON p.id = a.payment_id AND p.workspace_id = a.workspace_id
   WHERE a.workspace_id = p_workspace_id
     AND a.deposit_id = p_deposit_id
     AND p.status = 'posted';

  SELECT COALESCE(SUM(r.amount_minor), 0) INTO v_refunded
    FROM public.order_deposit_refunds r
    JOIN public.payments p
      ON p.id = r.payment_id AND p.workspace_id = r.workspace_id
   WHERE r.workspace_id = p_workspace_id
     AND r.deposit_id = p_deposit_id
     AND p.status = 'posted';

  RETURN jsonb_build_object(
    'deposit_id', p_deposit_id,
    'amount_minor', v_amount,
    'applied_minor', v_applied,
    'refunded_minor', v_refunded,
    'remaining_minor', v_amount - v_applied - v_refunded
  );
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 5. APPLY — Dr customer advances / Cr receivable, one transaction
--
--    p_fraction_digits comes from the server's FRACTION_DIGITS for the
--    deposit currency. It is used to convert minor -> major, and the round
--    trip is checked: an amount that cannot be represented exactly (a
--    3-decimal currency in a numeric(18,2) ledger) is refused, never rounded
--    away.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.order_deposit_apply(
  p_workspace_id        uuid,
  p_user_id             uuid,
  p_deposit_id          uuid,
  p_invoice_id          uuid,
  p_amount_minor        bigint,
  p_fraction_digits     smallint,
  p_entry_date          date,
  p_idempotency_key     text,
  p_advances_account_id uuid,
  p_receivable_account_id uuid,
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
  -- Optional column (phase-j-03). Read through dynamic SQL only when it is
  -- there, so this function still works on a database that has not run that
  -- migration — the same tolerance invoice.service shows.
  v_doc_status   text;
  v_payment_id   uuid;
  v_pay_number   text;
  v_entry_id     uuid;
  v_entry_number text;
  v_application  uuid;
  v_audit_old    jsonb;
  v_audit_new    jsonb;
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
  IF p_advances_account_id IS NULL OR p_receivable_account_id IS NULL THEN
    RAISE EXCEPTION 'DEPOSIT_ACCOUNTS_MISSING' USING ERRCODE = 'P0001';
  END IF;

  -- The lock is the whole concurrency story: every apply and every refund on
  -- this deposit waits here, so two of them cannot both read the same
  -- available balance and both succeed.
  SELECT * INTO v_dep
    FROM public.order_deposits
   WHERE id = p_deposit_id AND workspace_id = p_workspace_id
   FOR UPDATE;

  IF v_dep.id IS NULL THEN
    RAISE EXCEPTION 'DEPOSIT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- A retry of a request that already succeeded answers with that result.
  SELECT * INTO v_app
    FROM public.order_deposit_applications
   WHERE workspace_id = p_workspace_id
     AND deposit_id = p_deposit_id
     AND idempotency_key = p_idempotency_key;

  IF v_app.id IS NOT NULL THEN
    IF v_app.invoice_id <> p_invoice_id OR v_app.amount_minor <> p_amount_minor THEN
      -- The same key for a different request is a client defect, not a retry.
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

  -- Money that was never booked cannot be applied: crediting customer
  -- advances that were never debited would invent a balance. `pending_posting`
  -- is recoverable — the receipt endpoint posts it and flips the state.
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

  -- Lock the invoice while its real remaining balance is read, exactly as
  -- payments_record does.
  SELECT id, workspace_id, customer_id, currency, total, status
    INTO v_inv
    FROM public.invoices
   WHERE id = p_invoice_id AND workspace_id = p_workspace_id
   FOR UPDATE;

  -- A missing invoice and an invoice in ANOTHER workspace answer the same
  -- thing: nothing about another business's books is revealed.
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'DEPOSIT_INVOICE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_inv.customer_id IS NULL OR v_inv.customer_id <> v_dep.customer_id THEN
    RAISE EXCEPTION 'DEPOSIT_CUSTOMER_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  -- An invoice with no currency is UNKNOWN, not «the deposit's currency».
  -- Assuming they agree would settle a receivable that may be denominated in
  -- something else entirely.
  IF v_inv.currency IS NULL OR v_inv.currency <> v_dep.currency THEN
    RAISE EXCEPTION 'DEPOSIT_CURRENCY_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  -- FINAL means the document stands AND its effect is in the books. A draft
  -- may still change; a cancelled one must not be settled; and an invoice
  -- whose ledger posting was skipped has no receivable to credit, so applying
  -- a deposit to it would invent one.
  IF COALESCE(v_inv.status, '') IN ('', 'draft', 'cancelled') THEN
    RAISE EXCEPTION 'DEPOSIT_INVOICE_NOT_FINAL' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'invoices'
       AND column_name = 'document_status'
  ) THEN
    EXECUTE 'SELECT document_status FROM public.invoices WHERE id = $1 AND workspace_id = $2'
      INTO v_doc_status
      USING p_invoice_id, p_workspace_id;

    IF COALESCE(v_doc_status, '') IN ('draft', 'cancelled') THEN
      RAISE EXCEPTION 'DEPOSIT_INVOICE_NOT_FINAL' USING ERRCODE = 'P0001';
    END IF;
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

  -- Minor -> major with the currency's own precision, and the round trip is
  -- checked. AFN: 12,345 minor -> 12,345. USD: 12,345 minor -> 123.45.
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

  -- A settlement is a payment. payments_record locks the invoice, refuses an
  -- allocation beyond what is owed, and writes the allocation that the
  -- settlement projection reads.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || ':payments', 7));
  SELECT COALESCE(MAX(substring(payment_number FROM '^PMT-[0-9]{4}-([0-9]+)$')::int), 0) + 1
    INTO v_seq
    FROM public.payments
   WHERE workspace_id = p_workspace_id
     AND payment_number LIKE 'PMT-' || v_year || '-%';

  v_pay_number := 'PMT-' || v_year || '-' || lpad(v_seq::text, 6, '0');

  v_payment_id := public.payments_record(
    p_workspace_id,
    p_user_id,
    jsonb_build_object(
      'payment_number', v_pay_number,
      'direction', 'in',
      'party_type', 'customer',
      'party_id', v_dep.customer_id,
      'amount', v_amount,
      'currency', v_dep.currency,
      'method', 'order_deposit',
      'entry_date', COALESCE(p_entry_date, CURRENT_DATE),
      'reference', 'DEPOSIT:' || v_dep.id::text,
      'notes', 'Application of order deposit ' || v_dep.id::text,
      'status', 'posted'
    ),
    jsonb_build_array(
      jsonb_build_object('invoice_id', p_invoice_id, 'amount', v_amount)
    )
  );

  -- The entry: Dr customer advances / Cr receivable.
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
          'description', 'تطبیق بیعانه سفارش با فاکتور ' || p_invoice_id::text,
          'reference', v_pay_number,
          'status', 'posted',
          'entry_number', v_entry_number,
          'source_type', 'payment',
          'source_id', v_payment_id::text
        ),
        jsonb_build_array(
          jsonb_build_object('account_id', p_advances_account_id, 'debit', v_amount, 'credit', 0),
          jsonb_build_object('account_id', p_receivable_account_id, 'debit', 0, 'credit', v_amount)
        )
      );
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- Another posting took that number between the read and the insert. The
      -- savepoint undoes only this attempt; the payment above is untouched.
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

  -- A pointer for the screens that still read it; never overwrites a different
  -- invoice that was applied earlier.
  UPDATE public.order_deposits
     SET applied_invoice_id = COALESCE(applied_invoice_id, p_invoice_id)
   WHERE id = p_deposit_id AND workspace_id = p_workspace_id;

  v_audit_old := jsonb_build_object(
    'applied_minor', (v_balance ->> 'applied_minor')::bigint,
    'remaining_minor', v_remaining
  );
  v_audit_new := jsonb_build_object(
    'event', 'order_deposit_applied',
    'application_id', v_application,
    'invoice_id', p_invoice_id,
    'amount_minor', p_amount_minor,
    'currency', v_dep.currency,
    'payment_id', v_payment_id,
    'payment_number', v_pay_number,
    'journal_entry_id', v_entry_id,
    'entry_number', v_entry_number,
    'idempotency_key', p_idempotency_key
  );

  -- `audit_logs.workspace_id` arrives with docs/live-reconciliation-migration.sql.
  -- A database that has not run it still records the event, scoped by the
  -- entity it names, rather than failing the whole application.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'audit_logs'
       AND column_name = 'workspace_id'
  ) THEN
    INSERT INTO public.audit_logs (
      user_id, workspace_id, action, entity_type, entity_id, old_data, new_data, created_at
    ) VALUES (
      p_user_id, p_workspace_id, 'update', 'order_deposit', p_deposit_id,
      v_audit_old, v_audit_new, now()
    );
  ELSE
    INSERT INTO public.audit_logs (
      user_id, action, entity_type, entity_id, old_data, new_data, created_at
    ) VALUES (
      p_user_id, 'update', 'order_deposit', p_deposit_id,
      v_audit_old, v_audit_new, now()
    );
  END IF;

  -- The SoD index is a machine-read control, not the audit trail. Written in
  -- the same transaction so a posting cannot exist without it; guarded because
  -- the table arrives with docs/sod-migration.sql.
  IF to_regclass('public.sod_actions') IS NOT NULL THEN
    INSERT INTO public.sod_actions (
      workspace_id, entity_type, entity_id, capability, actor_id, actor_role
    ) VALUES (
      p_workspace_id, 'journal_entry', v_entry_id, 'ledger.post', p_user_id, p_actor_role
    );
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

-- ---------------------------------------------------------------------------
-- 6. REFUND — Dr customer advances / Cr cash | bank, one transaction
--
--    A refund is money going back, so it is a payment with direction 'out' and
--    no allocation. It is independent of any invoice: it returns the unused
--    advance, not a settlement.
--
--    WHY IS MANDATORY. A refund that does not say why is not an event a person
--    can review later. The reason is validated here (the server validates it too
--    with the same codes), stored on the refund row, and copied into audit_logs
--    together with the actor and the moment. The previous 11-argument signature
--    is DROPPED below so no caller can reach a version that skips it: an
--    overload left behind is a bypass.
--
--    NOTHING IS «COMPLETED» WITHOUT ITS ENTRY. accounting_post_journal_entry
--    returns an id or raises; this function also re-reads that id and refuses
--    DEPOSIT_REFUND_NOT_POSTED when the posted row is not there. Only then is
--    the refund row written — still inside the same transaction.
-- ---------------------------------------------------------------------------

-- rev2 signature. The old one is dropped explicitly: CREATE OR REPLACE with a
-- different argument list would leave both callable, and the old one has no
-- reason.
DROP FUNCTION IF EXISTS public.order_deposit_refund(uuid, uuid, uuid, bigint, smallint, date, text, text, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.order_deposit_refund(
  p_workspace_id        uuid,
  p_user_id             uuid,
  p_deposit_id          uuid,
  p_amount_minor        bigint,
  p_fraction_digits     smallint,
  p_entry_date          date,
  p_method              text,
  -- WHY the money went back. Mandatory, trimmed, 3..500 characters.
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
  v_audit_old    jsonb;
  v_audit_new    jsonb;
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
  -- The reason is part of the request, not a note: a refund that does not say
  -- why cannot be reviewed later. Same rule as the wire schema and the column.
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

  SELECT * INTO v_ref
    FROM public.order_deposit_refunds
   WHERE workspace_id = p_workspace_id
     AND deposit_id = p_deposit_id
     AND idempotency_key = p_idempotency_key;

  IF v_ref.id IS NOT NULL THEN
    -- A retry carries the same amount AND the same reason. The same key with
    -- a different explanation is a different refund sharing a key, not a retry.
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

  v_payment_id := public.payments_record(
    p_workspace_id,
    p_user_id,
    jsonb_build_object(
      'payment_number', v_pay_number,
      'direction', 'out',
      'party_type', 'customer',
      'party_id', v_dep.customer_id,
      'amount', v_amount,
      'currency', v_dep.currency,
      'method', v_method,
      'entry_date', COALESCE(p_entry_date, CURRENT_DATE),
      'reference', 'DEPOSIT-REFUND:' || v_dep.id::text,
      'notes', 'Refund of order deposit ' || v_dep.id::text,
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
          'description', 'بازپرداخت بیعانه ' || v_dep.id::text,
          'reference', v_pay_number,
          'status', 'posted',
          'entry_number', v_entry_number,
          'source_type', 'payment',
          'source_id', v_payment_id::text
        ),
        jsonb_build_array(
          jsonb_build_object('account_id', p_advances_account_id, 'debit', v_amount, 'credit', 0),
          jsonb_build_object('account_id', p_money_account_id, 'debit', 0, 'credit', v_amount)
        )
      );
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 5 THEN
        RAISE;
      END IF;
    END;
  END LOOP;

  -- Owner rule: a refund is never «completed» without its posted entry.
  -- accounting_post_journal_entry already answers an id or raises; this reads
  -- the row back so the guarantee does not rest on an assumption about another
  -- function's internals.
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

  v_audit_old := jsonb_build_object(
    'refunded_minor', (v_balance ->> 'refunded_minor')::bigint,
    'remaining_minor', v_remaining
  );
  -- Owner rule 4: the immutable trail names the actor, the moment, the amount,
  -- the currency, the reason, the deposit, the payment and the entry.
  v_audit_new := jsonb_build_object(
    'event', 'order_deposit_refunded',
    'refund_id', v_refund,
    'deposit_id', p_deposit_id,
    'amount_minor', p_amount_minor,
    'currency', v_dep.currency,
    'method', v_method,
    'reason', v_reason,
    'actor_id', p_user_id,
    'occurred_at', now(),
    'payment_id', v_payment_id,
    'payment_number', v_pay_number,
    'journal_entry_id', v_entry_id,
    'entry_number', v_entry_number,
    'idempotency_key', p_idempotency_key
  );

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'audit_logs'
       AND column_name = 'workspace_id'
  ) THEN
    INSERT INTO public.audit_logs (
      user_id, workspace_id, action, entity_type, entity_id, old_data, new_data, created_at
    ) VALUES (
      p_user_id, p_workspace_id, 'update', 'order_deposit', p_deposit_id,
      v_audit_old, v_audit_new, now()
    );
  ELSE
    INSERT INTO public.audit_logs (
      user_id, action, entity_type, entity_id, old_data, new_data, created_at
    ) VALUES (
      p_user_id, 'update', 'order_deposit', p_deposit_id,
      v_audit_old, v_audit_new, now()
    );
  END IF;

  IF to_regclass('public.sod_actions') IS NOT NULL THEN
    INSERT INTO public.sod_actions (
      workspace_id, entity_type, entity_id, capability, actor_id, actor_role
    ) VALUES (
      p_workspace_id, 'journal_entry', v_entry_id, 'ledger.post', p_user_id, p_actor_role
    );
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

-- ---------------------------------------------------------------------------
-- 7. Nobody but the server may call these
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.order_deposit_balance(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_deposit_balance(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.order_deposit_apply(uuid, uuid, uuid, uuid, bigint, smallint, date, text, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_deposit_apply(uuid, uuid, uuid, uuid, bigint, smallint, date, text, uuid, uuid, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.order_deposit_refund(uuid, uuid, uuid, bigint, smallint, date, text, text, text, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_deposit_refund(uuid, uuid, uuid, bigint, smallint, date, text, text, text, uuid, uuid, text)
  TO service_role;

REVOKE ALL ON TABLE public.order_deposit_applications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.order_deposit_refunds FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.order_deposit_applications TO service_role;
GRANT SELECT, INSERT ON TABLE public.order_deposit_refunds TO service_role;

COMMENT ON FUNCTION public.order_deposit_apply(uuid, uuid, uuid, uuid, bigint, smallint, date, text, uuid, uuid, text)
  IS 'order-deposit-apply-refund-01:rev1 — apply a deposit to a final invoice atomically (payment + allocation + Dr advances / Cr receivable entry + audit).';
COMMENT ON FUNCTION public.order_deposit_refund(uuid, uuid, uuid, bigint, smallint, date, text, text, text, uuid, uuid, text)
  IS 'order-deposit-apply-refund-01:rev2 — refund an unused deposit (reason mandatory) atomically (payment out + Dr advances / Cr cash|bank entry + audit).';
COMMENT ON FUNCTION public.order_deposit_balance(uuid, uuid)
  IS 'order-deposit-apply-refund-01:rev1 — received / applied / refunded / remaining of one deposit, counting only live (posted) payments.';

NOTIFY pgrst, 'reload schema';
