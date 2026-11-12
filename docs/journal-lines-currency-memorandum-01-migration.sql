-- ============================================================================
-- docs/journal-lines-currency-memorandum-01-migration.sql
--
-- V61 B.2.1 (Multi-currency journal_lines) + B.2.2 (Memorandum accounts)
--   - Adds nullable `currency`, `amount_currency_minor`, `exchange_rate` to `journal_lines`.
--     NULL means book currency. Existing rows stay NULL (no backfill).
--   - Adds `kind` ('standard' | 'memorandum') to `accounts` (default 'standard').
--   - Updates `accounting_post_journal_entry` to:
--     1. Keep checking balance in book currency.
--     2. Validate foreign amount * rate ≈ book amount (`JOURNAL_LINE_FX_MISMATCH`).
--     3. Refuse mixing memorandum and standard lines (`JOURNAL_MEMORANDUM_MIXED_FORBIDDEN`).
--
-- Additive, idempotent. Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

ALTER TABLE public.journal_lines
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS amount_currency_minor bigint,
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(18, 8);

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'accounts_kind_chk'
       AND conrelid = 'public.accounts'::regclass
  ) THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_kind_chk CHECK (kind IN ('standard', 'memorandum')) NOT VALID;
  END IF;
  ALTER TABLE public.accounts VALIDATE CONSTRAINT accounts_kind_chk;
END $$;

CREATE OR REPLACE FUNCTION public.accounting_post_journal_entry(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_entry        jsonb,
  p_lines        jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_entry_id     uuid;
  v_date         date := (p_entry ->> 'date')::date;
  v_status       text := COALESCE(p_entry ->> 'status', 'posted');
  v_branch_id    uuid := NULLIF(p_entry ->> 'branch_id', '')::uuid;
  v_total_debit  numeric(18, 2);
  v_total_credit numeric(18, 2);
  v_lock         record;
  v_bad_accounts int;
  v_fx_bad       int;
  v_std_count    int;
  v_memo_count   int;
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNTING_WORKSPACE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF to_regprocedure('public.accounting_period_locked(uuid, uuid, date)') IS NOT NULL THEN
    SELECT * INTO v_lock
    FROM public.accounting_period_locked(p_workspace_id, v_branch_id, v_date);
    IF FOUND THEN
      RAISE EXCEPTION 'ACCOUNTING_PERIOD_LOCKED'
        USING ERRCODE = 'P0001',
              DETAIL  = format('%s lock, closed through %s', v_lock.scope, v_lock.locked_until);
    END IF;
  END IF;

  SELECT
    COALESCE(SUM((l ->> 'debit')::numeric), 0),
    COALESCE(SUM((l ->> 'credit')::numeric), 0)
  INTO v_total_debit, v_total_credit
  FROM jsonb_array_elements(p_lines) AS l;

  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION 'JOURNAL_ENTRY_UNBALANCED' USING ERRCODE = 'P0001';
  END IF;

  IF v_total_debit = 0 THEN
    RAISE EXCEPTION 'JOURNAL_ENTRY_EMPTY' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_bad_accounts
  FROM jsonb_array_elements(p_lines) AS l
  LEFT JOIN public.accounts a
    ON a.id = (l ->> 'account_id')::uuid
   AND a.workspace_id = p_workspace_id
   AND a.deleted_at IS NULL
  WHERE a.id IS NULL OR a.is_group = true OR a.is_active = false;

  IF v_bad_accounts > 0 THEN
    RAISE EXCEPTION 'JOURNAL_LINE_ACCOUNT_INVALID' USING ERRCODE = 'P0001';
  END IF;

  -- B.2.2: Refuse mixing memorandum accounts with standard accounts in one entry.
  SELECT
    COUNT(*) FILTER (WHERE COALESCE(a.kind, 'standard') = 'standard'),
    COUNT(*) FILTER (WHERE a.kind = 'memorandum')
  INTO v_std_count, v_memo_count
  FROM jsonb_array_elements(p_lines) AS l
  JOIN public.accounts a
    ON a.id = (l ->> 'account_id')::uuid
   AND a.workspace_id = p_workspace_id;

  IF v_std_count > 0 AND v_memo_count > 0 THEN
    RAISE EXCEPTION 'JOURNAL_MEMORANDUM_MIXED_FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  -- B.2.1: Validate foreign amount * exchange_rate matches book amount within 0.05 tolerance.
  SELECT COUNT(*) INTO v_fx_bad
  FROM jsonb_array_elements(p_lines) AS l
  WHERE NULLIF(l ->> 'currency', '') IS NOT NULL
    AND (
      NULLIF(l ->> 'amount_currency_minor', '') IS NULL
      OR NULLIF(l ->> 'exchange_rate', '') IS NULL
      OR (l ->> 'exchange_rate')::numeric <= 0
      OR ABS(
        ((ABS((l ->> 'amount_currency_minor')::bigint)::numeric / 100.0) * (l ->> 'exchange_rate')::numeric)
        - GREATEST(COALESCE((l ->> 'debit')::numeric, 0), COALESCE((l ->> 'credit')::numeric, 0))
      ) > 0.05
    );

  IF v_fx_bad > 0 THEN
    RAISE EXCEPTION 'JOURNAL_LINE_FX_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.journal_entries (
    workspace_id, user_id, date, description, reference, status,
    entry_number, source_type, source_id, reversal_of, posted_at, posted_by,
    branch_id
  ) VALUES (
    p_workspace_id,
    p_user_id,
    v_date,
    COALESCE(p_entry ->> 'description', ''),
    COALESCE(p_entry ->> 'reference', ''),
    v_status,
    p_entry ->> 'entry_number',
    p_entry ->> 'source_type',
    NULLIF(p_entry ->> 'source_id', '')::uuid,
    NULLIF(p_entry ->> 'reversal_of', '')::uuid,
    CASE WHEN v_status = 'posted' THEN now() ELSE NULL END,
    CASE WHEN v_status = 'posted' THEN p_user_id ELSE NULL END,
    v_branch_id
  )
  RETURNING id INTO v_entry_id;

  INSERT INTO public.journal_lines (
    workspace_id, journal_id, account_id, debit, credit, user_id,
    currency, amount_currency_minor, exchange_rate
  )
  SELECT
    p_workspace_id,
    v_entry_id,
    (l ->> 'account_id')::uuid,
    COALESCE((l ->> 'debit')::numeric, 0),
    COALESCE((l ->> 'credit')::numeric, 0),
    p_user_id,
    NULLIF(l ->> 'currency', ''),
    NULLIF(l ->> 'amount_currency_minor', '')::bigint,
    NULLIF(l ->> 'exchange_rate', '')::numeric(18, 8)
  FROM jsonb_array_elements(p_lines) AS l;

  RETURN v_entry_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.accounting_post_journal_entry(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- Rollback (manual reference):
-- ALTER TABLE public.journal_lines DROP COLUMN IF EXISTS exchange_rate, DROP COLUMN IF EXISTS amount_currency_minor, DROP COLUMN IF EXISTS currency;
-- ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_kind_chk, DROP COLUMN IF EXISTS kind;
