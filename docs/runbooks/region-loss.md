# Runbook: Cloud Region Loss & Disaster Recovery

## Trigger

Primary region (Supabase + Render) experiences a sustained regional outage (`> 15 minutes`).

## Recovery Procedure

1. **Declare Incident:** Open an incident using [incident-template.md](./incident-template.md).
2. **Restore Database in Secondary Region:** Provision Supabase project in secondary region from latest PITR / backup snapshot (note RPO target `<= 5 min` with PITR, or up to `24h` with daily snapshots).
3. **Deploy Render Services in Matching Region (`ADR-0004`):** Deploy `hisabche-api` (`PROCESS_ROLE=api`) and `hisabche-worker` (`PROCESS_ROLE=worker`) in the same region as the new DB.
4. **Update Secrets & DNS:** Update `SUPABASE_URL`, `DATABASE_URL`, `DIRECT_URL` in Render environment and switch API DNS/custom domain.
5. **Verify:** Confirm `GET /ready` returns `200`, run read-only smoke checks, then re-enable normal traffic.
