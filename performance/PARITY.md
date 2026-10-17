# PARITY — production stack vs the lab stack, layer by layer

Method: production facts are read from the repository's own files (cited
inline). Lab facts are measured on this machine — the commands are in
[`status/M1.md`](status/M1.md). A fact that is not visible from the repository
is marked **UNKNOWN** and is never assumed equal to the lab. A layer the lab
cannot exercise is marked **NOT TESTABLE (local)** and is never approximated.

The lab's job is to find where the _architecture_ — schema, queries, RPCs,
locks, growth — bends and breaks. It is honest about the one thing it cannot be:
the production HTTP tier's behaviour.

## 1. PostgreSQL engine and schema — REPRESENTATIVE (with one UNKNOWN)

|            |                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production | Supabase-managed Postgres. **Major version: UNKNOWN** — nothing in the repository states it.                                                                                    |
| Lab        | PostgreSQL **17.10** (x86_64-windows), the same distribution the repo's own `*.pg.test.ts` suites already run on (`embedded-postgres@17.10.0-beta.17`, a backend devDependency) |
| Schema     | **Identical bytes.** The lab ran the repository's canonical runner (`scripts/run-migrations.mjs`) over the same `docs/*.sql` queue. Not a reduced schema, not a re-created one. |

What this means:

- DDL/DML behaviour, RPC bodies (`invoice_write_document`, `inventory_*`,
  `pos_record_order`, `payments_cancel`, `claim_*`, …), triggers, constraint
  triggers, check constraints, RLS _evaluation_ and planner behaviour are
  **real** and fully local.
- Extensions: `docs/` contains **no `CREATE EXTENSION` statement** (measured —
  see `status/M1.md`); the lab database therefore shows only `plpgsql` and
  `pg_stat_statements` (added by the lab for profiling, preloaded in
  `postgresql.conf`). If production has more extensions (Supabase defaults
  include others), the schema does not depend on them. **UNKNOWN, and
  deliberately not assumed.**
- Engine version: the schema does not gate on the engine version; the only
  forward-looking construct spotted is `pg_proc.prosqlbody` (PG14+) read by
  `linter-2026-09-14-migration.sql`. The production major version remains an
  UNKNOWN this lab cannot resolve.
- UUID generation: migrations rely on core `gen_random_uuid()` (PG13+), so no
  extension parity question arises.
- **Column-level parity is now mechanical.** The owner's production schema dump
  (2026-10-17) is stored verbatim at
  [`raw/production-schema-dump.sql`](raw/production-schema-dump.sql) — a
  snapshot for comparison, never executed. `scripts/parity/prod-vs-lab-defaults.mjs`
  parses it and diffs it against the lab's `information_schema`
  ([`raw/M2-prod-vs-lab-defaults.json`](raw/M2-prod-vs-lab-defaults.json)):
  **1,263 columns on shared tables — 0 nullability mismatches, 0 default-text
  mismatches**; the 29 columns of the semantic-null-defaults fix carry a default
  on **neither** side now; 136 default-presence differences remain and each is
  classified in [`status/M1.md`](status/M1.md) §8.5 (63 `created_at`/`updated_at`
  = the owner's `module-created-at` direction, production mid-migration; 73
  nullable boolean/numeric columns = the rebuild's documented
  `generate-base-schema` inference, which `restore-defaults-migration.sql`
  deliberately does not add to live). Seeded lab rows always write these
  columns explicitly, so the difference affects only inserts that omit them:
  for the capacity question it is inert, and it is reported, not hidden.

**Not representative, by definition:** hardware and storage IOPS (host: 16
logical CPUs, 39.8 GB RAM, 356.1 GB free — production instance class is
**UNKNOWN** from the repo; `render.yaml` declares only `NODE_VERSION 22.22.0`).
The lab therefore reports two kinds of number:

1. **architecture numbers** (plan shapes, row growth, lock behaviour, invariant
   checks) — valid regardless of hardware;
2. **hardware-bound latency** — valid _for this host_, quoted with the host
   spec, and never presented as "the production latency".

## 2. Connection topology — NOT REPRESENTATIVE

Production: backend → supabase-js → PostgREST → Supabase pooler → Postgres. The
pooler and PostgREST layers are not visible from the repository (no local config
exists) and are not testable on this machine.

Lab: direct TCP to `127.0.0.1:55432`, bounded by the server's
`max_connections=400` (a lab-host choice, see `config/lab.json`).

Consequence: the lab can say "the database at 200 concurrent sessions does X";
it cannot say "PostgREST at 200 in-flight requests does Y". Where the mission
wanted API RPS numbers, the answer is **NOT TESTABLE (local)** — never a
simulated PostgREST.

## 3. Backend (Fastify) — NOT TESTABLE (local)

Every backend query goes through supabase-js to PostgREST — there is no direct
database path to point at a local Postgres (`backend/src/db.ts` routes through
the owner's proxy to the real project; `backend/src/utils/supabase-fetch-metrics.ts`
counts HTTP fetches, not SQL). The lab exercises the RPC/SQL layer _under_ the
backend, with the same statements the backend issues, but not the Node process
itself: event loop, JSON serialization, in-process caches, retry behaviour and
HTTP overhead are outside the lab.

## 4. Auth (GoTrue / JWT issuance) — NOT TESTABLE; claims layer REPRESENTATIVE

Token issuance, expiry and refresh (GoTrue) do not exist locally. What _does_
exist is the exact contract the database consumes: PostgREST sets a request's
role and JWT claims before SQL runs, and every policy reads them through
`auth.uid()` / `auth.jwt()` / `request.jwt.claims`. The lab reproduces that
inside a transaction (`SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = …`)
— see [`AUTH.md`](AUTH.md). RLS policy semantics, helper functions
(`private.auth_workspace_ids()` and friends) and tenancy enforcement are
therefore **real**; token lifecycle is not.

## 5. Realtime / websocket sync — NOT TESTABLE (local)

The project's realtime is its own websocket endpoint (`/api/sync/stream`; its
limits live in the backend: `MAX_STREAM_SOCKETS`, `STREAM_POLL_MS`), served by
the Fastify process — which needs the API layer this machine cannot run.
Supabase Realtime is _not_ part of the product path (the shim creates the empty
`supabase_realtime` publication for schema parity only).

What the lab _can_ and will measure (M6): the database side of sync — the poll
queries, the sync/queue tables, `claim_*` worker functions under concurrent
leases. The websocket fan-out itself is reported **NOT TESTABLE (local)**.

The existing `scripts/sync-loadtest.mjs` needs a deployed API and is therefore
outside this lab; it is listed in [`CI-MATRIX.md`](CI-MATRIX.md).

## 6. Storage — NOT TESTABLE

`storage.buckets` / `storage.objects` exist as a platform shim (FK targets for
the real schema only). There is no S3-compatible endpoint locally, so upload /
download behaviour is out of scope, not approximated.

## 7. Background jobs / schedulers — split

The _database_ half (job tables, `claim_background_jobs`, `claim_event_log`,
`claim_webhook_deliveries`, `claim_email_outbox`, `claim_scheduled_run`) is real
and testable (M6). The worker/scheduler processes are the backend — not runnable
locally.

## 8. Data — generated, with the manifest as the assumption ledger

Every row in the lab is generated by lab scripts against the real schema through
real RPCs where volume allows (decided in M2 on measured throughput, reported
as a ratio — never silently). Profiles come from the task brief:
SMALL 100 users / 40 workspaces / 100k invoices · MEDIUM 500 / 180 / 500k ·
**TARGET 1000 / 350 / 1,000,000** · LARGE 1500 / 500 / 1.5M. The per-tenant
skew (invoices per workspace, items per invoice, 24 months of history, currency
mix AFN+USD) is a documented assumption in `reports/dataset-manifest.json` when
M2 writes it. The real tenants' query mix is **UNKNOWN**; the lab uses a fixed,
reported mix.

## 9. What the lab adds that no existing test covers

The backend's `*.pg.test.ts` suites spin one embedded cluster per capability and
are excellent at _correctness per feature_. None of them: runs the full
canonical queue in one long-lived database, grows it to 10⁶ rows, or profiles
plan/lock behaviour under concurrency. That is this lab's slice — described
against the test suites in [`CI-MATRIX.md`](CI-MATRIX.md).

## Verdict table

| Layer                                                      | Production                                      | Lab                                                                                                                                  | Represents production?                                     |
| ---------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Postgres engine                                            | Supabase-managed (version UNKNOWN)              | 17.10 local, real binaries                                                                                                           | **Yes** for SQL/behaviour; version parity UNKNOWN          |
| Schema                                                     | built from `docs/*.sql` by `run-migrations.mjs` | same runner, same queue, 278/278 accounted · vs the production dump: 1,263 shared columns, 0 nullability / 0 default-text mismatches | **Yes — identical bytes**                                  |
| RPCs / triggers / constraints / policies                   | Postgres-evaluated                              | same engine, same objects                                                                                                            | **Yes**                                                    |
| RLS semantics with real claims                             | PostgREST sets role+claims                      | `SET LOCAL` reproduces the contract                                                                                                  | **Yes**                                                    |
| RLS request plumbing (PostgREST), token lifecycle (GoTrue) | real Supabase services                          | do not exist locally                                                                                                                 | **No — NOT TESTABLE (local)**                              |
| Backend process (Fastify), API RPS                         | Render instance                                 | not runnable (no direct DB path)                                                                                                     | **No — NOT TESTABLE (local)**                              |
| Websocket sync fan-out                                     | `/api/sync/stream`                              | needs the API process                                                                                                                | **No — NOT TESTABLE (local)**; DB-side pollers measurable  |
| Storage                                                    | S3 API                                          | shim tables only                                                                                                                     | **No — NOT TESTABLE (local)**                              |
| Job workers/schedulers                                     | backend processes                               | `claim_*` functions measurable                                                                                                       | half yes, half not                                         |
| Data                                                       | real tenants, UNKNOWN mix                       | generated to profiles, documented assumptions                                                                                        | **Partly — documented, not real**                          |
| Hardware                                                   | instance class UNKNOWN                          | 16 CPU / 39.8 GB / 356 GB free                                                                                                       | **No** — latency is host-bound; architecture findings hold |
