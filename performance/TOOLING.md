# TOOLING — every lab script, its contract, and the traps this machine taught us

Everything below was used to build M1; the commands in
[`status/M1.md`](status/M1.md) are the ones that were actually run. Scripts live
under `performance/scripts/` and import their configuration from
`performance/config/lab.json` through `scripts/lib/lab-config.mjs`, whose
`assertLocal()` refuses any host that is not loopback — there is no flag or env
var that lifts that check.

## Server lifecycle — `scripts/db/lab-db.mjs`

| Command              | Contract                                                                                                                                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `init`               | `initdb` from the repo's own embedded PostgreSQL distribution; generates a self-signed TLS certificate (CN/SAN `localhost`, `127.0.0.1`) with Git's OpenSSL; appends the lab block to `postgresql.conf` (port, TLS, `pg_stat_statements` preload, `max_connections=400`, `wal_level=logical`, plan/function/IO tracking) |
| `start`              | Spawns `postgres.exe` **detached** (see trap 1), waits for readiness by probing the **maintenance** database (trap 4), creates `hisabche_lab` on first start. Refuses to spawn a binary whose major version differs from the data directory's `PG_VERSION` (trap 2).                                                     |
| `stop`               | `CHECKPOINT`, then `taskkill /PID <postmaster.pid> /T /F`, then waits until the port stops answering — the same shape as the repository's own embedded-postgres hard stop, with the checkpoint added so restart costs nothing.                                                                                           |
| `status`             | pid, `SELECT version()`, database size, connection count, table count; prints `shared_preload_libraries` and `ssl` from the running server.                                                                                                                                                                              |
| `sql "<statements>"` | Runs one or more statements (simple protocol) as `postgres`; prints JSON.                                                                                                                                                                                                                                                |
| `sql-file <path>`    | Same, for a file; prints the statement count and elapsed ms.                                                                                                                                                                                                                                                             |

## The repository's migration runner, lab-pointed — `scripts/db/apply-migrations.mjs`

- **Dry run by default**; `--apply` applies. Any extra argument is forwarded to
  `scripts/run-migrations.mjs` verbatim — that is how `--only <file>` is used.
- Always sets `DATABASE_URL` to the loopback lab before spawning the runner.
  The runner _would_ fall back to `.env.migrate`; `scripts/lib/load-env.mjs`
  skips keys already present in the environment (`if (process.env[key]) continue`),
  so the file value can never override the lab's — proof in `SAFETY.md`.
- Prints `target: 127.0.0.1:55432/hisabche_lab (loopback ✓)` on every run.

## Bootstrap drivers (all read-only except where noted)

| Script                                          | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/db/classify-docs.mjs`                  | Census of the queue: for each non-underscore `docs/*.sql` — has DDL? has DML? applied? Writes `raw/M1-docs-classification.json`. Read-only.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `scripts/db/mark-skipped.mjs`                   | Records one file as SKIPPED with the runner's **exact checksum** (so the queue reports `skip (already applied)` from then on) plus the reason, in `schema_migrations.applied_by`. **Refuses any file that contains DDL** — a skip must never change what the canonical rebuild produces.                                                                                                                                                                                                                                                                                                       |
| `scripts/db/defer-migration.mjs defer\|undefer` | Same recording for the maintenance class of file that has to run **last** (objects it alters are created by later-sorted files). `undefer` removes the record so `apply-migrations --apply --only <file>` really runs it.                                                                                                                                                                                                                                                                                                                                                                      |
| `scripts/db/apply-until-schema-blocker.mjs`     | The bootstrap driver used for M1. On each failure, in order: (1) the migration declares a prerequisite (`Run docs/X first`) → apply X alone; (2) `relation X does not exist` and exactly **one** docs file creates X → apply the creator alone; (3) the failing file is a pure diagnostic — after stripping comments, string literals and dollar-quoted bodies it contains no `create/alter/drop/grant/revoke/truncate/insert/update/delete/copy/execute/call/vacuum/reindex/cluster/into` and no `DO` block — → record SKIPPED with the error; (4) anything else → **stop dead** for a human. |
| `scripts/db/bootstrap-shims.sql`                | The Supabase platform surface the migrations assume (see `AUTH.md`): roles `anon`/`authenticated`/`service_role`; the `auth` schema with Supabase's own `auth.uid()`/`auth.jwt()`/`auth.role()`; `auth.users` as an FK target; `storage.buckets`/`storage.objects`; the empty `supabase_realtime` publication; and Supabase's default grants at table birth (ALL to the three roles) so the migrations' `REVOKE`s mean here what they mean in production. It also seeds the one account `CREATE-MY-WORKSPACE.sql` refuses to run without — the reason is recorded in `status/M1.md`.           |

## Production-vs-lab diff — `scripts/parity/prod-vs-lab-defaults.mjs`

Parses `raw/production-schema-dump.sql` (the owner's production snapshot,
2026-10-17 — stored verbatim, **never executed**) and compares it against the
running lab's `information_schema`: nullability and column defaults, per column,
on every shared table. Writes `raw/M2-prod-vs-lab-defaults.json` and exits
non-zero when a claim in `docs/semantic-null-defaults-migration.sql` breaks (a
fixed column that still defaults on either side, or any nullable timestamp still
defaulting to `now()` in the lab). Read-only against the lab — it connects
through the same `assertLocal()` guard as every other script.

## Evidence conventions

- Full runner output per round: `raw/M1-bootstrap-<timestamp>.log`
- Machine-readable skip list: `raw/M1-bootstrap-skips.json`; the **authoritative**
  record is always `schema_migrations` itself (`raw/M1-db-skips-from-schema-migrations.json`
  is a dump of the rows the lab wrote).
- Queue census: `raw/M1-docs-classification.json`
- Ordering repairs: `raw/M1-ordering-repairs.json`

## Traps — all measured on this machine

1. **`pg_ctl` is unusable here.** The embedded distribution ships `initdb`,
   `pg_ctl` and `postgres` — but not `pg_controldata`, so `pg_ctl start` reads
   the control file wrongly and fails with `control file appears to be
corrupt`. `lab-db.mjs` therefore starts `postgres.exe` itself (detached) and
   stops it with `CHECKPOINT` + `taskkill`.
2. **A stray global `node_modules` one level above the repo** —
   `C:\Users\hamed\node_modules\@embedded-postgres\windows-x64` (version 18.4) —
   hijacked platform-binary resolution, because pnpm's strict layout has no
   `backend/node_modules/@embedded-postgres` to find first. The symptom was
   `FATAL: database files are incompatible with server … initialized by
PostgreSQL version 17, which is not compatible with this version 18.4`.
   Fix: resolve the platform package **from `embedded-postgres` itself**
   (exactly as its own `binary.js` does) and refuse to spawn a binary whose
   major version differs from the data directory's (`assertServerMatchesCluster`).
3. **PowerShell pipe truncation kills the writer.** `node … | Select-Object
-First N` closes the pipe and node exits 1 with `EPIPE` — an artifact, not a
   failure. Tee to a file instead and read the tail.
4. **Readiness must probe the maintenance database.** The lab database does not
   exist until after the server starts; probing it reads as “server down”.
5. **Never recurse the whole repository with `Get-ChildItem`** — it hung the
   shell once. Scope every search to a package directory.
6. **The runner's extras order is alphabetical.** Uppercase `VERIFY-*`/
   `FINDING-*` files sort before every lowercase `*-migration.sql`, so a fresh
   database fails 48 VERIFY files at their queue position (they verify objects
   whose migration has not run yet). This is structural, documented with counts
   in `status/M1.md`, and not worked around — those files are recorded SKIPPED
   with the error that stopped each one.
