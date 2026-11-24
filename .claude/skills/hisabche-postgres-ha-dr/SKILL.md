---
name: hisabche-postgres-ha-dr
description: Use when auditing or designing PostgreSQL provider abstraction, Supabase dependency isolation, replicas, WAL, backups, PITR, restore, failover, multi-region disaster recovery, or database availability for Hisabche.
---

# Hisabche PostgreSQL High Availability and Disaster Recovery

## Goal

Keep business data durable and service recoverable during provider, region, network, credential, storage, or deployment failures without risking split-brain or duplicate financial writes.

## Mandatory repository context

- Read `AGENTS.md` and existing database/backend/architecture skills.
- Inspect the actual DB client factories, query paths, Supabase Auth/Storage/Realtime/RPC dependencies, migration system, deployment descriptors, backup jobs, runbooks and tests.
- Read current `.claude` DB/DR specs if present.
- Use code intelligence before broad search.
- Do not infer runtime availability from repository configuration.

## Architecture rules

- Default to one authoritative active writer per data domain.
- Use read replicas for reads only when freshness semantics permit. A read replica is not a backup and not automatically promotable.
- Separate local/zone HA from regional/provider DR.
- Use independent backups in a separate failure domain and test restores.
- Multi-provider is not achieved by swapping `DATABASE_URL`. Inventory every Supabase-specific feature: Auth, Storage, Realtime, RPC, RLS, Edge Functions, Vault and managed extensions.
- A provider abstraction must preserve transactions, isolation, errors, pooling, migrations, tenant security and observability; do not force incompatible providers into a fake common interface.
- Avoid multi-master for financial state unless a formally verified conflict-free design exists. Default is active-passive.
- Cross-region synchronous replication may sacrifice writes during a network partition. Make the availability/consistency tradeoff explicit.
- Never promote a standby until the old writer is fenced and cannot accept writes.
- Use fencing token/epoch or an equivalent enforceable mechanism. DNS change alone is not fencing.
- Unknown commit outcomes must be resolved through idempotency and reconciliation, not blind retries.

## Backup and recovery

- Define RPO/RTO per failure class and business criticality; targets are not achieved facts until measured.
- Combine base backups with WAL archiving for PITR where the selected platform supports it.
- Encrypt backups, restrict access, separate credentials, record retention and verify checksums.
- Back up database and object storage separately. Database metadata backup does not imply file/blob backup.
- Include schema, extensions, roles/grants, RLS policies, functions, triggers, sequences, indexes and secrets/configuration recovery plan (never expose secrets).
- Restore into an isolated environment first. Verify row counts, constraints, indexes, functions, RLS, tenant isolation, financial invariants and application compatibility.
- A script that compares fixtures or checks backup file existence is not a restore drill.
- Test recovery from a timestamp and demonstrate the actual restored state.
- Preserve audit history and avoid destructive cleanup during recovery.

## Failover safety

1. Detect and classify failure; distinguish DB outage, provider outage, network partition, DNS issue, auth outage and storage outage.
2. Confirm primary is unavailable, not merely unreachable from one probe.
3. Establish fencing of the old writer.
4. Verify standby replay position and data loss window.
5. Require explicit human approval for production promotion unless a separately approved, tested control plane authorizes it.
6. Promote exactly one candidate.
7. Switch application writer endpoint only after promotion is confirmed.
8. Verify read/write, tenant isolation, idempotent financial posting, outbox processing and auth/storage dependencies.
9. Record actual RPO/RTO and all lost/queued requests.
10. Do not fail back until replication direction and data reconciliation are established.

## Required chaos and DR tests

- Primary process crash.
- Primary host loss.
- Region loss.
- Provider API outage.
- DNS/connection pool stale endpoint.
- Cross-border network partition.
- Replica lag beyond threshold.
- WAL archive gap.
- Corrupt/missing backup object.
- Expired credentials.
- Auth available while DB unavailable and vice versa.
- Storage unavailable while DB is healthy.
- Failover with in-flight payment/posting.
- Unknown commit outcome during promotion.
- Old primary returns after promotion (split-brain attempt).
- Restore to a timestamp before a destructive event.
- Schema migration present on primary but missing on standby.
- RLS, grants, functions, extensions and sequences parity after restore.

## Guardrails

- Never execute production DDL/write, failover, promotion, DNS changes, infrastructure provisioning or credential rotation without explicit approval.
- Never read or print `.env*`.
- Never install infrastructure tooling or change dependencies without approval.
- Do not claim RPO/RTO, PITR or failover is verified without recorded drill evidence.
- Do not run a destructive restore against any shared or production database.
- Create runbooks and test scripts first; use isolated disposable Postgres for verification.

## Output

Report separately:
- Architecture found vs proposed.
- Primary writer and replica evidence.
- Backup schedule and independent storage evidence.
- PITR evidence.
- Last successful restore drill.
- Auth/storage/realtime external dependencies.
- Split-brain/fencing model.
- Measured RPO/RTO vs targets.
- Exact blockers requiring human credentials/approval.
- Status: `VERIFIED_COMPLETE`, `IMPLEMENTED_NOT_LIVE_VERIFIED`, `VERIFIED_WITH_LIMITATIONS`, `BLOCKED`, or `NOT_IMPLEMENTED`.
