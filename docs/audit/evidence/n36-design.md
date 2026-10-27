# N-36 Architectural Design: Eliminating In-Flight Cursor Skew in Multi-Tenant Sync

Date: 2026-10-26  
Status: **IMPLEMENTATION DESIGN DOCUMENT**

---

## 1. Problem Definition & The Flaw in Heuristics

In `docs/sync-engine-migration.sql:97-263`, `sync_change_log` tracks incremental changes using a global `BIGSERIAL` sequence (`sync_version`). In PostgreSQL:

1. `BIGSERIAL` values are allocated at the moment `nextval()` is invoked during `INSERT`.
2. Concurrently executing transactions $T_1$ and $T_2$ may allocate version numbers $V_1 = 101$ and $V_2 = 102$.
3. If $T_2$ commits before $T_1$, a client pulling changes at $t$ sees version 102 but does not yet see 101.
4. If the pull cursor advances to 102, version 101 will be permanently skipped once $T_1$ commits.

The previous heuristic attempted to hold the cursor across gaps within a 10-second `SAFE_HORIZON_MS` window. This approach was flawed:

- **Gaps are normal:** In a multi-tenant database, version numbers are consumed by transactions in other workspaces or rolled-back transactions. Such gaps will NEVER be filled.
- **Client spin lock:** Holding `nextCursor` at the gap while returning `hasMore: true` caused client pull loops (`sync-engine.ts pullDelta`) to spin back-to-back without making any progress.
- **Vulnerability to long writes:** Any transaction taking longer than 10 seconds still suffered data loss upon commit.

---

## 2. Comparison of Solutions

### Option B: Per-Workspace Advisory Transaction Locks

- Mechanism: Acquire `pg_advisory_xact_lock(hashtextextended(workspace_id::text, 0))` inside `sync_record_change()`.
- Trade-off: Writers in the same workspace are forced into strict serial execution until commit. For long-running transactions (such as complex invoice creation with costing and stock movements), concurrent cashier or POS checkouts in the same shop would block each other, degrading throughput.

### Option A: The Commit-Horizon (`xid8` & Snapshot Invariant) — CHOSEN

- Mechanism:
  1. Add `txid xid8 NOT NULL DEFAULT pg_current_xact_id()` to `sync_change_log`.
  2. The pull function filters rows where:
     $$\text{txid} < \text{pg\_snapshot\_xmin}(\text{pg\_current\_snapshot}())$$
  3. Ordered strictly by `sync_version ASC`.
- Proof of Correctness:
  - By definition in PostgreSQL, `pg_snapshot_xmin()` is the lowest transaction ID that is still active (in-flight) at the moment the snapshot is taken.
  - Any row with $\text{txid} < \text{xmin}$ belongs to a transaction that has ALREADY completed (either committed or aborted).
  - Therefore, no in-flight transaction can ever commit a row with a transaction ID below the current `xmin`.
  - All rows visible under this condition are final and immutable. Gaps among them are guaranteed to be rolled-back or foreign-workspace transactions, and the cursor can advance over them immediately without waiting or stalling.
- Zero Lock Contention: Writers never wait on each other; multiple cashiers can create invoices concurrently.

---

## 3. Pull Contract Invariants

- `nextCursor`: set to the highest `sync_version` among the returned rows, or retained at `currentCursor` if no rows returned.
- `hasMore`: returns `true` ONLY if more rows exist AND `nextCursor > currentCursor` (progress is guaranteed; no spinning).
- `mustRehydrate`: preserved when requested cursor is behind the pruning retention horizon.

---

## 4. Operational Risk & Mitigation

### Database-Wide Scope of `pg_snapshot_xmin`

Because PostgreSQL's `pg_snapshot_xmin()` represents the oldest uncommitted transaction across the entire cluster, an open or abandoned transaction in **any database session** (even for a background worker or an unrelated tenant) will pin `xmin`. While that transaction remains open, changes with higher transaction IDs cannot be pulled by any tenant until `xmin` moves forward.

### Recommended Postgres Configuration

To prevent abandoned transactions from stalling synchronization across tenants, configure:

```sql
ALTER DATABASE hisabche SET idle_in_transaction_session_timeout = '60s';
ALTER DATABASE hisabche SET statement_timeout = '120s';
```

### Operational Monitoring Query

Monitor long-running or idle-in-transaction connections with:

```sql
SELECT
  pid,
  usename,
  client_addr,
  state,
  xact_start,
  now() - xact_start AS duration,
  query
FROM pg_stat_activity
WHERE state IN ('idle in transaction', 'active')
  AND xact_start < now() - interval '1 minute'
ORDER BY xact_start ASC;
```

If an uncommitted connection stalls synchronization, terminate it safely:

```sql
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = <stalled_pid>;
```
