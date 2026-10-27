# Hisabche Disaster Recovery (DR) Plan & Runbook

## 1. Objectives & Metrics (RTO / RPO)

- **Recovery Point Objective (RPO)**: < 15 minutes (cloud continuous WAL replication; local SQLite transaction journal is synchronous).
- **Recovery Time Objective (RTO)**: < 30 minutes for cloud failover; < 2 minutes for local desktop/mobile offline fallback.

## 2. Architecture & Resilience

1. **Local-First Immunity**: Since clients (desktop Electron and mobile) run local SQLite engines (`packages/local-engine/`), an outage of the cloud server or Supabase infrastructure causes zero downtime for cashiers and sales counters. They continue issuing invoices, taking payments, and recording movements.
2. **Crash-Durable Outbox**: All background notifications and synchronization tasks reside in durable Postgres outbox queues (`email-outbox`, `sync-outbox`) with lease reclamation (`SKIP LOCKED`).
3. **Workspace Isolation**: Workspaces are completely isolated by `workspace_id`. Disaster recovery drills run in temporary scratch workspaces without risking tenant data.

## 3. Restore Drill Runbook

To verify disaster recovery readiness without affecting production:

```bash
node scripts/dr-restore-drill.mjs
```

The drill executes:

1. Exporting a full JSON/SQL snapshot of a workspace using `BackupService`.
2. Initializing a scratch workspace (`scratch-dr-reconcile`).
3. Restoring all accounts, customers, products, invoices, and journal entries into the scratch workspace.
4. Running a count and balance reconciliation between original and restored datasets.
5. Purging the scratch workspace and logging the verified RTO duration.

## 4. Status Page Copy (Incident Communication Template)

```markdown
### Service Interruption — Cloud Sync In Progress

- **Current State**: Cloud synchronization is currently experiencing latency.
- **Shop Owners**: Your local POS, invoice builder, till operations, and barcode scanning are **completely unaffected**. Continue ringing up sales as normal.
- **Sync Status**: All transactions are buffered securely on your device and will synchronize automatically once connectivity is restored.
```
