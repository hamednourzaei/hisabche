-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY — docs/opening-capital-and-fees-01-migration.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- READ-ONLY. One statement; run it after the migration and send the output.
-- Every row should say ok = true.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT 'accounts.role accepts owner_capital and bank_fees (and still fx_gain_loss)' AS name,
       EXISTS (SELECT 1 FROM pg_constraint
                WHERE conname = 'accounts_role_check'
                  AND conrelid = 'public.accounts'::regclass
                  AND pg_get_constraintdef(oid) LIKE '%owner_capital%'
                  AND pg_get_constraintdef(oid) LIKE '%bank_fees%'
                  AND pg_get_constraintdef(oid) LIKE '%fx_gain_loss%') AS ok,
       'the equity account for opening capital, the expense account for fees' AS detail
UNION ALL
SELECT 'a till movement may be opening capital',
       EXISTS (SELECT 1 FROM pg_constraint
                WHERE conname = 'pos_cash_movements_kind_check'
                  AND conrelid = 'public.pos_cash_movements'::regclass
                  AND pg_get_constraintdef(oid) LIKE '%opening_capital%'
                  AND pg_get_constraintdef(oid) LIKE '%transfer_from_bank%'),
       'kind opening_capital, beside the four that existed'
UNION ALL
SELECT 'column payments.fee_amount exists, nullable, positive when set',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'payments'
                  AND column_name = 'fee_amount' AND is_nullable = 'YES')
       AND EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'payments_fee_positive'
                      AND conrelid = 'public.payments'::regclass AND convalidated),
       'NULL = no fee'
UNION ALL
SELECT 'payments_record_with_fee: the server role only',
       has_function_privilege('service_role',
         'public.payments_record_with_fee(uuid, uuid, jsonb, jsonb, text, uuid, bigint, numeric)', 'EXECUTE')
       AND NOT has_function_privilege('anon',
         'public.payments_record_with_fee(uuid, uuid, jsonb, jsonb, text, uuid, bigint, numeric)', 'EXECUTE')
       AND NOT has_function_privilege('authenticated',
         'public.payments_record_with_fee(uuid, uuid, jsonb, jsonb, text, uuid, bigint, numeric)', 'EXECUTE'),
       'service_role yes; anon and authenticated no';
