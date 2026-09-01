-- ============================================================================
-- docs/_who-is-blocking.sql
--
-- READ-ONLY, and fast. Run this when a query hangs or the editor times out.
--
-- ---------------------------------------------------------------------------
-- "SUPABASE IS DOWN" AND "MY STATEMENT IS WAITING FOR A LOCK" LOOK IDENTICAL
--
-- Both present as a query that never returns. They are not the same thing and
-- the fix is completely different, so it is worth thirty seconds to tell them
-- apart before restarting anything.
--
-- If this file returns instantly, the database is fine and something is
-- holding a lock. If this file ALSO hangs, the problem is upstream.
-- ============================================================================

-- ─── 1. Is the database answering at all? ───────────────────────────────────
--
-- If this row comes back, Supabase is up. Anything that hangs after it is a
-- lock or a slow query, not an outage.

SELECT
  'alive'                                   AS status,
  now()                                     AS server_time,
  (SELECT count(*) FROM pg_stat_activity)   AS connections,
  current_setting('lock_timeout')           AS lock_timeout,
  current_setting('statement_timeout')      AS statement_timeout;

-- ─── 2. Who is waiting, and who are they waiting for? ───────────────────────
--
-- `pg_blocking_pids()` gives the answer directly: for each waiting backend,
-- the pids actually holding what it wants.
--
-- An empty result means nothing is blocked — the slow query is slow on its own
-- merits, not stuck behind somebody.

SELECT
  waiting.pid                          AS waiting_pid,
  waiting.usename                      AS waiting_user,
  waiting.wait_event_type,
  left(waiting.query, 90)              AS waiting_query,
  now() - waiting.query_start          AS waiting_for,
  blocker.pid                          AS blocker_pid,
  blocker.usename                      AS blocker_user,
  blocker.state                        AS blocker_state,
  left(blocker.query, 90)              AS blocker_query,
  now() - blocker.state_change         AS blocker_idle_for
FROM pg_stat_activity waiting
JOIN LATERAL unnest(pg_blocking_pids(waiting.pid)) AS blocked(pid) ON true
JOIN pg_stat_activity blocker ON blocker.pid = blocked.pid
WHERE cardinality(pg_blocking_pids(waiting.pid)) > 0
ORDER BY waiting.query_start;

-- ─── 3. Long-running and idle-in-transaction sessions ───────────────────────
--
-- ⚠️ `idle in transaction` is the one to look for. A connection that opened a
-- transaction, did something, and then went idle WITHOUT committing holds
-- every lock it took — indefinitely, and while doing no work at all.
--
-- It is the usual cause of an ALTER that never starts. A pooled API connection
-- that errored mid-transaction is the usual source.

SELECT
  pid,
  usename,
  application_name,
  state,
  now() - state_change     AS in_this_state_for,
  now() - xact_start       AS transaction_age,
  left(query, 120)         AS last_query
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND (
    state = 'idle in transaction'
    OR (state = 'active' AND now() - query_start > interval '10 seconds')
  )
ORDER BY xact_start NULLS LAST;

-- ============================================================================
-- IF SECTION 3 SHOWS AN `idle in transaction` SESSION
--
-- Cancel it — gently first:
--
--     SELECT pg_cancel_backend(<pid>);      -- cancels the query, keeps the connection
--     SELECT pg_terminate_backend(<pid>);   -- drops the connection entirely
--
-- ⚠️ `pg_terminate_backend` rolls that session's open transaction back. On a
-- connection that is idle in transaction there is nothing in flight to lose;
-- on an ACTIVE one it discards work that was part-way done. Read the `state`
-- column before choosing, and prefer `pg_cancel_backend` unless the session is
-- idle.
--
-- ⚠️ Never terminate by pid without looking at `usename` and `query` first.
-- `supabase_admin` and the replication connections are not yours to kill.
-- ============================================================================
