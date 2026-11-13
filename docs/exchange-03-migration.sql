-- ============================================
-- docs/exchange-03-migration.sql
--
-- V59.1 Exchange → General Ledger + Agent Settlement + Offline PENDING_REVIEW
--
-- Replaces the V58/exchange-01 "outside the GL" design with atomic,
-- idempotent, workspace-scoped, row-locked Postgres functions that post
-- every Exchange lifecycle event through public.accounting_post_journal_entry()
-- (never writing journal_lines directly and never creating a shadow GL):
--
--   1. public.fx_trade_create_with_ledger       — buy / sell / opening + GL
--      (offline queued sell short-sell → status = 'pending_review', no GL)
--   2. public.fx_trade_resolve_pending_review   — owner approve/reject review
--   3. public.fx_trade_void_with_ledger         — void trade + reversal GL
--   4. public.remittance_payout_with_ledger     — state move + payout GL
--   5. public.fx_agent_settle                   — partner settlement + GL
--
-- Depends on: accounting-core-migration.sql, exchange-01-migration.sql.
-- Additive and idempotent. Status: PENDING HUMAN CONFIRMATION.
--
-- ROLLBACK (only before live settlements):
--   DROP FUNCTION IF EXISTS
--     public.fx_agent_settle(uuid, uuid, jsonb),
--     public.remittance_payout_with_ledger(uuid, uuid, text, text, text, text, bigint, text, uuid),
--     public.fx_trade_void_with_ledger(uuid, uuid, text, uuid),
--     public.fx_trade_resolve_pending_review(uuid, uuid, text, text, uuid),
--     public.fx_trade_create_with_ledger(uuid, uuid, jsonb),
--     public._fx_post_gl(uuid, uuid, text, uuid, text, text, jsonb, date, uuid),
--     public._fx_account_id(uuid, text),
--     public.fx_book_minor_to_major(text, bigint);
--   DROP TABLE IF EXISTS public.fx_agent_settlements;
-- ============================================

BEGIN;

-- ─── 1. Standard role `fx_vault` in accounts_role_check ───────────────────────
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_role_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_role_check CHECK (
  role IS NULL OR role IN (
    'bank', 'cash', 'receivable', 'payable', 'tax',
    'inventory', 'cogs', 'sales', 'purchase',
    'retained_earnings', 'current_year_earnings',
    'salary_expense', 'fx_gain_loss', 'owner_capital', 'bank_fees',
    'deferred_revenue', 'inventory_loss', 'customer_advances',
    'inventory_shrinkage', 'inventory_gain', 'supplier_advances',
    'manufacturing_overhead', 'fx_vault'
  )
);

-- ─── 2. GL linkage, cost basis & offline conflict review columns ──────────────
ALTER TABLE public.fx_trades
  ADD COLUMN IF NOT EXISTS cost_basis_minor bigint,
  ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES public.journal_entries (id),
  ADD COLUMN IF NOT EXISTS void_journal_entry_id uuid REFERENCES public.journal_entries (id);

ALTER TABLE public.fx_trades DROP CONSTRAINT IF EXISTS fx_trades_status;
ALTER TABLE public.fx_trades ADD CONSTRAINT fx_trades_status
  CHECK (status IN ('posted', 'voided', 'pending_review'));

ALTER TABLE public.remittances
  ADD COLUMN IF NOT EXISTS payout_journal_entry_id uuid REFERENCES public.journal_entries (id),
  ADD COLUMN IF NOT EXISTS settled_minor bigint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS fx_trades_pending_review_idx
  ON public.fx_trades (workspace_id, created_at DESC)
  WHERE status = 'pending_review';

-- ─── 3. Partner / agent settlement ledger table ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.fx_agent_settlements (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  counterparty       text NOT NULL,
  direction          text NOT NULL,
  currency           text NOT NULL,
  amount_minor       bigint NOT NULL,
  rate_micro         bigint NOT NULL,
  book_currency      text NOT NULL,
  book_amount_minor  bigint NOT NULL,
  journal_entry_id   uuid REFERENCES public.journal_entries (id),
  note               text,
  client_request_id  text,
  created_by         uuid NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fx_agent_settlements_direction CHECK (direction IN ('collect', 'pay')),
  CONSTRAINT fx_agent_settlements_amounts CHECK (
    amount_minor > 0 AND rate_micro > 0 AND book_amount_minor > 0
  ),
  CONSTRAINT fx_agent_settlements_currency CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX IF NOT EXISTS fx_agent_settlements_partner_idx
  ON public.fx_agent_settlements (workspace_id, lower(btrim(counterparty)), currency, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS fx_agent_settlements_request_key
  ON public.fx_agent_settlements (workspace_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

ALTER TABLE fx_agent_settlements ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON public.fx_agent_settlements
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.fx_agent_settlements TO service_role;

-- ─── 4. Helpers ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fx_book_minor_to_major(p_currency text, p_amount_minor bigint)
RETURNS numeric(18, 2)
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT round(
    coalesce(p_amount_minor, 0)::numeric /
    CASE upper(coalesce(p_currency, 'USD'))
      WHEN 'AFN' THEN 1::numeric
      WHEN 'IRR' THEN 1::numeric
      WHEN 'IQD' THEN 1::numeric
      WHEN 'JPY' THEN 1::numeric
      WHEN 'KRW' THEN 1::numeric
      WHEN 'VND' THEN 1::numeric
      WHEN 'BHD' THEN 1000::numeric
      WHEN 'JOD' THEN 1000::numeric
      WHEN 'KWD' THEN 1000::numeric
      WHEN 'LYD' THEN 1000::numeric
      WHEN 'OMR' THEN 1000::numeric
      WHEN 'TND' THEN 1000::numeric
      ELSE 100::numeric
    END,
    2
  )
$fn$;

CREATE OR REPLACE FUNCTION public._fx_account_id(p_workspace_id uuid, p_role text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_account_id uuid;
BEGIN
  SELECT id INTO v_account_id
    FROM public.accounts
   WHERE workspace_id = p_workspace_id
     AND role = p_role
     AND deleted_at IS NULL
     AND coalesce(is_group, false) = false
     AND coalesce(is_active, true) = true
   ORDER BY code ASC
   LIMIT 1;
  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'FX_LEDGER_ACCOUNT_MISSING:%', p_role USING ERRCODE = 'P0001';
  END IF;
  RETURN v_account_id;
END
$fn$;

CREATE OR REPLACE FUNCTION public._fx_post_gl(
  p_workspace_id uuid,
  p_user_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_description text,
  p_reference text,
  p_lines jsonb,
  p_entry_date date DEFAULT CURRENT_DATE,
  p_reversal_of uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_existing_id uuid;
  v_entry_id uuid;
  v_year text := to_char(coalesce(p_entry_date, CURRENT_DATE), 'YYYY');
  v_seq int;
  v_entry_number text;
  v_attempt int := 0;
  v_filtered jsonb;
BEGIN
  IF p_source_id IS NOT NULL THEN
    SELECT id INTO v_existing_id
      FROM public.journal_entries
     WHERE workspace_id = p_workspace_id
       AND source_type = p_source_type
       AND source_id = p_source_id
       AND status <> 'cancelled'
     LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id;
    END IF;
  END IF;

  SELECT coalesce(jsonb_agg(l), '[]'::jsonb) INTO v_filtered
    FROM jsonb_array_elements(p_lines) AS l
   WHERE coalesce((l ->> 'debit')::numeric, 0) > 0
      OR coalesce((l ->> 'credit')::numeric, 0) > 0;

  IF jsonb_array_length(v_filtered) = 0 THEN
    RETURN NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || ':journal', 11));
  LOOP
    v_attempt := v_attempt + 1;
    SELECT coalesce(MAX(substring(entry_number FROM '^JV-[0-9]{4}-([0-9]+)$')::int), 0) + 1
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
          'date', coalesce(p_entry_date, CURRENT_DATE),
          'description', p_description,
          'reference', p_reference,
          'status', 'posted',
          'entry_number', v_entry_number,
          'source_type', p_source_type,
          'source_id', p_source_id::text,
          'reversal_of', CASE WHEN p_reversal_of IS NOT NULL THEN p_reversal_of::text ELSE NULL END
        ),
        v_filtered
      );
      RETURN v_entry_id;
    EXCEPTION WHEN unique_violation THEN
      IF p_source_id IS NOT NULL THEN
        SELECT id INTO v_existing_id
          FROM public.journal_entries
         WHERE workspace_id = p_workspace_id
           AND source_type = p_source_type
           AND source_id = p_source_id
           AND status <> 'cancelled'
         LIMIT 1;
        IF v_existing_id IS NOT NULL THEN
          RETURN v_existing_id;
        END IF;
      END IF;
      IF v_attempt >= 5 THEN
        RAISE;
      END IF;
    END;
  END LOOP;
END
$fn$;

-- ─── 5. Event 1: FX trade create + atomic GL posting ───────────────────────────
CREATE OR REPLACE FUNCTION public.fx_trade_create_with_ledger(
  p_workspace_id uuid,
  p_user_id uuid,
  p_trade jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_id uuid;
  v_currency text := upper(btrim(p_trade ->> 'currency'));
  v_book_currency text := upper(btrim(p_trade ->> 'book_currency'));
  v_side text := p_trade ->> 'side';
  v_amount bigint := (p_trade ->> 'amount_minor')::bigint;
  v_book_amount bigint := (p_trade ->> 'book_amount_minor')::bigint;
  v_rate_micro bigint := (p_trade ->> 'rate_micro')::bigint;
  v_request text := p_trade ->> 'client_request_id';
  v_allow_pending boolean := coalesce((p_trade ->> 'allow_pending_review')::boolean, false);
  v_held bigint;
  v_pool_cost bigint;
  v_cost_basis bigint := NULL;
  v_existing public.fx_trades%ROWTYPE;
  v_entry_id uuid := NULL;
  v_cash_acc uuid;
  v_vault_acc uuid;
  v_capital_acc uuid;
  v_gain_acc uuid;
  v_book_major numeric(18, 2);
  v_cost_major numeric(18, 2);
  v_lines jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('fx:' || p_workspace_id::text || ':' || v_currency, 0));

  IF v_request IS NOT NULL THEN
    SELECT * INTO v_existing
      FROM public.fx_trades
     WHERE workspace_id = p_workspace_id AND client_request_id = v_request;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'id', v_existing.id,
        'status', v_existing.status,
        'journal_entry_id', v_existing.journal_entry_id,
        'cost_basis_minor', v_existing.cost_basis_minor,
        'replayed', true
      );
    END IF;
  END IF;

  SELECT
    coalesce(sum(CASE WHEN side = 'sell' THEN -amount_minor ELSE amount_minor END), 0)::bigint,
    coalesce(sum(CASE WHEN side = 'sell' THEN -coalesce(cost_basis_minor, book_amount_minor) ELSE book_amount_minor END), 0)::bigint
  INTO v_held, v_pool_cost
    FROM public.fx_trades
   WHERE workspace_id = p_workspace_id
     AND currency = v_currency
     AND status = 'posted';

  IF v_side = 'sell' AND v_held < v_amount THEN
    IF v_allow_pending THEN
      INSERT INTO public.fx_trades (
        workspace_id, side, currency, amount_minor, rate_micro, book_currency, book_amount_minor,
        customer_id, id_full_name, id_type, id_number, note, status, client_request_id, created_by
      ) VALUES (
        p_workspace_id, v_side, v_currency, v_amount, v_rate_micro, v_book_currency, v_book_amount,
        nullif(p_trade ->> 'customer_id', '')::uuid,
        p_trade ->> 'id_full_name', p_trade ->> 'id_type', p_trade ->> 'id_number',
        p_trade ->> 'note', 'pending_review', v_request, p_user_id
      )
      RETURNING id INTO v_id;

      RETURN jsonb_build_object(
        'id', v_id,
        'status', 'pending_review',
        'journal_entry_id', NULL,
        'cost_basis_minor', NULL,
        'replayed', false
      );
    END IF;
    RAISE EXCEPTION 'FX_POSITION_SHORT' USING ERRCODE = 'P0001';
  END IF;

  IF v_side = 'sell' THEN
    v_cost_basis := CASE WHEN v_held > 0 THEN ((v_pool_cost::numeric * v_amount::numeric) / v_held::numeric)::bigint ELSE 0 END;
    IF v_cost_basis < 0 THEN
      v_cost_basis := 0;
    END IF;
  END IF;

  INSERT INTO public.fx_trades (
    workspace_id, side, currency, amount_minor, rate_micro, book_currency, book_amount_minor,
    cost_basis_minor, customer_id, id_full_name, id_type, id_number, note, status, client_request_id, created_by
  ) VALUES (
    p_workspace_id, v_side, v_currency, v_amount, v_rate_micro, v_book_currency, v_book_amount,
    v_cost_basis,
    nullif(p_trade ->> 'customer_id', '')::uuid,
    p_trade ->> 'id_full_name', p_trade ->> 'id_type', p_trade ->> 'id_number',
    p_trade ->> 'note', 'posted', v_request, p_user_id
  )
  RETURNING id INTO v_id;

  v_book_major := public.fx_book_minor_to_major(v_book_currency, v_book_amount);
  v_vault_acc := public._fx_account_id(p_workspace_id, 'fx_vault');

  IF v_side = 'opening' THEN
    v_capital_acc := public._fx_account_id(p_workspace_id, 'owner_capital');
    v_lines := jsonb_build_array(
      jsonb_build_object('account_id', v_vault_acc, 'debit', v_book_major, 'credit', 0),
      jsonb_build_object('account_id', v_capital_acc, 'debit', 0, 'credit', v_book_major)
    );
  ELSIF v_side = 'buy' THEN
    v_cash_acc := public._fx_account_id(p_workspace_id, 'cash');
    v_lines := jsonb_build_array(
      jsonb_build_object('account_id', v_vault_acc, 'debit', v_book_major, 'credit', 0),
      jsonb_build_object('account_id', v_cash_acc, 'debit', 0, 'credit', v_book_major)
    );
  ELSE
    v_cash_acc := public._fx_account_id(p_workspace_id, 'cash');
    v_gain_acc := public._fx_account_id(p_workspace_id, 'fx_gain_loss');
    v_cost_major := public.fx_book_minor_to_major(v_book_currency, coalesce(v_cost_basis, v_book_amount));
    v_lines := jsonb_build_array(
      jsonb_build_object('account_id', v_cash_acc, 'debit', v_book_major, 'credit', 0),
      jsonb_build_object('account_id', v_vault_acc, 'debit', 0, 'credit', v_cost_major)
    );
    IF v_book_major > v_cost_major THEN
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account_id', v_gain_acc, 'debit', 0, 'credit', v_book_major - v_cost_major)
      );
    ELSIF v_cost_major > v_book_major THEN
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account_id', v_gain_acc, 'debit', v_cost_major - v_book_major, 'credit', 0)
      );
    END IF;
  END IF;

  v_entry_id := public._fx_post_gl(
    p_workspace_id,
    p_user_id,
    'fx_trade',
    v_id,
    format('FX %s %s', v_side, v_currency),
    format('FX:%s', v_id::text),
    v_lines,
    CURRENT_DATE,
    NULL
  );

  UPDATE public.fx_trades
     SET journal_entry_id = v_entry_id
   WHERE id = v_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'status', 'posted',
    'journal_entry_id', v_entry_id,
    'cost_basis_minor', v_cost_basis,
    'replayed', false
  );
END
$fn$;

-- ─── 6. Event 1b: Resolve offline PENDING_REVIEW trade ────────────────────────
CREATE OR REPLACE FUNCTION public.fx_trade_resolve_pending_review(
  p_workspace_id uuid,
  p_trade_id uuid,
  p_decision text,
  p_reason text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_trade public.fx_trades%ROWTYPE;
  v_held bigint;
  v_pool_cost bigint;
  v_cost_basis bigint := NULL;
  v_entry_id uuid := NULL;
  v_cash_acc uuid;
  v_vault_acc uuid;
  v_gain_acc uuid;
  v_book_major numeric(18, 2);
  v_cost_major numeric(18, 2);
  v_lines jsonb;
BEGIN
  IF p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'FX_REVIEW_DECISION_INVALID' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_trade
    FROM public.fx_trades
   WHERE id = p_trade_id AND workspace_id = p_workspace_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  IF v_trade.status <> 'pending_review' THEN
    RETURN jsonb_build_object(
      'outcome', 'already_resolved',
      'status', v_trade.status,
      'journal_entry_id', v_trade.journal_entry_id
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('fx:' || p_workspace_id::text || ':' || v_trade.currency, 0));

  IF p_decision = 'reject' THEN
    UPDATE public.fx_trades
       SET status = 'voided',
           void_reason = coalesce(nullif(btrim(p_reason), ''), 'Offline conflict rejected'),
           voided_at = now(),
           voided_by = p_user_id
     WHERE id = p_trade_id AND workspace_id = p_workspace_id;
    RETURN jsonb_build_object('outcome', 'rejected', 'status', 'voided', 'journal_entry_id', NULL);
  END IF;

  SELECT
    coalesce(sum(CASE WHEN side = 'sell' THEN -amount_minor ELSE amount_minor END), 0)::bigint,
    coalesce(sum(CASE WHEN side = 'sell' THEN -coalesce(cost_basis_minor, book_amount_minor) ELSE book_amount_minor END), 0)::bigint
  INTO v_held, v_pool_cost
    FROM public.fx_trades
   WHERE workspace_id = p_workspace_id
     AND currency = v_trade.currency
     AND status = 'posted';

  IF v_trade.side = 'sell' AND v_held < v_trade.amount_minor THEN
    RAISE EXCEPTION 'FX_POSITION_SHORT' USING ERRCODE = 'P0001';
  END IF;

  v_cost_basis := CASE WHEN v_held > 0 THEN ((v_pool_cost::numeric * v_trade.amount_minor::numeric) / v_held::numeric)::bigint ELSE 0 END;
  v_book_major := public.fx_book_minor_to_major(v_trade.book_currency, v_trade.book_amount_minor);
  v_cost_major := public.fx_book_minor_to_major(v_trade.book_currency, coalesce(v_cost_basis, v_trade.book_amount_minor));
  v_cash_acc := public._fx_account_id(p_workspace_id, 'cash');
  v_vault_acc := public._fx_account_id(p_workspace_id, 'fx_vault');
  v_gain_acc := public._fx_account_id(p_workspace_id, 'fx_gain_loss');

  v_lines := jsonb_build_array(
    jsonb_build_object('account_id', v_cash_acc, 'debit', v_book_major, 'credit', 0),
    jsonb_build_object('account_id', v_vault_acc, 'debit', 0, 'credit', v_cost_major)
  );
  IF v_book_major > v_cost_major THEN
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_id', v_gain_acc, 'debit', 0, 'credit', v_book_major - v_cost_major)
    );
  ELSIF v_cost_major > v_book_major THEN
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_id', v_gain_acc, 'debit', v_cost_major - v_book_major, 'credit', 0)
    );
  END IF;

  v_entry_id := public._fx_post_gl(
    p_workspace_id,
    p_user_id,
    'fx_trade',
    v_trade.id,
    format('FX %s %s (review approved)', v_trade.side, v_trade.currency),
    format('FX:%s', v_trade.id::text),
    v_lines,
    CURRENT_DATE,
    NULL
  );

  UPDATE public.fx_trades
     SET status = 'posted',
         cost_basis_minor = v_cost_basis,
         journal_entry_id = v_entry_id
   WHERE id = p_trade_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object('outcome', 'approved', 'status', 'posted', 'journal_entry_id', v_entry_id);
END
$fn$;

-- ─── 7. Event 2: FX trade void + atomic GL reversal ──────────────────────────
CREATE OR REPLACE FUNCTION public.fx_trade_void_with_ledger(
  p_workspace_id uuid,
  p_trade_id uuid,
  p_reason text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_trade public.fx_trades%ROWTYPE;
  v_reversal_lines jsonb;
  v_void_entry_id uuid := NULL;
BEGIN
  SELECT * INTO v_trade
    FROM public.fx_trades
   WHERE id = p_trade_id AND workspace_id = p_workspace_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('fx:' || p_workspace_id::text || ':' || v_trade.currency, 0));

  IF v_trade.status = 'voided' THEN
    RETURN jsonb_build_object(
      'outcome', 'already_voided',
      'journal_entry_id', v_trade.void_journal_entry_id
    );
  END IF;

  IF v_trade.status = 'posted'
     AND v_trade.side <> 'sell'
     AND public.fx_held_minor(p_workspace_id, v_trade.currency) < v_trade.amount_minor THEN
    RETURN jsonb_build_object('outcome', 'would_go_short');
  END IF;

  IF v_trade.status = 'posted' AND v_trade.journal_entry_id IS NOT NULL THEN
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'account_id', account_id,
          'debit', credit,
          'credit', debit
        )
      ),
      '[]'::jsonb
    )
    INTO v_reversal_lines
    FROM public.journal_lines
    WHERE journal_id = v_trade.journal_entry_id
      AND workspace_id = p_workspace_id;

    IF jsonb_array_length(v_reversal_lines) > 0 THEN
      v_void_entry_id := public._fx_post_gl(
        p_workspace_id,
        p_user_id,
        'reversal',
        v_trade.id,
        format('Void FX trade %s', v_trade.id::text),
        format('FX-VOID:%s', v_trade.id::text),
        v_reversal_lines,
        CURRENT_DATE,
        v_trade.journal_entry_id
      );
    END IF;
  END IF;

  UPDATE public.fx_trades
     SET status = 'voided',
         void_reason = p_reason,
         voided_at = now(),
         voided_by = p_user_id,
         void_journal_entry_id = v_void_entry_id
   WHERE id = p_trade_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object('outcome', 'voided', 'journal_entry_id', v_void_entry_id);
END
$fn$;

-- ─── 8. Event 3: Remittance payout + atomic GL posting ────────────────────────
CREATE OR REPLACE FUNCTION public.remittance_payout_with_ledger(
  p_workspace_id uuid,
  p_remittance_id uuid,
  p_from text,
  p_to text,
  p_reason text,
  p_code_hash text,
  p_rate_micro bigint,
  p_book_currency text,
  p_actor uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_row public.remittances%ROWTYPE;
  v_entry_id uuid := NULL;
  v_book text := upper(btrim(coalesce(p_book_currency, 'AFN')));
  v_rate bigint := coalesce(p_rate_micro, 1000000);
  v_principal_book bigint;
  v_fee_book bigint;
  v_principal_major numeric(18, 2);
  v_fee_major numeric(18, 2);
  v_fx_digits int;
  v_book_digits int;
  v_cash_or_vault uuid;
  v_ar_or_ap uuid;
  v_fee_acc uuid;
  v_lines jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_row
    FROM public.remittances
   WHERE id = p_remittance_id AND workspace_id = p_workspace_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  IF v_row.status = p_to THEN
    RETURN jsonb_build_object(
      'outcome', 'moved',
      'journal_entry_id', v_row.payout_journal_entry_id,
      'replayed', true
    );
  END IF;

  IF v_row.status <> p_from THEN
    RETURN jsonb_build_object('outcome', 'moved', 'journal_entry_id', v_row.payout_journal_entry_id);
  END IF;

  IF v_row.direction = 'incoming' AND p_to = 'paid'
     AND (p_code_hash IS NULL OR p_code_hash <> v_row.payout_code_hash) THEN
    RETURN jsonb_build_object('outcome', 'wrong_code');
  END IF;

  UPDATE public.remittances
     SET status = p_to,
         cancel_reason = CASE WHEN p_to = 'cancelled' THEN p_reason ELSE cancel_reason END,
         paid_at = CASE WHEN p_to = 'paid' THEN now() ELSE paid_at END,
         updated_at = now()
   WHERE id = p_remittance_id AND workspace_id = p_workspace_id;

  INSERT INTO public.remittance_events (workspace_id, remittance_id, from_status, to_status, note, actor_id)
  VALUES (p_workspace_id, p_remittance_id, p_from, p_to, p_reason, p_actor);

  IF p_to = 'paid' THEN
    IF upper(v_row.currency) <> v_book AND v_rate <= 0 THEN
      RAISE EXCEPTION 'FX_RATE_REQUIRED' USING ERRCODE = 'P0001';
    END IF;

    IF upper(v_row.currency) = v_book THEN
      v_principal_book := v_row.amount_minor;
      v_fee_book := v_row.fee_minor;
      v_cash_or_vault := public._fx_account_id(p_workspace_id, 'cash');
    ELSE
      v_fx_digits := CASE upper(v_row.currency)
        WHEN 'AFN' THEN 0 WHEN 'IRR' THEN 0 WHEN 'IQD' THEN 0 WHEN 'JPY' THEN 0 WHEN 'KRW' THEN 0 WHEN 'VND' THEN 0
        WHEN 'BHD' THEN 3 WHEN 'JOD' THEN 3 WHEN 'KWD' THEN 3 WHEN 'LYD' THEN 3 WHEN 'OMR' THEN 3 WHEN 'TND' THEN 3
        ELSE 2 END;
      v_book_digits := CASE v_book
        WHEN 'AFN' THEN 0 WHEN 'IRR' THEN 0 WHEN 'IQD' THEN 0 WHEN 'JPY' THEN 0 WHEN 'KRW' THEN 0 WHEN 'VND' THEN 0
        WHEN 'BHD' THEN 3 WHEN 'JOD' THEN 3 WHEN 'KWD' THEN 3 WHEN 'LYD' THEN 3 WHEN 'OMR' THEN 3 WHEN 'TND' THEN 3
        ELSE 2 END;
      v_principal_book := round(
        (v_row.amount_minor::numeric * v_rate::numeric * power(10::numeric, v_book_digits)) /
        (power(10::numeric, v_fx_digits) * 1000000::numeric)
      )::bigint;
      v_fee_book := round(
        (v_row.fee_minor::numeric * v_rate::numeric * power(10::numeric, v_book_digits)) /
        (power(10::numeric, v_fx_digits) * 1000000::numeric)
      )::bigint;
      v_cash_or_vault := public._fx_account_id(p_workspace_id, 'fx_vault');
    END IF;

    v_principal_major := public.fx_book_minor_to_major(v_book, v_principal_book);
    v_fee_major := public.fx_book_minor_to_major(v_book, v_fee_book);
    v_fee_acc := public._fx_account_id(p_workspace_id, 'fx_gain_loss');

    IF v_row.direction = 'incoming' THEN
      v_ar_or_ap := public._fx_account_id(p_workspace_id, 'receivable');
      v_lines := jsonb_build_array(
        jsonb_build_object('account_id', v_ar_or_ap, 'debit', v_principal_major, 'credit', 0),
        jsonb_build_object('account_id', v_cash_or_vault, 'debit', 0, 'credit', v_principal_major)
      );
      IF v_fee_major > 0 THEN
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_id', v_cash_or_vault, 'debit', v_fee_major, 'credit', 0),
          jsonb_build_object('account_id', v_fee_acc, 'debit', 0, 'credit', v_fee_major)
        );
      END IF;
    ELSE
      v_ar_or_ap := public._fx_account_id(p_workspace_id, 'payable');
      v_lines := jsonb_build_array(
        jsonb_build_object('account_id', v_cash_or_vault, 'debit', v_principal_major + v_fee_major, 'credit', 0),
        jsonb_build_object('account_id', v_ar_or_ap, 'debit', 0, 'credit', v_principal_major)
      );
      IF v_fee_major > 0 THEN
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_id', v_fee_acc, 'debit', 0, 'credit', v_fee_major)
        );
      END IF;
    END IF;

    v_entry_id := public._fx_post_gl(
      p_workspace_id,
      p_actor,
      'remittance_payout',
      v_row.id,
      format('Hawala %s #%s (%s)', v_row.direction, v_row.number::text, v_row.counterparty),
      format('HAWALA:%s', v_row.id::text),
      v_lines,
      CURRENT_DATE,
      NULL
    );

    UPDATE public.remittances
       SET payout_journal_entry_id = v_entry_id
     WHERE id = p_remittance_id AND workspace_id = p_workspace_id;
  END IF;

  RETURN jsonb_build_object('outcome', 'moved_ok', 'journal_entry_id', v_entry_id);
END
$fn$;

-- ─── 9. Event 4: Agent / hawala partner settlement + atomic GL posting ────────
CREATE OR REPLACE FUNCTION public.fx_agent_settle(
  p_workspace_id uuid,
  p_user_id uuid,
  p_settlement jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_id uuid;
  v_counterparty text := btrim(p_settlement ->> 'counterparty');
  v_direction text := p_settlement ->> 'direction';
  v_currency text := upper(btrim(p_settlement ->> 'currency'));
  v_amount bigint := (p_settlement ->> 'amount_minor')::bigint;
  v_rate_micro bigint := (p_settlement ->> 'rate_micro')::bigint;
  v_book_currency text := upper(btrim(p_settlement ->> 'book_currency'));
  v_book_amount bigint := (p_settlement ->> 'book_amount_minor')::bigint;
  v_request text := p_settlement ->> 'client_request_id';
  v_existing public.fx_agent_settlements%ROWTYPE;
  v_entry_id uuid := NULL;
  v_cash_or_vault uuid;
  v_ar_or_ap uuid;
  v_book_major numeric(18, 2);
  v_lines jsonb;
BEGIN
  IF v_direction NOT IN ('collect', 'pay') OR length(coalesce(v_counterparty, '')) = 0 THEN
    RAISE EXCEPTION 'FX_SETTLEMENT_INVALID' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('fx_agent:' || p_workspace_id::text || ':' || lower(v_counterparty) || ':' || v_currency, 0)
  );

  IF v_request IS NOT NULL THEN
    SELECT * INTO v_existing
      FROM public.fx_agent_settlements
     WHERE workspace_id = p_workspace_id AND client_request_id = v_request;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'id', v_existing.id,
        'journal_entry_id', v_existing.journal_entry_id,
        'replayed', true
      );
    END IF;
  END IF;

  INSERT INTO public.fx_agent_settlements (
    workspace_id, counterparty, direction, currency, amount_minor, rate_micro,
    book_currency, book_amount_minor, note, client_request_id, created_by
  ) VALUES (
    p_workspace_id, v_counterparty, v_direction, v_currency, v_amount, v_rate_micro,
    v_book_currency, v_book_amount, p_settlement ->> 'note', v_request, p_user_id
  )
  RETURNING id INTO v_id;

  v_book_major := public.fx_book_minor_to_major(v_book_currency, v_book_amount);
  v_cash_or_vault := public._fx_account_id(
    p_workspace_id,
    CASE WHEN v_currency = v_book_currency THEN 'cash' ELSE 'fx_vault' END
  );

  IF v_direction = 'collect' THEN
    v_ar_or_ap := public._fx_account_id(p_workspace_id, 'receivable');
    v_lines := jsonb_build_array(
      jsonb_build_object('account_id', v_cash_or_vault, 'debit', v_book_major, 'credit', 0),
      jsonb_build_object('account_id', v_ar_or_ap, 'debit', 0, 'credit', v_book_major)
    );
  ELSE
    v_ar_or_ap := public._fx_account_id(p_workspace_id, 'payable');
    v_lines := jsonb_build_array(
      jsonb_build_object('account_id', v_ar_or_ap, 'debit', v_book_major, 'credit', 0),
      jsonb_build_object('account_id', v_cash_or_vault, 'debit', 0, 'credit', v_book_major)
    );
  END IF;

  v_entry_id := public._fx_post_gl(
    p_workspace_id,
    p_user_id,
    'fx_agent_settlement',
    v_id,
    format('Agent settlement %s (%s %s)', v_direction, v_counterparty, v_currency),
    format('FX-SETTLE:%s', v_id::text),
    v_lines,
    CURRENT_DATE,
    NULL
  );

  UPDATE public.fx_agent_settlements
     SET journal_entry_id = v_entry_id
   WHERE id = v_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object('id', v_id, 'journal_entry_id', v_entry_id, 'replayed', false);
END
$fn$;

-- ─── 10. Function execution privileges ───────────────────────────────────────
REVOKE ALL ON FUNCTION public.fx_book_minor_to_major(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._fx_account_id(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._fx_post_gl(uuid, uuid, text, uuid, text, text, jsonb, date, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fx_trade_create_with_ledger(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fx_trade_resolve_pending_review(uuid, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fx_trade_void_with_ledger(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remittance_payout_with_ledger(uuid, uuid, text, text, text, text, bigint, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fx_agent_settle(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fx_book_minor_to_major(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.fx_trade_create_with_ledger(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fx_trade_resolve_pending_review(uuid, uuid, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fx_trade_void_with_ledger(uuid, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.remittance_payout_with_ledger(uuid, uuid, text, text, text, text, bigint, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fx_agent_settle(uuid, uuid, jsonb) TO service_role;


-- ---------------------------------------------------------------------------
-- CLIENT LOCKDOWN (V61 audit, 12 Nov 2026).
--
-- These tables are reached ONLY through the backend (service_role), which
-- checks the capability of the person asking. A policy "FOR ALL TO
-- authenticated USING (workspace member)" let ANY member of the workspace —
-- a seller included — write these rows straight through the Supabase API and
-- skip every capability check (e.g. approve their own request, overwrite
-- another member's 2FA enrollment). RLS stays ON with NO policy; clients get
-- nothing. Idempotent: on a database where the earlier version of this file
-- already ran, it drops whatever policies exist on these tables.
-- ---------------------------------------------------------------------------
DO $lockdown$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = ANY (ARRAY['fx_agent_settlements'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $lockdown$;
ALTER TABLE public.fx_agent_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fx_agent_settlements FROM PUBLIC, anon, authenticated;

COMMIT;
