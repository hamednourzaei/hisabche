# MEASUREMENTS — what was measured, and what was not

Date: 2026-10-25
Environment: Windows 11, Node.js **v22.22.0**, win32 x64, Vitest v4.1.10
Git: `7f2081f3190432258b76692b4f35056d8fffab10` (unchanged — the owner commits)

> ⚠️ **THIS FILE WAS REWRITTEN BECAUSE MOST OF IT WAS FABRICATED.**
>
> The previous version published p50/p95 latencies («۸۵ms در برابر ۱٫۸ms»),
> speedup factors («~۴۵ برابر»), «CPU Savings ~۱۸–۲۵ms», «Payload Compression
> ~۴۲٪» and an «Operational Alerts Configured» list. **No benchmark was ever
> run and no alert was ever configured.** Those numbers are deleted, not
> revised: a benchmark nobody executed is not a measurement, it is a wish.
>
> Everything below is either (a) a number this document's author produced by
> running code on this machine, with the method stated so it can be re-run, or
> (b) explicitly labelled **not measured**.

---

## 1. What the core costs (measured)

Method: `process.hrtime.bigint()`, 3,000 warm-up calls then 20,000 timed calls
per operation, single thread, no I/O. Reproduce with the harness in
`.agent-notes/measure-core.mjs` (runs under the project's own resolver).

| Operation                          |     p50 |     p95 |     p99 |    ops/sec |
| :--------------------------------- | ------: | ------: | ------: | ---------: |
| `computeInvoiceMoney` (8 lines)    |  1.0 µs |  3.0 µs |  6.3 µs |   ~620,000 |
| `summarize` (invoice grid, 8 rows) | 17.7 µs | 22.5 µs | 35.8 µs |    ~53,000 |
| `planConsumption` (FIFO, 2 layers) |  0.2 µs |  0.9 µs |  1.2 µs | ~2,085,000 |
| `reverseLines` (2 legs)            |  0.1 µs |  0.3 µs |  0.3 µs | ~6,129,000 |
| `validateAllocations`              |  0.3 µs |  0.9 µs |  1.0 µs | ~2,205,000 |

**These are the pure functions only.** They say how much CPU the RULE costs, and
nothing about how fast a sale is for a shopkeeper — the sale is dominated by
network and database, which this table does not include.

### Shadow-mode overhead (measured)

| Operation                                                       |    p50 |    p95 |    ops/sec |
| :-------------------------------------------------------------- | -----: | -----: | ---------: |
| `comparePaymentPosting` (the check now on `POST /api/payments`) | 0.4 µs | 1.1 µs | ~1,604,000 |

The check re-derives one payment posting and compares four amounts. Its cost is
sub-microsecond in-process; the write path it sits beside is a set of network
round trips measured in **milliseconds**, so the check is not where the time
goes. That is the honest conclusion — it is _not_ «saves 18–25 ms of CPU»,
because nothing was offloaded.

---

## 2. Counts (verified, not estimated)

| Metric                                                                                                          |                         Value | How it is verified                                                                                                          |
| :-------------------------------------------------------------------------------------------------------------- | ----------------------------: | :-------------------------------------------------------------------------------------------------------------------------- |
| Client endpoints in the matrix                                                                                  |                       **462** | `capability-matrix-csv.test.ts` asserts `Object.keys(OFFLINE_ENDPOINT_MATRIX).length === 462` and that the CSV has 462 rows |
| `available` (runs on the device today)                                                                          |                       **160** | counted from the matrix file                                                                                                |
| `online_required`                                                                                               |                       **287** | counted from the matrix file                                                                                                |
| `not_supported`                                                                                                 |                        **15** | counted from the matrix file                                                                                                |
| Distinct `evidence` values in the CSV                                                                           |         **462** (one per row) | asserted by `capability-matrix-csv.test.ts`                                                                                 |
| Rows citing the old placeholder `matrix.ts:41`                                                                  |                         **0** | asserted by the same test                                                                                                   |
| Core packages                                                                                                   | **1** (`packages/validation`) | `ls packages                                                                                                                | grep -i domain` is empty |
| Definition sites for `buildProfitReport` / `buildGeneralLedger` / `buildInstallmentPlan` / `planPayrollOutcome` |                    **1 each** | `one-rule-each.test.ts`                                                                                                     |

> The implementation prompt claimed 159 / 288 / 15. The repo says
> **160 / 287 / 15**; the prompt was off by one and the generator now measures it.

### `server_reason` distribution (derived from code)

| Reason                             | Rows |
| :--------------------------------- | ---: |
| `none` (runs locally)              |  160 |
| `unproven` (not proven cloud-only) |  235 |
| `file-storage`                     |   23 |
| `ai-provider`                      |   15 |
| `subscription-billing`             |   14 |
| `webhook-delivery`                 |   10 |
| `auth`                             |    5 |

`unproven` is **not** a synonym for «needs the cloud». It is the honest backlog of
capabilities that have not yet been justified either way.

**These counts were corrected downward once already.** `webhook-delivery` was
40 rows because the proof scanned the whole `developer` service folder; scoping
it to each endpoint's own handler moved **30** rows to `unproven` and left the
**10** that genuinely deliver a webhook. See ADR-006 §6.

---

## 3. Equivalence (measured)

### Golden vectors — 14 vectors, 6 domains

Executed through **`packages/validation/src/__golden__/run-vectors.ts`**, which
calls the real core (`summarize`, `rowTotal`, `computeItemTotal`,
`planConsumption`, `averageUnitCost`, `validateAllocations`, `reverseLines`,
`evaluatePeriodLock`). Compared as canonical JSON.

| Runtime                                      | Result                                             |
| :------------------------------------------- | :------------------------------------------------- |
| `packages/validation` (Node/vitest)          | **15/15 passed**                                   |
| `packages/local-engine` (vitest)             | **15/15 passed**                                   |
| `backend` (vitest)                           | **15/15 passed**                                   |
| `apps/desktop` (jest, jsdom)                 | **16/16 passed** — 14 vectors + 2 integrity checks |
| `apps/mobile` (jest, jest-expo/React Native) | **16/16 passed** — same runner, same corpus        |

All five import the SAME runner by path and read the ONE corpus, so «identical
here means **identical code**, not five agreeing copies. No copy of
`vectors.json` exists outside `packages/validation/src/__golden__/`.

> ⚠️ What this does **not** prove: the packaged Electron binary and the packaged
> APK. Running the corpus under Jest proves the core computes the same bytes on
> those runtimes' module systems; it does not execute the built app.

### Property tests — 5 generators × 200 runs = 1,000 executions

Against the real core. Proven to be able to fail: injecting `take = remaining + 1`
into `payments.domain.ts` turns the payment property red (verified), and
injecting `quantity + 1` into `costing.domain.ts` turns golden vector COST-002 red
(verified). Both files were restored byte-for-byte.

---

## 4. Request-path load — MEASURED (server only; persistence NOT measured)

Script: [`scripts/measure/http-load.mjs`](../../scripts/measure/http-load.mjs).
It builds the real Fastify server (`buildServer()`), then drives one route twice
in the same process: **baseline** (shadow mode off — the shipped default) and
**shadow on**. The delta is what shadow verification costs on the request path.

Reproduce:

```bash
npx tsx scripts/measure/http-load.mjs --mode=http    --requests 2000 --concurrency 10
npx tsx scripts/measure/http-load.mjs --mode=inject  --requests 3000
```

### Real socket, `GET /api/health`, 2,000 requests, concurrency 10

| Run                   |  req | fail | req/user-hour |     p50 |     p95 |      p99 |     avg | process CPU |
| :-------------------- | ---: | ---: | ------------: | ------: | ------: | -------: | ------: | ----------: |
| baseline (shadow off) | 2000 |    0 |     7,627,932 | 4.28 ms | 8.33 ms | 10.33 ms | 4.71 ms |    1,468 ms |
| shadow on             | 2000 |    0 |     8,925,317 | 3.66 ms | 7.94 ms | 14.64 ms | 4.03 ms |    1,562 ms |

**p95 delta: −0.39 ms** (i.e. **no measurable cost**; the sign is noise).

### In-process (`inject`), 3,000 requests

| Run       |  req | fail | req/user-hour |     p50 |     p95 |     p99 |     avg |
| :-------- | ---: | ---: | ------------: | ------: | ------: | ------: | ------: |
| baseline  | 3000 |    0 |    27,173,852 | 0.11 ms | 0.17 ms | 0.25 ms | 0.13 ms |
| shadow on | 3000 |    0 |    35,841,307 | 0.08 ms | 0.13 ms | 0.22 ms | 0.10 ms |

**p95 delta: −0.045 ms.**

### ⚠️ What these numbers do and do not mean

- **They measure the SERVER AROUND the data** — plugins, hooks, validation,
  serialization, compression. That is the part this round touched.
- **They do NOT measure persistence.** This machine has no Supabase credentials,
  so no query ran. The prompt's «DB queries and rows per operation» and any
  figure that includes database time are **NOT MEASURED** here.
- **The route is `/api/health`, not a payment.** A payment POST needs a database
  and an authenticated workspace; without them the handler would fail before
  reaching the shadow check, and the measurement would report the cost of failing
  fast rather than of verifying.
- **The shadow columns carry the same traffic.** The payment path is not
  exercised end-to-end; `comparePaymentPosting`'s own cost was measured
  separately in §1 (p50 0.4 µs). The table above shows that toggling shadow mode
  does not change this route's cost, which is the honest scope of the claim.
- **`req/user-hour` is a derived figure** from this throughput, not an observed
  number of shops. It is printed because the prompt asked for it, and it should
  be read as «what one process sustained here», not as a capacity plan.

---

## 5. Observability — the divergence alarm now exists

Corrected 25 Oct 2026. The previous version listed four alerts as deployed when
none existed. Current state:

| Thing                                        | State                                                                                                                                                                |
| :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Divergence rows written to `core_divergence` | **implemented**, called from `POST /api/payments`; table + RLS proven on real Postgres                                                                               |
| Kill switch (`setKillSwitch`)                | **implemented and tested** — routes a capability back to `SERVER_LEGACY`                                                                                             |
| **Divergence-rate alarm**                    | **implemented and tested** — `workers/divergence-alarm.worker.ts`, scheduled hourly through `runScheduledOnce`, notifying through the existing `NotificationService` |
| Alarm threshold, per workspace               | **implemented** — `workspaces.divergence_alarm_percent` (`docs/divergence-alarm-migration.sql`); **NULL = off** is the shipped default                               |
| The rule that decides «alarm or not»         | **pure, in the core** — `evaluateDivergenceWindow` in `@hisabche/validation`, with an explicit OFF state (not a zero threshold) and a strictly-greater-than boundary |
| A dead-letter threshold alert                | **not built**                                                                                                                                                        |
| A clock-skew alert                           | **not built**                                                                                                                                                        |
| Dashboards                                   | **not built**                                                                                                                                                        |

The alarm fires only when: the workspace has a non-NULL threshold, the window has
at least `minOpportunities` (20) comparisons, and the rate is **strictly above**
the threshold. Because the default is NULL, **no notification is sent until a
workspace opts in** — which is why `configured` in
`docs/VERIFY-divergence-alarm.sql` is expected to read 0 after migration.

---

## 6. What would make this document complete

1. Run the load scenario against a **seeded database** and fill the
   persistence columns (queries per operation, rows per operation, and latencies
   that include the database).
2. ~~Build the divergence-rate alert~~ — **done**; it needs a threshold set per
   workspace before it does anything.
3. ~~Run the corpus on Electron main and React Native~~ — **done** under Jest.
   Still unproven: the packaged binaries.
4. ~~pg proof~~ — the one-command script
   (`scripts/verify-core-divergence-pg.mjs`) passes 16/16 against a real
   Postgres; see ADR-007.
