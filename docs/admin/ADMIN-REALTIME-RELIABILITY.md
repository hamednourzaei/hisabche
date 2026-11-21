# Admin Real-time & Reliability Contract

Mission §6. The old admin/wall SSE streams were removed on 12 Nov 2026 because
they had NO consumer. The stream returns only because this mission ships the
endpoint, the real frontend consumer, and connection management together.

## Transport

- `GET /api/admin/monitor/stream` — Server-Sent Events, behind
  `adminRoute('operations.monitor.read')` (authenticate → platform-admin guard →
  permission). **No token in the query string, ever.**
- Client: `apps/admin/lib/monitor-stream.ts` — fetch-based SSE (not EventSource,
  which cannot send the Authorization header). Credential = the same
  `getToken()` the API layer uses; starts after `tokenReady` (the token-ready trap).
- The public wall keeps polling with `x-wall-token`; it gets aggregates only.

## One sampler, many viewers

- ONE shared 10 s timer for ALL subscribers (`admin-monitor.routes.ts`), started
  by the first connection, cleared when the last leaves. Classified by
  `job-authority-guard.test.ts` as the legitimate SSE sampler location — no new
  timer authority.
- The sample itself is the existing single-flight `sharedSnapshot()` +
  `sharedCoreSnapshot()` (10 s TTL, failed sample not cached): N viewers cost
  one DB sample per 10 s, not N.
- Cap: `MAX_ADMIN_STREAMS = 20` → 503 `STREAM_LIMIT` (tested with 20 live
  connections + a 21st refused).
- Backpressure: latest-wins. A `write()===false` only means the buffer is full
  NOW (a 20 KB payload exceeds the 16 KB high-water mark even for a healthy
  client); a subscriber still stalled after TWO ticks is disconnected and its
  client reconnects with a fresh snapshot.
- The server's 30 s connection timeout is disabled on the hijacked stream socket;
  the heartbeat keeps proxies awake instead.

## Event contract (versioned `{v:1, ...}`)

| Event                             | Payload                                                | When                                                                              |
| --------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `snapshot`                        | overview, vitals, alerts, cores, counts, instances, db | on connect                                                                        |
| `core.metrics`                    | at, cores, counts                                      | every tick                                                                        |
| `instance.metrics`                | instances (online + offline, role, lastSeen)           | every tick                                                                        |
| `database.metrics`                | db history row + live vitals                           | every tick                                                                        |
| `alert.raised` / `alert.resolved` | ruleId, coreId, metric, severity                       | transition, derived from the SAME evaluations the screen shows (observation only) |
| `heartbeat`                       | at                                                     | every 2nd tick (20 s)                                                             |
| `stream.error`                    | message                                                | sample failed                                                                     |

## Client lifecycle (unit-tested, injectable fetch/timers)

- Single subscription: `start()` twice is a no-op.
- Heartbeat watchdog: no event for 30 s → abort + reconnect (stale is never «live»).
- Reconnect: exponential backoff + jitter, capped 30 s; after 3 failed attempts
  state = `fallback` and the hook resumes controlled 10 s polling — the badge
  says «Fallback polling». The client keeps trying to restore the stream.
- `stop()` on unmount: abort + clear every timer + no reconnect (no ghosts).
- Events land directly in the React Query cache (`setQueryData`), not a parallel
  state; alert transitions invalidate the affected queries.

## Freshness rules

- While connected, overview/cores polling is PAUSED (`paused` flag) — no
  duplicate load. History refetches every 60 s beside the live totals (F-05).
- The badge shows Connected / Connecting / Reconnecting / Fallback / Disconnected
  plus the last-event time.
- Multi-instance: the stream serves DB-aggregated data across ALL instances
  (minute granularity); offline instances stay visible via the 24 h lookback +
  `lastSeen`. Sub-minute cross-instance push would need Redis pub/sub that
  `cacheService` lacks — recorded limitation, not faked.

## Verification

- Backend HTTP: `monitoring-stream.test.ts` (real `listen` + fetch): auth 401,
  versioned snapshot, periodic events + heartbeat from one sampler, disconnect
  cleanup (subscriber count → 0), cap 503.
- Wall guard rewritten to the new decision: admin stream requires admin auth
  (401 anonymous AND with a wall token); wall stream/session stay 404.
- Client: `apps/admin/src/__tests__/monitor-stream.test.ts` — 12 tests covering
  parsing, auth header, single subscription, watchdog, backoff→fallback, 401,
  reconnect reset, stop cleanup, server-restart reconnect.
- Wiring: `monitor-wiring.test.ts` — hook paths ↔ declared routes, paused
  polling, cache wiring, no URL token, no EventSource.

## Runbook

1. **Stream down, polling active**: badge says Fallback; check backend health
   and the 20-connection cap; the client restores automatically.
2. **Cores all UNKNOWN**: migration `admin-core-monitoring-01` not applied yet
   (PENDING HUMAN CONFIRMATION) or no traffic in the window — the reason is
   shown per core; infra monitoring is unaffected.
3. **Alert storm**: one open event per (rule, core) is enforced by the DB;
   notification respects `cooldown_minutes`; disable/tune the rule via the
   monitor tab (step-up required).
4. **Retention**: hourly tick rolls core minutes → hours and prunes (7 d / 90 d);
   open alert events are never pruned.
