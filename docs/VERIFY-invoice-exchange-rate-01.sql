-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY — docs/invoice-exchange-rate-01-migration.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- READ-ONLY. One statement; run it after the migration and send the output.
-- The first two rows should say ok = true. The last two are FINDINGS, not
-- checks: they count what is already in the books, and nothing changes them.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT 'column invoices.exchange_rate exists and is nullable' AS name,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'invoices'
                  AND column_name = 'exchange_rate' AND is_nullable = 'YES') AS ok,
       'numeric, NULL = books currency or made before rates were kept' AS detail
UNION ALL
SELECT 'a rate must be positive',
       EXISTS (SELECT 1 FROM pg_constraint
                WHERE conname = 'invoices_exchange_rate_positive'
                  AND conrelid = 'public.invoices'::regclass AND convalidated),
       'CHECK (exchange_rate IS NULL OR exchange_rate > 0)'
UNION ALL
SELECT 'FINDING: invoices in a currency other than their business''s books currency, with no rate',
       NULL,
       (SELECT COUNT(*)::text
          FROM public.invoices i
          JOIN public.workspaces w ON w.id = i.workspace_id
         WHERE i.exchange_rate IS NULL
           AND i.currency IS NOT NULL
           AND w.base_currency IS NOT NULL
           AND i.currency <> w.base_currency)
       || ' — booked figure for figure before this change; review them by hand'
UNION ALL
SELECT 'FINDING: the same, by business and currency',
       NULL,
       COALESCE((SELECT string_agg(t.line, ' | ')
                   FROM (SELECT w.name || ' · ' || i.currency || ' in ' || w.base_currency
                                || ' books: ' || COUNT(*)::text AS line
                           FROM public.invoices i
                           JOIN public.workspaces w ON w.id = i.workspace_id
                          WHERE i.exchange_rate IS NULL
                            AND i.currency IS NOT NULL
                            AND w.base_currency IS NOT NULL
                            AND i.currency <> w.base_currency
                          GROUP BY w.name, i.currency, w.base_currency
                          ORDER BY COUNT(*) DESC
                          LIMIT 20) t), 'none');
