-- ============================================================================
-- docs/rpc-client-revoke-migration.sql                  (27 Sep 2026)
--
-- ⚠️ SECURITY. Database functions the BACKEND calls must not be callable by
-- CLIENTS.
--
-- WHAT WAS FOUND
--   Ten functions the backend calls through supabase.rpc() had no REVOKE in
--   any migration. Supabase grants EXECUTE on public functions to `anon` and
--   `authenticated` by default, PostgREST exposes them at /rest/v1/rpc/<name>,
--   and the anon key ships inside the web bundle. Eight of them are SECURITY
--   DEFINER (row security does not apply) and take the workspace as a
--   PARAMETER — so anyone holding the public key could, for ANY business:
--     accounting_post_journal_entry   post a journal entry
--     payments_cancel                 cancel a payment
--     pos_record_order                record a POS sale
--     warehouse_transfer_stock        move stock between its warehouses
--     inventory_receive_layer         add a cost layer
--     inventory_release_consumption   release consumed cost
--     traceability_consume_batch      consume a lot
--     inventory_valuation             read its stock valuation
--   plus get_next_invoice_number and product_units_replace (invoker, but still
--   backend-only).
--   No client calls any of them: web, desktop and mobile go through the API;
--   the browser's Supabase client is used for Realtime only.
--
-- WHAT THIS DOES
--   Revokes EXECUTE on every overload of those names from PUBLIC, anon and
--   authenticated, and grants it to service_role (the backend's key). Nothing
--   else changes: no table, no data, no function body.
--
-- SAFETY
--   Additive and idempotent. Tolerant: a name that does not exist on this
--   database is skipped with a NOTICE.
--
-- ROLLBACK / MITIGATION
--   Only if something unexpectedly depended on client access (nothing in this
--   repository does):
--     GRANT EXECUTE ON FUNCTION public.<name>(<args>) TO authenticated;
--   for that one function — never to anon, and never for a SECURITY DEFINER
--   function that takes a workspace id without checking membership inside.
-- ============================================================================

DO $$
DECLARE
  v_name text;
  v_fn   regprocedure;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'accounting_post_journal_entry',
    'get_next_invoice_number',
    'inventory_receive_layer',
    'inventory_release_consumption',
    'inventory_valuation',
    'payments_cancel',
    'pos_record_order',
    'product_units_replace',
    'traceability_consume_batch',
    'warehouse_transfer_stock'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = v_name
    ) THEN
      RAISE NOTICE 'rpc-client-revoke: % does not exist here, skipped', v_name;
      CONTINUE;
    END IF;

    FOR v_fn IN
      SELECT p.oid::regprocedure
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = v_name
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', v_fn);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', v_fn);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', v_fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_fn);
    END LOOP;
  END LOOP;
END
$$;

NOTIFY pgrst, 'reload schema';
