# SAFETY — Hisabche capacity lab (LOCAL ONLY)

Written before any lab operation ran. Every claim here has an evidence command
beside it; the numbers are what the commands actually printed on this machine
(2026-10-17).

## The one rule

**Every target this lab touches is on this machine.** There is no flag, no env
var and no code path that lifts this: `performance/scripts/lib/lab-config.mjs`
`assertLocal()` throws for any host outside `127.0.0.1 / localhost / ::1`, and
every lab script funnels its connection string through it.

## Detected targets and what they are

| What                 | Value                                      | Why it is local                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lab PostgreSQL       | `127.0.0.1:55432`, database `hisabche_lab` | Embedded PostgreSQL 17.10 binaries that ship with this repo (`embedded-postgres@17.10.0-beta.17`, a backend devDependency); data directory under `C:\Users\hamed\AppData\Local\Temp\opencode\hisabche-capacity-lab` |
| Backend (Fastify)    | **not started by this lab**                | it has no local database path (every query is supabase-js → PostgREST; see PARITY.md)                                                                                                                               |
| Supabase local stack | **does not exist on this machine**         | `docker` not found; no `supabase/config.toml` in the repo; `supabase start` would need Docker                                                                                                                       |
| Supabase (remote)    | **NEVER CONTACTED**                        | see below                                                                                                                                                                                                           |
| Render / Vercel      | **NEVER CONTACTED**                        | nothing in the lab reads `RENDER_*` or deploys anything                                                                                                                                                             |

Evidence — `netstat -ano | Select-String LISTENING` printed **no** lines for
`5432 / 54321 / 54322 / 3039` before lab work began; `docker --version` →
"not recognized"; `Test-Path supabase` → False; WSL not installed.

## Why the remote Supabase cannot leak into the lab

The owner's normal local setup does point at Supabase (through the local proxy
at `127.0.0.1:10808` — `backend/src/db.ts` lines 68-79). The lab is built to
make that impossible rather than unlikely:

1. **The lab never reads any `.env*` file.** Not `.env.local`, not
   `.env.migrate`, not `.env.production`. (Repo rule; none were opened.)
2. The repository migration runner WOULD load `.env.migrate` if
   `DATABASE_URL` were unset — so `apply-migrations.mjs` always sets it to the
   loopback lab URL first. Verified in `scripts/lib/load-env.mjs`: it skips
   any key already present in `process.env` (`if (process.env[key]) continue`),
   so the file value cannot override the shell's.
3. `assertLocal()` runs in the wrapper before the runner is spawned, and in
   every other lab script before a connection is opened.
4. The lab database has its own password, its own port (55432 — nothing in
   the repo or the machine uses it) and its own data directory. It is not
   reachable by any product code, and product code is not pointed at it.

## What the lab will NEVER do (checked against the mission's forbidden list)

- No production database / Supabase / Render / Vercel: nothing above is ever
  contacted; the only host in any lab command is `127.0.0.1`.
- No production users, invoices or data: every row in the lab is generated.
- No destructive remote calls: there are no remote calls.
- No internet load generators: the generators are Node scripts run on this
  machine against this machine.
- No `.env*` reading, no secrets in code, logs or reports. The lab password is
  a synthetic string in `config/lab.json` that protects nothing (loopback-only,
  `pg_hba` restricts to local connections).

## Resource guards (before seeding)

From `config/lab.json` — the seed aborts (not warns) when exceeded:

- `minFreeDiskGb: 40` — measured free on C: before lab work: **356.1 GB**
- `maxDbSizeGb: 30`, `maxWalGb: 20`, `maxSeedMinutes: 240`
- `maxMemoryPressurePct: 85` — host has 39.8 GB RAM, 16 logical CPUs

## Cleanup

Everything the lab creates lives under
`C:\Users\hamed\AppData\Local\Temp\opencode\hisabche-capacity-lab` plus this
`performance/` directory. `performance/scripts/lab-cleanup.mjs` (to come with
M2) deletes ONLY that temp directory after printing it for confirmation, and
refuses to run against any path outside the temp root.

## Hard stops (mirroring the mission's §43)

Any test stops immediately if: a non-loopback target is seen; RLS or tenancy
is disabled to make a number look better; financial invariants fail; disk or
memory guards trip; the load generator saturates before the system under test
(marked `LOAD_GENERATOR_SATURATED`, never reported as capacity).
