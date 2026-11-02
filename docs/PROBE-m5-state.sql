-- ============================================================================
-- docs/PROBE-m5-state.sql
--
-- READ-ONLY STATE PROBE. Run it FIRST, before any M5 migration or the forward-fix, and send the whole result table back. It
-- writes nothing, creates nothing, and never errors on a missing object (every lookup is to_regclass / to_regprocedure / catalog
-- based). One result table: object | exists | version_marker | fingerprint | note.
--
--   version_marker  the COMMENT 'm5:<object>:rev<N>' written by docs/m5-forward-fix-01-migration.sql; NULL = rev1 (a first copy) or
--                   the object is absent. Reading it is exact.
--   fingerprint     a HEURISTIC read of the installed function text (pg_get_functiondef): it looks for the corrected behaviour.
--                   It is a fingerprint, NOT proof of behaviour. 'ok' / 'OLD' / 'n/a'.
--
-- The result tells you which runbook branch applies (docs/architecture/universal-business-core/APPLY-RUNBOOK.md):
--   S1 nothing of M5 exists            S2 objects exist with rev1 / OLD fingerprints   S3 everything is rev2 and 'ok'
--   S4 anything unexpected (an interval-shaped suspension table, a missing table, a missing column): STOP and report.
-- ============================================================================
WITH fn(object, signature) AS (
  VALUES
    ('package_credit_allocate',              'public.package_credit_allocate()'),
    ('accounting_deferred_revenue_change',   'public.accounting_deferred_revenue_change(uuid, date, date)'),
    ('accounting_profit_ledger_totals',      'public.accounting_profit_ledger_totals(uuid, date, date)'),
    ('invoice_write_document_11',            'public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb)'),
    ('invoice_return_scrap_loss',            'public.invoice_return_scrap_loss()'),
    ('service_delivery_deliver',             'public.service_delivery_deliver(uuid, uuid, text, uuid, numeric, uuid, text, uuid, timestamptz)'),
    ('service_delivery_cancel',              'public.service_delivery_cancel(uuid, uuid, uuid, text)')
), found AS (
  SELECT fn.object, fn.signature, to_regprocedure(fn.signature) AS oid FROM fn
), rows AS (
  SELECT 1 AS ord, 'function ' || f.object AS object,
         (f.oid IS NOT NULL) AS exists_now,
         CASE WHEN f.oid IS NULL THEN NULL ELSE obj_description(f.oid, 'pg_proc') END AS version_marker,
         CASE
           WHEN f.oid IS NULL THEN 'n/a'
           WHEN f.object IN ('accounting_deferred_revenue_change', 'accounting_profit_ledger_totals') THEN
             CASE WHEN pg_get_functiondef(f.oid) LIKE '%''posted'', ''reversed''%' THEN 'ok' ELSE 'OLD (counts only posted rows)' END
           WHEN f.object = 'package_credit_allocate' THEN
             CASE WHEN pg_get_functiondef(f.oid) LIKE '%''SUSPEND''%' THEN 'ok' ELSE 'OLD (interval-shaped suspensions)' END
           WHEN f.object = 'invoice_write_document_11' THEN
             CASE WHEN pg_get_functiondef(f.oid) LIKE '%v_grant_cols%' THEN 'ok' ELSE 'OLD (grants via the whitelist)' END
           ELSE 'n/a'
         END AS fingerprint,
         CASE WHEN f.oid IS NULL THEN 'absent' ELSE 'present' END AS note
    FROM found f
  UNION ALL
  SELECT 2, 'table ' || t.name, to_regclass('public.' || t.name) IS NOT NULL, NULL, 'n/a',
         CASE WHEN to_regclass('public.' || t.name) IS NULL THEN 'absent' ELSE 'present' END
    FROM (VALUES ('package_credit_ledger'), ('package_credit_allocations'), ('package_credit_suspensions'),
                 ('service_delivery_sessions'), ('invoice_returns'), ('invoice_return_lines')) AS t(name)
  UNION ALL
  SELECT 3, 'column ' || c.tbl || '.' || c.col,
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = c.tbl AND column_name = c.col),
         NULL, 'n/a',
         CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = c.tbl AND column_name = c.col)
              THEN 'present' ELSE 'absent' END
    FROM (VALUES ('package_credit_ledger', 'deferred_amount'), ('package_credit_ledger', 'term_months'),
                 ('products', 'package_term_months'), ('package_credit_suspensions', 'kind'),
                 ('package_credit_suspensions', 'effective_on'), ('package_credit_suspensions', 'starts_on')) AS c(tbl, col)
  UNION ALL
  SELECT 4, 'trigger ' || g.name, EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = g.name AND NOT tgisinternal), NULL, 'n/a',
         CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = g.name AND NOT tgisinternal) THEN 'present' ELSE 'absent' END
    FROM (VALUES ('trg_package_credit_allocate'), ('trg_pkg_alloc_immutable'), ('trg_pkg_susp_immutable'),
                 ('trg_invoice_return_scrap_loss')) AS g(name)
  UNION ALL
  SELECT 5, 'account roles allow deferred_revenue + inventory_loss',
         COALESCE((SELECT pg_get_constraintdef(oid) LIKE '%deferred_revenue%' AND pg_get_constraintdef(oid) LIKE '%inventory_loss%'
                     FROM pg_constraint WHERE conname = 'accounts_role_check' LIMIT 1), false),
         NULL, 'n/a', 'accounts_role_check'
)
SELECT object, exists_now AS "exists", version_marker, fingerprint, note
  FROM rows
 ORDER BY ord, object;
