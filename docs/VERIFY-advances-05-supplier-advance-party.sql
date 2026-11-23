-- ============================================================================
-- docs/VERIFY-advances-05-supplier-advance-party.sql
--
-- Read-only. Run after docs/advances-05-supplier-advance-party-migration.sql.
-- Every query answers one question; none writes. Keep the output.
-- ============================================================================

-- 1. Both functions exist, are SECURITY DEFINER, and pin search_path.
SELECT
  p.proname,
  p.prosecdef            AS security_definer,
  p.proconfig            AS config,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('supplier_advance_apply', 'supplier_advance_refund')
ORDER BY p.proname;
-- EXPECT: two rows, both security_definer = true, config contains
--         'search_path=public, pg_temp'.

-- 2. Both bodies resolve the party from supplier_id first, then customer_id,
--    and refuse an unknown party. A function that still reads
--    `v_dep.customer_id` directly would return false here.
SELECT
  p.proname,
  position('v_party := COALESCE(v_dep.supplier_id, v_dep.customer_id)' IN pg_get_functiondef(p.oid)) > 0
    AS resolves_party,
  position('ADVANCE_PARTY_UNKNOWN' IN pg_get_functiondef(p.oid)) > 0
    AS refuses_unknown
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('supplier_advance_apply', 'supplier_advance_refund')
ORDER BY p.proname;
-- EXPECT: resolves_party = true and refuses_unknown = true for BOTH rows.

-- 3. Unresolved historical advances. This number must not GROW; it is allowed
--    to shrink only when a person maps a row by hand. It is not a migration
--    failure: docs/FINDING-advances-party-identity.sql lists the rows.
SELECT
  count(*) FILTER (WHERE supplier_id IS NULL AND customer_id IS NULL) AS unresolved_party,
  count(*) FILTER (WHERE supplier_id IS NOT NULL AND customer_id IS NULL) AS supplier_side,
  count(*) FILTER (WHERE supplier_id IS NULL AND customer_id IS NOT NULL) AS still_on_customer_column,
  count(*) AS total_pre_purchase
FROM public.order_deposits
WHERE source_type = 'pre_purchase';
-- EXPECT: still_on_customer_column = 0 for rows written after advances-04.
--         (Historical rows may appear there only if the migration was applied
--         before advances-04's backfill; advances-04 maps the mappable ones.)

-- 4. Grants. Only the server role may call these; a browser session may not.
SELECT
  p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE')  AS service_role_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('supplier_advance_apply', 'supplier_advance_refund')
ORDER BY p.proname;
-- EXPECT: anon_execute = false, authenticated_execute = false,
--         service_role_execute = true for BOTH rows.
