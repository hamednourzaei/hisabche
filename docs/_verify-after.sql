-- ============================================================================
-- docs/_verify-after.sql — READ ONLY. Run after the bundle.
--
-- The bundle appearing to finish is not proof that it did. The SQL Editor
-- shows only the last statement's output, so the reports in the middle — the
-- unassigned-workspace counts, the constraint validation notice — scrolled
-- past unseen.
--
-- This asks the database directly, and every line carries its own verdict so
-- nothing has to be interpreted.
-- ============================================================================

-- ─── 1. Did the migrations record themselves? ───────────────────────────────

select
  '1. ledger' as check_name,
  count(*)::text as value,
  case when count(*) >= 31
    then 'OK — every migration recorded'
    else 'INCOMPLETE — expected 31'
  end as verdict
from schema_migrations

union all

-- ─── 2. Do the tables that were missing now exist? ──────────────────────────

select
  '2. new tables',
  count(*)::text,
  case when count(*) = 17
    then 'OK — all 17 created'
    else format('MISSING %s of 17', 17 - count(*))
  end
from pg_tables
where schemaname = 'public'
  and tablename in (
    'accounting_period_locks', 'asset_depreciation_schedule',
    'bank_statement_lines', 'bank_statements', 'branches', 'budgets',
    'cost_layers', 'exchange_rates', 'fixed_assets', 'pos_cash_movements',
    'pos_order_payments', 'pos_orders', 'pos_sessions', 'stock_serials',
    'stock_batches', 'time_entries', 'schema_migrations'
  )
-- `stock_serials`, not `serial_units`. The first version of this check used the
-- TypeScript type name and reported a missing table that was there all along —
-- a check that lies is worse than no check, because it sends somebody looking
-- for a problem that does not exist.

union all

-- ─── 3. Is the ledger constraint actually enforced? ─────────────────────────
--
-- `convalidated = false` means it applies to new writes only and the history
-- was never checked. That is a weaker guarantee, and worth knowing about.

select
  '3. ledger constraint',
  case when con.convalidated then 'validated' else 'NOT VALID' end,
  case when con.convalidated
    then 'OK — enforced on every row, history included'
    else 'PARTIAL — new writes only; old rows still break it'
  end
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
where con.conname = 'journal_lines_one_sided_check'

union all

-- ─── 4. Were the amount-less lines archived before removal? ─────────────────

select
  '4. archived lines',
  count(*)::text,
  case when count(*) = 2
    then 'OK — both preserved in journal_lines_archive'
    else 'CHECK — expected 2'
  end
from journal_lines_archive

union all

-- ─── 5. Rows that could not be assigned to a workspace ──────────────────────
--
-- This is the number that matters most. Every one of these is a row the
-- application cannot see. Zero is the only good answer.

select
  '5. unassigned rows',
  total::text,
  case when total = 0
    then 'OK — every row belongs to a workspace'
    else format('%s row(s) invisible to the app — see the breakdown below', total)
  end
from (
  select
    (select count(*) from audit_logs where workspace_id is null)
  + (select count(*) from stock_movements where workspace_id is null)
  + (select count(*) from suppliers where workspace_id is null)
  + (select count(*) from purchase_orders where workspace_id is null)
  + (select count(*) from payrolls where workspace_id is null)
  + (select count(*) from leaves where workspace_id is null)
  + (select count(*) from project_time_entries where workspace_id is null)
  + (select count(*) from boms where workspace_id is null)
  + (select count(*) from bom_items where workspace_id is null)
  + (select count(*) from work_orders where workspace_id is null)
  + (select count(*) from opportunities where workspace_id is null)
  + (select count(*) from employees where workspace_id is null)
  + (select count(*) from projects where workspace_id is null)
  + (select count(*) from departments where workspace_id is null)
  as total
) t

union all

-- ─── 6. Is RLS on every table that now carries a workspace? ─────────────────
--
-- The column is bookkeeping; the policy is the boundary. A table with a
-- workspace column and no policy hands any authenticated caller any row.

select
  '6. tables without RLS',
  count(*)::text,
  case when count(*) = 0
    then 'OK — every workspace table has RLS on'
    else format('%s table(s) unprotected: %s', count(*), string_agg(tablename, ', '))
  end
from pg_tables t
where t.schemaname = 'public'
  and not t.rowsecurity
  and exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = t.tablename
      and c.column_name = 'workspace_id'
  )

union all

-- ─── 7. Do those tables have a policy, not just RLS enabled? ────────────────
--
-- RLS enabled with no policy denies everything. For most tables that breaks
-- the app; for a few it is the point.
--
-- `sync_change_log` and `sync_mutations` are reached only through the sync
-- endpoints, which use the service role and derive workspace and user from a
-- verified JWT. Deny-all is deliberate there: a leaked anon key cannot read
-- another workspace's change stream even if an endpoint were bypassed. They
-- are excluded so this check does not report a defence as a defect.

select
  '7. RLS without policy',
  count(*)::text,
  case when count(*) = 0
    then 'OK — every table that should have a policy has one'
    else format('%s table(s) deny everything: %s', count(*), string_agg(t.tablename, ', '))
  end
from pg_tables t
where t.schemaname = 'public'
  and t.rowsecurity
  and t.tablename not in ('sync_change_log', 'sync_mutations')
  and exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = t.tablename
      and c.column_name = 'workspace_id'
  )
  and not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = t.tablename
  )

union all

-- ─── 8. Are the RPCs the services call actually there? ──────────────────────

select
  '8. rpc functions',
  count(*)::text,
  case when count(*) >= 2
    then 'OK — posting and till functions exist'
    else 'MISSING — the services will fail at runtime'
  end
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('accounting_post_journal_entry', 'pos_record_order')

order by check_name;
