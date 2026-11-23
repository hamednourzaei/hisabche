-- ============================================================================
-- docs/VERIFY-order-deposit-balances-01.sql
--
-- Read-only. Run after docs/order-deposit-balances-01-migration.sql.
-- Every query answers one question; none writes. Keep the output.
-- ============================================================================

-- 1. The function exists, is SECURITY DEFINER, and pins search_path.
SELECT
  p.proname,
  p.prosecdef AS security_definer,
  p.proconfig AS config,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'order_deposit_balances';
-- EXPECT: one row; security_definer = true; config contains
--         'search_path=public, pg_temp'; args = 'uuid, uuid[]'.

-- 2. Only the server may execute it.
SELECT
  has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE')  AS service_role_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'order_deposit_balances';
-- EXPECT: anon_execute = false, authenticated_execute = false,
--         service_role_execute = true.

-- 3. THE ONE THAT MATTERS: the batched answer equals the per-row function for
--    every deposit in the workspace. Any difference is a migration failure, not
--    a rounding detail — apply/refund validate with order_deposit_balance.
WITH batched AS (
  SELECT b.deposit_id, b.amount_minor, b.applied_minor, b.refunded_minor, b.remaining_minor
    FROM (SELECT DISTINCT workspace_id FROM public.order_deposits) w
    CROSS JOIN LATERAL public.order_deposit_balances(
      w.workspace_id,
      ARRAY(SELECT x.id FROM public.order_deposits x WHERE x.workspace_id = w.workspace_id)
    ) b
),
single AS (
  SELECT
    d.id AS deposit_id,
    d.amount_minor,
    (public.order_deposit_balance(d.workspace_id, d.id) ->> 'applied_minor')::bigint  AS applied_minor,
    (public.order_deposit_balance(d.workspace_id, d.id) ->> 'refunded_minor')::bigint AS refunded_minor,
    (public.order_deposit_balance(d.workspace_id, d.id) ->> 'remaining_minor')::bigint AS remaining_minor
  FROM public.order_deposits d
)
SELECT count(*) AS deposits_compared,
       count(*) FILTER (
         WHERE b.amount_minor   IS DISTINCT FROM s.amount_minor
            OR b.applied_minor  IS DISTINCT FROM s.applied_minor
            OR b.refunded_minor IS DISTINCT FROM s.refunded_minor
            OR b.remaining_minor IS DISTINCT FROM s.remaining_minor
       ) AS differing
FROM batched b
JOIN single s ON s.deposit_id = b.deposit_id;
-- EXPECT: differing = 0. deposits_compared is the workspace's deposit count.

-- 4. Cross-workspace isolation: asking one workspace for another workspace's
--    deposit id returns nothing.
SELECT count(*) AS foreign_rows
FROM public.order_deposit_balances(
  (SELECT workspace_id FROM public.order_deposits ORDER BY created_at LIMIT 1),
  ARRAY(
    SELECT id FROM public.order_deposits
     WHERE workspace_id <> (SELECT workspace_id FROM public.order_deposits ORDER BY created_at LIMIT 1)
     LIMIT 50
  )
);
-- EXPECT: foreign_rows = 0.
