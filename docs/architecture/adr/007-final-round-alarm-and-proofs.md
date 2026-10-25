# ADR-007 — Closing the last unproven items: alarm, cross-runtime corpus, pg proof, shadow coverage, load numbers, `unproven` bookkeeping

## Status

Accepted. Final round of the Local-First Core work.

## Context

Three review rounds had left a specific set of items **built but unproven**. This
ADR records the decisions taken to close them, and — where an item could not be
closed on this machine — the exact reason, stated rather than dressed up.

The standing rule for this round: **only the project's own vitest/jest counts as
green.** Every claim below names the command that produced it.

---

## A. Divergence alarm — built

### The gap

`core_divergence` was being written by the payment shadow check and read by
**nobody**. «Zero divergence» therefore meant «nobody looked». The previous
`MEASUREMENTS.md` listed four alerts as though they existed; none did.

### Decision 1 — the decision is a PURE rule in the core

`packages/validation/src/schemas/divergence-alarm.ts`:
`evaluateDivergenceWindow`, `summarizeDivergenceAlarms`, `isDivergenceAlarmEnabled`.

**Why not an `if` in the worker:** «how much disagreement is normal» is a business
rule that a dashboard, a migration script and a support query will each want to
restate differently. Two thresholds that disagree is how a system reports «all
clear» while the table fills.

### Decision 2 — OFF is a state, not a zero

`DEFAULT_DIVERGENCE_THRESHOLD = { percent: null, minOpportunities: 20 }`.

`null` means off. A `0` threshold is legal and means «any divergence at all».
This repo has already been bitten by «off at threshold zero» meaning «on» —
`if (score < minScore)` with `minScore: 0` is never true, so a feature switched
off at zero alarmed on everything. `isDivergenceAlarmEnabled` answers the separate
question, and a test asserts that an all-diverged window records nothing while the
alarm is off **and still reports its rate**.

### Decision 3 — the boundary is strictly greater

A threshold of 5 % does not fire at exactly 5 %. Same rule the repo uses for
supplier risk and discount limits. A boundary that fires on its own value is a
boundary nobody can reason about.

### Decision 4 — a window too small cannot be judged

`minOpportunities: 20`. One divergence out of two comparisons is 50 %, and fires
on every quiet morning. Below the minimum the window is **reported**, not judged.

### Decision 5 — one job authority, one notification system

The pass runs through `runScheduledOnce('divergence-alarm', slotOf(3600s))` on the
existing scheduler — the same claim-the-slot mechanism as trial-expiration,
depreciation and automation. No new queue, no new scheduler
(`job-authority-guard.test.ts` still green). Notifications go through the existing
`NotificationService.create` to the workspace's **owners** only; a member who
cannot act on it has no use for it and would learn to ignore it.

### Decision 6 — per tenant, because the threshold is per tenant

The first implementation judged globally with the shipped default (which is OFF)
and then re-judged per workspace — so the global pass always concluded «nothing
fired». Its own test caught that. Now each workspace's divergences are judged
against **that workspace's** threshold, and `judged[]` is one entry per
(workspace, capability).

### Decision 7 — the migration adds a column, not a table

`docs/divergence-alarm-migration.sql` adds
`workspaces.divergence_alarm_percent numeric(5,2)` with a `CHECK (NULL OR 0..100)`
and an index for the window read. A `divergence_settings` table would be a second
home for workspace configuration, needing its own RLS policy and backfill, for one
nullable number. **No new RLS policy is needed** because the column lives on
`workspaces`, already governed by the membership chain — adding a policy there
would be a second rule over the same rows.

### Decision 8 — read failures are reported, not smoothed

The service returns `{ windows, errors }`. A failed read is never an empty window:
«no divergences» and «the query broke» must not look the same.

### ⚠️ A real guard caught a real bug

`no-silent-row-cap.test.ts` rejected `.limit(2000)` in the worker. PostgREST
truncates at `max-rows` (1000) **without an error**, so the first version would
have under-reported which workspaces diverge — on exactly the day it mattered.
Both reads now page through `selectAllPages`. This is the class of defect the
guard exists for, and it was found by running the suite rather than by review.

---

## B. Golden vectors on Electron and React Native — built and green

`apps/desktop/src/__tests__/golden-vectors.test.ts` and
`apps/mobile/src/__tests__/golden-vectors.test.ts` import the **same runner** by
path (`packages/validation/src/__golden__/run-vectors.ts`) and read the **one**
corpus. No second copy of `vectors.json` exists.

The runner is imported by path, not from the barrel, because the barrel
deliberately does not export it: exporting it created the import cycle fixed in
ADR-006.

| Runtime                  | Command                       | Result                                         |
| :----------------------- | :---------------------------- | :--------------------------------------------- |
| desktop (jest, jsdom)    | `cd apps/desktop && npx jest` | **266/266**, 28 suites (16 of them the corpus) |
| mobile (jest, jest-expo) | `cd apps/mobile && npx jest`  | **198/198**, 15 suites (16 of them the corpus) |

`apps/desktop/jest.config.js` needed `src` added to `roots`; mobile's `roots`
already covered `src`, and both `transformIgnorePatterns` already handled
`@hisabche`/`@noble`.

**What this proves:** the core computes byte-identical results under both module
systems. **What it does not:** the packaged `.exe` and `.apk` were not run.

---

## C. Postgres proof — the script works; the _environment_ is still blocked

### What was actually wrong, in three layers

1. `initdb: could not change permissions of directory %TEMP%\…` — proven
   **pre-existing and environmental**: the untouched `data-snapshots.pg.test.ts`
   fails identically.
2. `could not create shared memory segment: error code 1314` — this sandbox does
   not permit the segment Postgres needs. No test-side change can fix it.
3. A failed `beforeAll` used to hang `afterAll` for 60 s («Hook timed out»),
   burying the real error. Teardown is now bounded.

### What was built

- `helpers/pg-temp-dir.ts` — prefers a repo-owned `.pgtest/` directory (git
  ignored), so `initdb` can chmod what it created.
- The pg test now accepts **`HISABCHE_PG_URL`** and skips the embedded server
  entirely when given, so the same assertions can run against any real Postgres.
- `scripts/verify-core-divergence-pg.mjs` — **one command**, prints PASS/FAIL per
  check, exits non-zero on failure, refuses to run on a database that already has
  `core_divergence` unless `--force`.

### Proof it works

Run against a real Postgres 18.4 started on this machine:

```
node scripts/verify-core-divergence-pg.mjs "postgres://…/verify" --force
checks=16 passed=16 failed=0
```

including «migration run 2 — idempotent», «policy uses the membership chain», «a
SUSPENDED membership grants nothing», «a member cannot write into another
workspace», «anon cannot read at all».

And the **vitest** file itself, pointed at a real database:

```
HISABCHE_PG_URL=… pnpm exec vitest run --project pg src/__tests__/core-divergence.pg.test.ts
Tests  8 passed (8)
```

### Three real defects the script surfaced by being run

- `postgres.js` refuses multi-statement `unsafe` on a pool — needs `max: 1`.
- With `max: 1`, a reserved connection that is never released deadlocks the next
  call (the first version of the script hung).
- `SET LOCAL` outside a transaction is discarded, so a role check silently ran as
  superuser and «passed» by reading everything. Each check now runs inside an
  explicit `BEGIN … ROLLBACK` on a reserved connection, released in `finally`.

**Status: `IMPLEMENTED_NOT_LIVE_VERIFIED` in the default embedded mode on this
machine** — the remaining blocker is the shared-memory restriction. Against a real
Postgres the same assertions are green, which is the acceptance evidence.

---

## D. Shadow coverage — one path wired, eight excluded with a code-level reason

Full table in `CORE-READINESS.md`. Summary:

| Path                            | Status                                 | Why                                                                                                                                   |
| :------------------------------ | :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/payments`            | **WIRED**                              | Rule shared, two readers; wrong posting records one row; kill switch tested                                                           |
| Payment allocation              | **covered indirectly**                 | `paymentPosting` consumes the allocations, so `party`/`difference` move with them                                                     |
| `POST /api/invoices`            | out of scope **by design**             | `InvoiceService.create` already calls `computeInvoiceMoney` and stores its answer — a shadow check would compare the core with itself |
| Invoice cancel / payment cancel | out of scope                           | A reversal, not a derivation; arithmetic is golden vector LEDG-003, atomicity is the Postgres function                                |
| Stock consumption (FIFO/AVCO)   | out of scope — **best next candidate** | Shared and two-reader, but server and engine derive at different moments                                                              |
| Period lock                     | out of scope                           | A refusal; both sides read the same lock table                                                                                        |
| Payroll                         | out of scope — candidate               | Shared and two-reader; needs the same «same facts» moment                                                                             |
| Installment plan, late fee      | out of scope                           | One reader on the money path                                                                                                          |

**The honest reason costing and payroll are not wired:** each needs a defined
«same facts» moment between the server and the engine. Guessing it would flag
every backdated sale as a divergence — noise that makes the alarm worthless. That
is a design task for its own ADR, not something to wire quietly at the end.

---

## E. Load measurement — real HTTP, persistence NOT measured

`scripts/measure/http-load.mjs` builds the real Fastify server and drives it twice
in one process: **baseline** (shadow off, the shipped default) and **shadow on**.
Real socket, `GET /api/health`, 2,000 requests, concurrency 10:

| Run       | req/user-hour |     p50 |     p95 |      p99 |
| :-------- | ------------: | ------: | ------: | -------: |
| baseline  |     7,627,932 | 4.28 ms | 8.33 ms | 10.33 ms |
| shadow on |     8,925,317 | 3.66 ms | 7.94 ms | 14.64 ms |

**p95 delta −0.39 ms — no measurable cost.** The sign is noise, which is the
honest reading.

**Explicitly NOT measured:** anything involving the database (no credentials on
this machine), DB queries per operation, rows per operation, sync payload bytes,
mobile battery. The prompt's six-number table is therefore partially filled, and
`MEASUREMENTS.md` says which cells are empty and why.

One more honesty fix: the script's argument parser ignored `--mode=http` (it
looked for the value in the _next_ token), so the first run reported
`mode=inject` while being labelled http. Fixed; both modes now print the mode they
actually used.

---

## F. `unproven` — 235 → 227, only with per-handler evidence

Three corrections, each driven by reading the handler rather than the feature name:

1. **`team.*` (8 rows)** were `unproven`. Every one of those handlers reads or
   writes `workspace_members` — the table every device's membership answer is
   derived from — so the honest reason is `cross-device`. Email was the wrong
   reason for the group: `POST /workspaces/:x/leave` sends nobody anything.
2. **The `sms-email` rule was matching the wrong thing.** It fired on
   `const resend = … new Resend(key)` — proof only that a provider is
   _configured_ — and then on `emailService.getUserLanguage(...)`, a preference
   read. It now requires an actual `emailService.send*` call.
3. **The `webhook-delivery` rule was domain-wide** (fixed in ADR-006 §6): scoping
   it per endpoint moved 30 developer rows to `unproven` and kept the 10 that
   genuinely deliver.

Evidence now distinguishes `reason@file:line` (**scoped** — the file the
endpoint's own handler reaches) from `reason~file:line` (**domain-wide only**), and
a test requires the majority to be scoped.

**Distribution now:** `none` 160 · `unproven` **227** · `file-storage` 23 ·
`ai-provider` 15 · `subscription-billing` 14 · `webhook-delivery` 10 ·
`cross-device` 8 · `auth` 5. Total 462.

**No target number was chased.** 227 is what the code supports; inventing reasons
for the rest is the failure mode this column exists to prevent.

---

## Consequences

- The alarm exists, is pure at its decision point, is OFF by default, and needs a
  per-workspace threshold before it notifies anyone.
- The corpus now runs on five runtimes with one runner and one file.
- The pg migration is one command away from verification on any real Postgres.
- The shadow table states plainly that one path is wired and why eight are not.
- `MEASUREMENTS.md` has real numbers for the server request path and says
  «NOT MEASURED» for everything touching the database.
