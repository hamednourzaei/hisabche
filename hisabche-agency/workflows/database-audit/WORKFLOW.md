# Workflow — Database & Migration Integrity Audit

**Default Profile:** `STANDARD` or `CRITICAL`

## Sequence

1. **`Database Optimizer` (`hisabche-database-optimizer`)** inspects `docs/*-migration.sql`, `.claude/db-integrity/00-SPEC.md`, FK validity, nullable `workspace_id`, and `TIMESTAMPTZ` hygiene.
2. **`Database Reliability Engineer` (`hisabche-database-reliability-engineer`)** checks `schema-fingerprint.ts` parity (tables, indexes, constraints, RLS, grants, extensions, sequences), `fencing.ts` leases, and DR restore scripts.
3. **`Security Architect` (`hisabche-security-architect`)** verifies `REVOKE ALL` from `PUBLIC, anon, authenticated` and pinned `SET search_path = public, pg_temp`.
4. **`Evidence Collector` (`hisabche-evidence-collector`)** checks `VERIFY-*.sql`, `*.pg.test.ts`, and `docs/MIGRATIONS-PENDING.md` (marking unexecuted SQL strictly `PENDING_HUMAN_CONFIRMATION`).

## Required Outputs

- Additive migration & `VERIFY-*.sql` checklist (zero live DB DDL executed by agents)
- Idempotency (`twice-run`) test coverage status (`*.pg.test.ts`)
- Partition/FK/trigger invariant proof table
