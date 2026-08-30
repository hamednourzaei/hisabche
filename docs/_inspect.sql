-- ============================================================================
-- docs/_inspect.sql — READ ONLY. Nothing here writes, alters or drops.
--
-- Run this in the Supabase SQL Editor BEFORE applying any migration, and send
-- the result back. It answers the four questions that decide what to do next:
--
--   1. which tables already exist, and do they hold data?
--   2. which of them have Row Level Security switched on?
--   3. which tables the migrations expect are missing?
--   4. exactly which existing rows would violate the new constraints?
--
-- Question 4 is the one that stopped the run: `journal_lines` already holds
-- rows that are neither a debit nor a credit, and a CHECK constraint cannot be
-- added over data that breaks it. What to do about those rows is an accounting
-- decision, not a technical one, which is why this script only reports them.
-- ============================================================================

-- ─── 1. What exists now, with RLS state and live row counts ─────────────────

select
  '1. tables' as section,
  t.tablename as name,
  case when t.rowsecurity then 'RLS on' else 'RLS OFF' end as detail,
  (
    select n_live_tup
    from pg_stat_user_tables s
    where s.relname = t.tablename and s.schemaname = 'public'
  )::text as value
from pg_tables t
where t.schemaname = 'public'

union all

-- ─── 2. Tables the migrations expect that are not there yet ─────────────────
--
-- Missing is fine and expected — that is what the migrations create. It is
-- listed so the run can be judged afterwards: anything still missing then did
-- not get created, and that is a failure worth seeing.

select
  '2. missing' as section,
  expected.name,
  'not created yet' as detail,
  '' as value
from (
  values
    ('accounts'), ('journal_entries'), ('journal_lines'),
    ('accounting_period_locks'), ('payments'), ('payment_allocations'),
    ('cost_layers'), ('stock_batches'), ('serial_units'),
    ('pos_sessions'), ('pos_orders'), ('pos_order_payments'),
    ('pos_cash_movements'), ('fixed_assets'), ('asset_depreciation_schedule'),
    ('bank_statements'), ('bank_statement_lines'), ('exchange_rates'),
    ('budgets'), ('time_entries'), ('sync_conflicts'), ('sync_change_log'),
    ('schema_migrations'), ('sod_overrides'), ('branches')
) as expected(name)
where not exists (
  select 1 from pg_tables t
  where t.schemaname = 'public' and t.tablename = expected.name
)

union all

-- ─── 3. The rows that blocked the migration ─────────────────────────────────
--
-- A journal line is one side or the other: a debit OR a credit, never both and
-- never neither. These rows are neither, so the books they belong to do not
-- balance and never did.

select
  '3. bad journal lines' as section,
  case
    when coalesce(debit, 0) = 0 and coalesce(credit, 0) = 0 then 'both zero'
    when coalesce(debit, 0) <> 0 and coalesce(credit, 0) <> 0 then 'both non-zero'
    else 'negative amount'
  end as name,
  'violates journal_lines_one_sided_check' as detail,
  count(*)::text as value
from journal_lines
where not (
  coalesce(debit, 0) >= 0 and coalesce(credit, 0) >= 0
  and (coalesce(debit, 0) = 0) <> (coalesce(credit, 0) = 0)
)
group by 1, 2, 3

union all

-- ─── 4. How much of the ledger is affected ──────────────────────────────────
--
-- The ratio is what decides the next step. A handful of rows is a data fix; a
-- large share means the ledger was written by something that never enforced
-- the rule, and the constraint should go on as NOT VALID so new writes are
-- correct while the history is dealt with separately.

select
  '4. ledger size' as section,
  'journal_lines total' as name,
  '' as detail,
  count(*)::text as value
from journal_lines

union all

select
  '4. ledger size' as section,
  'journal_entries total' as name,
  '' as detail,
  count(*)::text as value
from journal_entries

order by section, name;
