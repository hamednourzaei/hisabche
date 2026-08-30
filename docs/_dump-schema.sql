-- ============================================================================
-- docs/_dump-schema.sql — READ ONLY. One statement, one cell of text.
--
-- Everything the migrations need to agree with: every table, every column and
-- type, every constraint, every RLS policy, every function.
--
-- ---------------------------------------------------------------------------
-- WHY A SINGLE TEXT CELL
--
-- The SQL Editor returns rows as JSON, and a schema of sixty-seven tables is
-- roughly eight hundred rows of it — unreadable and painful to copy. This
-- builds one string instead: run it, click the single cell, copy.
--
-- ---------------------------------------------------------------------------
-- WHY IT IS NEEDED
--
-- `CREATE TABLE IF NOT EXISTS` does NOT reshape a table that already exists.
-- Half of these tables pre-date the migrations, so what the code assumes and
-- what the database holds can differ silently — `journal_lines.journal_id` vs
-- the `entry_id` that was assumed is exactly that, found by accident.
--
-- Reading the real shape first turns the rest of the work from guessing into
-- checking.
-- ============================================================================

select
  string_agg(line, E'\n' order by sort_key, line) as schema_dump
from (

  -- ─── Tables and their columns ─────────────────────────────────────────────

  select
    1 as sort_key,
    format(
      'TABLE %s (%s rows, %s)%s  %s',
      c.relname,
      coalesce(s.n_live_tup, 0),
      case when c.relrowsecurity then 'RLS on' else 'RLS OFF' end,
      E'\n',
      (
        select string_agg(
          format('%s %s%s', a.attname, format_type(a.atttypid, a.atttypmod),
                 case when a.attnotnull then ' NOT NULL' else '' end),
          E'\n  ' order by a.attnum
        )
        from pg_attribute a
        where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      )
    ) as line
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_stat_user_tables s on s.relid = c.oid
  where n.nspname = 'public' and c.relkind = 'r'

  union all

  -- ─── Constraints — the things that refuse data ────────────────────────────

  select
    2,
    format('CONSTRAINT %s ON %s: %s',
           con.conname, rel.relname, pg_get_constraintdef(con.oid))
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public' and con.contype in ('c', 'u', 'f', 'p')

  union all

  -- ─── RLS policies — who can see what ──────────────────────────────────────

  select
    3,
    format('POLICY %s ON %s FOR %s TO %s%s  USING %s%s  CHECK %s',
           p.policyname, p.tablename, p.cmd, array_to_string(p.roles, ','),
           E'\n', coalesce(p.qual, '(none)'),
           E'\n', coalesce(p.with_check, '(none)'))
  from pg_policies p
  where p.schemaname = 'public'

  union all

  -- ─── Functions — the RPCs the services call ───────────────────────────────
  --
  -- Signatures only. The bodies are long and what matters here is whether the
  -- function exists and takes the arguments the service sends.

  select
    4,
    format('FUNCTION %s(%s) RETURNS %s',
           p.proname,
           pg_get_function_arguments(p.oid),
           pg_get_function_result(p.oid))
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'

  union all

  -- ─── Indexes ──────────────────────────────────────────────────────────────

  select
    5,
    format('INDEX %s', pg_get_indexdef(i.indexrelid))
  from pg_index i
  join pg_class c on c.oid = i.indrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not i.indisprimary

) as everything;
