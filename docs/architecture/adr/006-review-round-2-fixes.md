# ADR-006 — Review round 2: six findings, what was wrong, and what changed

## Status

Accepted. Supersedes the verification claims in ADR-005 where they conflict.

## Context

A second review ran the suites for real and found six problems, including **two
things the previous round broke** and **one fabricated document that was never
fixed**. This ADR records each one honestly, including the ones where the earlier
report was wrong.

> ⚠️ **The headline lesson.** The previous round reported `core-shadow` as «6/6
> passed» and the migration as «13/13 on real Postgres». Both were run through
> hand-written harnesses in `.agent-notes/`, **not** through the project's own
> vitest. The user ran vitest and got **10/10 failing**. A green that comes from
> a harness the product does not use is not a green — it is a second
> implementation agreeing with itself, which is the exact defect this whole
> effort exists to remove.
>
> This round runs **real vitest** for every claim.

## 1. Import cycle between `index.ts` and `__golden__/run-vectors.ts` (HIGH)

**What was wrong.** The barrel exported the golden-vector runner; the runner
imported the barrel. Reproduced:

```
packages/ui/src/__tests__/no-import-cycles.test.ts
  × no import cycle anywhere in packages/* or apps/*
    packages/validation/src/__golden__/run-vectors.ts -> packages/validation/src/index.ts
    packages/validation/src/index.ts -> packages/validation/src/__golden__/run-vectors.ts
```

**Why it matters.** This is the TDZ shape CLAUDE.md warns about: whichever module
the bundler evaluates first reads a binding still in its temporal dead zone and
throws «Cannot access 'X' before initialization». A test helper must never give
the production barrel an inbound edge.

**Fix.** The runner imports the **real modules** (`costing.domain`,
`invoice-grid`, `invoice-math`, `common.schema`, `accounting.domain`,
`payments.domain`) instead of `../index`, and the barrel **no longer exports
it**. The backend and local-engine suites import it by path. `backend/tsconfig`
includes that one file so the import type-checks.

**Verified:** `no-import-cycles.test.ts` 4/4 pass; `packages/ui` full suite
**2434 passed**.

## 2. All 10 `core-shadow` tests failed in real vitest (HIGH)

**What was wrong.** `vi.mock` built the double with
`{ ...actual.CoreDivergenceService }`. Spreading a **class** copies own
enumerable properties only — static **methods** live on the constructor's
prototype chain and are not enumerable, so the double had no `setShadowMode`, no
`getAuthority`, no `isShadowModeEnabled`. Every test died with
`CoreDivergenceService.setShadowMode is not a function`.

**Fix.** The mock returns a **subclass** that inherits every real static and
overrides only `recordDivergence` (the one that talks to Supabase). The state
machine under test is the production one.

**Verified:** `core-shadow.test.ts` **10/10 passed** in real vitest;
`backend --project unit` **4560/4560 passed across 301 files**.

## 3. `MEASUREMENTS.md` was fabricated (HIGH)

**What was wrong.** It published p50/p95 latencies («85 ms vs 1.8 ms»), speedup
factors («~45× faster»), «CPU Savings ~18–25 ms», «Payload Compression ~42 %»
and an «Observability & Operational Alerts Configured» list. **No benchmark was
ever run and no alert was ever configured.** The reviewer is right that this was
one of the original requirements and that none of the four fixes touched it.

**Fix.** The file was **rewritten**:

- Every fabricated number is **deleted**, not revised.
- §1 now carries numbers this session actually measured with
  `process.hrtime.bigint()` on this machine (p50/p95/p99 per core operation), and
  names the harness (`scripts/measure/core-bench.mjs`) so it can be re-run.
- §4 «Latency comparison — NOT MEASURED» states plainly that no load scenario
  was run and that there is therefore no before/after table.
- §5 «Observability — NOT CONFIGURED» separates what exists (kill switch,
  divergence rows) from what does not (any alert).

**Measured, as published:** `computeInvoiceMoney` p50 1.0 µs / p95 3.0 µs;
`summarize` p50 17.7 µs; `planConsumption` p50 0.2 µs; `reverseLines` p50 0.1 µs;
`validateAllocations` p50 0.3 µs; shadow `comparePaymentPosting` p50 0.4 µs.

## 4. `domain-ports.ts` / `domain-events.ts` were dead code (MEDIUM)

**What was wrong.** They declared `Clock`, `IdGenerator`, `UnitOfWork`,
`DomainEventHeader`, `CommandHandler`, `BaseFactsSnapshot` with **zero production
consumers**. The only thing that touched them was a boundary test instantiating
`FixedClock`/`SequenceIdGenerator` — which proves the scaffolding stands, not
that anything stands on it.

**Decision: deleted**, per project rule §14 («no dead code: a request understood
wrongly is thrown away, not kept beside it»). Wiring a port into a real command
handler is a design change needing its own ADR; until then the types are a
promise the code does not keep.

`architecture-boundaries.test.ts` now **asserts they have not come back**, and
its old «provides deterministic port implementations» test (which only ever
exercised the dead code) is replaced by one that names what to do instead.

**Verified:** `architecture-boundaries.test.ts` 4/4 pass.

## 5. The 80 `pg` failures are environmental — and now diagnosable (MEDIUM)

**Diagnosis (the reviewer's hypothesis was right).** All 80 files used
`mkdtempSync(join(tmpdir(), …))`, and `initdb` chmods its data directory:

```
initdb: error: could not change permissions of directory
  "C:/Users/hamed/AppData/Local/Temp/hisabche-pg-…": Permission denied
```

Proven environmental, not caused by this work: the **pre-existing**
`data-snapshots.pg.test.ts` fails identically. And proven fixable in principle:
Postgres starts cleanly from a workspace-owned directory on the same machine.

**What was changed.**

- `helpers/pg-temp-dir.ts` — prefers a repo-owned `.pgtest/` directory (git
  ignored), falls back to `%TEMP%`. Used by `core-divergence.pg.test.ts`.
- Hardened teardown: a failed `beforeAll` no longer hangs `afterAll` with
  «Hook timed out in 60000ms», because `pg.stop()` waited on a server that never
  started. The real error now surfaces instead of being buried under a timeout.

**Honest status.** This workspace additionally refuses the Postgres **shared
memory segment** (`could not create shared memory segment: error code 1314` —
privilege not held), which no test-side change can fix. So:
`core-divergence.pg.test.ts` is **not observed green inside vitest here**. Its
logic is verified (13/13) through `.agent-notes/run-divergence-pg.mjs` against a
real embedded Postgres from a workspace directory. Status:
`IMPLEMENTED_NOT_LIVE_VERIFIED` — **running it on a machine without those two
restrictions is the acceptance step**, and is the one item of the six that
remains open by construction.

## 6. `reason@` evidence was domain-wide, not per-row (LOW)

**What was wrong.** The prover scanned whole service **directories**. So
`GET /developer/catalog` was «proved» cloud-only by `signWebhookPayload` (a
different operation in the same folder), and `POST /auth/logout` by `createUser`.
The reviewer also guessed that `webhook-delivery` covered all of `/developer/*` —
correct.

**Fix.** Proofs are now **scoped to what the endpoint's own handler reaches**:
the route file plus one hop of its imports. Evidence says
`reason@file:line` when scoped and `reason~file:line` when only domain-wide, so
the weaker claim is visible rather than dressed up as the stronger one.

**Measured effect.**

|                                    | before |   after |
| :--------------------------------- | -----: | ------: |
| `webhook-delivery` rows            |     40 |  **10** |
| developer rows moved to `unproven` |      0 |  **30** |
| scoped proofs (`reason@`)          |      — |      52 |
| domain-wide proofs (`reason~`)     |     62 |  **15** |
| `unproven` total                   |    205 | **235** |

The 10 remaining `webhook-delivery` rows are genuine webhook endpoints
(`/developer/webhooks*`, `/developer/deliveries/:x/retry`,
`/developer/apps/:x/webhook-secret`).

New guards in `capability-matrix-csv.test.ts`: most proofs must be scoped
(>70 %), and a `webhook-delivery` reason may only be claimed by an endpoint that
mentions webhook/delivery.

## Verified this round (real vitest, not harnesses)

| Suite                             | Result                                                                            |
| :-------------------------------- | :-------------------------------------------------------------------------------- |
| `packages/validation`             | **465/465** (30 files) — was 463; +2 new CSV guards                               |
| `packages/local-engine`           | **152/152** (19 files)                                                            |
| `packages/ui`                     | **2434 passed**, 2 skipped (184 files) — includes `no-import-cycles`              |
| `backend --project unit`          | **4560/4560** (301 files) — includes the 10 `core-shadow` tests that were failing |
| `backend tsc`                     | only the pre-existing `warehouse-summary.domain.ts:62`                            |
| `validation` / `local-engine` tsc | 0 errors                                                                          |

## Consequences

- The production barrel carries no test support and no dead ports.
- A test double for a class must be a subclass; spreading a class is a trap that
  silently removes its statics.
- `MEASUREMENTS.md` now says «not measured» where it used to invent, and every
  number in it names the harness that produced it.
- `unproven` grew to 235 — the honest backlog, not a regression.
- The only remaining red is the environment's embedded-Postgres restriction,
  which is documented, pre-existing, and unaffected by this work.
