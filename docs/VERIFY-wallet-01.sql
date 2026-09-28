-- VERIFY for docs/wallet-01-migration.sql — read-only.
-- Expected: every row's `ok` is true. A missing object shows as ok = false.

WITH fns(name, signature) AS (
  VALUES
    ('create_wallet_topup_request', 'public.create_wallet_topup_request(uuid, uuid, uuid, bigint, text, text, date, text, text, text)'),
    ('approve_wallet_topup',        'public.approve_wallet_topup(uuid, uuid, bigint, text)'),
    ('reject_wallet_topup',         'public.reject_wallet_topup(uuid, uuid, text)'),
    ('cancel_wallet_topup',         'public.cancel_wallet_topup(uuid, uuid, uuid)'),
    ('wallet_adjust',               'public.wallet_adjust(uuid, text, bigint, uuid, text)'),
    ('wallet_pay_subscription_upgrade', 'public.wallet_pay_subscription_upgrade(uuid, uuid, text, text, text, bigint, text, text, text)'),
    ('wallet_post',                 'public.wallet_post(uuid, text, bigint, text, text, uuid, uuid, text)')
), resolved AS (SELECT name, to_regprocedure(signature) AS oid FROM fns)
SELECT name || ': exists' AS check, oid IS NOT NULL AS ok FROM resolved
UNION ALL
SELECT name || ': clients cannot execute',
       oid IS NOT NULL
       AND NOT has_function_privilege('anon', oid, 'EXECUTE')
       AND NOT has_function_privilege('authenticated', oid, 'EXECUTE')
  FROM resolved
UNION ALL
SELECT name || ': search_path fixed',
       oid IS NOT NULL AND EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = resolved.oid
                                     AND array_to_string(p.proconfig, ',') LIKE '%search_path=%')
  FROM resolved
UNION ALL
SELECT 'tables exist',
       to_regclass('public.wallet_payment_methods') IS NOT NULL
       AND to_regclass('public.wallets') IS NOT NULL
       AND to_regclass('public.wallet_transactions') IS NOT NULL
       AND to_regclass('public.wallet_topup_requests') IS NOT NULL
UNION ALL
SELECT 'row security on (all four)',
       (SELECT count(*) FROM pg_class
         WHERE relname IN ('wallet_payment_methods', 'wallets', 'wallet_transactions', 'wallet_topup_requests')
           AND relrowsecurity) = 4
UNION ALL
SELECT 'members can read their wallet (3 read policies)',
       (SELECT count(*) FROM pg_policies
         WHERE policyname IN ('wallets_workspace_read', 'wallet_transactions_workspace_read',
                              'wallet_topup_requests_workspace_read')) = 3
UNION ALL
SELECT 'balance cannot go negative (CHECK)',
       EXISTS (SELECT 1 FROM pg_constraint
                WHERE conrelid = to_regclass('public.wallets') AND contype = 'c'
                  AND pg_get_constraintdef(oid) LIKE '%balance_minor >= 0%')
UNION ALL
SELECT 'balance moves only through the functions (trigger)',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'wallets_balance_guard')
UNION ALL
SELECT 'ledger is append-only (trigger)',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'wallet_transactions_append_only')
UNION ALL
SELECT 'one receipt reference credited once (unique index)',
       to_regclass('public.wallet_topup_requests_reference_key') IS NOT NULL
UNION ALL
SELECT 'upgrade requests accept payment_method = wallet',
       EXISTS (SELECT 1 FROM pg_constraint
                WHERE conname = 'subscription_upgrade_requests_payment_method_check2')
UNION ALL
-- storage.buckets always exists on Supabase.
SELECT 'receipts bucket is private',
       EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'wallet-receipts' AND public = false)
UNION ALL
-- Every wallet equals the sum of its ledger (0 rows of drift).
SELECT 'every balance equals its ledger',
       NOT EXISTS (
         SELECT 1 FROM public.wallets w
          WHERE w.balance_minor <> COALESCE(
                  (SELECT sum(t.amount_minor) FROM public.wallet_transactions t WHERE t.wallet_id = w.id), 0));
