-- ============================================================================
-- docs/VERIFY-invoice-write-payment-01.sql
--
-- Verification script for docs/invoice-write-payment-01-migration.sql
-- Status: PENDING HUMAN CONFIRMATION
--
-- RUN:
--   psql "$DATABASE_URL" -f docs/VERIFY-invoice-write-payment-01.sql
--
-- EXPECTED:
--   All assertions return true.
--
-- Read-only. The behaviour itself (invoice + payment commit or roll back
-- together) is proven with real rows by
-- backend/src/__tests__/invoice-write-payment-01.pg.test.ts.
-- ============================================================================

SELECT
  to_regprocedure(
    'public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb, jsonb)'
  ) IS NOT NULL
    AS invoice_write_document_12_args_exists,

  -- The older arities stay: a sale without money and a package sale name them.
  to_regprocedure(
    'public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint)'
  ) IS NOT NULL
    AS invoice_write_document_10_args_exists,
  to_regprocedure(
    'public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb)'
  ) IS NOT NULL
    AS invoice_write_document_11_args_exists,

  -- The money is written by the payments core, never by a second INSERT here.
  (SELECT pg_get_functiondef(p.oid) LIKE '%public.payments_record_keyed(%'
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'invoice_write_document'
      AND p.pronargs = 12)
    AS delegates_to_payments_record_keyed,
  (SELECT pg_get_functiondef(p.oid) LIKE '%public.payments_record_at_till(%'
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'invoice_write_document'
      AND p.pronargs = 12)
    AS delegates_to_payments_record_at_till,
  (SELECT pg_get_functiondef(p.oid) NOT LIKE '%INSERT INTO public.payments%'
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'invoice_write_document'
      AND p.pronargs = 12)
    AS no_second_payment_writer,

  -- Dependencies this overload needs, reported so a missing one is visible.
  to_regprocedure('public.payments_record_keyed(uuid, uuid, jsonb, jsonb, text)') IS NOT NULL
    AS payments_record_keyed_exists,
  to_regprocedure('public.payments_record_at_till(uuid, uuid, jsonb, jsonb, text, uuid, bigint)') IS NOT NULL
    AS payments_record_at_till_exists,

  NOT has_function_privilege(
    'anon',
    'public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb, jsonb)',
    'EXECUTE'
  ) AS anon_cannot_execute,
  NOT has_function_privilege(
    'authenticated',
    'public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb, jsonb)',
    'EXECUTE'
  ) AS authenticated_cannot_execute,
  has_function_privilege(
    'service_role',
    'public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb, jsonb)',
    'EXECUTE'
  ) AS service_role_can_execute;
