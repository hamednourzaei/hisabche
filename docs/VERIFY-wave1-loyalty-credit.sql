-- ============================================
-- docs/VERIFY-wave1-loyalty-credit.sql
-- Post-migration verification query — PENDING HUMAN CONFIRMATION
-- ============================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'gift_cards',
    'gift_card_transactions',
    'store_credit_ledger',
    'loyalty_points_ledger'
  )
ORDER BY table_name;

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'gift_cards',
    'gift_card_transactions',
    'store_credit_ledger',
    'loyalty_points_ledger'
  )
ORDER BY tablename;
