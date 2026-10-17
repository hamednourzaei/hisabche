# SLO — the thresholds capacity is judged against

Fixed **before** any load runs, so M3–M7 cannot rationalize a result after the
fact. Two kinds of target are kept apart:

1. **DB-layer SLOs** — operations the backend actually drives, measurable on
   this machine. These are what M3–M7 report against.
2. **End-to-end targets** — page loads, API latency, websocket fan-out. These
   need the HTTP services that do not exist locally (`PARITY.md` §3–§5); the lab
   never prints a number for them and marks them **NOT TESTABLE (local)**.

## The repository declares no latency budget — these bands are the lab's

A search of `backend/src` finds no `p95`/`p99`/latency-budget statement anywhere
(the only timing constants are operational: sync stream polling at
`STREAM_POLL_MS` = 2000 ms and a `MAX_STREAM_SOCKETS` back-pressure cap). The
bands below are therefore declared **lab conventions**: chosen strict enough
that a 1,000-user ERP backend hitting them still feels responsive, and stated
here so they cannot drift. They are not a promise about production latency.

## Operation classes and thresholds (DB layer)

| #   | Operation (the real RPC/SQL the backend drives)                                         | p95    | p99    | Correctness budget                                                                                                                    |
| --- | --------------------------------------------------------------------------------------- | ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | `invoice_write_document` — invoice + 1–8 lines + ledger + cost effects, one transaction | 150 ms | 400 ms | 0 unexpected errors; a duplicate idempotency key must be **refused deterministically** (a refusal is correct behaviour, not an error) |
| W2  | `pos_record_order`                                                                      | 200 ms | 500 ms | same                                                                                                                                  |
| W3  | payment allocation / `payments_cancel`                                                  | 150 ms | 400 ms | same                                                                                                                                  |
| R1  | workspace-scoped invoice list page (single query, keyed)                                | 80 ms  | 200 ms | 0                                                                                                                                     |
| R2  | per-invoice profit explanation (`explainInvoiceProfit` path)                            | 120 ms | 300 ms | 0                                                                                                                                     |
| R3  | trial balance / statement over 24 months                                                | 300 ms | 800 ms | 0                                                                                                                                     |
| R4  | one sync poll cycle for a workspace                                                     | 60 ms  | 150 ms | 0                                                                                                                                     |

Measured as **server-side and client-observed**: client round-trip percentile
from the load driver, and `pg_stat_statements` `mean_exec_time` /
`stddev_exec_time` for the corresponding statement — both quoted together.

## Concurrency ladder

Levels: 1, 4, 16, 32, 64, 128, 200 concurrent sessions (bounded by the server's
`max_connections=400` minus maintenance headroom — a **lab-host choice**, see
`PARITY.md` §2). At each level the lab records: p50/p95/p99 round trip,
achieved throughput, unexpected-error rate, and server-side samples (lock waits
from `pg_locks`/`pg_stat_activity`, temp-file and buffer counters from
`pg_stat_statements`/`pg_stat_database`).

## Classification bands

| Band            | Meaning                                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SAFE**        | p95 ≤ SLO, p99 ≤ SLO, unexpected errors ≈ 0, invariants hold                                                                                                   |
| **DEGRADATION** | p95 or p99 between 1.0× and 1.5× SLO while throughput still rises with concurrency                                                                             |
| **SATURATION**  | > 1.5× SLO, or throughput flat/falling under increasing concurrency — **without** invariant violations or unrecoverable errors                                 |
| **FAILURE**     | any invariant violation (`FINANCIAL-INVARIANTS.md`), deadlock storm, connection exhaustion, > 1 % unexpected errors, or a duplicate write that was not refused |

**Headroom at 1,000 users** is claimed only if a measured concurrency level at
the SAFE band covers the concurrent heavy-operation intensity a 1,000-user mix
implies — and the mapping from "users" to "concurrent operations" is written
down with the dataset manifest (M2), as an assumption, never as a fact.

## Gates that outrank every latency number

1. After each stage the load stops and the invariant suite runs. A stage that
   violates any invariant is **FAILURE** at any latency.
2. If the load generator saturates before the database does, the stage is
   labelled `LOAD_GENERATOR_SATURATED` and is **not** a capacity result.
3. An unknown (a figure that could not be read) is reported as unknown — never
   as zero, and never substituted with an estimate.
