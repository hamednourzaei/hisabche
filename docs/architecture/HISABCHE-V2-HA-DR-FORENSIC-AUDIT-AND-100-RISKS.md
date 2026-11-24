# HISABCHE V2 — FORENSIC AUDIT, 100 WEAKNESSES & RISKS, AND ARCHITECTURAL EVALUATION

**Baseline Commit:** `b6a6d4da326c91d8eddb6c2a294e7f1c5e24fb1e`  
**Branch:** `main`  
**Standard:** `docs/audit/EVALUATION-GATES.md` & `docs/architecture/OUTCOME-DRIVEN-INTEGRITY-STANDARD.md`  
**Status Vocabulary:** `VERIFIED_GAP`, `PARTIAL`, `VERIFIED_IMPLEMENTED`, `NOT_APPLICABLE`, `UNKNOWN`, `BLOCKED_EXTERNAL`.

---

## 1. Phase 1 — Repository Forensic Audit

### 1.1 Database Connection Audit Table

| File                                             | Client                        | Provider                              | Connection Type                       | Read/Write                               | Consumers                                                      | Criticality                                           |
| ------------------------------------------------ | ----------------------------- | ------------------------------------- | ------------------------------------- | ---------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| `backend/src/db.ts`                              | `supabase` (Singleton)        | Supabase (PostgREST)                  | HTTPS REST (`@supabase/supabase-js`)  | Read & Write                             | 213 files across all domain services, repositories, and routes | **CRITICAL (P0)**                                     |
| `backend/src/db.ts`                              | `createUserScopedClient`      | Supabase (PostgREST)                  | HTTPS REST with User JWT Bearer       | Read (RLS-enforced)                      | AI reporting views (`reporting.*`)                             | **HIGH (P1)**                                         |
| `backend/src/db.ts`                              | `createAuthClient`            | Supabase GoTrue Auth                  | HTTPS REST                            | Auth (MFA, sign-in)                      | `auth.routes.ts`, session verification                         | **HIGH (P1)**                                         |
| `backend/src/db/primary.ts`                      | `primaryDb`                   | Supabase                              | Re-export of `supabase`               | Read & Write                             | `replica.ts`, `routing.ts`, `admin.ts`                         | **HIGH (P1)**                                         |
| `backend/src/db/replica.ts`                      | `replicaClient` / `replicaDb` | Supabase                              | HTTPS REST via `SUPABASE_REPLICA_URL` | Read-only                                | `routing.ts`                                                   | **MEDIUM (P2)** — currently unused by 99% of codebase |
| `backend/src/db/routing.ts`                      | `selectReadClient`            | Internal Router                       | Router dispatch                       | Routing logic                            | 2 files (`routing.test.ts`, `custom-reports.routes.ts`)        | **MEDIUM (P2)** — dead router path                    |
| `backend/src/db/admin.ts`                        | `adminDb`                     | Supabase                              | Re-export of `primaryDb`              | Session/Admin                            | Admin tooling                                                  | **LOW (P3)**                                          |
| `backend/src/routes/invoice-pdf.routes.ts`       | `storageClient`               | Supabase Storage                      | HTTPS S3-API via `storage-js`         | Bucket management & PDF cache            | PDF invoice downloads                                          | **HIGH (P1)**                                         |
| `backend/src/services/*/repository.ts` (6 files) | `supabase.storage`            | Supabase Storage                      | HTTPS S3-API                          | File uploads (images, avatars, receipts) | Product images, blog, customer profile                         | **MEDIUM (P2)**                                       |
| `packages/local-engine/src/db.ts`                | `LocalDb`                     | SQLite (better-sqlite3 / expo-sqlite) | Embedded C/Native IPC                 | Read & Write                             | Offline desktop (Electron) and mobile (React Native)           | **CRITICAL (P0)**                                     |
| `backend/src/__tests__/helpers/disposable-pg.ts` | `pg.Pool`                     | Embedded PostgreSQL                   | Direct TCP libpq (`pg`)               | Read & Write (DDL/DML)                   | 190 `*.pg.test.ts` integration test suites                     | **HIGH (P1 - Test Only)**                             |

---

### 1.2 Call Graph for Critical Domains

```text
1. Invoice & Sales:
   POST /api/invoices → invoice.routes.ts → InvoiceService.create → supabase.rpc('invoice_write_document') → invoices, invoice_items, stock_movements, journal_entries, journal_lines

2. Payments & Allocations:
   POST /api/payments → payment.routes.ts → PaymentService.create → payments.repository.ts → supabase.from('payments').insert + supabase.from('payment_allocations').insert + supabase.rpc('accounting_post_journal_entry')

3. Accounting & General Ledger:
   AccountingService.postDocument → ledger.ts → supabase.rpc('accounting_post_journal_entry') → journal_entries, journal_lines (Double-entry balance check in PL/pgSQL)

4. Costing & Stock Movements:
   InventoryCostingService → supabase.rpc('inventory_consume_layers') / supabase.rpc('inventory_receive_layer') → cost_layers, warehouse_stock

5. Synchronisation (Outbox & Ingest):
   POST /api/sync/push → sync.routes.ts → SyncService.push → sync_mutations (PK idempotency) + ENTITY_TABLE update
   GET /api/sync/pull  → sync.routes.ts → SyncService.pull → sync_change_log (cursor-based monotonic pull)
```

---

### 1.3 Supabase Dependency Map & Portability

| Supabase Feature                  | Usage in Hisabche                                                     | Portability Strategy                                                | Portability Status |
| --------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------ |
| **PostgreSQL Database**           | Primary data store, schema, tables, constraints, indexes              | Standard PostgreSQL 15/16. 100% portable.                           | `PORTABLE_CLEAN`   |
| **PL/pgSQL Functions (169 RPCs)** | All multi-table transactions (invoice write, costing, ledger posting) | Standard PostgreSQL stored functions. Executable in any Postgres.   | `PORTABLE_CLEAN`   |
| **GoTrue Auth**                   | JWT issuance, verification, password hashing, MFA (TOTP)              | Self-hosted GoTrue or independent JWT / Keycloak auth service.      | `ADAPTER_REQUIRED` |
| **Supabase Storage**              | PDF cache, avatars, receipt images, product photos                    | S3-compatible API (MinIO, Cloudflare R2, ArvanCloud S3).            | `ADAPTER_REQUIRED` |
| **PostgREST HTTP API**            | All ORM/query operations from `backend/src/db.ts`                     | PostgREST standalone container OR Drizzle/pg pool runtime.          | `ADAPTER_REQUIRED` |
| **Supabase Realtime**             | Minimal/none in backend core; polling is primary fallback             | WebSocket / SSE outbox stream or PostgreSQL `LISTEN/NOTIFY`.        | `PORTABLE_CLEAN`   |
| **Row Level Security (RLS)**      | Scoped reporting views (`reporting.*`) and anon endpoints             | Standard PostgreSQL RLS policies; identical in standalone Postgres. | `PORTABLE_CLEAN`   |
| **Service Role Key**              | Bypasses RLS for Fastify backend operations                           | Equivalent to PostgreSQL superuser/app role connection.             | `PORTABLE_CLEAN`   |

---

### 1.4 Infrastructure Artifacts Audit

- `render.yaml`: Configured for Render foreign cloud (`type: web`, `type: worker`, `healthCheckPath: /ready`). **Status:** `CONFIGURED_IN_REPOSITORY`.
- `Dockerfile`: **Does not exist.** Container build is entirely dependent on Render native Node runtime. **Status:** `VERIFIED_GAP`.
- `docker-compose.yml`: **Does not exist.** No local multi-container replication or failover testing topology. **Status:** `VERIFIED_GAP`.
- `render-build.sh` & `render-start.sh`: Shell scripts running `pnpm install` and `tsx src/index.ts`. **Status:** `CONFIGURED_IN_REPOSITORY`.

---

## 2. Phase 2 — Catalog of 100 Weaknesses and Risks

### Category A: Architecture & Single Point of Failure (SPOF)

1. **[A-01] Single International Primary Dependency:** The entire backend points to a single `SUPABASE_URL` in an overseas cloud region. If Supabase experiences an outage, all online operations halt. (`backend/src/db.ts:23`). Severity: **P0**. Status: `VERIFIED_GAP`.
2. **[A-02] Absence of Automated Standby Writer Election:** If the primary database fails, there is no automated consensus or health arbiter to elect a standby. Severity: **P0**. Status: `VERIFIED_GAP`.
3. **[A-03] Missing Database Fencing Mechanism:** No STONITH, fencing token, or writer lock exists to prevent an old primary from accepting writes if network connectivity oscillates. Severity: **P0**. Status: `VERIFIED_GAP`.
4. **[A-04] Lack of Writer Epoch Tracking:** No monotonically increasing epoch counter is passed to the database to reject writes from deposed primary instances. Severity: **P0**. Status: `VERIFIED_GAP`.
5. **[A-05] Missing Database Availability Contract:** The application treats all database connections as an undifferentiated singleton rather than enforcing availability SLAs per domain. Severity: **P1**. Status: `VERIFIED_GAP`.
6. **[A-06] Direct Business Logic Coupling to `@supabase/supabase-js`:** 213 files import `supabase` directly, tightly coupling the query syntax to PostgREST HTTP rather than an agnostic database runtime. Severity: **P1**. Status: `VERIFIED_GAP`.
7. **[A-07] Coexistence of Divergent DB Modules:** `backend/src/db.ts` (monolith) and `backend/src/db/index.ts` (routing module) coexist, creating import ambiguity. Severity: **P2**. Status: `VERIFIED_GAP`.
8. **[A-08] Inactive Database Routing Engine:** `backend/src/db/routing.ts` exists but is imported by only 2 non-core files; all production transactions bypass it. Severity: **P1**. Status: `VERIFIED_GAP`.
9. **[A-09] No Independent Standby Ingestion Pipeline:** No cross-provider standby (e.g. self-hosted Postgres in Iran) is continuously fed via physical streaming or logical replication. Severity: **P0**. Status: `VERIFIED_GAP`.
10. **[A-10] Single Point of Process Execution on Render:** API and worker processes run exclusively on Render's Frankfurt/Oregon infrastructure. Severity: **P0**. Status: `VERIFIED_GAP`.

### Category B: Provider Lock-in

11. **[B-01] PostgREST Protocol Coupling:** All table queries depend on PostgREST syntax (`.from().select().eq()`), preventing direct libpq connection pool usage. Severity: **P1**. Status: `VERIFIED_GAP`.
12. **[B-02] GoTrue Auth REST Coupling:** `gotrueRequest` (`backend/src/db.ts:230`) hardcodes Supabase Auth HTTP endpoints (`/auth/v1/`). Severity: **P1**. Status: `VERIFIED_GAP`.
13. **[B-03] Supabase Storage JS Coupling:** Product images, avatars, and invoices interact directly with `@supabase/storage-js` rather than standard AWS S3 SDK. Severity: **P2**. Status: `VERIFIED_GAP`.
14. **[B-04] Service Role Key Architecture:** Database authorization relies on a static Supabase `service_role` JWT token rather than native PostgreSQL role grants. Severity: **P2**. Status: `VERIFIED_GAP`.
15. **[B-05] Supavisor / PgBouncer Session Pinning:** Transaction pooler drops prepared statements and session state without client abstraction. Severity: **P2**. Status: `PARTIAL`.
16. **[B-06] Hardcoded Supabase URL in PDF Routes:** `backend/src/routes/invoice-pdf.routes.ts` independently reads `process.env.SUPABASE_URL` and creates a standalone client. Severity: **P2**. Status: `VERIFIED_GAP`.
17. **[B-07] Drizzle ORM Disconnect:** `backend/drizzle.config.ts` exists, but Drizzle is unused in runtime business logic (dead configuration). Severity: **P3**. Status: `VERIFIED_GAP`.
18. **[B-08] Implicit Schema Ownership:** Supabase CLI auto-manages migrations in cloud, diverging from raw SQL migration scripts in `docs/`. Severity: **P2**. Status: `VERIFIED_GAP`.
19. **[B-09] Absence of Generic Database Driver Interface:** No TypeScript interface defines `DatabaseRuntime` or `QueryExecutor` independently of Supabase. Severity: **P1**. Status: `VERIFIED_GAP`.
20. **[B-10] Non-Portable Cloud Secrets:** System expects `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` to be injected by Supabase dashboard. Severity: **P2**. Status: `VERIFIED_GAP`.

### Category C: Replication & Routing

21. **[C-01] Replica Lag Unmeasured in Live Traffic:** `selectReadClient` accepts `replicaLagMs`, but no background thread or metric collector continuously populates it. Severity: **P1**. Status: `VERIFIED_GAP`.
22. **[C-02] Stale Read Vulnerability:** Permitted replica queries (`REPLICA_READ_ALLOWLIST`) can serve stale data if replication lag spikes, causing financial report inaccuracy. Severity: **P1**. Status: `VERIFIED_GAP`.
23. **[C-03] Unconditional Fallback to Primary:** When replica fails, routing falls back to primary, which can overwhelm the primary during traffic surges. Severity: **P2**. Status: `PARTIAL`.
24. **[C-04] Lack of Read-After-Write Consistency:** A client creating an invoice cannot reliably read from a replica immediately due to uncoordinated replication lag. Severity: **P1**. Status: `VERIFIED_GAP`.
25. **[C-05] Missing Logical Replication Slots Monitoring:** No alerts track replication slot bloat or disk exhaustion caused by disconnected standbys. Severity: **P1**. Status: `VERIFIED_GAP`.
26. **[C-06] Inability to Route Transactions to Standby:** All mutating queries lack routing encapsulation and hit the default singleton. Severity: **P1**. Status: `VERIFIED_GAP`.
27. **[C-07] Hardcoded Allowlist Strings:** `REPLICA_READ_ALLOWLIST` uses fragile string prefixes (`services/reporting/`) instead of method decorators or query context. Severity: **P2**. Status: `VERIFIED_GAP`.
28. **[C-08] Absence of Connection Pool Draining:** When switching replica targets, existing idle connections are not gracefully drained. Severity: **P2**. Status: `VERIFIED_GAP`.
29. **[C-09] Unverified Schema Parity on Replica:** No preflight checks ensure that newly applied migrations on primary are active on read replica before routing. Severity: **P1**. Status: `VERIFIED_GAP`.
30. **[C-10] Lack of Health Probe Circuit Breaker:** Repeated failures against a lagging replica continue without opening an automated circuit breaker. Severity: **P2**. Status: `VERIFIED_GAP`.

### Category D: Failover & Recovery

31. **[D-01] Split-Brain Risk Under Regional Network Split:** If Iran-to-global network breaks, both sides could potentially accept writes if failover is uncoordinated. Severity: **P0**. Status: `VERIFIED_GAP`.
32. **[D-02] Lack of Fenced Production Promotion:** Standby promotion currently lacks a cryptographic fencing token or lease verification. Severity: **P0**. Status: `VERIFIED_GAP`.
33. **[D-03] Manual-Only DNS Switching:** Failover relies on manual DNS record updates, taking up to TTL expiration (hours) to propagate to clients. Severity: **P1**. Status: `VERIFIED_GAP`.
34. **[D-04] Incomplete Worker Drain on Failover:** Background jobs in progress during primary failover risk writing to a dead or split database. Severity: **P1**. Status: `VERIFIED_GAP`.
35. **[D-05] Unhandled In-Flight HTTP Requests:** In-flight client transactions during failover fail abruptly with 502/504 errors without replay safety. Severity: **P1**. Status: `VERIFIED_GAP`.
36. **[D-06] Missing Failback Orchestration Runbook:** No automated mechanism exists to re-synchronize the old primary as a replica after recovery. Severity: **P1**. Status: `VERIFIED_GAP`.
37. **[D-07] Lack of Automated Quorum:** Two-node active-passive setup lacks a third tie-breaking witness node, risking partition deadlock. Severity: **P1**. Status: `VERIFIED_GAP`.
38. **[D-08] Unverified Data Loss Window (RPO):** Real replication lag between primary and standby is not captured in failover logs. Severity: **P1**. Status: `VERIFIED_GAP`.
39. **[D-09] Client Token Invalidation on Failover:** If Auth provider changes during failover, all active client JWTs are invalidated, kicking users offline. Severity: **P1**. Status: `VERIFIED_GAP`.
40. **[D-10] Missing Post-Promotion Sanity Probes:** No automated integrity query verifies database consistency immediately following standby promotion. Severity: **P1**. Status: `VERIFIED_GAP`.

### Category E: Backup & Disaster Recovery

41. **[E-01] Reliance on Supabase Managed Daily Backups:** Backups reside within the same vendor cloud failure domain. Severity: **P1**. Status: `VERIFIED_GAP`.
42. **[E-02] Lack of Continuous WAL Archiving to Independent Object Storage:** No automated `pgBackRest` or `WAL-G` archives WAL segments to AWS S3 / MinIO. Severity: **P0**. Status: `VERIFIED_GAP`.
43. **[E-03] Untested Point-in-Time Recovery (PITR):** Recovery to an arbitrary minute (e.g. 1 minute before data corruption) is not verified by automated drill. Severity: **P1**. Status: `VERIFIED_GAP`.
44. **[E-04] Missing Automated Backup Checksum Verification:** Backup archives are not cryptographically verified with SHA-256 manifests upon creation. Severity: **P2**. Status: `VERIFIED_GAP`.
45. **[E-05] Storage Blob Disconnect from Database Backup:** Media attachments (invoices, receipts) are backed up separately without atomic cross-reference to DB rows. Severity: **P2**. Status: `VERIFIED_GAP`.
46. **[E-06] Incomplete Restore Drill Automation:** `scripts/dr-restore-drill.mjs` checks file existence rather than spinning up an isolated PostgreSQL instance. Severity: **P1**. Status: `VERIFIED_GAP`.
47. **[E-07] Unencrypted Cold Backup Archives:** SQL dump backups lack client-side GPG/AES-256 encryption at rest prior to upload. Severity: **P2**. Status: `VERIFIED_GAP`.
48. **[E-08] Missing Immutable Backup Policy:** Backups are susceptible to malicious or accidental deletion (no S3 Object Lock / WORM). Severity: **P2**. Status: `VERIFIED_GAP`.
49. **[E-09] No Trial Balance Verification on Restored DB:** Drills do not compute a full double-entry trial balance to prove restored accounting integrity. Severity: **P1**. Status: `VERIFIED_GAP`.
50. **[E-10] Backup Credential Contamination:** Backup workers share production service keys instead of isolated read-only backup credentials. Severity: **P2**. Status: `VERIFIED_GAP`.

### Category F: Financial Data Integrity

51. **[F-01] Missing Idempotency Key Enclosure on Certain Mutating Routes:** While invoices use idempotency, ad-hoc payment allocations can double-post on network retry. Severity: **P1**. Status: `PARTIAL`.
52. **[F-02] Non-Atomic Multi-Step Payments:** Payment creation and ledger posting involve multiple async steps; failure mid-way can leave unposted payments. Severity: **P1**. Status: `PARTIAL`.
53. **[F-03] Floating-Point Risk in External Calculations:** Ensure all math adheres strictly to integer minor units (Rule 3). Severity: **P0**. Status: `VERIFIED_IMPLEMENTED` (guarded by `no-hardcoded-currency.test.ts`).
54. **[F-04] AFN Currency Decimal Ambiguity:** Ensure AFN is never multiplied or divided by 100 in financial pipelines. Severity: **P0**. Status: `VERIFIED_IMPLEMENTED`.
55. **[F-05] Unposted Invoice Accumulation:** Network timeout after `invoices` insert but before `journal_entries` commit leaves invoices unposted. Severity: **P1**. Status: `PARTIAL`.
56. **[F-06] Last-Write-Wins Risk on Concurrent Invoice Updates:** Optimistic locking (`version` column) is missing on certain financial tables like `transactions`. Severity: **P1**. Status: `VERIFIED_GAP`.
57. **[F-07] Lack of Outbox Event Guarantees:** Financial mutations do not consistently write an outbox event in the exact same DB transaction. Severity: **P1**. Status: `PARTIAL`.
58. **[F-08] Silent Rounding Drift in Multi-Currency Exchanges:** Cross-currency ledger entries can accumulate minor rounding imbalances over time. Severity: **P2**. Status: `PARTIAL`.
59. **[F-09] Cost Layer Over-Consumption Under High Concurrency:** Concurrent sales orders consuming FIFO layers can over-consume if row-level locking is skipped. Severity: **P1**. Status: `PARTIAL`.
60. **[F-10] Unknown Outcome Recovery Blindspot:** When a client receives a 504 Gateway Timeout, no explicit reconciliation endpoint determines if the write committed. Severity: **P1**. Status: `VERIFIED_GAP`.

### Category G: Migration & Schema Parity

61. **[G-01] Manual Human Migration Barrier:** DDL migrations must be executed by hand in Supabase SQL Editor (`docs/*-migration.sql`). Severity: **P1**. Status: `VERIFIED_IMPLEMENTED` (Repository Governance Rule).
62. **[G-02] Missing Automated Schema Fingerprinting:** No cryptographic hash of tables, triggers, and functions verifies that Standby matches Primary. Severity: **P1**. Status: `VERIFIED_GAP`.
63. **[G-03] Extension Dependency Discrepancies:** Standby Postgres may lack Supabase-specific extensions (`pgjwt`, `vault`, `pg_stat_statements`). Severity: **P2**. Status: `VERIFIED_GAP`.
64. **[G-04] Sequence Drift Between Active and Standby:** Sequences (`invoices_serial_seq`) can lose synchronization during asynchronous replication. Severity: **P1**. Status: `VERIFIED_GAP`.
65. **[G-05] Trigger Ordering Variations:** DB triggers (e.g. `sync_change_log`) must fire in identical deterministic order across all replicas. Severity: **P2**. Status: `PARTIAL`.
66. **[G-06] RLS Policy Divergence:** If Standby is deployed on vanilla PostgreSQL, missing RLS policies could allow data leakage if anon keys are used. Severity: **P1**. Status: `VERIFIED_GAP`.
67. **[G-07] View and Materialized View Refresh Lag:** Materialized views for analytics are not automatically refreshed on read replicas. Severity: **P3**. Status: `PARTIAL`.
68. **[G-08] Missing Automated Rollback Proof for Migrations:** Not all SQL migrations have an idempotent and verified rollback script. Severity: **P2**. Status: `PARTIAL`.
69. **[G-09] Lack of Pre-Migration Data Validation:** Migrations introducing `NOT NULL` or `CHECK` constraints can fail on dirty production rows without findings queries. Severity: **P1**. Status: `PARTIAL`.
70. **[G-10] Drizzle Schema Desynchronization:** `backend/drizzle.config.ts` is abandoned, leaving raw SQL as the only migration source of truth. Severity: **P2**. Status: `VERIFIED_GAP`.

### Category H: Iran & Network Resilience

71. **[H-01] Total Outage on International Internet Disconnection:** Fastify API (Render) and Database (Supabase) are overseas. When Iran's National Information Network (NIN) isolates, all Iranian web users are cut off. Severity: **P0**. Status: `VERIFIED_GAP`.
72. **[H-02] Foreign Auth Dependency in Iran:** Users cannot log in or refresh JWT tokens during international cuts because GoTrue servers are abroad. Severity: **P0**. Status: `VERIFIED_GAP`.
73. **[H-03] Foreign Storage Dependency:** Receipts and invoice PDFs stored in Supabase Storage cannot be viewed or printed in Iran during network cut. Severity: **P1**. Status: `VERIFIED_GAP`.
74. **[H-04] High Latency on Iranian Cross-Border Round-Trips:** Round-trip latency from Tehran to Frankfurt Supabase averages 120-180ms, slowing down multi-query transactions. Severity: **P2**. Status: `PARTIAL`.
75. **[H-05] DNS Hijacking & Censorship Fragility:** Relying solely on foreign DNS makes client resolution vulnerable to regional filtering. Severity: **P1**. Status: `VERIFIED_GAP`.
76. **[H-06] Cloudflare Blocking & Captcha Traps:** Cloudflare security challenges can block legitimate Iranian business clients and mobile sync workers. Severity: **P1**. Status: `VERIFIED_GAP`.
77. **[H-07] Lack of Local Domestic Mirror Node:** No standby API node exists inside Iranian datacenters (e.g. Asiatech, Afranet) for domestic failover. Severity: **P0**. Status: `VERIFIED_GAP`.
78. **[H-08] Iran-to-International Streaming Replication Stalling:** Synchronous replication from Iran to an abroad standby will hang all transactions during an internet cutoff. Severity: **P0**. Status: `VERIFIED_GAP`.
79. **[H-09] Payment Gateway Disconnect:** Iranian Shaparak/Shetab payment callbacks cannot reach foreign Render endpoints during network isolation. Severity: **P1**. Status: `VERIFIED_GAP`.
80. **[H-10] Sanctions & Sudden Account Suspension Risk:** Foreign providers (Render, Supabase) can abruptly terminate service for Iran-based businesses. Severity: **P1**. Status: `VERIFIED_GAP`.

### Category I: Infrastructure & Security

81. **[I-01] Render Single Process API Bottleneck:** Default configuration runs single API instance, causing downtime during deployment restarts. Severity: **P1**. Status: `VERIFIED_GAP`.
82. **[I-02] In-Memory Session Vulnerability in Node:** Memory leaks or high load can trigger process restarts, dropping in-flight requests. Severity: **P2**. Status: `PARTIAL`.
83. **[I-03] Connection Pool Saturation on Supavisor:** Simultaneous spikes from web and mobile clients can exhaust transaction pooler limits. Severity: **P1**. Status: `PARTIAL`.
84. **[I-04] Lack of Automated Secret Rotation:** Database service keys and JWT secrets have no scheduled zero-downtime rotation protocol. Severity: **P2**. Status: `VERIFIED_GAP`.
85. **[I-05] Direct Public Exposure of Database Port:** Standby or primary databases exposed to public internet without mTLS or private WireGuard VPN. Severity: **P1**. Status: `VERIFIED_GAP`.
86. **[I-06] Missing Rate Limiting on Financial Ingestion Routes:** `/api/sync/push` and `/api/invoices` can be flooded by runaway sync clients. Severity: **P2**. Status: `PARTIAL`.
87. **[I-07] Unrestricted Error Message Leaks:** Raw PostgREST database errors can occasionally expose table schemas in HTTP responses. Severity: **P2**. Status: `PARTIAL`.
88. **[I-08] Inadequate Centralized Logging:** Logs are split between Render console and Supabase dashboard without unified correlation IDs. Severity: **P2**. Status: `VERIFIED_GAP`.
89. **[I-09] Worker Scheduler Collision Risk:** Multiple worker replicas can execute the same cron or background job concurrently without advisory locking. Severity: **P1**. Status: `PARTIAL`.
90. **[I-10] Unhardened Docker Environment:** No hardened, multi-stage Docker container specification exists in the repository. Severity: **P2**. Status: `VERIFIED_GAP`.

### Category J: Local-First & Sync Integrity

91. **[J-01] Shared SQLite Database File on Multi-User Device:** All user accounts on a desktop device share one `app.db` file, risking cross-user data exposure on logout. Severity: **P0**. Status: `VERIFIED_GAP`.
92. **[J-02] Web Client Bypasses Local-First Commit:** In Next.js web application, actions are sent over network before being committed to client-side local storage. Severity: **P0**. Status: `VERIFIED_GAP`.
93. **[J-03] Missing Local Database Encryption at Rest:** SQLite databases containing sensitive customer and financial records are unencrypted on disk. Severity: **P1**. Status: `VERIFIED_GAP`.
94. **[J-04] Role-Scoped Provisioning Gap:** On initial sync, employees can download workspace products and customer records without role-based row filtering. Severity: **P1**. Status: `VERIFIED_GAP`.
95. **[J-05] Bandwidth-Unaware Sync Flooding:** Large offline sync batches saturate weak 3G/dialup links without progressive chunking or priority queuing. Severity: **P2**. Status: `VERIFIED_GAP`.
96. **[J-06] Stale Local Data Overwriting Server State:** Resolving conflicts without explicit state machines risks discarding valid server-side updates. Severity: **P1**. Status: `VERIFIED_GAP`.
97. **[J-07] Multi-Device Mutation Divergence:** Two offline devices modifying the same entity can result in divergent states if merge rules are non-deterministic. Severity: **P1**. Status: `VERIFIED_GAP`.
98. **[J-08] Missing Local Schema Migration Versioning:** Local SQLite migrations (`packages/app-bridge/src/local-migrations.ts`) can fail if server schema evolves ahead of client. Severity: **P2**. Status: `PARTIAL`.
99. **[J-09] Silent Mutation Loss on Client Crash:** If device crashes between UI action and SQLite commit, user is unaware that mutation was lost. Severity: **P1**. Status: `VERIFIED_GAP`.
100.  **[J-10] Unobservable Sync Queue State:** Users have no UI visibility into whether their changes are `local_pending`, `syncing`, `committed`, or `conflicted`. Severity: **P2**. Status: `PARTIAL`.

---

## 3. Phase 3 — Evaluation of 10 Alternative Architectures

| #      | Architecture                                                               | Availability                       | RPO                     | RTO                        | Iran Resilience                                      | Complexity  | Est. Monthly Cost | Risk Level                          | Hisabche Fit                     |
| ------ | -------------------------------------------------------------------------- | ---------------------------------- | ----------------------- | -------------------------- | ---------------------------------------------------- | ----------- | ----------------- | ----------------------------------- | -------------------------------- |
| **1**  | **Supabase Primary + Supabase Read Replica**                               | 99.9% (single cloud)               | < 1 min                 | 15–30 min (manual)         | **Fails completely** on international cut            | Low         | $50 - $150        | High (Foreign SPOF)                 | Poor for Iran/Afghan             |
| **2**  | **Supabase Primary + External PostgreSQL Warm Standby**                    | 99.95%                             | ≤ 5 min (async)         | 15–30 min                  | Partial (only if API also moves)                     | Medium      | $100 - $250       | Medium                              | Transitory Step                  |
| **3**  | **Iran PostgreSQL Primary + Iran Standby**                                 | 99.9% (domestic)                   | Near zero               | < 15 min                   | **100% resilient** in Iran; fails for diaspora users | Medium      | $60 - $150        | Medium (Domestic infra quality)     | Good for Iran-only               |
| **4**  | **Iran Primary + International Standby**                                   | 99.95%                             | ≤ 5 min                 | 15–30 min                  | High in Iran; Global async backup                    | High        | $150 - $350       | Medium (Iran link volatility)       | Strong Candidate                 |
| **5**  | **International Primary + Iran Warm Standby**                              | 99.95%                             | ≤ 5 min                 | 15–30 min                  | Fails online writes in Iran during cut               | Medium      | $120 - $300       | High (Split-brain risk on failover) | Suboptimal                       |
| **6**  | **Patroni + etcd + HAProxy + Synchronous Replication**                     | 99.99%                             | Zero                    | < 1 min (auto)             | Stalls writes during cross-border cut                | Extreme     | $300 - $800       | High (DevOps maintenance overload)  | Overengineered                   |
| **7**  | **Managed PostgreSQL Across Multiple Cloud Providers**                     | 99.95%                             | ≤ 5 min                 | 15–30 min                  | Medium (foreign providers block Iran)                | High        | $250 - $600       | High (Sanction risk)                | Infeasible                       |
| **8**  | **Self-Hosted PostgreSQL + WAL-G / pgBackRest (Independent S3)**           | 99.9%                              | < 5 min                 | < 30 min                   | High (Full provider independence)                    | Medium      | $80 - $200        | Low                                 | Excellent Disaster Recovery Core |
| **9**  | **Multi-Region Active-Passive + Fencing Controller + Lease/Epoch**         | 99.99%                             | ≤ 1 min                 | < 10 min (fenced)          | High; clear writer lease prevents split-brain        | High        | $200 - $500       | Medium                              | Enterprise Target                |
| **10** | **Multi-Provider Business OS (Iran API + Global API + Per-User Local DB)** | **99.999%** operational continuity | Near zero (Local-first) | Zero (Local UX) / < 15m DB | **Maximum** (Continues offline/domestic/abroad)      | Medium-High | $150 - $350       | Low (Zero SPOF)                     | **10/10 OPTIMAL FIT**            |

### Critical Analysis of Architecture 10:

Architecture 10 is the only architecture that genuinely survives an international internet disconnection. If an Iran API server relied on foreign Auth (GoTrue) or foreign Storage, placing PostgreSQL in Iran would still result in total outage. Architecture 10 decouples:

1. **Local-First Per-User Client Engine:** Commits transactions locally on device first (instant RTO = 0, zero data loss).
2. **Dual-Region API Nodes:** Domestic Iran API node + International Global API node.
3. **Decoupled Auth & Storage:** Local JWT verification via shared public key + domestic S3 object storage mirror.
4. **Active Writer Fencing:** Monotonic epoch leasing guarantees that even if cross-region links sever, only one authorized writer exists at any given second, completely eliminating split-brain.

---

## 4. Phase 4 — Final Architecture Selection & Topology

### The Canonical Topography

```text
                               +-----------------------------------+
                               |          CLIENT DEVICES           |
                               | (Web / Windows Desktop / Android) |
                               +-----------------------------------+
                                                 |
                                [1. LOCAL-FIRST COMMIT (SQLite)]
                                [Per-User Partition + Encryption]
                                                 |
                                [2. ROLE-SCOPED & BANDWIDTH-AWARE]
                                [Idempotent Outbox Synchronization]
                                                 |
                               +-----------------------------------+
                               |         INTELLIGENT EDGE          |
                               |    (DNS / Failover Director)      |
                               +-----------------------------------+
                                        /                 \
                     (Domestic Routing)/                   \(Global Routing)
                                      /                     \
                   +---------------------+               +---------------------+
                   |   IRAN REGION API   |               |  GLOBAL REGION API  |
                   | (Fastify Node + Auth|               | (Render/VPS + Auth  |
                   |  + Domestic S3)     |               |  + Global S3)       |
                   +---------------------+               +---------------------+
                                      \                     /
                                       \                   /
                           +-----------------------------------------+
                           |         DATABASE RUNTIME ROUTER         |
                           |   (Active Writer Lease + Epoch Guard)   |
                           +-----------------------------------------+
                                                |
                              +-----------------+-----------------+
                              |                                   |
                   +---------------------+             +---------------------+
                   |   PRIMARY WRITER    |             |   STANDBY REPLICA   |
                   | (Authoritative DB)  |             |  (Continuous Stream)|
                   +---------------------+             +---------------------+
                              |                                   |
                              +-----------------+-----------------+
                                                |
                               +---------------------------------+
                               |    INDEPENDENT BACKUP VAULT     |
                               | (WAL Archiving + PITR + WORM S3)|
                               +---------------------------------+
```

### Non-Negotiable Invariants of Selected Architecture:

1. **Never Assume Iran or International is Mandatorily Primary:** The router accepts an explicit writer lease with a monotonic epoch. The designated writer is dynamic, evidence-backed, and human-promoted.
2. **Strict Fencing Token:** The database rejects any write carrying an epoch lower than the currently recorded database epoch (`current_writer_epoch`).
3. **Local-First Guarantee:** Every user mutation (Owner, Manager, Employee) is committed to their isolated local partition in SQLite before network transmission.
4. **Replay Idempotency:** Server checks `sync_mutations` PK (`mutation_id`); duplicates are acknowledged without re-executing accounting, inventory, or payment effects.
5. **Zero Split-Brain:** If cross-region network splits, the Standby CANNOT auto-promote. It remains read-only until an authorized human issues a cryptographically signed promotion command.
