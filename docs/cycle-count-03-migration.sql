-- ============================================================================
-- docs/cycle-count-03-migration.sql
--
-- A stock count that moves value POSTS it — atomically, with two separate accounts.
--
-- V53 owner decision CC: «Inventory Shrinkage» and «Inventory Gain» are two accounts.
--
--   shortage   Dr inventory_shrinkage   Cr inventory
--   surplus    Dr inventory             Cr inventory_gain
--
-- Until now cycle_count_complete() (docs/cycle-count-02-migration.sql, already applied) moved the stock and
-- closed the count but posted nothing: the value of a write-off never reached the books. This migration adds
-- the journal step to the SAME transaction, so a count can never be «completed» with the stock moved and the
-- books silent, nor the other way round.
--
-- WHAT IT ADDS (all additive; cycle-count-02 is not edited):
--   1. accounts_role_check learns `inventory_shrinkage` and `inventory_gain` and keeps every role it had.
--   2. cycle_counts.journal_entry_id — the entry the count posted.
--   3. cycle_counts_status_check learns `pending_accounts`: the count was finished by the people, but the two
--      accounts it needs do not exist yet. NOTHING is adjusted and NOTHING is posted in that state — the
--      physical count is kept and the adjustment waits for the accounts (owner default Q4). It is recoverable:
--      finishing again, once the accounts exist, completes it.
--   4. cycle_count_finish() — movements + frozen figures + the journal entry + the status change, one transaction.
--      Returns 'completed' | 'not_open' | 'not_found'. A locked period, an unbalanced entry or an invalid
--      account raises and rolls EVERYTHING back (count still open, no movement, no entry).
--
-- IDEMPOTENT: re-running changes nothing. The old cycle_count_complete() stays in place (the service falls back
-- to it until this migration is applied). Run docs/VERIFY-cycle-count-03.sql afterwards; «Success. No rows
-- returned» is NOT a pass.
--
-- RUN ORDER: after docs/cycle-count-02-migration.sql and docs/customer-advances-01-migration.sql
-- (the role check below lists `customer_advances`, which that migration added).
--
-- ROLLBACK / MITIGATION (forward-only is safe; nothing here rewrites a row):
--   DROP FUNCTION IF EXISTS public.cycle_count_finish(uuid, uuid, uuid, jsonb, numeric, numeric, numeric, date, jsonb);
--   (the role list and the status list only ever WIDENED; narrowing them back is blocked by any row that uses
--    the new values, which is the correct behaviour — map those rows by hand first.)
-- ============================================================================

-- No BEGIN/COMMIT on purpose: a script sent as ONE simple query already runs as a single implicit transaction.

DO $guard$
BEGIN
  IF to_regprocedure('public.accounting_post_journal_entry(uuid,uuid,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'CYCLE_COUNT_03: public.accounting_post_journal_entry(uuid,uuid,jsonb,jsonb) is missing (docs/accounting-core-migration.sql).';
  END IF;
  IF to_regclass('public.cycle_counts') IS NULL THEN
    RAISE EXCEPTION 'CYCLE_COUNT_03: public.cycle_counts is missing (docs/phase-l-03-cycle-counts-migration.sql).';
  END IF;
END
$guard$;

-- ---------------------------------------------------------------------------
-- 1. Account roles
-- ---------------------------------------------------------------------------

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
    -- V53 CC: a count's shortage and surplus.
    'inventory_shrinkage',
    'inventory_gain'
  )
) NOT VALID;

-- Widening cannot invalidate a row (every old role is still listed).
ALTER TABLE public.accounts VALIDATE CONSTRAINT accounts_role_check;

-- ---------------------------------------------------------------------------
-- 2. The entry a count posted, and the recoverable «waiting for accounts» state
-- ---------------------------------------------------------------------------

ALTER TABLE public.cycle_counts ADD COLUMN IF NOT EXISTS journal_entry_id uuid;

ALTER TABLE public.cycle_counts DROP CONSTRAINT IF EXISTS cycle_counts_status_check;

ALTER TABLE public.cycle_counts ADD CONSTRAINT cycle_counts_status_check CHECK (
  status IN ('draft', 'counting', 'pending_accounts', 'completed', 'cancelled')
) NOT VALID;

ALTER TABLE public.cycle_counts VALIDATE CONSTRAINT cycle_counts_status_check;

-- ---------------------------------------------------------------------------
-- 3. cycle_count_finish — one transaction: movements + figures + journal entry + status
--
--   p_lines          [{ "product_id": uuid, "variance_qty": number, "variance_value": number }, ...]
--   p_entry_date     the date of the journal entry (the day the count is finished)
--   p_journal_lines  [{ "account_id": uuid, "debit": number, "credit": number }, ...] — balanced — or NULL / []
--                    when no value moved (a clean count posts nothing).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cycle_count_finish(
  p_workspace_id uuid,
  p_count_id uuid,
  p_user_id uuid,
  p_lines jsonb,
  p_shortage_value numeric,
  p_surplus_value numeric,
  p_net_loss numeric,
  p_entry_date date,
  p_journal_lines jsonb
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_status text;
  v_warehouse uuid;
  v_entry_id uuid;
  v_year text;
  v_seq int;
  v_attempt int := 0;
  v_number text;
BEGIN
  SELECT status, warehouse_id INTO v_status, v_warehouse
    FROM cycle_counts
   WHERE id = p_count_id AND workspace_id = p_workspace_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  -- Open for finishing: being counted, or waiting for its accounts.
  IF v_status NOT IN ('counting', 'pending_accounts') THEN
    RETURN 'not_open';
  END IF;

  INSERT INTO stock_movements (
    workspace_id, product_id, type, quantity,
    reference_type, reference_id, to_warehouse_id, user_id, notes
  )
  SELECT p_workspace_id, l.product_id, 'adjustment', l.variance_qty,
         'cycle_count', p_count_id, v_warehouse, p_user_id,
         'count variance ' || l.variance_qty::text
    FROM jsonb_to_recordset(p_lines) AS l(product_id uuid, variance_qty numeric, variance_value numeric)
   WHERE l.variance_qty <> 0
  ON CONFLICT (workspace_id, reference_id, product_id) WHERE reference_type = 'cycle_count'
  DO NOTHING;

  UPDATE cycle_count_lines AS cl
     SET variance_qty = l.variance_qty,
         variance_value = l.variance_value
    FROM jsonb_to_recordset(p_lines) AS l(product_id uuid, variance_qty numeric, variance_value numeric)
   WHERE cl.count_id = p_count_id
     AND cl.workspace_id = p_workspace_id
     AND cl.product_id = l.product_id;

  -- The books. Skipped only when no value moved. A locked period, an unbalanced entry or an invalid account
  -- raises here and rolls back the movements above.
  IF p_journal_lines IS NOT NULL AND jsonb_array_length(p_journal_lines) > 0 THEN
    v_year := to_char(COALESCE(p_entry_date, CURRENT_DATE), 'YYYY');

    LOOP
      v_attempt := v_attempt + 1;

      SELECT COALESCE(MAX(substring(entry_number FROM '^JV-[0-9]{4}-([0-9]+)$')::int), 0) + 1
        INTO v_seq
        FROM public.journal_entries
       WHERE workspace_id = p_workspace_id
         AND entry_number LIKE 'JV-' || v_year || '-%';

      v_number := 'JV-' || v_year || '-' || lpad(v_seq::text, 6, '0');

      BEGIN
        v_entry_id := public.accounting_post_journal_entry(
          p_workspace_id,
          p_user_id,
          jsonb_build_object(
            'date', COALESCE(p_entry_date, CURRENT_DATE),
            'description', 'تعدیل موجودی بر اساس شمارش ' || p_count_id::text,
            'reference', p_count_id::text,
            'status', 'posted',
            'entry_number', v_number,
            'source_type', 'cycle_count',
            'source_id', p_count_id::text
          ),
          p_journal_lines
        );
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        -- Another posting took that number between the read and the insert; the savepoint undoes only this attempt.
        IF v_attempt >= 5 THEN
          RAISE;
        END IF;
      END;
    END LOOP;
  END IF;

  UPDATE cycle_counts
     SET status = 'completed',
         completed_by = p_user_id,
         completed_at = now(),
         shortage_value = p_shortage_value,
         surplus_value = p_surplus_value,
         net_loss = p_net_loss,
         journal_entry_id = v_entry_id,
         updated_at = now()
   WHERE id = p_count_id AND workspace_id = p_workspace_id;

  RETURN 'completed';
END
$fn$;

REVOKE ALL ON FUNCTION public.cycle_count_finish(uuid, uuid, uuid, jsonb, numeric, numeric, numeric, date, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cycle_count_finish(uuid, uuid, uuid, jsonb, numeric, numeric, numeric, date, jsonb)
  TO service_role;

COMMENT ON FUNCTION public.cycle_count_finish(uuid, uuid, uuid, jsonb, numeric, numeric, numeric, date, jsonb)
  IS 'cycle-count-03:rev1';
