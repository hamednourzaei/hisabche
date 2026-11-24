# HISABCHE V2 — PROVIDER-AGNOSTIC, LOCAL-FIRST, MULTI-DATABASE HIGH AVAILABILITY & DISASTER RECOVERY

## MASTER ENGINEERING AUDIT & IMPLEMENTATION PROMPT (v2, hardened to 10/10)

### Mission

Transform Hisabche into an **Offline-First, Per-User-Local, Multi-Database, Multi-Provider Business Operating System** that:

- Continues business operations during Supabase failure, Render failure, regional network failure, international internet disconnection, and single-database failure.
- **Does not depend on any single provider** — not Supabase, not Render, not Cloudflare, not any single Iran VPS, not any single database vendor. The end state is not "Supabase copied to another server"; it is a provider-agnostic architecture where any component can be replaced without rewriting the business core.
- Preserves **financial correctness** across failover, retries, offline periods, and multi-device sync — zero duplicate invoices, payments, journal entries, or stock movements; zero split-brain.
- Treats **every user action** (Owner, Manager, Employee — any role) as a **local-first write**: the write commits to that user's local database **first**, and only then synchronizes to the server, in a role-scoped and load-aware manner, without ever corrupting the shared database.

---

## 0. Role & Responsibilities

Act as a combined senior engineering team:

1. Principal Backend Engineer
2. Principal PostgreSQL Database Architect
3. Senior Database Reliability Engineer
4. Principal DevOps / SRE Engineer
5. Distributed Systems Architect
6. Disaster Recovery Specialist
7. Infrastructure Security Engineer
8. Financial Data Integrity Engineer
9. Offline-First / Per-User Local Database Architect
10. Production Readiness Auditor

Project context:

- Repository: `https://github.com/hamednourzaei/hisabche`
- Branch: `main`
- Product: Hisabche / حسابچه
- Model: Offline-First Business Operating System
- Initial markets: Iran and Afghanistan
- Primary requirement: **financial and operational continuity despite infrastructure failures**

**Hard constraint:** Do not produce documentation and then claim the system is implemented. Every claim must be backed by code, tests, or a clearly labeled `BLOCKED_EXTERNAL` status.

---

## 0.1 Three Deliberately Strict Design Principles (Non-negotiable)

These three principles were chosen deliberately and must not be relaxed:

1. **The Iran database is not mandated to be Primary.** The determining factors must be real customer reachability, legal requirements, network quality, and operational capacity. Do not assume Iran-Primary or International-Primary — decide with evidence.
2. **International internet disconnection is treated separately from database failure.** If the Iran-side API depends on foreign Auth or foreign Storage, putting PostgreSQL inside Iran will not solve the outage. Database residency and dependency residency must be analyzed independently.
3. **Implementation is separated from automatic Production promotion.** Wrong failover in a financial system can be more dangerous than the outage itself. Automated detection may be implemented; automated Production promotion must require explicit human approval, fenced execution, and rollback proof.

---

## 0.2 The New Local-First / Per-User Database Requirement (Non-negotiable)

This is a first-class architectural requirement, not an optional enhancement.

For **every user — Owner, Manager, Employee, or any future role — every activity they perform inside Hisabche must be persisted to that user's own local database first**, and only then synchronized to the server.

Mandatory properties:

1. **Per-user local database.** Each user account on each device has its own local database (or a strictly isolated local data partition). Cross-user data leakage on the same device is forbidden.
2. **Local-first commit.** Any user action (invoice, payment, stock movement, journal entry, customer edit, settings change, report snapshot, etc.) must be written to the local database and acknowledged locally **before** any network call to the server is attempted.
3. **Durable offline survival.** If the internet drops, the local write must survive process restart, device reboot, and prolonged offline periods without data loss.
4. **Role-scoped, account-scoped incremental provisioning on login.** When a user logs in, the server must provision an incremental dataset scoped to that user's role, workspace, and account. The client must not be required to download the entire workspace to function.
5. **Load-aware, bandwidth-aware sync.** Sync must adapt to server load and client bandwidth (rate limiting, backoff, batching, priority queues). A user on a slow link must not be starved; a user on a fast link must not overload the server.
6. **Segregated, damage-free replay.** On reconnect, pending local mutations must be replayed to the server in a segregated, idempotent, conflict-aware manner that cannot corrupt the shared database, cannot double-apply, and cannot overwrite newer server state with stale local state.
7. **Role- and permission-respecting sync.** A user must never receive data they are not permitted to see, even in the local cache. Server-side authorization must be the source of truth; local caches must not be an authorization bypass.
8. **Multi-device consistency for the same user.** If the same user has multiple devices, the local databases must converge without duplicating financial effects and without silently discarding mutations.
9. **Local encryption at rest.** Local databases containing financial data must be encrypted at rest, with keys bound to device/user identity.
10. **Local schema versioning and migration.** The local database schema must be versioned and migratable, independently of the server schema, and must tolerate server schema evolution.
11. **Explicit sync state machine.** Every mutation must have an explicit lifecycle (e.g., `local_pending`, `syncing`, `server_committed`, `conflict`, `rejected`, `reconciled`) that is observable, auditable, and recoverable.
12. **No silent loss, no silent duplication.** A mutation must never disappear silently, and a retry must never create a second financial effect.

This requirement must be designed, audited, implemented, and tested as a dedicated phase (Phase 7), not folded into generic sync documentation.

---

# PHASE 0 — Non-Negotiable Rules

Before starting, read:

- `AGENTS.md` and every nested `AGENTS.md`
- Architecture docs, Database docs, Sync docs, Security docs, Migration docs
- PostgreSQL tests
- Production and deployment docs

Rules:

1. No commit, no push.
2. No reset, rebase, stash, checkout, or clean.
3. Preserve all existing user changes.
4. Never read, print, or disclose any `.env` or secret.
5. Never record credentials in reports.
6. Never run DDL or writes against Supabase Production.
7. Never alter any live database.
8. Never create external servers, projects, or services.
9. Never incur cost on the user's behalf.
10. Never change dependencies or lockfiles without explicit permission.
11. Never run a production build unless explicitly authorized.
12. Do not use subagents.
13. Do not use `any`, `@ts-ignore`, or `eslint-disable`.
14. Do not use fake APIs, placeholders, fake success, or dead code.
15. Do not build a parallel architecture or duplicate engine.
16. Do not create a second Database Router alongside the existing one — extend the existing one.
17. Every change must remain compatible with the existing architecture.
18. Never use a mocked test state to claim real database health.
19. Never conflate `IMPLEMENTED` with `LIVE_VERIFIED`.
20. Record every infrastructure ambiguity as `BLOCKED_EXTERNAL`.

Record repository state before any change: git status, branch, HEAD SHA, dirty files, existing modifications, untracked files.

---

# PHASE 1 — Repository Forensic Audit

## 1.1 Database Connection Audit

Starting points:

- `backend/src/db.ts`
- `backend/src/db/`
- `backend/src/db/primary.ts`
- `backend/src/db/replica.ts`
- `backend/src/db/routing.ts`
- `backend/src/db/admin.ts`

This list is a starting point, not exhaustive. Find every related file.

Look for: all `createClient` calls, all `createPool` calls, all PostgreSQL connections, all Supabase clients, all Drizzle connections, all connection pools, all direct database queries, all RPC calls, all session-based operations, all transactions, all database environment variables.

**Required output table:**

| File | Client | Provider | Connection Type | Read/Write | Consumers | Criticality |
| ---- | ------ | -------- | --------------- | ---------- | --------- | ----------- |

No database connection may be omitted.

## 1.2 Real Call Graph

Reconstruct the real chain for each critical domain:

`Route → Controller → Service → Repository → Database Client`

Cover at minimum: Invoice, Invoice Items, Payments, Payment Allocations, Accounting, Journal Entries, Journal Lines, Products, Inventory, Stock Movements, Warehouses, Customers, Employees, Payroll, Manufacturing, Orders, Purchase Orders, Returns, Expenses, Reports, Audit Logs, Sync Mutations, Sync Change Logs, Workspace Management, Authentication, Permissions, Background Jobs, Webhooks.

For each path, determine: direct Supabase dependency, repository usage, real transaction boundary, idempotency, safe retry, portability to standalone PostgreSQL, and whether it works during an internet cut.

## 1.3 Supabase Dependency Map

Classify every dependency into: PostgreSQL, Supabase Auth, Supabase Storage, Supabase Realtime, Supabase RPC, Supabase Edge Functions, Supabase RLS, Supabase Service Role, Supavisor / PgBouncer, Supabase-specific extensions.

For each dependency, decide: replaceable with standard PostgreSQL, replaceable with an independent service, needs an adapter, needs redesign, or truly tied to an external service.

The goal: Hisabche must be able to run without Supabase in the future without rewriting the financial and operational core.

## 1.4 Infrastructure File Audit

Inspect: `render.yaml`, all Dockerfiles, Docker Compose files, GitHub Actions, deployment scripts, Cloudflare config, DNS config, health checks, readiness checks, runtime configuration, environment schemas, infrastructure docs, migration scripts, backup scripts, restore scripts.

The existence of a file does not prove the feature is active. Classify each capability as:

`CODE_EXISTS`, `CONFIGURED_IN_REPOSITORY`, `CONFIGURED_EXTERNALLY`, `TESTED_IN_STAGING`, `LIVE_VERIFIED`, `BLOCKED_EXTERNAL`, `NOT_IMPLEMENTED`.

## 1.5 Local-First / Per-User Local Database Audit

Additionally audit the current state of:

- Local engine(s): SQLite / Local Engine and any other client-side store.
- Where local writes currently happen.
- Whether local writes are committed before server calls.
- Current sync protocol (`sync_mutations`, `sync_change_log`, cursors).
- Role-based data filtering at sync time.
- Local encryption at rest.
- Local schema versioning.
- Multi-device consistency handling.
- Behaviour during internet cut.
- Behaviour on reconnect (replay, idempotency, conflict).
- Whether any role (Owner / Manager / Employee) currently bypasses local-first.

**Required output:** a matrix of every user role × every critical action × (local-first committed? / synced? / role-scoped? / tested?).

---

# PHASE 2 — At Least 100 Weaknesses and Risks

Identify at least 100 real, independent weaknesses. Cover the following 10 categories:

**A. Architecture & Single Point of Failure** — single Primary dependency, missing independent Standby, missing Writer Election, missing Fencing, missing Split-Brain protection, missing Writer Epoch, missing Failback, missing Multi-Provider Database Runtime, business logic coupled directly to provider, missing Database Availability Contract.

**B. Provider Lock-in** — Supabase client coupling, Auth coupling, Storage coupling, Realtime coupling, RPC coupling, RLS portability, service-role dependency, connection-pool dependency, provider-specific SQL, migration impossible without rewrite.

**C. Replication & Routing** — replica availability, replica lag measurement, replica health checks, read routing, write routing, read-after-write consistency, stale-read risk, query-failure fallback, schema parity, promotion readiness.

**D. Failover & Recovery** — failure detection, failure classification, quorum, consensus, fencing, promotion, connection draining, endpoint switching, worker coordination, failback.

**E. Backup & Disaster Recovery** — PITR, full backup, incremental backup, WAL archiving, immutable backup, encryption, backup manifest, checksum verification, restore verification, storage backup.

**F. Financial Data Integrity** — invoice idempotency, payment idempotency, inventory idempotency, ledger idempotency, cross-database duplicate mutations, outbox durability, transaction boundaries, optimistic concurrency, financial reconciliation, unknown transaction outcome.

**G. Migration & Schema** — migration manifest, schema versioning, extension parity, function parity, trigger parity, sequence parity, index parity, RLS parity, GRANT parity, rollback safety.

**H. Iran & Network Resilience** — Supabase international dependency, Render international dependency, national internet disconnection, international network failure, Iran-to-international replication, DNS dependency, ISP dependency, regional failure domain, data residency, local authentication availability.

**I. Infrastructure & Security** — API instance availability, API statelessness, worker availability, connection pool saturation, secret rotation, backup credential isolation, database network isolation, monitoring, alerting, capacity planning.

**J. Local-First & Sync Integrity (new)** — local write not committed first, local write lost on crash, missing local schema versioning, missing local encryption, missing role-scoped provisioning, missing role-scoped authorization on local cache, sync not load-aware, sync not bandwidth-aware, duplicate financial effect on replay, stale local overwrite, missing per-user isolation on shared device, multi-device divergence, missing conflict state machine, missing sync observability.

**K. Testing & Production Readiness** — PostgreSQL integration coverage, failover tests, restore tests, chaos tests, network partition tests, sync recovery tests, financial consistency tests, runbook coverage, SLO measurement, disaster recovery acceptance tests.

The above list is an **audit checklist, not a list of confirmed defects.** For each item, record one of: `VERIFIED_GAP`, `PARTIAL`, `VERIFIED_IMPLEMENTED`, `NOT_APPLICABLE`, `UNKNOWN`, `BLOCKED_EXTERNAL`.

Each finding must record: ID, Category, Finding, Evidence (file and line), Call Graph, Impact, Probability, Severity, Priority (P0–P4), Root Cause, Recommended Fix, Test, Status.

If confirmed defects are fewer than 100, do not fabricate. State the real number and separate the confirmed from the suspected.

---

# PHASE 3 — Evaluate 10 Alternative Architectures

Evaluate each of these on cost, complexity, availability, RPO, RTO, security, performance, and Hisabche fit:

1. Supabase Primary + Supabase Read Replica
2. Supabase Primary + External PostgreSQL Warm Standby
3. Iran PostgreSQL Primary + Iran Standby
4. Iran Primary + International Standby
5. International Primary + Iran Warm Standby
6. PostgreSQL HA with Patroni + etcd/Consul + HAProxy + PgBouncer + Synchronous Replication
7. Managed PostgreSQL across multiple providers (with Iran network reachability as a criterion)
8. Self-hosted PostgreSQL + Independent Backup (WAL-G / pgBackRest, immutable storage, restore automation)
9. Multi-Region Active-Passive with Failover Controller, Fencing, Writer Lease, Epoch
10. Multi-Provider Business Infrastructure: API in Iran, API abroad, PostgreSQL in Iran, PostgreSQL abroad, Supabase optional, independent Storage, independent Auth, independent DNS, independent Worker, independent Backup

**Required comparison table:**

| Architecture | Availability | RPO | RTO | Iran Resilience | Complexity | Cost | Risk |
| ------------ | ------------ | --- | --- | --------------- | ---------- | ---- | ---- |

For any cost figures: use real quotes if available; otherwise show estimate ranges with explicit assumptions. Never fabricate numbers.

**Critical check for Architecture 10:** prove whether it actually survives international internet disconnection, or whether it is just several servers all depending on the same foreign service.

---

# PHASE 4 — Final Architecture Selection

Do not choose Supabase merely out of familiarity. Select based on:

1. Financial correctness
2. Offline-First / per-user-local behaviour
3. Iran and Afghanistan realities
4. International internet disconnection
5. Provider independence
6. Maintenance cost
7. DevOps complexity
8. Growth path
9. Security
10. Real, tested recovery

Evaluate this target architecture as the initial candidate, not as a pre-made decision:

```text
                  USERS
                    |
             DNS / Routing
                    |
          +---------+---------+
          |                   |
      IRAN REGION        GLOBAL REGION
          |                   |
       API NODE A          API NODE B
       API NODE B          WORKER NODE
          |                   |
          +---------+---------+
                    |
             DATABASE ROUTER
                    |
           ACTIVE WRITER ONLY
                    |
       +------------+-------------+
       |                          |
   IRAN PRIMARY              IRAN STANDBY
       |                          |
       +------ WAL / STREAMING ---+
                    |
             GLOBAL STANDBY
                    |
          INDEPENDENT BACKUP
                    |
          PITR + WAL ARCHIVE

   EVERY USER / EVERY DEVICE
                    |
        PER-USER LOCAL DATABASE
                    |
     LOCAL-FIRST COMMIT → ROLE-SCOPED,
     LOAD-AWARE, IDEMPOTENT SYNC
```

**Rules:**

- If Iran is Primary, international internet disconnection must not stop local Iran operations.
- If Iran-to-international connectivity drops, no region may become an independent Writer. Split-brain must be impossible.
- Financial operations must continue on the authorized Writer.
- Offline clients must keep mutations locally.
- On reconnect, sync must complete without duplication or loss.
- If these cannot be achieved with a given architecture, the limitation must be stated explicitly.

---

# PHASE 5 — Database Provider Abstraction

Goal: business core must not depend on Supabase.

Design one Database Runtime. Extend the existing one; do not build a parallel router.

Required capabilities: Primary Provider, Read Replica Provider, Standby Provider, Active Writer Identity, Database Health, Replication Lag, Schema Version, Database Mode, Provider Capability Registry, Connection Lifecycle, Circuit Breaker, Retry Policy, Read Routing, Write Routing.

Rules:

1. Only one active Writer.
2. Every write goes to the valid Writer.
3. Replica is used only for permitted queries.
4. Freshness-sensitive financial reads must not come from a lagging replica.
5. Replica failure must never lose a write.
6. Retry must not re-apply a financial operation.
7. No failover may be accepted as final merely by changing an ENV variable.
8. Changing provider must not change business rules.

Verify specifically:

- Do `backend/src/db.ts` and `backend/src/db/index.ts` coexist?
- Which import resolves to which file?
- Do all consumers use the same client?
- Does replica routing run on the real request path?
- Can repositories work against standalone PostgreSQL?

These must be proven with code intelligence and TypeScript module resolution, not guessed.

---

# PHASE 6 — Authentication, Storage & Realtime Independence

Moving PostgreSQL is not enough.

**Auth:** audit Supabase Auth, JWT, refresh tokens, session revocation, MFA, password reset, role management, workspace membership, permission enforcement. Propose an independent architecture (internal Auth, Keycloak, independent managed Auth, independent JWT validation with client compatibility). No forced Auth migration.

**Storage:** audit Supabase Storage usage — invoice files, product images, customer documents, attachments, exports, backups. Storage must be independent of Database. Evaluate S3-compatible and Iranian options.

**Realtime:** must not be the only data path. Audit PostgreSQL NOTIFY, durable Outbox, WebSocket, SSE, polling fallback, local event queue. A Realtime outage must never lose a financial operation.

**Local Auth resilience:** authentication must be able to survive an international internet cut for users operating inside the affected region, or the limitation must be documented explicitly.

---

# PHASE 7 — Per-User Local-First, Role-Scoped Incremental Sync, Financial Consistency

This is the most sensitive phase. It combines the financial integrity requirements with the **new local-first / per-user database requirement**.

### 7.1 Architecture Requirements

1. Every user action is committed to the **user's local database first**.
2. Local commit must be durable (survive crash, restart, prolonged offline).
3. Server synchronization happens after local commit, never before.
4. Sync is **role-scoped** (Owner, Manager, Employee) and **account-scoped** (workspace, tenant).
5. Sync is **load-aware** (adapts to server load) and **bandwidth-aware** (adapts to client link quality).
6. On login, provisioning is **incremental and role-scoped** — the client fetches only what that user, role, and workspace are authorized for.
7. Replay on reconnect is **segregated** (per user, per device, per workspace), **idempotent**, **conflict-aware**, and cannot corrupt shared data.
8. Multi-device consistency for the same user is guaranteed by server-side reconciliation, not by client trust.
9. Local caches never grant authorization that the server would deny.
10. Local databases containing financial data are encrypted at rest.

### 7.2 Required Components to Audit and Complete

- `sync_mutations`
- `sync_change_log`
- Mutation IDs
- Idempotency keys (globally unique, epoch-safe across failover)
- Version / Optimistic concurrency
- Cursor pull
- Outbox
- Conflict resolution (state machine, not ad-hoc)
- Audit trail
- Device hydration
- Local database (schema versioned, migratable)
- Per-user isolation on shared device
- Local encryption
- Sync observability (pending, in-flight, committed, conflicted, rejected, reconciled)

### 7.3 Non-Negotiable Rules

1. No invoice is recorded twice.
2. No payment is applied twice.
3. No journal entry is created twice.
4. No stock movement is applied twice.
5. No financial operation is lost due to retry.
6. Last-Write-Wins is forbidden for financial data.
7. A finalized invoice must not be editable without explicit business action.
8. An unknown-outcome mutation must be recoverable and reconcilable.
9. Sync must never overwrite newer local data with older server data.
10. Conflicts must be observable and resolvable.
11. Role-scoped provisioning must never leak data across roles, workspaces, or users.
12. Local caches must never be used to bypass server authorization.
13. A local mutation must never be silently discarded.

### 7.4 Critical Scenario (must be proven with a real test)

1. User records a payment.
2. The local database commits it.
3. The server commits it.
4. The API dies before responding.
5. The Primary database fails.
6. The Standby is promoted (with human approval, fenced).
7. The device re-sends the same mutation.

**Result that must be proven:** the payment was applied exactly once.

### 7.5 Additional Scenarios That Must Be Tested

- User on shared device logs out; next user must not see previous user's local data.
- Employee logs in and receives only employee-scoped data.
- Manager logs in and receives manager-scoped data without receiving Owner-only data.
- Owner logs in and receives full authorized data.
- User is offline for days, accumulates many mutations, then reconnects on a slow link while the server is under load.
- Server schema has advanced during the offline period; client must migrate or reconcile without corruption.
- Two devices of the same user go offline and both commit conflicting edits; on reconnect, convergence must be explicit, auditable, and financially safe.

---

# PHASE 8 — Replication & Split-Brain Protection

Design independently: Synchronous replication, asynchronous replication, logical replication, physical replication, WAL, replication slots, lag monitoring, quorum, consensus, writer lease, epoch, fencing token, promotion, demotion, failback.

For Iran-to-international replication: synchronous replication may stall writes during a connectivity cut. The architecture must separate **local HA** (inside the region) from **global DR** (cross-region).

Evaluate: two or three independent failure domains inside Iran for local HA (sized to the actual provider capability), a global async standby for DR, and independent backups outside writer reach. Node count and consensus placement must match the real topology, network latency, and fencing capability.

**Split-brain test scenarios:**

- Primary isolated from API
- Primary isolated from Standby
- Iran-to-international link cut
- Old Primary returns
- Two controllers activate
- Epoch disagreement
- Consensus unreachable
- DNS broken
- Stale connections persist

No scenario may produce two valid Writers.

---

# PHASE 9 — Backup & Restore

Audit current state first: `backend/src/services/workspace/backup.service.ts`, `backend/src/services/workspace/backup-formats.ts`, all backup/restore scripts, `scripts/dr-restore-drill.mjs`, DR docs, Supabase backup configuration.

**Required architecture:** automated full backup, incremental backup, WAL archiving, PITR, encrypted backup, independent object storage, immutable retention, backup manifest, checksum, restore automation.

**Restore test:** the database must be really restored. Comparing sample data to itself, or a mocked test, is forbidden.

After restore, verify: invoice count, payment count, journal entry count, customer count, product count, inventory, account balances, invoice number sequences, payment allocations, journal balances, audit history, workspace isolation.

**The trial balance must be actually computable.** Storage must be restored separately.

---

# PHASE 10 — Migration & Schema Parity

Audit all SQL migrations, Drizzle migrations, manual migrations, extensions, functions, triggers, policies, RLS, GRANTs, indexes, constraints, sequences, views, materialized views.

Design a comparable Schema Fingerprint.

**Promotion Gate:** any material schema difference must block promotion.

Migrations must be versioned, ordered, idempotent where appropriate, tested, audited, reproducible. Financial and irreversible migrations require a roll-forward and recovery plan.

---

# PHASE 11 — Iran Infrastructure & Multi-Provider

Goal: Hisabche must not run **only** on Render and Supabase.

Evaluate: Render, Iran VPS, foreign VPS, dedicated servers, managed PostgreSQL, self-hosted PostgreSQL, Cloudflare, independent DNS providers, Iranian object storage, foreign object storage.

For each provider evaluate: real Iran reachability, sanctions/service limitations, network quality, SLA, backup, region, disaster recovery, cost, security, bandwidth limits, data transfer limits, monitoring feasibility.

**Do not select any provider based on marketing claims.**

### International internet disconnection scenario (mandatory)

Assume: Supabase is abroad, Render is abroad, international internet from Iran is cut, Iranian users still have domestic network access.

Answer explicitly:

- Can the user log in?
- Can the user see business data?
- Can the user record an invoice?
- Can the user record a payment?
- Can the user change inventory?
- Can the user record a customer?
- Can the user see local reports?
- Can the user sync later when the link returns?

If the answer is "no", the architecture still fails the mission. Record it as `VERIFIED_GAP` and state what must change.

### Local infrastructure design (if Iran is selected)

API node, PostgreSQL, local Auth, object storage, worker, connection pool, monitoring, backup, firewall, VPN/private networking, DNS, health check.

---

# PHASE 12 — API & Worker High Availability

Render must not be the only Backend location.

Audit: API statelessness, session storage in process memory, job concurrency safety, worker idempotency, independent queue, scheduler duplication, cron duplication.

Proposed topology:

```text
                   USERS
                     |
                 DNS / EDGE
                     |
          +----------+----------+
          |                     |
      IRAN API              GLOBAL API
          |                     |
          +----------+----------+
                     |
              ACTIVE WRITER
                     |
                PostgreSQL
```

API and Worker must run with a shared contract and controlled runtime configuration, independent of location.

**Rule:** running two API instances alone is not HA. Their shared dependencies on Database, Auth, DNS, and Storage must be analyzed.

---

# PHASE 13 — Monitoring & Observability

Central monitoring must cover:

**Database** — Primary health, Replica health, Standby health, connection count, connection saturation, WAL generation rate, WAL replication lag, replay lag, disk usage, query latency, transaction rate, deadlocks.

**Financial** — failed mutations, duplicate mutation attempts, payment reconciliation, ledger imbalance, invoice commit failures, inventory consistency, unresolved conflicts.

**Sync** — outbox backlog, pending mutations, sync latency, failed pull, cursor lag, device recovery, per-user sync state distribution.

**Local-First** — local write volume, local DB size, local encryption health, local schema version distribution, offline duration distribution, reconnect replay time, conflict rate by role.

**Infrastructure** — API availability, worker availability, DNS availability, network latency, packet loss, storage availability, backup age, restore verification.

For each metric: threshold, alert, severity, runbook, owner, recovery action.

---

# PHASE 14 — At Least 100 Mandatory Tests & Acceptance Criteria

**Database Failure:** Primary down, Replica down, Standby down, replica lag increase, WAL lag increase, connection pool saturation, database restart, network timeout, DNS failure, authentication failure.

**Failover:** Primary failure detection, writer freeze, fencing, promotion, epoch increment, writer endpoint change, connection drain, smoke test, failback, split-brain prevention.

**Backup:** full backup, incremental backup, WAL restore, PITR, checksum, encryption verification, immutable backup, missing WAL detection, missing table detection, restore to isolated environment.

**Financial Integrity:** duplicate invoice retry, duplicate payment retry, duplicate stock movement, duplicate journal entry, partial transaction failure, unknown commit outcome, concurrent invoice update, concurrent payment, cross-workspace isolation, ledger reconciliation.

**Sync (expanded):** offline invoice creation, offline payment creation, offline inventory change, duplicate mutation, device restart during sync, API restart during sync, Primary failure during sync, replica promotion during sync, cursor recovery, conflict resolution, per-user local isolation, role-scoped provisioning correctness, slow-link sync with server load, multi-device convergence, local schema migration, local encryption at rest.

**Provider Failure:** Supabase unavailable, Supabase Auth unavailable, Supabase Storage unavailable, Supabase Realtime unavailable, Render unavailable, Iran VPS unavailable, international network unavailable, Iran-to-global link failure, DNS provider failure, object storage failure.

**Migration:** missing migration, duplicate migration, failed migration, schema mismatch, missing function, missing trigger, missing extension, missing index, missing constraint, RLS mismatch.

**API & Worker:** API crash, worker crash, duplicate worker job, scheduler duplication, queue recovery, long-running transaction, connection leak, memory pressure, disk pressure, graceful shutdown.

**Disaster Recovery:** regional failure, complete Primary loss, standby promotion, backup-only recovery, storage recovery, full business restore, financial reconciliation after restore, API recovery after restore, Auth recovery after restore, offline device reconciliation after restore.

**Production Readiness:** RPO measurement, RTO measurement, monthly restore drill, quarterly failover drill, monitoring alert, runbook execution, security isolation, secret rotation, capacity test, full DR acceptance.

Each test records: Test ID, Preconditions, Failure Injection, Expected Result, Actual Result, Evidence, Duration, Data Loss, Status.

Real tests must be separated from mock/unit tests.

---

# PHASE 15 — Implementation Roadmap

Deliver an actionable roadmap across 11 tracks:

1. Database forensic audit
2. SLO / RPO / RTO and Failure Matrix
3. Database Runtime (provider abstraction)
4. Local High Availability (PostgreSQL HA inside a failure domain)
5. Cross-Provider Standby
6. Read Replica completion (routing, lag, health)
7. Backup & Recovery (PITR, WAL, immutable, verified restore)
8. Financial Integrity (idempotency, outbox, reconciliation)
9. Per-User Local-First + Role-Scoped Sync (new track)
10. Failover Orchestration (fencing, promotion, failback, runbook)
11. Multi-Provider Production (independence from Render, Supabase, and international-only dependencies)

For each track: files involved, current architecture, target architecture, required migration, tests, dependencies, risk, estimated cost, acceptance criteria, rollback plan.

---

# PHASE 16 — File-by-File Implementation

Produce a file-level table:

| File | Current State | Problem | Proposed Change | Dependencies | Tests | Risk |
| ---- | ------------- | ------- | --------------- | ------------ | ----- | ---- |

Rules: only report actually existing files as existing; label new files as `NEW FILE`; specify callers and consumers for every change; stay consistent with the current architecture; do not build a parallel module; do not rename a critical file just because of its name; keep changes small, reviewable, testable; every migration must be auditable.

**Autonomous scope** (no repeated approval needed): audit, documentation, design, writing independent tests, safe local refactors, type-safety fixes, completing health checks, completing routing in test environments, building restore verification in isolated environments, building mock-free integration tests.

**Explicit approval required** for: creating servers or buying VPS, creating a second Supabase project, creating cloud resources, touching Production, changing DNS, changing credentials, running migrations on the live database, promoting a Production database, changing the Production writer endpoint, enabling any paid service.

In those cases, continue local implementation and record the blocker.

---

# PHASE 17 — RPO / RTO Acceptance

Initial design targets:

| Metric                          | Target                                                 |
| ------------------------------- | ------------------------------------------------------ |
| Local Primary Failure RPO       | Near zero                                              |
| Regional DR RPO                 | ≤ 15 minutes                                           |
| Database Failover RTO           | ≤ 30 minutes                                           |
| Backup Restore RTO              | ≤ 30 minutes for an agreed database size               |
| Duplicate financial mutation    | 0                                                      |
| Split-brain                     | 0                                                      |
| Promotion with schema mismatch  | Blocked                                                |
| Verified restore                | 100% of critical data                                  |
| Offline mutation loss           | 0 under tested supported scenarios                     |
| Per-user local write durability | 100% across crash/restart/offline within tested bounds |

Targets must be reconciled with the real capacity of the chosen architecture. If they are not achievable, say exactly why. Never declare a target met just in documentation.

---

# PHASE 18 — Required Final Report

Final report in Persian, with full technical detail. Code and filenames stay in English.

Structure:

1. Executive Summary — real state of Hisabche.
2. Repository Snapshot — branch, commit, repo state, audit limits.
3. Database Architecture Audit — the real database architecture.
4. Supabase Dependency Map — complete dependency map.
5. File-by-File Findings.
6. Call Graph — real read and write paths.
7. 100 Weaknesses — confirmed items with evidence (or the real count, separated from suspected).
8. 10 Architecture Alternatives — full comparison.
9. Recommended Architecture — final choice, rationale, trade-offs.
10. Iran Infrastructure Design — Iran and abroad.
11. Database Runtime Design — provider abstraction in detail.
12. Replication & Failover — promotion and fencing design.
13. Backup & Restore — full recovery plan.
14. Financial Integrity — protection of financial data.
15. Per-User Local-First Design — local DB, role-scoped provisioning, load-aware sync, encryption, multi-device.
16. File-by-File Implementation Plan — all existing and new files.
17. Implemented Changes — what was actually done.
18. Test Results — tests run and results.
19. Blockers — anything needing access or owner decision.
20. Cost & Infrastructure — estimated Iran and abroad, with assumptions.
21. Production Readiness Score — real, evidence-backed score.

---

# PHASE 19 — Final Status Vocabulary

Use only these statuses for capabilities:

`VERIFIED_COMPLETE`, `IMPLEMENTED_NOT_LIVE_VERIFIED`, `PARTIALLY_IMPLEMENTED`, `BLOCKED_EXTERNAL`, `NOT_IMPLEMENTED`, `NOT_APPLICABLE`, `PENDING_OWNER_DECISION`.

Never call a capability complete because a file exists or a mock test passed.

---

# PHASE 20 — Final Engineering Decision

Answer precisely:

1. Is Hisabche currently dependent on a single Supabase project?
2. Can it run without Supabase?
3. Can it run without Render?
4. Can it operate inside Iran during an international internet disconnection?
5. Can an Iran PostgreSQL be Primary?
6. Can an international PostgreSQL be Standby?
7. Can Auth be made independent?
8. Can Storage be made independent?
9. Can the API run across two providers?
10. Is failover possible without split-brain?
11. Is financial data preserved through failover?
12. Is device sync safe after recovery?
13. Is full business restore proven?
14. Can the architecture scale to 100, 1,000, and 10,000 businesses?
15. **Is every user's every action committed locally first, role-scoped on sync, load-aware, and proven not to duplicate or lose financial effects?**

### Final decision rule

- If multi-database complexity costs more than it delivers for current Hisabche needs, say so explicitly.
- If self-hosted PostgreSQL is better, explain why.
- If Supabase remains the right choice, explain why.
- If an Iran + international combination is best, state both advantages and limits.
- No provider or technology is selected for popularity.

**The goal is a trusted infrastructure — not more servers, not more databases, not a copy of Supabase on another machine.**

---

# FINAL DIRECTIVE

Begin now.

First read repository rules. Then record Git state. Then run code intelligence and call graph analysis. Audit every path for database, sync, auth, storage, migration, deployment, and local-first.

Then enumerate 100 weaknesses with real evidence. Compare 10 architectures. Choose the final architecture. Produce the file-by-file table. Implement only safe, authorized changes. Add and run real, executable tests. Whenever Production, credentials, external servers, or human approval are needed, state the blocker precisely and continue the independent work.

Finally, deliver the complete Persian report.

**No unproven claims. No fabricated success. No dangerous changes. No hidden defects.**

Final success criterion: Hisabche must continue business operations — or degrade safely — under Supabase failure, Render failure, international internet disconnection, and single-database failure, according to approved RPO/RTO, with **zero split-brain, zero duplicate financial mutations, and zero silent data loss**, and with **every user action locally committed and role-scoped-synced without corruption**. Until those scenarios are proven with real tests, do not call the project 10/10.

---

**Three strict principles that must remain intact throughout:**

1. Iran is not mandatorily Primary — customer reachability, legal requirements, network quality, and operational capacity decide.
2. International internet disconnection is treated independently from database failure — foreign Auth or foreign Storage will still break Iran-side operations even with a healthy Iran PostgreSQL.
3. Implementation is separated from Production automatic promotion — wrong failover in a financial system can be more dangerous than the outage itself. Automated detection may exist; Production promotion requires explicit human approval, fencing, and rollback proof.
