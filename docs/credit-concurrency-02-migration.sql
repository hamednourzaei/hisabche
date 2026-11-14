-- ============================================
-- credit-concurrency-02: assert_customer_credit answers ONE row, with the declared types
-- ============================================
-- FORWARD FIX for credit-concurrency-01 (which is likely applied: it predates advances-02).
--
-- What was wrong in 01, found by running the app's own sale route on a real PostgreSQL
-- (backend/src/__tests__/journey-retail.pg.test.ts, 14 Nov 2026):
--
--   1. `RETURN QUERY SELECT true, null, 0, 0, null, null, null` hands back integer and
--      untyped NULL where the function declares bigint/text. PostgreSQL refuses that
--      (42804 «structure of query does not match function result type»), so the DEFAULT
--      case — a customer with no credit limit — failed every sale with a 500.
--   2. No RETURN after RETURN QUERY: PL/pgSQL keeps going, so «off» and «no limit»
--      fell through and appended more rows.
--   3. It revoked EXECUTE from `authenticated` and then granted it back, so its own
--      VERIFY («revoked from PUBLIC») could never be true. The backend calls it with the
--      service role; that is the only grant now.
--
-- The rule is unchanged: same arguments, same columns, same decisions.
-- Idempotent: CREATE OR REPLACE on the same signature; safe to run twice.
-- Rollback: re-run docs/credit-concurrency-01-migration.sql (restores the old body).
-- Owner action: run this file, then docs/VERIFY-credit-concurrency-02.sql (one row per check, all ok).
-- ============================================

CREATE OR REPLACE FUNCTION public.assert_customer_credit(
  p_workspace_id uuid,
  p_customer_id uuid,
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
  v_projected numeric;
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

  v_projected := v_receivable + p_amount_minor;

  -- Cash-only customer
  IF v_limit = 0 AND p_amount_minor > 0 THEN
    RETURN QUERY SELECT
      false,
      'CASH_ONLY_CUSTOMER'::text,
      p_amount_minor,
      v_projected::bigint,
      0::bigint,
      NULL::text,
      'cash only customer cannot owe'::text;
    RETURN;
  END IF;

  -- Over limit
  IF v_projected > v_limit THEN
    RETURN QUERY SELECT
      false,
      'CREDIT_LIMIT_EXCEEDED'::text,
      (v_projected - v_limit)::bigint,
      v_projected::bigint,
      v_limit::bigint,
      NULL::text,
      'credit limit exceeded'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text, 0::bigint, v_projected::bigint, v_limit::bigint, NULL::text, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_customer_credit(uuid, uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_customer_credit(uuid, uuid, bigint) TO service_role;

COMMENT ON FUNCTION public.assert_customer_credit(uuid, uuid, bigint) IS
  'V53 4.4 P0: atomically checks a customer credit limit under an advisory lock (credit-concurrency-02: one row, exact types).';
