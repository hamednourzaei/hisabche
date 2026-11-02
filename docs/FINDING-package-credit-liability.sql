-- ============================================================================
-- FINDING: package credit — what the ledger and the invoices say (read-only)
-- File: docs/FINDING-package-credit-liability.sql
-- Status: PENDING HUMAN CONFIRMATION (a measuring instrument; the assistant ran it only on a stand-in schema).
--
-- READ-ONLY. Block 0 (does this database have what the others read?) and five measuring blocks; run each one SEPARATELY (the SQL editor shows only the last statement's result).
-- Nothing here inserts, updates, deletes or "fixes" anything: incomplete legacy data stays UNKNOWN (NULL), never zero.
--
-- Needs: package-credit-ledger-01 (package_credit_ledger), offering-type-01 (products.offering_type).
-- ============================================================================

-- ── BLOCK 0 ── RUN THIS FIRST: does this database have what the other blocks read? (one row of true/false)
-- A false means the migration named in the column has not been run here: run THAT migration (or skip the blocks that need it) —
-- do not edit the blocks to work around a missing column.
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products'
           AND column_name = 'offering_type')                                         AS has_products_offering_type,   -- docs/offering-type-01-migration.sql  (needed by block 1)
  to_regclass('public.package_credit_ledger') IS NOT NULL                              AS has_package_credit_ledger,    -- docs/package-credit-ledger-01-migration.sql (blocks 1-5)
  to_regclass('public.service_delivery_sessions') IS NOT NULL                          AS has_service_delivery_sessions, -- docs/service-delivery-01-migration.sql (block 4)
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_delivery_sessions'
           AND column_name = 'settlement_method')                                      AS has_session_settlement;

-- ── BLOCK 1 ── package invoice lines that never produced a GRANT.
-- The grant is written by a SECOND call after the invoice is saved and its failure is only logged
-- (backend/src/services/invoice.service.ts, grantPackageCreditsForInvoice): a paid package can exist with no credit.
SELECT i.workspace_id,
       COUNT(*)                         AS package_lines_without_grant,
       COUNT(DISTINCT i.id)             AS invoices_affected
  FROM public.invoice_items it
  JOIN public.invoices i  ON i.id = it.invoice_id
  JOIN public.products p  ON p.id = it.product_id AND p.workspace_id = i.workspace_id
 WHERE p.offering_type = 'package'
   AND i.customer_id IS NOT NULL
   AND COALESCE(i.status, '') <> 'cancelled'
   AND it.quantity > 0
   AND NOT EXISTS (
        SELECT 1 FROM public.package_credit_ledger g
         WHERE g.workspace_id = i.workspace_id AND g.entry_type = 'GRANT'
           AND g.source_document_type = 'invoice' AND g.source_line_id = it.id AND g.deleted_at IS NULL)
 GROUP BY i.workspace_id
 ORDER BY package_lines_without_grant DESC;

-- ── BLOCK 2 ── units per account (customer × package): granted, consumed, reversed, expired, adjusted, balance.
SELECT workspace_id, customer_id, package_product_id,
       SUM(quantity) FILTER (WHERE entry_type = 'GRANT')      AS granted,
       SUM(quantity) FILTER (WHERE entry_type = 'CONSUME')    AS consumed,
       SUM(quantity) FILTER (WHERE entry_type = 'REVERSAL')   AS reversed,
       SUM(quantity) FILTER (WHERE entry_type = 'EXPIRE')     AS expired,
       SUM(quantity) FILTER (WHERE entry_type = 'ADJUSTMENT') AS adjusted,
       COALESCE(SUM(CASE WHEN entry_type IN ('GRANT', 'ADJUSTMENT', 'REVERSAL') THEN quantity
                         WHEN entry_type IN ('CONSUME', 'EXPIRE') THEN -quantity ELSE 0 END), 0) AS balance
  FROM public.package_credit_ledger
 WHERE deleted_at IS NULL
 GROUP BY workspace_id, customer_id, package_product_id
HAVING COALESCE(SUM(CASE WHEN entry_type IN ('GRANT', 'ADJUSTMENT', 'REVERSAL') THEN quantity
                         WHEN entry_type IN ('CONSUME', 'EXPIRE') THEN -quantity ELSE 0 END), 0) <> 0
 ORDER BY workspace_id, balance DESC;

-- ── BLOCK 3 ── OUTSTANDING LIABILITY per workspace and currency: units still owed × the unit value the customer paid.
-- unit value = SUM(invoice line total) ÷ SUM(units granted) over the account's grants. It is NULL (unknown) — not zero —
-- when ANY grant of the account has no invoice line to read the price from (a manual grant, an import, a deleted line).
-- `liability` is NULL in the same case. Currency is the INVOICE's currency; amounts of different currencies are never added.
WITH account AS (
  SELECT g.workspace_id, g.customer_id, g.package_product_id,
         SUM(CASE WHEN g.entry_type IN ('GRANT', 'ADJUSTMENT', 'REVERSAL') THEN g.quantity
                  WHEN g.entry_type IN ('CONSUME', 'EXPIRE') THEN -g.quantity ELSE 0 END)      AS balance,
         SUM(g.quantity) FILTER (WHERE g.entry_type = 'GRANT')                                  AS granted,
         COUNT(*) FILTER (WHERE g.entry_type = 'GRANT')                                         AS grants,
         COUNT(*) FILTER (WHERE g.entry_type = 'GRANT' AND i.id IS NOT NULL)                    AS priced_grants,
         SUM(it.total_price) FILTER (WHERE g.entry_type = 'GRANT')                                    AS paid,
         MIN(i.currency) FILTER (WHERE g.entry_type = 'GRANT')                                  AS currency_a,
         MAX(i.currency) FILTER (WHERE g.entry_type = 'GRANT')                                  AS currency_b
    FROM public.package_credit_ledger g
    LEFT JOIN public.invoice_items it ON it.id = g.source_line_id
    LEFT JOIN public.invoices i       ON i.id = it.invoice_id AND i.workspace_id = g.workspace_id
   WHERE g.deleted_at IS NULL
   GROUP BY g.workspace_id, g.customer_id, g.package_product_id
)
SELECT workspace_id,
       CASE WHEN grants = priced_grants AND currency_a = currency_b THEN currency_a END AS currency,
       SUM(balance)                                                                      AS units_outstanding,
       CASE WHEN BOOL_AND(grants = priced_grants AND granted > 0 AND currency_a = currency_b)
            THEN ROUND(SUM(balance * paid / NULLIF(granted, 0)), 4) END                  AS liability,
       COUNT(*) FILTER (WHERE NOT (grants = priced_grants AND currency_a = currency_b))  AS accounts_with_unknown_value
  FROM account
 WHERE balance > 0
 GROUP BY workspace_id, CASE WHEN grants = priced_grants AND currency_a = currency_b THEN currency_a END
 ORDER BY workspace_id;

-- ── BLOCK 4 ── delivered package sessions with no consume, and consumes with no session.
SELECT 'delivered_without_consume' AS problem, s.workspace_id, s.id AS session_id, NULL::uuid AS ledger_id
  FROM public.service_delivery_sessions s
 WHERE s.status = 'delivered' AND s.settlement_method = 'package_credit' AND s.deleted_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.package_credit_ledger c
                    WHERE c.workspace_id = s.workspace_id AND c.entry_type = 'CONSUME'
                      AND c.source_document_type = 'service_delivery' AND c.source_document_id = s.id AND c.deleted_at IS NULL)
UNION ALL
SELECT 'consume_without_session', c.workspace_id, c.source_document_id, c.id
  FROM public.package_credit_ledger c
 WHERE c.entry_type = 'CONSUME' AND c.source_document_type = 'service_delivery' AND c.deleted_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.service_delivery_sessions s
                    WHERE s.id = c.source_document_id AND s.workspace_id = c.workspace_id)
UNION ALL
SELECT 'cancelled_session_credit_not_returned', s.workspace_id, s.id, s.package_credit_id
  FROM public.service_delivery_sessions s
 WHERE s.status = 'cancelled' AND s.settlement_method = 'package_credit' AND s.package_credit_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.package_credit_ledger r
                    WHERE r.workspace_id = s.workspace_id AND r.entry_type = 'REVERSAL'
                      AND r.reference_entry_id = s.package_credit_id AND r.deleted_at IS NULL);

-- ── BLOCK 5 ── accounts whose balance is NEGATIVE (should be impossible: consume is refused without credit).
SELECT workspace_id, customer_id, package_product_id,
       SUM(CASE WHEN entry_type IN ('GRANT', 'ADJUSTMENT', 'REVERSAL') THEN quantity
                WHEN entry_type IN ('CONSUME', 'EXPIRE') THEN -quantity ELSE 0 END) AS balance
  FROM public.package_credit_ledger
 WHERE deleted_at IS NULL
 GROUP BY workspace_id, customer_id, package_product_id
HAVING SUM(CASE WHEN entry_type IN ('GRANT', 'ADJUSTMENT', 'REVERSAL') THEN quantity
                WHEN entry_type IN ('CONSUME', 'EXPIRE') THEN -quantity ELSE 0 END) < 0;
