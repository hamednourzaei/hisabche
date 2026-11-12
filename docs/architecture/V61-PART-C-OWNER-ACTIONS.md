# V61 Part C — Owner Actions Required (Production & Staging)

These operational actions cannot be executed by the coding agent and require the repository/infrastructure owner:

1. **Cloud Region Co-Location (`ADR-0004`):** Ensure `hisabche-api`, `hisabche-worker` (Render), and the Supabase PostgreSQL primary project live in the **exact same cloud region** (single biggest latency reduction for multi-query POS & sync flows).
2. **Managed Database Upgrades (Supabase Dashboard):**
   - Enable **PITR (Point-in-Time Recovery)** to meet the `<= 5 min` RPO target (`03-SLO.md`).
   - Enable **Managed HA** and provision a **Read Replica** (`DATABASE_REPLICA_URL`) for heavy analytical reports.
3. **Render Service Configuration (`render.yaml`):**
   - Create/enable the `hisabche-worker` background worker service (`PROCESS_ROLE=worker`).
   - Scale `hisabche-api` to `numInstances >= 2` for zero-downtime deploys and instance failover.
   - Configure optional `REDIS_URL` if cross-instance shared rate-limiting/caching is desired (system runs safely without it per `ADR-0003`).
4. **Database Migrations & Role Timeouts (`PENDING HUMAN CONFIRMATION`):**
   - Run `docs/role-timeouts-01-migration.sql` (and `VERIFY-role-timeouts-01.sql`) alongside all V61 feature migrations in the documented run order.
5. **Staging Drills (`NOT_RUN` until executed by owner):**
   - Execute [docs/runbooks/failover-drill.md](../runbooks/failover-drill.md) on staging and record observed RTO/RPO.
   - Execute monthly [docs/runbooks/restore-to-sandbox.md](../runbooks/restore-to-sandbox.md) drill after enabling PITR.
