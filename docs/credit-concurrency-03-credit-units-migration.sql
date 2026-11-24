-- ============================================================================
-- docs/credit-concurrency-03-credit-units-migration.sql
--
-- assert_customer_credit compared TWO DIFFERENT UNITS.
--
--   * `invoices.total - invoices.paid_amount` and `customers.credit_limit` are
--     MAJOR units (the figures a person typed).
--   * `p_amount_minor` is sent by the backend as `Math.round(owing * 100)` —
--     the same 1/100 comparison unit `evaluateCreditLimit` and the pre-migration
--     fallback already use (packages/validation/src/schemas/money.ts `minor`).
--
--   The body added 100 x the new invoice to the major receivable and compared
--   the sum with the major limit:
--
--       v_projected := v_receivable + p_amount_minor;   -- 600 + 30 000
--       IF v_projected > v_limit THEN ...               -- 30 600 > 1 000
--
--   So once this function was deployed, a customer with a 1000 limit, 600 owed
--   and a 300 sale was REFUSED as «credit limit exceeded» — every financed sale
--   over a limit failed, for every currency. The advisory lock (the part this
--   migration keeps) was correct; the arithmetic was not.
--
-- WHAT CHANGES
--   The receivable and the limit are converted to the SAME 1/100 unit as
--   `p_amount_minor` before the comparison, and the returned figures stay in
--   that unit (the backend divides them by 100 for the screen, unchanged).
--   The decisions, columns, grants and lock are unchanged.
--
-- WHY NOT CURRENCY-AWARE DIGITS HERE
--   `minor()` in the shared money core is the project's documented comparison
--   unit: two decimals for every currency, locked by
--   `backend/src/__tests__/money-primitive-guard.test.ts`. This function must
--   agree with the caller; inventing a second currency rule in SQL would make
--   the server and the ledger disagree about the same balance.
--
-- Safety classification: ADDITIVE (CREATE OR REPLACE, same signature; no table
-- or data change). Idempotent: safe to run twice.
--
-- Rollback: re-run docs/credit-concurrency-02-migration.sql (restores the
-- mixed-unit body). That body is the defect this file removes.
--
-- Owner action: run this file, then docs/VERIFY-credit-concurrency-03.sql.
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assert_customer_credit(
  p_workspace_id uuid,
  p_customer_id uuid,
  -- The new invoice's amount in the shared 1/100 comparison unit (`minor()`).
  p_amount_minor bigint
)
RETURNS TABLE (
  allowed boolean,
  code text,
  over_limit_minor bigint,
  projected_receivable_minor bigint,
  credit_limit_minor bigint,
  currency text,
  detail text
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mode text;
  v_limit numeric;
  v_receivable numeric;
  v_limit_minor bigint;
  v_receivable_minor bigint;
  v_projected bigint;
BEGIN
  -- One caller at a time per customer, across all backend instances.
  PERFORM pg_advisory_xact_lock(
    ('x' || md5(p_workspace_id::text || ':' || p_customer_id::text))::bit(32)::int4
  );

  -- Credit limit mode: 'off' | 'warn' | 'block' (default 'warn')
  SELECT COALESCE(w.credit_limit_mode, 'warn')
  INTO v_mode
  FROM workspaces w
  WHERE w.id = p_workspace_id;

  IF v_mode = 'off' THEN
    RETURN QUERY SELECT true, NULL::text, 0::bigint, 0::bigint, NULL::bigint, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Customer limit: null = unlimited, 0 = cash only, > 0 = max receivable
  SELECT c.credit_limit
  INTO v_limit
  FROM customers c
  WHERE c.id = p_customer_id AND c.workspace_id = p_workspace_id;

  IF v_limit IS NULL THEN
    RETURN QUERY SELECT true, NULL::text, 0::bigint, 0::bigint, NULL::bigint, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Current receivable (posted, unpaid invoices + allocations not yet settled)
  SELECT COALESCE(SUM(i.total - i.paid_amount), 0)
  INTO v_receivable
  FROM invoices i
  WHERE i.customer_id = p_customer_id
    AND i.workspace_id = p_workspace_id
    AND i.status NOT IN ('cancelled', 'draft')
    AND i.deleted_at IS NULL;

  -- ⚠️ ONE UNIT. The receivable and the limit are major units in the table;
  -- `p_amount_minor` is 1/100. Convert before adding, or a 300 sale weighs
  -- 30 000 against a 1 000 limit.
  v_receivable_minor := round(v_receivable * 100)::bigint;
  v_limit_minor := round(v_limit * 100)::bigint;
  v_projected := v_receivable_minor + p_amount_minor;

  -- Cash-only customer
  IF v_limit = 0 AND p_amount_minor > 0 THEN
    RETURN QUERY SELECT
      false,
      'CASH_ONLY_CUSTOMER'::text,
      p_amount_minor,
      v_projected,
      0::bigint,
      NULL::text,
      'cash only customer cannot owe'::text;
    RETURN;
  END IF;

  -- Over limit
  IF v_projected > v_limit_minor THEN
    RETURN QUERY SELECT
      false,
      'CREDIT_LIMIT_EXCEEDED'::text,
      (v_projected - v_limit_minor)::bigint,
      v_projected,
      v_limit_minor,
      NULL::text,
      'credit limit exceeded'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text, 0::bigint, v_projected, v_limit_minor, NULL::text, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_customer_credit(uuid, uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_customer_credit(uuid, uuid, bigint) TO service_role;

COMMENT ON FUNCTION public.assert_customer_credit(uuid, uuid, bigint) IS
  'V53 4.4 P0: atomically checks a customer credit limit under an advisory lock (credit-concurrency-03: one 1/100 unit on both sides).';
