-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY — docs/till-payments-01-migration.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- READ-ONLY. One statement; run it after the migration and send the output.
-- The first seven rows should say ok = true. The last is a FINDING: it counts
-- cash payments with no till, and nothing changes them.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT 'columns payments.pos_session_id and till_amount_minor exist, nullable' AS name,
       (SELECT COUNT(*) = 2 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'payments'
           AND column_name IN ('pos_session_id', 'till_amount_minor')
           AND is_nullable = 'YES') AS ok,
       'NULL in both = no till named' AS detail
UNION ALL
SELECT 'the till is a real till (foreign key)',
       EXISTS (SELECT 1 FROM pg_constraint
                WHERE conname = 'payments_pos_session_fk'
                  AND conrelid = 'public.payments'::regclass AND contype = 'f'),
       'payments.pos_session_id → pos_sessions.id'
UNION ALL
SELECT 'till and till amount come together, amount positive',
       EXISTS (SELECT 1 FROM pg_constraint
                WHERE conname = 'payments_till_pair_check'
                  AND conrelid = 'public.payments'::regclass AND convalidated),
       'CHECK payments_till_pair_check'
UNION ALL
SELECT 'only cash names a till',
       EXISTS (SELECT 1 FROM pg_constraint
                WHERE conname = 'payments_till_cash_only'
                  AND conrelid = 'public.payments'::regclass AND convalidated),
       'CHECK payments_till_cash_only'
UNION ALL
SELECT 'the guard trigger is on payments',
       EXISTS (SELECT 1 FROM pg_trigger
                WHERE tgname = 'payments_till_guard_trg'
                  AND tgrelid = 'public.payments'::regclass AND NOT tgisinternal),
       'same workspace; the till of a payment cannot be changed afterwards'
UNION ALL
SELECT 'payments_record_at_till: the server role only',
       has_function_privilege('service_role',
         'public.payments_record_at_till(uuid, uuid, jsonb, jsonb, text, uuid, bigint)', 'EXECUTE')
       AND NOT has_function_privilege('anon',
         'public.payments_record_at_till(uuid, uuid, jsonb, jsonb, text, uuid, bigint)', 'EXECUTE')
       AND NOT has_function_privilege('authenticated',
         'public.payments_record_at_till(uuid, uuid, jsonb, jsonb, text, uuid, bigint)', 'EXECUTE'),
       'service_role yes; anon and authenticated no'
UNION ALL
SELECT 'accounts.role accepts fx_gain_loss',
       EXISTS (SELECT 1 FROM pg_constraint
                WHERE conname = 'accounts_role_check'
                  AND conrelid = 'public.accounts'::regclass
                  AND pg_get_constraintdef(oid) LIKE '%fx_gain_loss%'),
       'the account exchange differences are booked to'
UNION ALL
SELECT 'FINDING: posted cash payments with no till named',
       NULL,
       (SELECT COUNT(*)::text FROM public.payments
         WHERE method = 'cash' AND status = 'posted' AND pos_session_id IS NULL)
       || ' — made before this change, or recorded without choosing a till; none is assigned to one';
