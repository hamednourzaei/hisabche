-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY — docs/db-integrity-01-migration.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- READ-ONLY. One statement; run it after the migration and send the output.
-- Every row should say ok = true, with ONE expected exception:
--
--   «fk payment_allocations.invoice_id is validated» is expected to be false.
--   15 old allocations point at invoices that no longer exist; the key refuses
--   new ones and leaves those for a person to look at.
-- ═══════════════════════════════════════════════════════════════════════════

WITH wanted_fk (child, col, parent) AS (
  VALUES
    ('payment_allocations', 'invoice_id',       'invoices'),
    ('cost_layers',         'product_id',       'products'),
    ('cost_consumptions',   'layer_id',         'cost_layers'),
    ('cost_consumptions',   'product_id',       'products'),
    ('journal_entries',     'reversal_of',      'journal_entries'),
    ('payments',            'journal_entry_id', 'journal_entries'),
    ('accounts',            'workspace_id',     'workspaces'),
    ('journal_entries',     'workspace_id',     'workspaces'),
    ('journal_lines',       'workspace_id',     'workspaces'),
    ('invoice_items',       'workspace_id',     'workspaces'),
    ('stock_movements',     'workspace_id',     'workspaces'),
    ('warehouses',          'workspace_id',     'workspaces'),
    ('warehouse_stock',     'workspace_id',     'workspaces'),
    ('suppliers',           'workspace_id',     'workspaces'),
    ('payments',            'workspace_id',     'workspaces'),
    ('payment_allocations', 'workspace_id',     'workspaces'),
    ('cost_layers',         'workspace_id',     'workspaces'),
    ('cost_consumptions',   'workspace_id',     'workspaces')
),
fk AS (
  SELECT
    w.child,
    w.col,
    w.parent,
    (
      SELECT k.convalidated
        FROM pg_constraint k
        JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ANY (k.conkey)
       WHERE k.contype = 'f'
         AND k.conrelid = format('public.%I', w.child)::regclass
         AND k.confrelid = format('public.%I', w.parent)::regclass
         AND a.attname = w.col
       ORDER BY k.convalidated DESC
       LIMIT 1
    ) AS validated
  FROM wanted_fk w
),
checks (name, ok, detail) AS (
  SELECT 'check journal_lines_amounts_not_negative',
         COALESCE(bool_or(convalidated), false),
         'debit >= 0 AND credit >= 0'
    FROM pg_constraint
   WHERE conname = 'journal_lines_amounts_not_negative' AND conrelid = 'public.journal_lines'::regclass
  UNION ALL
  SELECT 'check journal_lines_one_side',
         COALESCE(bool_or(convalidated), false),
         'a line is on one side only'
    FROM pg_constraint
   WHERE conname = 'journal_lines_one_side' AND conrelid = 'public.journal_lines'::regclass
  UNION ALL
  SELECT 'check cost_layers_remaining_in_range',
         COALESCE(bool_or(convalidated), false),
         '0 <= remaining_qty <= received_qty'
    FROM pg_constraint
   WHERE conname = 'cost_layers_remaining_in_range' AND conrelid = 'public.cost_layers'::regclass
  UNION ALL
  SELECT 'journal_lines.' || column_name || ' is NOT NULL',
         is_nullable = 'NO',
         'is_nullable = ' || is_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'journal_lines'
     AND column_name IN ('journal_id', 'account_id')
  UNION ALL
  SELECT 'trigger ' || t.name,
         EXISTS (
           SELECT 1 FROM pg_trigger g
            WHERE g.tgname = t.name
              AND g.tgrelid = format('public.%I', t.tbl)::regclass
              AND g.tgenabled <> 'D'
              AND (NOT t.deferred OR (g.tgdeferrable AND g.tginitdeferred))
         ),
         CASE WHEN t.deferred THEN 'checked at commit' ELSE 'before the row is written' END
    FROM (VALUES
      ('journal_lines_balance_trg', 'journal_lines', true),
      ('journal_entries_balance_trg', 'journal_entries', true),
      ('payment_allocations_same_currency_trg', 'payment_allocations', false)
    ) AS t (name, tbl, deferred)
  UNION ALL
  SELECT 'function ' || p.proname || ' is not callable by anon/authenticated',
         NOT has_function_privilege('anon', p.oid, 'EXECUTE')
           AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE'),
         'search_path: ' || COALESCE(array_to_string(p.proconfig, ', '), '(not set)')
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN (
       'journal_entry_assert_balanced',
       'journal_lines_keep_balance',
       'journal_entries_keep_balance',
       'payment_allocations_same_currency'
     )
  UNION ALL
  SELECT 'fk ' || child || '.' || col || ' exists',
         validated IS NOT NULL,
         '-> ' || parent
    FROM fk
  UNION ALL
  SELECT 'fk ' || child || '.' || col || ' is validated',
         COALESCE(validated, false),
         CASE WHEN COALESCE(validated, false) THEN 'every existing row satisfies it'
              ELSE 'enforced for new rows only' END
    FROM fk
  UNION ALL
  SELECT 'invoice_items with no workspace',
         COUNT(*) = 0,
         COUNT(*)::text || ' rows'
    FROM public.invoice_items
   WHERE workspace_id IS NULL
  UNION ALL
  SELECT 'posted entries that do not balance',
         COUNT(*) = 0,
         COUNT(*)::text || ' entries'
    FROM (
      SELECT e.id
        FROM public.journal_entries e
        JOIN public.journal_lines l ON l.journal_id = e.id
       WHERE e.status IN ('posted', 'reversed')
       GROUP BY e.id
      HAVING SUM(l.debit) <> SUM(l.credit)
    ) AS unbalanced
)
SELECT name, ok, detail
FROM checks
ORDER BY ok, name;
