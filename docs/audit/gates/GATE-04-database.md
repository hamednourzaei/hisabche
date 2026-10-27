# GATE-04 — Database verification

Status: **BLOCKED_EXTERNAL** (repository-local verification exhausted; live execution impossible on this machine)

## 1. What can be verified without a running database

| Source                                                                        | Count                                                            | What was done                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SQL files in `docs/`                                                          | 330 (185 named `*-migration.sql`, plus FINDING/VERIFY/FIX/SETUP) | parsed for `CREATE TABLE/VIEW/FUNCTION`: 286 tables, 303 table-or-view names, 166 functions (`scripts/audit/inventory.mjs`, `table-names.mjs`)                                                                                                                               |
| Every `.from('x')` and `.rpc('x')` in `backend/src`                           | all                                                              | checked against the parsed names: the only undefined table in changed code is `invoice_lines` (real table: `invoice_items`) — N-17; other misses are `users` (auth schema), `license_devices`, and a metrics noise token                                                     |
| Columns written by the new backend services vs `universal-core-migration.sql` | 8 services                                                       | `scripts/audit/column-check.mjs`; no real mismatch (the flagged `vehicle_attributes.*` hits were a heuristic artefact: those columns belong to `stock_serials`, which has them)                                                                                              |
| Foreign keys behind PostgREST embeds                                          | 3 embeds in new code                                             | no FK declared in the new migration → N-24                                                                                                                                                                                                                                   |
| Local SQLite schema (offline)                                                 | version 9                                                        | `packages/app-bridge/src/local-schema.ts`; tests `migration-v8.test.ts`, `migration-v9.test.ts` pass                                                                                                                                                                         |
| Generated types                                                               | none for the server schema                                       | `packages/db-schema/src/drizzle.schema.ts` defines 8 tables for the offline bridge only (imported by `app-bridge/src/local-schema.ts`); no generated Supabase types exist, so TypeScript does not guard server column or table names — which is how `invoice_lines` compiled |

## 2. The 81 Postgres tests

`generated/pg-tests.json`: **81 files, 724 test cases, none drives HTTP** (they apply SQL and call SQL functions through the `postgres` client). They name 87 of the 185 migration files; 98 migrations are not named by any Postgres test, including the three new ones (`deferral-schedules`, `expense-claims`, `landed-costs`) and older ones such as `payments-ar-ap`, `multi-warehouse`, `hardening`. (A migration may still be exercised through a bundle; naming is a lower bound.)

What they would verify when run: each migration applies twice (idempotency), SQL functions behave (stock transfer keyed, ledger posting, cost layers/AVCO, shelf capacity, warehouse map, custom units, product barcodes, till payments, base currency), RLS/privilege setup (`ALTER DEFAULT PRIVILEGES … GRANT ALL` per CLAUDE).

`universal-core-migration.pg.test.ts` applies the migration twice and runs `VERIFY-universal-core.sql`, but asserts only `toBeDefined()`; it cannot detect N-24.

## 3. Why none could run — measured, not assumed

1. Command: `scripts/audit/pg-probe.mjs` (uses the repository's `embedded-postgres`, data directory under `.pgtest/tmp`, `TEMP`/`TMP` pointed at `.pgtest/tmp` as the repository's own lesson prescribes).
2. `initdb` **succeeds** (5.6 s).
3. `pg.start()` **fails**: `FATAL: could not create shared memory segment: error code 1314 — Failed system call was CreateFileMapping(…, name=Global/PostgreSQL:…)`. Windows error 1314 = `ERROR_PRIVILEGE_NOT_HELD`: creating a global file mapping needs the "Create global objects" privilege (`SeCreateGlobalPrivilege`), which this session's token does not hold.
4. The vitest run of `universal-core-migration.pg.test.ts` with the same workaround reproduces it: the `beforeAll` hook fails, then `afterAll` times out after 60 s; 3 tests skipped.
5. Alternatives checked: no Docker, WSL is not installed, no `psql`/`pg_ctl` on PATH.

The earlier note "1314/initdb" is therefore imprecise: initdb works; **starting the server** needs a privilege the session lacks.

What would unblock it (owner action): run the 81 tests from an elevated shell (Administrator), or in CI/Linux, or install Docker/WSL.

## 4. Live database

No access and, by project rule, no DDL from this audit. Nothing about the live Supabase state is claimed: migrations 'applied' per CLAUDE.md are recorded owner-side (`custom-units-01`, `attendance-*`, `dashboard-fx-01` etc. "waiting to execute"; others "executed and VERIFY returned").

## 5. Verdict

`BLOCKED_EXTERNAL` — static verification complete; execution needs a privileged environment.
