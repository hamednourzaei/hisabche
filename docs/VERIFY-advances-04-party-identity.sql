-- ============================================================================
-- docs/VERIFY-advances-04-party-identity.sql
--
-- Verification queries for docs/advances-04-party-identity-migration.sql
-- ============================================================================

-- 1. Verify supplier_id column exists with correct data type
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'order_deposits'
  AND column_name IN ('customer_id', 'supplier_id');

-- 2. Verify foreign key from order_deposits.supplier_id to suppliers.id
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'order_deposits'
  AND kcu.column_name = 'supplier_id';

-- 3. Verify the party-identity triggers and their function exist
SELECT
  t.tgname,
  p.proname,
  t.tgenabled
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'public.order_deposits'::regclass
  AND t.tgname IN ('order_deposits_party_identity_ins', 'order_deposits_party_identity_upd')
ORDER BY t.tgname;

-- 4. Unresolved historical pre_purchase rows (expected to exist until a human
--    resolves them; the trigger guarantees this number cannot GROW).
SELECT
  COUNT(*) AS unresolved_pre_purchase_rows
FROM public.order_deposits
WHERE source_type = 'pre_purchase'
  AND supplier_id IS NULL;
