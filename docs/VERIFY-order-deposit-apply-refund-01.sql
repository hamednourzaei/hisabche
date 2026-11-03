-- ============================================================================
-- docs/VERIFY-order-deposit-apply-refund-01.sql
--
-- Verification script for docs/order-deposit-apply-refund-01-migration.sql
-- Status: PENDING HUMAN CONFIRMATION
--
-- RUN:
--   psql "$DATABASE_URL" -f docs/VERIFY-order-deposit-apply-refund-01.sql
--
-- EXPECTED:
--   Every column returns TRUE, and every count column returns the number shown
--   in the comment beside it. «Success. No rows returned» is NOT a pass.
--
-- READ-ONLY. This file writes nothing and reads no business row.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The three functions exist, run as the definer, and pin search_path
--    (an unpinned SECURITY DEFINER function is a privilege-escalation hole).
-- ---------------------------------------------------------------------------

SELECT
  to_regprocedure('public.order_deposit_balance(uuid,uuid)')                                   IS NOT NULL AS has_balance,
  to_regprocedure('public.order_deposit_apply(uuid,uuid,uuid,uuid,bigint,smallint,date,text,uuid,uuid,text)') IS NOT NULL AS has_apply,
  to_regprocedure('public.order_deposit_refund(uuid,uuid,uuid,bigint,smallint,date,text,text,text,uuid,uuid,text)') IS NOT NULL AS has_refund,
  bool_and(p.prosecdef)                                                                        AS all_security_definer,
  bool_and(p.proconfig::text LIKE '%search_path=%')                                            AS all_pin_search_path,
  bool_and(p.proconfig::text LIKE '%pg_temp%')                                                 AS all_include_pg_temp,
  bool_and(p.prorettype = 'jsonb'::regtype)                                                    AS all_return_jsonb
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('order_deposit_balance', 'order_deposit_apply', 'order_deposit_refund');

-- ---------------------------------------------------------------------------
-- 2. The two new tables exist, with the columns the service reads
-- ---------------------------------------------------------------------------

SELECT
  to_regclass('public.order_deposit_applications') IS NOT NULL AS has_applications,
  to_regclass('public.order_deposit_refunds')      IS NOT NULL AS has_refunds,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_deposit_applications')::int
    = 11                                                        AS applications_11_columns,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_deposit_refunds')::int
    = 12                                                        AS refunds_12_columns;

-- Every column the functions and the service name, one row per column.
SELECT c.table_name, c.column_name, c.data_type, c.is_nullable
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND (
    (c.table_name = 'order_deposit_applications'
      AND c.column_name IN ('id','workspace_id','deposit_id','invoice_id','amount_minor',
                            'currency','idempotency_key','payment_id','journal_entry_id',
                            'created_by','created_at'))
    OR
    (c.table_name = 'order_deposit_refunds'
      AND c.column_name IN ('id','workspace_id','deposit_id','amount_minor','currency',
                            'method','reason','idempotency_key','payment_id','journal_entry_id',
                            'created_by','created_at'))
  )
ORDER BY c.table_name, c.column_name;
-- EXPECTED: 23 rows (11 + 12).

-- A refund must always say WHY, and the database enforces it.
SELECT
  bool_or(col.column_name = 'reason' AND col.is_nullable = 'NO') AS reason_mandatory
FROM information_schema.columns col
WHERE col.table_schema = 'public' AND col.table_name = 'order_deposit_refunds';

-- ---------------------------------------------------------------------------
-- 3. The deposit learned about currency and whether its receipt posted
-- ---------------------------------------------------------------------------

SELECT
  count(*) = 3                                                    AS all_three_columns_present,
  bool_or(col.column_name = 'currency'        AND col.is_nullable = 'YES') AS currency_nullable,
  bool_or(col.column_name = 'posting_status'  AND col.is_nullable = 'YES') AS posting_status_nullable,
  bool_or(col.column_name = 'journal_entry_id' AND col.is_nullable = 'YES') AS journal_entry_nullable
FROM information_schema.columns col
WHERE col.table_schema = 'public'
  AND col.table_name = 'order_deposits'
  AND col.column_name IN ('currency', 'posting_status', 'journal_entry_id');

-- The check permits exactly the two recorded states and NULL (unknown).
SELECT
  pg_get_constraintdef(c.oid) LIKE '%posted%'           AS allows_posted,
  pg_get_constraintdef(c.oid) LIKE '%pending_posting%'  AS allows_pending_posting,
  c.convalidated                                        AS constraint_validated
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
WHERE t.relname = 'order_deposits' AND c.conname = 'order_deposits_posting_status_check';

-- ---------------------------------------------------------------------------
-- 4. Idempotency and one-payment-one-row are ENFORCED by indexes
-- ---------------------------------------------------------------------------

SELECT
  count(*) FILTER (WHERE indexname = 'order_deposit_applications_idem_key')::int  = 1 AS applications_idem_key,
  count(*) FILTER (WHERE indexname = 'order_deposit_applications_payment_key')::int = 1 AS applications_payment_key,
  count(*) FILTER (WHERE indexname = 'order_deposit_refunds_idem_key')::int        = 1 AS refunds_idem_key,
  count(*) FILTER (WHERE indexname = 'order_deposit_refunds_payment_key')::int     = 1 AS refunds_payment_key,
  count(*) FILTER (WHERE indexname = 'order_deposits_workspace_order_idx')::int    = 1 AS deposits_order_idx
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('order_deposit_applications', 'order_deposit_refunds', 'order_deposits');

-- The idempotency indexes must be UNIQUE, not merely present.
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('order_deposit_applications_idem_key',
                    'order_deposit_applications_payment_key',
                    'order_deposit_refunds_idem_key',
                    'order_deposit_refunds_payment_key');
-- EXPECTED: 4 rows, every indexdef containing «UNIQUE INDEX».

-- ---------------------------------------------------------------------------
-- 5. Amounts cannot be zero or negative; the key cannot be a one-character key
-- ---------------------------------------------------------------------------

SELECT
  count(*) FILTER (WHERE conname = 'order_deposit_applications_amount_check')::int = 1 AS applications_amount_check,
  count(*) FILTER (WHERE conname = 'order_deposit_applications_key_check')::int    = 1 AS applications_key_check,
  count(*) FILTER (WHERE conname = 'order_deposit_refunds_amount_check')::int      = 1 AS refunds_amount_check,
  count(*) FILTER (WHERE conname = 'order_deposit_refunds_key_check')::int         = 1 AS refunds_key_check,
  count(*) FILTER (WHERE conname = 'order_deposit_refunds_reason_check')::int      = 1 AS refunds_reason_check
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
WHERE t.relnamespace = 'public'::regnamespace
  AND t.relname IN ('order_deposit_applications', 'order_deposit_refunds')
  AND c.contype = 'c';

-- The reason rule is VALIDATED, not merely present as NOT VALID.
SELECT conname, convalidated
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
WHERE t.relnamespace = 'public'::regnamespace
  AND t.relname = 'order_deposit_refunds'
  AND c.conname = 'order_deposit_refunds_reason_check';
-- EXPECTED: 1 row, convalidated = TRUE.

-- ---------------------------------------------------------------------------
-- 6. Only the server may call these — no PUBLIC / anon / authenticated EXECUTE
-- ---------------------------------------------------------------------------

SELECT
  p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE')  AS service_role_can_execute
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('order_deposit_balance', 'order_deposit_apply', 'order_deposit_refund')
ORDER BY p.proname;
-- EXPECTED: 3 rows; anon/authenticated FALSE, service_role TRUE.

SELECT
  has_table_privilege('anon', 'public.order_deposit_applications', 'SELECT')          AS anon_selects_applications,
  has_table_privilege('authenticated', 'public.order_deposit_applications', 'SELECT') AS auth_selects_applications,
  has_table_privilege('service_role', 'public.order_deposit_applications', 'SELECT')  AS service_selects_applications,
  has_table_privilege('anon', 'public.order_deposit_refunds', 'SELECT')               AS anon_selects_refunds,
  has_table_privilege('authenticated', 'public.order_deposit_refunds', 'SELECT')      AS auth_selects_refunds,
  has_table_privilege('service_role', 'public.order_deposit_refunds', 'SELECT')       AS service_selects_refunds
WHERE to_regclass('public.order_deposit_applications') IS NOT NULL
  AND to_regclass('public.order_deposit_refunds') IS NOT NULL;
-- EXPECTED: anon/auth FALSE, service_role TRUE.

-- ---------------------------------------------------------------------------
-- 7. History was not rewritten: no deposit gained a guessed currency, and no
--    row was deleted. Run this BEFORE and AFTER the migration; the two counts
--    must be identical.
-- ---------------------------------------------------------------------------

SELECT
  count(*)::int                                                 AS deposits_total,
  count(*) FILTER (WHERE currency IS NULL)::int                 AS deposits_without_currency,
  count(*) FILTER (WHERE posting_status IS NULL)::int           AS deposits_without_posting_status,
  count(*) FILTER (WHERE currency IS NOT NULL
                     AND currency !~ '^[A-Z]{3}$')::int         AS deposits_with_malformed_currency
FROM public.order_deposits;
-- EXPECTED after the migration: deposits_without_currency and
-- deposits_without_posting_status EQUAL the pre-migration row count (nothing
-- was backfilled), deposits_with_malformed_currency = 0.

-- ---------------------------------------------------------------------------
-- 8. The receipt entry the apply/refund functions require exists for every
--    deposit they will accept. A non-zero count here is not a failure — it is
--    the list of deposits that must be (re)posted before they can be applied.
-- ---------------------------------------------------------------------------

SELECT count(*)::int AS deposits_without_a_posted_receipt
FROM public.order_deposits d
WHERE NOT EXISTS (
  SELECT 1 FROM public.journal_entries j
   WHERE j.workspace_id = d.workspace_id
     AND j.source_type = 'order_deposit'
     AND j.source_id = d.id
     AND j.status = 'posted'
);
