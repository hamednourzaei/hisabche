-- FINDING — schema drift, 8 Nov 2026. READ-ONLY. Run in the Supabase SQL editor.
--
-- `node scripts/check-schema-drift.mjs` now reports 5 queries (was 74 before its
-- parser fixes: `public.` prefixes, multi-column ALTERs, `time`/`varchar` types,
-- `${CONSTANT}` column lists, `alias:column`). The repository's SQL does not
-- describe these 5 columns. Each row below says whether the LIVE table has it.
-- exists = false means that query answers 42703 in production.
--
-- Callers:
--   purchase_order_items.workspace_id      backend/src/services/analysis/analysis.service.ts
--   interactions.opportunity_id            backend/src/services/crm/crm.repository.ts (handles absence on purpose)
--   payments.invoice_id                    backend/src/services/event-log.service.ts
--   product_unit_options.is_sale_default   backend/src/services/invoice.service.ts
--   workflow_instances.status              backend/src/services/workflow/escalation.service.ts

SELECT want.table_name, want.column_name,
       EXISTS (
         SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.table_name = want.table_name
            AND c.column_name = want.column_name
       ) AS exists
  FROM (VALUES
    ('purchase_order_items', 'workspace_id'),
    ('interactions', 'opportunity_id'),
    ('payments', 'invoice_id'),
    ('product_unit_options', 'is_sale_default'),
    ('workflow_instances', 'status')
  ) AS want(table_name, column_name)
 ORDER BY 1, 2;
