# Hisabche capacity lab

A **local-only** laboratory that answers one question with measurements instead
of opinions:

> Does this architecture support ~1,000 users and ~1,000,000 invoices — and if
> not, exactly where does it degrade, saturate and fail?

Nothing this lab does can touch a remote system. The rule, the evidence for it
and the list of things it will never do live in
[`SAFETY.md`](SAFETY.md) — read that first.

**Current status: M1 complete → [`status/M1.md`](status/M1.md), plus the
same-day addendum there (§8): the first real defect the rebuild exposed is
fixed, applied and verified on the lab, and the owner's production schema dump
is now compared mechanically (`scripts/parity/`). M2 (seed & integrity) is
next.** The milestone plan is below; each milestone writes its own `status/MX.md`
and the lab stops being trustworthy the moment a number appears without its
command.

---

## What is running right now

|                      |                                                                                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Engine               | PostgreSQL **17.10** (x86_64-windows), started from the repo's own embedded distribution (`embedded-postgres@17.10.0-beta.17`, a backend devDependency)                                                                                                                        |
| Address              | `127.0.0.1:55432`, database `hisabche_lab` — loopback only, TLS on (self-signed localhost certificate)                                                                                                                                                                         |
| Data directory       | `C:\Users\hamed\AppData\Local\Temp\opencode\hisabche-capacity-lab`                                                                                                                                                                                                             |
| Schema               | **rebuilt by the repository's own migration runner**: 278 files in the canonical queue at the current head, all accounted for — 222 already-applied + 55 skipped with recorded reasons + the same-day defaults fix and its read-only VERIFY (see `status/M1.md` §8), 0 pending |
| Size after bootstrap | 24 MB, 240 tables (**all 240 with RLS enabled**), 155 public + 3 private functions, 171 policies, 789 indexes, 54 triggers                                                                                                                                                     |
| Server settings      | `shared_buffers=1GB`, `max_connections=400`, `wal_level=logical`, `track_functions=all`, `track_io_timing=on`, `pg_stat_statements` (preload + extension), `log_min_duration_statement=2000`                                                                                   |
| Host                 | 16 logical CPUs, 39.8 GB RAM, 356.1 GB free disk, Node v22.22.0 (matches `render.yaml`)                                                                                                                                                                                        |

The bootstrap was not a straight line, and the deviations are themselves
findings for the owner — the classes, the counts and the exact files are in
[`status/M1.md`](status/M1.md). The short version:

- **55 files were skipped** — 48 `VERIFY-*`, 5 `FINDING-*`, `DUMP-STRUCTURE-ONLY.sql`
  and `WIPE-ALL-BUSINESS-DATA.sql`. Every one carries **no schema** (a guard
  refuses to skip a file that could change the schema), and each is recorded in
  `schema_migrations` with the error that stopped it and the reason it is safe
  to skip.
- **8 files were applied out of alphabetical order** — 4 because the migration
  itself declares its prerequisite (`Run docs/X first`), 1 because exactly one
  file creates the table it needs, 2 (the phase-L pair) after the patch that
  needs them, and 1 deferred `linter-*` maintenance file applied last.
- **1 ordering repair**: `products_stock_webhook_trg` had to be dropped for
  `phase-c-01`'s `ALTER COLUMN products.quantity TYPE numeric` and recreated
  afterwards from its own file. Recorded in
  [`raw/M1-ordering-repairs.json`](raw/M1-ordering-repairs.json).
- **The first real defect the rebuild exposed — found, fixed, proven**: on a
  fresh database 29 nullable timestamps defaulted to `now()`, so an owner was
  born «suspended», every invoice born «finalized», every account and journal
  entry born «deleted». `docs/semantic-null-defaults-migration.sql` removes
  them (VERIFY 31/31 `ok: true` on the lab; real-Postgres test 5/5). The
  production schema dump is stored at
  [`raw/production-schema-dump.sql`](raw/production-schema-dump.sql) and
  [`scripts/parity/`](scripts/parity/) diffs production against the lab
  mechanically — 1,263 shared columns: 0 nullability and 0 default-text
  mismatches; 136 default-presence differences, each classified in
  [`status/M1.md`](status/M1.md) §8.5.

## What the lab can and cannot represent

Full table with reasons: [`PARITY.md`](PARITY.md). In one paragraph: the lab
exercises the **real database engine, the real schema (built from the same bytes
the owner runs), the real RPCs (`invoice_write_document`, `inventory_*`,
`pos_record_order`, …), real triggers, real constraints, real RLS policies**.
It cannot exercise anything that needs HTTP services that do not exist on this
machine — supabase-js → PostgREST/GoTrue, the Fastify process, the project's own
websocket sync endpoint, Storage — because this machine has no Docker/WSL and
the backend has no direct-database path. Those layers are labelled
**NOT TESTABLE (local)** wherever results are reported; they are never
approximated, mocked or faked.

## Milestones (plan of record)

| #   | Milestone             | Exit criterion                                                                                                                                                                  | Status                    |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| M1  | Lab bring-up & parity | Lab Postgres running; canonical schema rebuilt with every queue file accounted for; `README/PARITY/TOOLING/SLO/AUTH/CI-MATRIX/FINANCIAL-INVARIANTS` written from measured facts | **done — `status/M1.md`** |
| M2  | Seed & integrity      | Profiles SMALL→TARGET seeded with the real write paths where feasible; RLS/tenancy probes pass; financial invariants hold on seeded data                                        | next                      |
| M3  | Baseline & load curve | Hot paths (`invoice_write_document`, list/read queries, sync poll) measured single-workspace with pg_stat_statements evidence                                                   |                           |
| M4  | Scale to TARGET       | 1M invoices / 350 workspaces: latency at scale, storage growth, plan changes, vacuum/analyze behaviour                                                                          |                           |
| M5  | Concurrency curve     | Safe concurrency under the SLOs; first bottleneck named with evidence (locks, connections, IO, CPU)                                                                             |                           |
| M6  | Realtime & jobs       | `claim_*` workers, sync queues and background job tables measured under load                                                                                                    |                           |
| M7  | Stress & headroom     | Kill/restart recovery, WAL/checkpoint behaviour; headroom verdict at 1,000 users                                                                                                |                           |
| M8  | Synthesis             | The final report: capacity verdict per SLO band, bottleneck, recommendations                                                                                                    |                           |

## How to run it

```bash
# lifecycle (lab Postgres)
node performance/scripts/db/lab-db.mjs start      # start (or say "already running")
node performance/scripts/db/lab-db.mjs status     # pid, version, size, settings
node performance/scripts/db/lab-db.mjs stop       # CHECKPOINT then hard stop
node performance/scripts/db/lab-db.mjs sql "SELECT 1"
node performance/scripts/db/lab-db.mjs sql-file some-file.sql

# the repository's migration runner, pointed at the lab (dry run by default)
node performance/scripts/db/apply-migrations.mjs
node performance/scripts/db/apply-migrations.mjs --apply
node performance/scripts/db/apply-migrations.mjs --apply --only <file.sql>
```

Every script refuses any host that is not loopback (`assertLocal()` in
`scripts/lib/lab-config.mjs`) and the migration wrapper always sets
`DATABASE_URL` to the lab before spawning the repo runner — the runner's
`.env.migrate` fallback can never fire (proof in `SAFETY.md`, §“Why the remote
Supabase cannot leak into the lab”).

## Directory map

```
performance/
  README.md            ← you are here
  SAFETY.md            the local-only contract, with evidence
  PARITY.md            layer-by-layer: production vs lab, representative or not
  TOOLING.md           every script, its contract, and the traps this machine taught us
  SLO.md               the thresholds capacity is judged against (fixed before measuring)
  AUTH.md              how auth/RLS is exercised at the database layer, and what is not
  CI-MATRIX.md         what the existing test suites cover vs what the lab covers
  FINANCIAL-INVARIANTS.md  what must hold at any load, and how the lab checks it
  config/lab.json      ports, paths, profiles, resource guards
  scripts/lib/         assertLocal(), config loading, dependency resolution
  scripts/db/          server lifecycle, migration wrappers, bootstrap tooling
  scripts/parity/      production-vs-lab mechanical diff (raw/ dump as input)
  raw/                 logs and machine-readable evidence (per milestone)
  reports/             human-readable results (per milestone)
  status/M1.md         what M1 measured, what deviated, what comes next
```

## Evidence rules

1. A number without the command that printed it is not a number — every report
   quotes both.
2. A failed read is never an empty state, and an unknown is never a zero.
3. The load generator saturating before the system under test is reported as
   `LOAD_GENERATOR_SATURATED`, never as capacity.
4. Correctness (SLO bands in `SLO.md`, invariants in `FINANCIAL-INVARIANTS.md`)
   outranks any latency figure: a fast database with a broken invariant is a
   failure, not a result.
