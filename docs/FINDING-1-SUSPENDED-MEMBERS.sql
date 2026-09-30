-- ═══════════════════════════════════════════════════════════════════════════
-- FINDING 1 — DOES A SUSPENDED MEMBER EXIST?
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY THIS IS THE FIRST QUERY AND NOT THE FIFTH
--
-- `services/tenancy.service.ts:29` defines the authorisation chain as
-- `has_access = true` THEN `suspended_at IS NULL`, and line 166 enforces it.
-- Five RLS policies do not carry either condition, so a member suspended in the
-- application can still read those tables directly through PostgREST with a
-- JWT — the backend guard is not in that path.
--
-- One of the five is `ledger_entries`, which holds real debit and credit lines.
--
-- Whether that is a live problem or a theoretical one depends on ONE number:
-- how many suspended memberships exist on this database. Zero means the fix is
-- cheap. Not zero means it is an incident, not a ticket.
--
-- ⚠️ RUN THIS ALONE. It is deliberately a single statement with no `//`
-- comments anywhere — Postgres rejects those, and a comment inside a query is
-- what broke the last version of this file twice.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
  '=== SUSPENDED MEMBERS ==='                       AS section,
  count(*) FILTER (WHERE suspended_at IS NOT NULL)  AS suspended_rows,
  count(*) FILTER (WHERE has_access = false)       AS access_revoked_rows,
  count(*) FILTER (
    WHERE suspended_at IS NOT NULL OR has_access = false
  )                                                AS total_blocked_rows,
  (SELECT count(*) FROM ledger_entries)             AS ledger_rows_total,
  (SELECT count(*) FROM custom_units)               AS custom_units_total
FROM workspace_members;
