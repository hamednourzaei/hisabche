# Sync engine — deployment runbook

The local-first migration ships in a deliberate order: **the server can be
deployed and run indefinitely with no client using it.** Nothing in the
migration changes existing read or write paths, so step 1 is safe on its own
and reversible. Do not skip ahead.

---

## Before you start

You need:

- A **staging** Supabase project restored from a recent production dump.
  Do not rehearse on production.
- `SUPABASE_DATABASE_URL` for that staging project.
- ~15 minutes of low traffic for the production run.

Sanity check the target before touching it:

```bash
psql "$SUPABASE_DATABASE_URL" -c "select current_database(), current_user;"
```

---

## Step 0 — Tenancy correction (REQUIRED FIRST)

> **Do not skip this.** `invoices`, `customers`, `products` and `transactions`
> have no `workspace_id` — their tenancy is `user_id`, and
> `documents/DATABASE_SCHEMA.md` is wrong about it. The sync triggers read
> `NEW.workspace_id`, so applying Step 1 against that schema would raise
> `record "new" has no field "workspace_id"` on **every insert** and take
> invoice creation down.
>
> Step 1 now refuses to run until this is done. That guard is the only thing
> standing between the old file and a production outage.

`docs/tenancy-workspace-migration.sql` is in four parts. Run them **one at a
time** and read the output of each.

| Part       | What it does                                                          | Reversible |
| ---------- | --------------------------------------------------------------------- | ---------- |
| 1 ANALYSE  | Read-only. Reports mappable / orphaned / ambiguous per entity.        | n/a        |
| 2 ADD      | Nullable `workspace_id` + `NOT VALID` FK + indexes.                   | yes        |
| 3 BACKFILL | Fills only rows mapping to exactly one workspace, then validates FKs. | yes        |
| 4 NOT NULL | Commented out. Human decision, after the app writes the column.       | no         |

**Part 1 is the gate.** Its `verdict` column must read `SAFE` for all four
entities before you continue. If any row is:

- **ORPHANED** — its creator belongs to no workspace. Add the missing
  `workspace_members` row; do not invent a workspace for the invoice.
- **AMBIGUOUS** — its creator belongs to several workspaces, so which book the
  row belongs to is genuinely unknowable from the data. Only someone who knows
  the business can decide. The migration leaves these NULL rather than guessing.

Nothing in Step 0 deletes, merges or overwrites a row.

---

## Step 1 — Apply the sync migration (staging first)

```bash
psql "$SUPABASE_DATABASE_URL" -f docs/sync-engine-migration.sql
```

It begins with a preflight that **fails closed** if `workspace_id` is missing
from any of the four tables, and warns if the column is still nullable — a NULL
workspace means the row never reaches any client's delta, which is silent
divergence.

The script is idempotent — every statement is `IF NOT EXISTS` or
`CREATE OR REPLACE` — so re-running it is safe.

### What it does

| Object                                                      | Purpose                                 |
| ----------------------------------------------------------- | --------------------------------------- |
| `sync_change_log`                                           | Append-only log, `BIGSERIAL` cursor     |
| `sync_mutations`                                            | Idempotency ledger, PK on `mutation_id` |
| `invoices.version`, `customers.version`, `products.version` | Optimistic concurrency                  |
| `invoices.locked_by_user_id`, `lock_expires_at`             | Draft editing lease                     |
| `invoices.finalized_at`                                     | Immutability marker                     |
| 4 change-log triggers, 3 version triggers, 1 finalize guard | Keep log and data atomic                |

### Cost on a large table

`ALTER TABLE ... ADD COLUMN ... DEFAULT` is metadata-only on PostgreSQL 11+, so
the `version` columns do **not** rewrite the table. The `CREATE INDEX`
statements are not `CONCURRENTLY` — on a table above ~1M rows, convert them
first:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS sync_change_log_workspace_version_idx
  ON sync_change_log (workspace_id, sync_version);
```

`sync_change_log` starts empty, so this only matters for the `invoices_lock_idx`.

---

## Step 2 — Verify on staging

**Automated.** Two ways to run it — the script works in both.

From the CLI, where it exits non-zero on any failure:

```bash
psql "$SUPABASE_DATABASE_URL" -f scripts/verify-sync-migration.sql
```

Or paste the whole file into the **Supabase SQL editor**. It contains no psql
backslash meta-commands (`\set`, `\timing`), because those are consumed by the
psql CLI and never reach the server — any other client reports
`syntax error at or near "\"`.

**Reading the result.** Progress is reported twice, because `RAISE NOTICE`
output is usually hidden in the Supabase editor:

- psql prints a notice per check;
- every client gets a final result table, one row per check.

A pass looks like this:

| check_name                           | status | detail              |
| ------------------------------------ | ------ | ------------------- |
| objects exist                        | ok     |                     |
| columns added                        | ok     |                     |
| existing data initialised            | ok     |                     |
| no invoice wrongly finalized         | ok     |                     |
| indexes present                      | ok     |                     |
| change log written in-transaction    | ok     |                     |
| change log rolls back with data      | ok     | THE atomicity proof |
| version bumps on update              | ok     |                     |
| finalized invoice is immutable       | ok     |                     |
| sync columns writable when finalized | ok     |                     |
| duplicate mutation_id refused        | ok     |                     |
| cursor is monotonic                  | ok     |                     |

Any failure raises an exception before reaching the `SELECT`, so **a short or
empty result table is itself a failure** — read the error, do not proceed.

The script is read-mostly: its few writes happen inside subtransactions that
roll back, so it leaves no residue on the database.

Everything that follows is the manual equivalent, for when you want to inspect
a single property by hand.

```sql
-- 1. Objects exist
select count(*) from sync_change_log;            -- 0
select count(*) from sync_mutations;             -- 0

-- 2. Existing rows got a version
select count(*) from invoices where version is null;   -- 0
select min(version), max(version) from invoices;       -- 1, 1

-- 3. No existing invoice was accidentally marked finalized
select count(*) from invoices where finalized_at is not null;  -- 0

-- 4. The trigger fires and is atomic
begin;
  insert into invoices (id, workspace_id, user_id, invoice_number, total)
  values (gen_random_uuid(), '<a real workspace id>', '<a real user id>', 'RUNBOOK-1', 1);
  -- must be exactly 1: the log row is written by the same transaction
  select count(*) from sync_change_log where entity_type = 'invoice';
rollback;
-- must be 0 after rollback: log and data roll back together
select count(*) from sync_change_log where entity_type = 'invoice';

-- 5. Version bumps on update
update invoices set notes = 'runbook' where invoice_number = 'RUNBOOK-1';
select version from invoices where invoice_number = 'RUNBOOK-1';   -- 2

-- 6. Finalized invoices are immutable
update invoices set finalized_at = now() where invoice_number = 'RUNBOOK-1';
update invoices set total = 999 where invoice_number = 'RUNBOOK-1';
-- expected: ERROR ... is finalized and cannot be modified

-- 7. Idempotency ledger rejects a duplicate
insert into sync_mutations (mutation_id, workspace_id, user_id, entity_type, operation, status)
values ('00000000-0000-4000-8000-000000000001', '<ws>', '<user>', 'invoice', 'create', 'applied');
insert into sync_mutations (mutation_id, workspace_id, user_id, entity_type, operation, status)
values ('00000000-0000-4000-8000-000000000001', '<ws>', '<user>', 'invoice', 'create', 'applied');
-- expected: ERROR duplicate key value violates unique constraint
```

**Check 4 is the important one.** It proves the log and the business row commit
or roll back together — the invariant the whole delta protocol depends on. If it
does not hold, stop and do not proceed to production.

### Then exercise the endpoints against staging

```bash
TOKEN="<a staging user's JWT>"
API="https://<staging-api>/api"

curl -s "$API/sync/cursor" -H "authorization: Bearer $TOKEN"

curl -s -X POST "$API/sync/push" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"deviceId":"runbook","batchId":"11111111-1111-4111-8111-111111111111",
       "mutations":[{"mutationId":"22222222-2222-4222-8222-222222222222",
                     "entityType":"customer","entityId":"33333333-3333-4333-8333-333333333333",
                     "operation":"create","payload":{"name":"Runbook"}}]}'

# Send that EXACT request again. `duplicate: true`, and still one customer.
```

---

## Step 3 — Deploy the backend

Nothing in the app calls `/api/sync/*` yet, so this is inert.

Watch for, in order of severity:

- `Failed to create invoice item details` — the older
  `unified-sale-purchase-migration.sql` has not been applied. Invoice creation
  now degrades gracefully instead of 500ing, but apply it.
- `sync push` / `sync pull` log lines with a non-zero `rejected` count.

---

## Step 4 — Client rollout

Not yet shipped end-to-end. See "Remaining work" in the final report. When it
is, roll out behind a flag, workspace by workspace, watching `pendingCount` and
`conflicts`.

---

## Rollback

### The migration

It is **additive**. Nothing is dropped, no column changes type, no data is
rewritten. Existing code paths do not read the new columns. So the usual
rollback is _do nothing_ — leave it in place and roll back the application.

If you genuinely must remove it:

```sql
-- Triggers first: they are the only part that changes behaviour.
DROP TRIGGER IF EXISTS invoices_guard_finalized_trg ON invoices;
DROP TRIGGER IF EXISTS invoices_bump_version_trg   ON invoices;
DROP TRIGGER IF EXISTS customers_bump_version_trg  ON customers;
DROP TRIGGER IF EXISTS products_bump_version_trg   ON products;
DROP TRIGGER IF EXISTS invoices_change_log_trg     ON invoices;
DROP TRIGGER IF EXISTS customers_change_log_trg    ON customers;
DROP TRIGGER IF EXISTS products_change_log_trg     ON products;
DROP TRIGGER IF EXISTS transactions_change_log_trg ON transactions;
```

Dropping the triggers alone restores the previous behaviour completely. Keep
the tables and columns — they are harmless, and dropping `sync_mutations`
discards the idempotency history that protects against duplicate financial
effects from any client still retrying.

Only if you are certain no client will ever retry:

```sql
DROP VIEW  IF EXISTS sync_horizon;
DROP TABLE IF EXISTS sync_change_log;
DROP TABLE IF EXISTS sync_mutations;
ALTER TABLE invoices  DROP COLUMN IF EXISTS version, DROP COLUMN IF EXISTS locked_by_user_id,
                      DROP COLUMN IF EXISTS lock_expires_at, DROP COLUMN IF EXISTS finalized_at;
ALTER TABLE customers DROP COLUMN IF EXISTS version;
ALTER TABLE products  DROP COLUMN IF EXISTS version;
```

### The backend

Redeploy the previous image. The old `/api/sync/*` handlers return.

**Do not restore the old `/api/sync/push` and leave it exposed.** It passed a
client-supplied table name to the service-role database client, which let any
authenticated user read or write any table. If you must roll the backend back,
disable that route at the gateway.

---

## Retention

`sync_change_log` grows without bound. Once clients depend on it, add a job:

```sql
DELETE FROM sync_change_log WHERE created_at < now() - interval '30 days';
```

A client whose cursor predates the oldest surviving row is told to re-hydrate
(`mustRehydrate: true`) rather than silently skipping changes, so pruning is
safe — but keep the window comfortably longer than your longest expected
offline period.

---

## Incident recovery

### A client is stuck — the outbox will not drain

Symptom: `pendingCount` stays high, work is not reaching the server.

1. `GET /api/sync/health` — is `lag` growing, or is the cursor moving?
2. Backend logs for that `deviceId`: look at `rejected` and the error codes.
3. If `validation_failed` dominates, a client is sending a payload the server
   refuses. It will never succeed; the record is `failed` and surfaced to the
   user. Fix the client, then have the user retry.
4. If `server_error` dominates, it is retryable and the backoff is working.
   Check the database.

Never "fix" a stuck outbox by clearing local storage. That discards mutations
the server has not accepted — the user's unsaved work.

### A client is on the wrong cursor

Symptom: `mustRehydrate: true` in the pull logs, or a client showing data that
does not match another device.

The protocol self-heals: the client clears its local replicas and pulls from 0.
Nothing needs doing. If it recurs for one workspace, the change-log retention
window is shorter than that workspace's offline periods — lengthen it.

### Suspected duplicate financial effect

1. Find the mutation: `SELECT * FROM sync_mutations WHERE entity_id = '<id>';`
2. One row means one commit, however many times it was sent. That is the
   ledger working.
3. Two rows for one logical action means two different `mutation_id`s were
   generated — a client bug, not a protocol failure. The stable-id rule in
   `packages/sync/src/mutations.ts` is the thing to check.

### Rebuilding a client's local database

Last resort, and only when the outbox is empty:

```js
// Verify FIRST. A non-empty outbox means unsent user work.
await storage.listOutbox(workspaceId) // must be []
indexedDB.deleteDatabase('hisabche-local')
```

The next start hydrates from the server. If the outbox is not empty, resolve
those mutations first — deleting the database deletes them.

### Emergency: disable sync without a deploy

The endpoints are additive; nothing else depends on them. To stop all sync
traffic, block `/api/sync/*` at the gateway. Clients keep working locally and
queue their mutations; nothing is lost, and everything drains when it is
re-enabled.

---

## GC and retention

**Local GC** (`packages/sync/src/gc.ts`) evicts local replicas only. It cannot
delete server data — it never enqueues a mutation, and the test suite asserts
the outbox stays empty across every eviction path.

Defaults: invoices and transactions 90 days / 2000–5000 rows; customers and
products effectively never. A local miss triggers targeted hydration.

**Server retention** (`sync_change_log`) is the one that needs a job — see
above. These are unrelated: pruning the change log never deletes a business
row.

---

## Monitoring

| Signal                       | Where        | Means                                              |
| ---------------------------- | ------------ | -------------------------------------------------- |
| `sync push` `rejected > 0`   | backend logs | Clients sending invalid or stale mutations         |
| `sync push` `conflicts > 0`  | backend logs | Two users on one record — expected, watch the rate |
| `sync push` `duplicates > 0` | backend logs | Retries landing; the ledger is doing its job       |
| `sync pull` `mustRehydrate`  | backend logs | A client fell behind retention                     |
| `/api/sync/health` `lag`     | endpoint     | How far behind a client is                         |
| `pushMs`, `pullMs`           | backend logs | Endpoint latency                                   |
