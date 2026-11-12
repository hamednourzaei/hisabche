# Runbook: Database / Instance Failover Drill

## Purpose

Verify zero-downtime API behavior during instance restarts and safe degradation when Primary/Replica DB connectivity changes.

## Quarterly Drill Steps

1. **Verify Baseline:** Check `GET /ready` (`200 OK`) and `GET /metrics` (`serviceMode: "normal"`).
2. **Simulate API Instance Drain:** Send `SIGTERM` to one `api` instance; confirm `/ready` immediately returns `503`, inflight requests complete cleanly within `SHUTDOWN_GRACE_MS`, and remaining instance serves traffic without 5xx.
3. **Simulate Replica Lag:** Set replica lag above `REPLICA_MAX_LAG_MS`; confirm `db/routing.ts` falls back to `primary` and `serviceMode` reports `degraded`.
4. **Simulate Primary Read-Only:** Toggle `setServiceModeInput({ primaryWritable: false })` in staging; confirm `POST/PUT/PATCH/DELETE` return `503 SERVICE_READ_ONLY` while `GET` endpoints continue serving.
5. **Restore & Record:** Restore `primaryWritable: true`, confirm `serviceMode: "normal"`, and log timings against RTO (`<= 30 min`).
