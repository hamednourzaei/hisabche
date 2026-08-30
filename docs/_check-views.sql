-- READ ONLY. The four names the code reads that the table dump did not show.
--
-- The dump listed `relkind = 'r'` — ordinary tables only — so a VIEW is
-- invisible to it. These four are almost certainly views, but "almost
-- certainly" is not a thing to build a migration on.
--
-- Anything that comes back here exists and is fine. Anything missing from the
-- result is genuinely absent, and the service that reads it is broken today.

select
  c.relname as name,
  case c.relkind
    when 'v' then 'view'
    when 'm' then 'materialized view'
    when 'r' then 'table'
    when 'f' then 'foreign table'
    else c.relkind::text
  end as kind,
  n.nspname as schema
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relname in (
  'invoice_outstanding', 'ledger_entries_view', 'transactions_view', 'users'
)
order by n.nspname, c.relname;
