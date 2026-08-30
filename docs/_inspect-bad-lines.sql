-- ============================================================================
-- docs/_inspect-bad-lines.sql — READ ONLY.
--
-- The rows that blocked the migration, and the entries they belong to.
--
-- ---------------------------------------------------------------------------
-- RUN PART 0 FIRST
--
-- The first attempt at this script assumed `journal_lines.entry_id`, and the
-- table actually uses `journal_id` — the migration's own function inserts into
-- `journal_id`. Rather than guess a second time, part 0 prints the real
-- columns. Run it, and the rest of the script uses the name it found.
--
-- That mismatch is worth noticing on its own: this table pre-dates the
-- migration, so `CREATE TABLE IF NOT EXISTS` never reshaped it, and what the
-- code assumes and what the database holds can differ silently.
-- ============================================================================

-- ─── Part 0. What the table actually looks like ─────────────────────────────

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'journal_lines'
order by ordinal_position;


-- ============================================================================
-- Part 1. The offending lines, in full.
-- Run this second.
-- ============================================================================

select
  jl.id::text                          as line_id,
  jl.journal_id::text                  as journal_id,
  coalesce(a.code, '(no account)')     as account_code,
  coalesce(a.name, '(no account)')     as account_name,
  coalesce(jl.debit, 0)::text          as debit,
  coalesce(jl.credit, 0)::text         as credit,
  coalesce(je.entry_number, '(none)')  as entry_number,
  coalesce(je.description, '')         as entry_description,
  coalesce(je.status, '')              as entry_status
from journal_lines jl
left join journal_entries je on je.id = jl.journal_id
left join accounts a on a.id = jl.account_id
where not (
  coalesce(jl.debit, 0) >= 0 and coalesce(jl.credit, 0) >= 0
  and (coalesce(jl.debit, 0) = 0) <> (coalesce(jl.credit, 0) = 0)
);


-- ============================================================================
-- Part 2. Do their entries balance?
-- Run this third.
--
-- The empty lines carry no amount, so they cannot affect these totals. If
-- every `difference` is 0 the entries are sound and the empty rows are noise.
-- Any non-zero difference is an entry that never balanced, which a constraint
-- cannot fix and a person has to look at.
-- ============================================================================

select
  je.id::text                                                     as entry_id,
  coalesce(je.entry_number, '(none)')                             as entry_number,
  coalesce(je.description, '')                                    as description,
  count(jl.id)::text                                              as total_lines,
  sum(coalesce(jl.debit, 0))::text                                as sum_debit,
  sum(coalesce(jl.credit, 0))::text                               as sum_credit,
  (sum(coalesce(jl.debit, 0)) - sum(coalesce(jl.credit, 0)))::text as difference
from journal_entries je
join journal_lines jl on jl.journal_id = je.id
where je.id in (
  select jl2.journal_id
  from journal_lines jl2
  where not (
    coalesce(jl2.debit, 0) >= 0 and coalesce(jl2.credit, 0) >= 0
    and (coalesce(jl2.debit, 0) = 0) <> (coalesce(jl2.credit, 0) = 0)
  )
)
group by je.id, je.entry_number, je.description;
