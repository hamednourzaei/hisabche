# Runbook: Read-Only Mode (`SERVICE_READ_ONLY`)

## When It Triggers

- Primary PostgreSQL enters read-only failover, hits disk/connection emergency, or an operator intentionally pauses writes during an emergency migration.
- `backend/src/runtime/service-mode.ts` sets `mode = 'read_only'`, causing `backend/src/index.ts` `onRequest` hook to reject `POST`, `PUT`, `PATCH`, `DELETE` with `503 SERVICE_READ_ONLY`.

## Operator Actions

1. **Confirm State:** Query `GET /metrics` and check `serviceMode.mode === 'read_only'`.
2. **Communicate:** Notify active workspaces that offline POS/Desktop continues queuing locally (`local-engine` outbox) and will sync once writes resume.
3. **Resolve Primary Issue:** Verify Supabase primary health, disk space, and active locks (`pg_stat_activity`).
4. **Exit Read-Only Mode:** Once primary accepts writes cleanly, restore `primaryWritable: true` (or restart instances after DB recovery) and verify `GET /ready` returns `200`.
5. **Post-Recovery:** Monitor `/api/sync/push` queue drain and `/metrics` 5xx rate for 15 minutes.
