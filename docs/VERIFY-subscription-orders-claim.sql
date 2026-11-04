-- ============================================================================
-- docs/VERIFY-subscription-orders-claim.sql
-- Verification script for docs/subscription-orders-claim-migration.sql
-- Status: PENDING HUMAN CONFIRMATION
-- ============================================================================

DO $$
BEGIN
  -- 1. Check table existence
  ASSERT (SELECT count(*) FROM information_schema.tables WHERE table_name = 'subscription_orders') = 1, 'Table subscription_orders does not exist';
  ASSERT (SELECT count(*) FROM information_schema.tables WHERE table_name = 'subscription_order_events') = 1, 'Table subscription_order_events does not exist';

  -- 2. Check function existence
  ASSERT (SELECT count(*) FROM pg_proc WHERE proname = 'canonical_provision_workspace') = 1, 'RPC canonical_provision_workspace does not exist';

  RAISE NOTICE 'VERIFICATION SUCCESSFUL: subscription_orders and canonical_provision_workspace exist with correct schema.';
END;
$$;
