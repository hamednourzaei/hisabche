-- VERIFY invoices-seller-01 — run after the migration. Every row must say ok = true.
SELECT 'seller_user_id column exists, uuid, nullable' AS check_name,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'invoices'
           AND column_name = 'seller_user_id' AND data_type = 'uuid' AND is_nullable = 'YES'
       ) AS ok
UNION ALL
SELECT 'partial index invoices_seller_idx exists',
       EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE schemaname = 'public' AND tablename = 'invoices' AND indexname = 'invoices_seller_idx'
       )
UNION ALL
-- Nothing was back-filled: the column starts empty and fills only with overrides.
SELECT 'no seller equals its own issuer (only overrides are stored)',
       NOT EXISTS (
         SELECT 1 FROM public.invoices WHERE seller_user_id IS NOT NULL AND seller_user_id = user_id
       );
