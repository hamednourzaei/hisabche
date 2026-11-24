<USER_REQUEST>
این پرامپت رو کامل step بندی بکن و اجرا بکن که قابلیت های انجین ایکس و این موارد در ادمین پنل قابل خاموش یا روشن کردن باشن
اول در یک فایل بنویسش بعد اجراش بکن فاز به فاز تا کامل شود هیج بخش انجام نشد نباید در فایل وجود داشته باشد

# HISABCHE V75 — AUTONOMOUS PRODUCT COMPLETION & INFRASTRUCTURE ENGINEERING

## Master Mission: 67-Industry Completion + Single-Core Integrity + Local-First + HA/DR + Infrastructure Evaluation + Production Readiness

**Repository:** `hamednourzaei/hisabche`  
**Branch:** Inspect current branch; do not switch branches.  
**Target:** Complete as much verified, safe, in-repository work as possible.  
**Execution mode:** Autonomous, evidence-driven, implementation-first.  
**Communication:** Persian reports; English code, identifiers, comments and technical documentation where repository conventions require it.

---

# 0. YOUR ROLE

Operate as a coordinated Staff/Principal Engineering function with expertise in:

1. Full-stack architecture and implementation.
2. Accounting, double-entry ledger and financial integrity.
3. PostgreSQL, schema design, query optimization and data integrity.
4. Distributed systems and high availability.
5. Disaster recovery, backup and restore engineering.
6. Offline-first applications and synchronization.
7. API design, reverse proxies and infrastructure.
8. Application and infrastructure security.
9. Industry-specific ERP and business workflows.
10. SRE, observability, testing and release readiness.
11. Performance engineering for low-resource devices.
12. Technical product readiness and commercial capability classification.

You must behave like an engineer responsible for delivering a working product, not an assistant that only writes an audit report.

Your job is to inspect, decide, implement, test, document and verify.

Do not stop after planning.

Do not stop after identifying gaps.

Do not stop after creating files.

Continue through all safe, feasible implementation work until:

- The requested work is complete;
- A real technical blocker prevents further progress;
- Or an explicit human approval is required.

If one workstream is blocked, continue independent workstreams.

---

# 1. ABSOLUTE REPOSITORY AND SAFETY RULES

Before doing anything, read:

- Root `AGENTS.md`
- Root `CLAUDE.md`, if present
- All applicable nested agent instructions
- Existing architecture specifications
- Existing database and accounting specifications
- Existing custom Skills and their references
- Existing V2, V54, V60, V70, V73, V74 and V75 documents where present

Repository instructions are authoritative.

## 1.1 Prohibited actions

Never:

- Commit.
- Push.
- Reset.
- Rebase.
- Stash.
- Checkout another branch.
- Run `git clean`.
- Delete or overwrite user changes.
- Read, print, copy, expose or modify `.env`, `.env.*` or secrets.
- Execute DDL or data writes against live Supabase or production databases.
- Perform production DNS changes.
- Change production infrastructure.
- Change production credentials.
- Install, remove or upgrade dependencies without explicit authorization.
- Modify dependency or lock files without explicit authorization.
- Run production builds unless explicitly requested.
- Create subagents.
- Disable tests or weaken assertions to obtain green results.
- Introduce `any`, `@ts-ignore` or `eslint-disable`.
- Add fake APIs, fake database adapters, placeholder implementations or dead code.
- Claim a test passed if it was skipped, mocked, not executed or did not verify the intended behavior.

Preserve existing dirty and untracked work.

## 1.2 Before modification

Record:

- Current branch.
- Current HEAD.
- `git status --short`.
- Existing dirty files.
- Existing untracked files.
- Existing changes that are not yours.
- Code-intelligence graph freshness.
- Available test and verification commands.

Never assume the working tree is clean.

Never overwrite a file merely because it appears generated.

Never modify a user-owned file without understanding its existing changes.

## 1.3 Evidence vocabulary

Use exactly these meanings:

- `VERIFIED_COMPLETE`: implementation and required evidence are genuinely verified.
- `VERIFIED_WITH_LIMITATIONS`: working implementation with explicit, tested limitations.
- `IMPLEMENTED_NOT_LIVE_VERIFIED`: code exists, but live or production behavior has not been verified.
- `PARTIALLY_IMPLEMENTED`: some required behavior exists, but the complete workflow does not.
- `BLOCKED_EXTERNAL`: infrastructure, credentials, provider or external authorization prevents verification.
- `NOT_IMPLEMENTED`: implementation is absent.
- `NOT_APPLICABLE`: requirement genuinely does not apply.
- `PENDING_OWNER_DECISION`: an irreversible, financial, legal or product decision needs approval.

A generated document is not implementation evidence.

A source file is not runtime evidence.

A passing unit test is not PostgreSQL evidence.

A successful local request is not production evidence.

---

# 2. FIRST MISSION — VERIFY THE CLAIMS IN THE PREVIOUS ENGINEERING REPORT

The previous report claims that multiple major systems were implemented, including:

- Custom Skills deployed under `.agents/skills/` and `.claude/skills/`.
- HA/DR and local-first master prompts.
- Writer fencing and leases.
- Replica circuit breaker.
- Read/write database routing.
- Schema fingerprinting.
- Offline JWT verification.
- Storage abstraction.
- Per-user local database partitioning.
- PBKDF2/AES encryption.
- Financial sync state machine.
- Bandwidth-aware synchronization.
- A single universal business core.
- A 67-industry sellability classification.
- 24 industries sellable with limitations.
- 21 industries pilot-only.
- 22 industries not offered.
- Multiple new test files and successful tests.
- PostgreSQL and browser acceptance claims.

Treat every one of these as an UNVERIFIED CLAIM.

Do not trust the report merely because it contains exact filenames, counts or test totals.

## 2.1 Verify every claimed file

Check whether the following paths actually exist:

- `backend/src/db/fencing.ts`
- `backend/src/db/circuit-breaker.ts`
- `backend/src/db/routing.ts`
- `backend/src/db/schema-fingerprint.ts`
- `backend/src/middleware/jwt-verifier.ts`
- `backend/src/storage/storage-adapter.ts`
- `packages/local-engine/src/sync/per-user-partition.ts`
- `packages/local-engine/src/sync/sync-state-machine.ts`
- `packages/local-engine/src/sync/bandwidth-aware-sync.ts`
- `backend/src/__tests__/database-ha-routing.test.ts`
- `backend/src/__tests__/auth-and-storage-independence.test.ts`
- `packages/local-engine/src/__tests__/per-user-local-first-and-failover-replay.test.ts`
- `backend/src/__tests__/ledger-and-schema-integrity.test.ts`
- `packages/ui/src/__tests__/industry-specs-complete.test.ts`

Also verify:

- The exact Skills and reference files.
- The actual architecture audit.
- The actual 67-industry audit.
- The actual V2 HA/DR report.
- The actual test and verification suite.
- All generated industry documents.
- The actual `git diff` that introduced these changes.

## 2.2 Verify implementation quality

For each claimed implementation, answer:

1. Does the file exist?
2. Is the implementation real?
3. Is it imported by production code?
4. Which canonical service owns it?
5. Which callers use it?
6. Does it duplicate an existing mechanism?
7. Does it enforce the intended invariant?
8. Does it have meaningful tests?
9. Are failure conditions tested?
10. Is it wired into the actual runtime?
11. Does it introduce a new dependency?
12. Does it alter a public contract?
13. Does it have a safe migration path?
14. Is it compatible with current deployment?
15. Does it work under actual offline and network failure conditions?

A standalone class or utility that is never consumed by application code is not a completed feature.

## 2.3 Special security review

Treat the reported offline JWT verifier and per-user encryption as security-sensitive.

Verify:

- Correct JWT algorithm restrictions.
- Key rotation.
- Issuer and audience validation.
- Expiration and not-before handling.
- Revocation behavior.
- Clock skew.
- Token theft implications.
- User/device identity separation.
- Password-based key derivation parameters.
- Salt generation.
- Nonce/IV uniqueness.
- Authentication tag verification.
- Key storage.
- Memory handling.
- Logout and local data deletion behavior.
- Shared-device account switching.
- Backup and recovery implications.

Never implement a custom authentication protocol merely to claim offline authentication.

An offline JWT verification mechanism must not silently imply that a revoked user remains authorized forever.

Document the exact offline authorization model and its limitations.

If a cryptographic implementation cannot be proven safe, block it rather than expanding it.

## 2.4 HA/DR special review

Writer fencing, replica routing and circuit breakers are distributed-systems critical components.

Verify:

- A real monotonically increasing fencing token.
- A durable authoritative token source.
- Lease expiration semantics.
- Clock assumptions.
- Writer ownership.
- Stale writer rejection at the database boundary.
- Atomic ownership transitions.
- Split-brain prevention.
- Failover behavior during network partitions.
- Unknown commit outcome reconciliation.
- Replica lag measurement.
- Read-after-write consistency.
- Schema fingerprint completeness.
- Promotion of incompatible replicas.
- Recovery after partial failure.

A process-local counter is not a distributed fencing mechanism.

A TypeScript interface is not a database-enforced fencing boundary.

A successful unit test is not proof that two independent database nodes cannot both write.

Do not claim HA until actual failure drills prove it.

---

# 3. CANONICAL ARCHITECTURE — ONE CORE, NO PARALLEL ENGINES

The architecture must remain coherent.

There must be one canonical owner for:

- Accounting and ledger.
- Financial posting.
- Money and currency conversion.
- Inventory and stock valuation.
- COGS and profit.
- Customer and supplier balances.
- Payment allocation.
- Returns and reversals.
- Permissions.
- Tenant isolation.
- Business capability resolution.
- Industry terminology.
- KPI definitions.
- Offline mutation identity.
- Sync conflict resolution.
- Reconciliation.

Different industries may have:

- Different UI experiences.
- Different workflows.
- Different terminology.
- Different feature packs.
- Different operational adapters.
- Different validation rules.
- Different reports and views.

They must not have separate accounting or inventory engines.

## 3.1 Required architecture audit

Build a canonical ownership registry:

| Domain | Canonical owner | Callers | Duplicate implementation | Verdict |
| ------ | --------------- | ------- | ------------------------ | ------- |

Trace:

`UI → Hook → API → Service → Domain Core → Database`

For offline:

`UI → Local Hook → Local Engine → Outbox → Sync → Server Service → Database`

For reporting:

`Source of Truth → Canonical KPI/Report Engine → Read Model → UI`

Detect:

- Duplicate business formulas.
- Duplicate posting logic.
- Duplicate stock deduction.
- Duplicate payment allocation.
- Duplicate customer balance calculation.
- Duplicate COGS.
- Duplicate KPI calculations.
- Duplicate terminology overlays.
- Duplicate capability resolvers.
- Direct SQL writes bypassing the canonical service.
- Routes bypassing permission enforcement.
- Local writes bypassing outbox.
- UI components using fake or parallel calculations.

Do not delete legacy code blindly.

First identify consumers, behavior, migrations and compatibility requirements.

If two implementations are genuinely needed for different environments, establish one canonical contract and test parity.

---

# 4. 67 INDUSTRIES — COMPLETE AUDIT AND IMPLEMENTATION

The project must support its actual registered industry identifiers.

Do not hardcode the number 67 if the canonical registry changes. Derive the count from source.

Inspect:

- `packages/ui-contract/src/business-types.ts`
- `packages/validation/src/schemas/industry-profiles.ts`
- `packages/validation/src/schemas/business-capabilities.ts`
- `packages/validation/src/schemas/operational-dna.ts`
- `docs/industries/INDUSTRY-REGISTRY.md`
- `docs/industries/SHARED-CAPABILITY-MATRIX.md`
- `docs/industries/ACCEPTANCE-CRITERIA.md`
- `docs/industries/OFFLINE-WORKFLOW-MATRIX.md`
- `docs/industries/CROSS-PLATFORM-MATRIX.md`
- `docs/industries/WORKFLOW-STATE-MODEL.md`
- `docs/architecture/industry/`
- `docs/sales/`
- `scripts/industry/`

Inspect the actual implementation, not only documents.

## 4.1 Industry-by-industry traceability

For every registered industry, create or update a single canonical evidence row.

Required fields:

- Industry key.
- Persian label.
- Dari label.
- English label.
- Industry family.
- Archetype.
- Operational DNA.
- Required capabilities.
- Available capabilities.
- Partial capabilities.
- Planned capabilities.
- UI pages.
- UI routes.
- Hooks.
- Backend routes.
- Services.
- Database tables.
- Constraints.
- RLS.
- Permissions.
- Entitlements.
- Local engine handlers.
- Outbox event types.
- Sync handlers.
- Reports.
- KPIs.
- Tests.
- Browser journey.
- PostgreSQL journey.
- Offline journey.
- Commercial status.
- Known limitations.
- Required external dependencies.

Every claim must point to actual source evidence.

## 4.2 Required commercial classifications

Reuse the existing canonical status system if one exists.

Otherwise, use:

- `SELLABLE`
- `SELLABLE_WITH_LIMITS`
- `PILOT_ONLY`
- `CORE_ONLY`
- `NOT_OFFERED`
- `BLOCKED_EXTERNAL`
- `PENDING_OWNER_DECISION`

Do not confuse:

- Registered.
- Profiled.
- Capability available.
- UI wired.
- Workflow complete.
- Offline supported.
- Acceptance verified.
- Commercially sellable.

These are separate gates.

## 4.3 Capability priorities

Prioritize reusable engines that unlock the greatest number of industries.

### Product and inventory

- Variants.
- SKU and barcode.
- Variant-specific stock.
- Serial tracking.
- Warranty.
- Batch and expiry.
- FEFO.
- Roll tracking.
- Roll cutting.
- Partial quantity.
- Weight pricing.
- Length pricing.
- Area pricing.
- Volume pricing.
- Tiered pricing.
- Multi-unit conversion.

### Gold and exchange

- Purity and karat.
- Gross/net weight.
- Making charges.
- Metal rates.
- Old-gold exchange.
- Gold ledger.
- Foreign currency.
- Exchange rates.
- Currency settlement.
- Multi-currency balances.
- Exchange profit and loss.
- Reversal and audit.

### Service businesses

- Service catalog.
- Appointment.
- Resource capacity.
- Scheduling.
- Staff availability.
- Package credits.
- Credit consumption.
- Cancellation.
- Refund.
- Commission.
- Work queue.
- SLA.
- Service completion.

### Manufacturing and food

- BOM.
- Multi-level BOM.
- Recipe.
- Work orders.
- Workstations.
- Material consumption.
- Scrap.
- Waste.
- Production cost.
- Labor cost.
- Overhead allocation.
- Batch production.
- Quality inspection.
- Finished goods.
- COGS.

### Project and professional services

- Project costing.
- Timesheets.
- Contract recurrence.
- Installments.
- Deposits.
- Retention.
- Milestones.
- Progress billing.
- Customer and supplier obligations.

### Logistics and transport

- Dispatch.
- Driver assignment.
- Trip.
- Delivery notes.
- Proof of delivery.
- COD.
- Driver settlement.
- Shipment lifecycle.
- Failed delivery.
- Return shipment.
- Fleet assets.

### Regulated industries

Pharmacy, clinical services, gold, exchange, banking/lending and other regulated domains require dedicated review.

Do not implement superficial CRUD to claim readiness.

Identify external legal, security, licensing and integration requirements.

Do not invent compliance requirements.

Do not claim regulatory compliance without authoritative evidence and human review.

---

# 5. OFFLINE-FIRST — THE PRODUCT CONTRACT

The product must preserve a consistent business experience online and offline wherever the workflow is claimed to support offline execution.

Inspect:

- `packages/local-engine`
- `packages/sync`
- Outbox and mutation identity.
- Local database.
- Cursor and pull mechanisms.
- Conflict queue.
- Conflict resolution.
- Device identity.
- Tenant boundaries.
- Offline permissions.
- Local encryption.
- Retry handling.
- Crash recovery.
- Data migration.
- Reconciliation.

## 5.1 Required invariants

1. Local database is usable without internet for supported operations.
2. Server/PostgreSQL remains the canonical shared source of truth.
3. Local state is not blindly overwritten during hydration.
4. Durable outbox preserves unsynced mutations.
5. Mutation identity is stable and idempotent.
6. Financial conflicts are never resolved by last-write-wins.
7. No silent financial deletion.
8. Posted/finalized financial records remain immutable.
9. Reversals are explicit and auditable.
10. Unknown commit outcomes are reconciled before retry.
11. Cursor updates and applied mutations are atomic.
12. Multi-device synchronization is deterministic.
13. Tenant isolation is preserved.
14. User/device switching cannot leak local data.
15. Low bandwidth does not starve financial mutations.

## 5.2 Required failure tests

- Offline before mutation.
- Offline during mutation.
- App crash after local commit.
- App crash during upload.
- Server commit succeeds but response is lost.
- Duplicate retry.
- Token expires while offline.
- User switches account.
- Device is restored from backup.
- Two devices edit the same record.
- Two devices submit financial operations.
- Network partition during failover.
- Cursor advances but data is not persisted.
- Local schema upgrade with unsynced mutations.

Do not claim complete offline support for a feature without an actual local-to-server roundtrip test.

---

# 6. POSTGRESQL, MULTI-PROVIDER AND HA/DR

The goal is a resilient database architecture, not the maximum number of database products.

First inspect the current database implementation and provider dependencies.

Determine:

- Which code uses Supabase Auth.
- Which code uses Supabase Storage.
- Which code uses Supabase Realtime.
- Which code uses Supabase RPC.
- Which code uses Postgres directly.
- Which code uses Drizzle.
- Which code depends on RLS.
- Which code depends on extensions.
- Which code depends on Edge Functions.
- Which code depends on provider-specific behavior.

A generic `DATABASE_URL` abstraction is not multi-provider support.

## 6.1 Database topology

Evaluate the following target model:

- One active writer.
- One or more standby replicas.
- Optional read replicas.
- Durable WAL archiving.
- Point-in-time recovery.
- Automated backup verification.
- Fencing and promotion control.
- Independent object-storage backup.
- Tested restore.
- Monitoring and alerting.

Never introduce uncontrolled multi-master writes.

Never let two independent primaries accept financial writes.

Read replicas are not backups.

Backups are not high availability.

DNS switching is not writer fencing.

## 6.2 Required PostgreSQL integrity

Verify:

- Schema parity.
- Extensions.
- Functions.
- Triggers.
- Sequences.
- Indexes.
- Constraints.
- Foreign keys.
- RLS.
- Grants.
- Ownership.
- Migration ordering.
- Idempotency.
- Transaction boundaries.
- Connection limits.
- Long-running transactions.
- Vacuum and bloat.
- WAL retention.
- Replica lag.
- Restore integrity.

Financial posting must remain atomic.

Do not rely on application-side checks for invariants that must be enforced at the database boundary.

Do not use floating-point values for money.

AFN uses zero decimal places. Never apply `/100` or `*100` to AFN.

Unknown is not zero.

Partial and unknown costs must not silently produce numeric profit.

---

# 7. INFRASTRUCTURE ENGINEERING — NGINX AND TEN ALTERNATIVES

Evaluate these ten technologies against the actual Hisabche architecture.

Do not install all of them.

Do not add infrastructure merely because it is popular.

Do not introduce two tools that perform the same role without a demonstrated requirement.

## 7.1 Technology candidates

### 1. Nginx

Role:

- Web server.
- Reverse proxy.
- TLS termination.
- Static asset serving.
- HTTP routing.
- Load balancing.
- Basic caching.

Evaluate:

- Next.js reverse proxy.
- Fastify API reverse proxy.
- WebSocket/Realtime upgrade behavior.
- Request size limits.
- Timeouts.
- Rate limiting.
- Security headers.
- Compression.
- Static asset caching.
- Health endpoints.
- Upstream failover.
- Logging.

Official documentation:
https://nginx.org/en/docs/

### 2. Caddy

Role:

- Web server.
- Reverse proxy.
- Automatic HTTPS.

Evaluate operational simplicity, certificate automation, routing and deployment fit.

https://caddyserver.com/docs/

### 3. Traefik

Role:

- Dynamic reverse proxy.
- Container ingress.
- Service discovery.

Evaluate whether the current deployment actually needs dynamic container discovery.

https://doc.traefik.io/traefik/

### 4. HAProxy

Role:

- High-performance load balancer.
- TCP/HTTP proxy.
- Health checking.

Evaluate active-passive API instances, database proxying where appropriate and failure detection.

https://www.haproxy.org/

### 5. Envoy Proxy

Role:

- Advanced service proxy.
- Traffic management.
- gRPC.
- Observability.
- Service mesh data plane.

Do not add Envoy unless its advanced features solve a demonstrated requirement.

https://www.envoyproxy.io/docs

### 6. Apache HTTP Server

Role:

- Web server.
- Reverse proxy.
- Mature module ecosystem.

Evaluate only where existing compatibility or module needs justify it.

https://httpd.apache.org/docs/

### 7. Kong Gateway

Role:

- API gateway.
- Authentication and traffic policies.
- API management.
- Rate limiting and plugins.

Evaluate whether Hisabche actually needs a dedicated API gateway beyond Fastify and the current edge layer.

https://docs.konghq.com/gateway/

### 8. Apache APISIX

Role:

- Dynamic API gateway.
- Plugin ecosystem.
- Traffic control.

Evaluate operational overhead, control plane and etcd requirements.

https://apisix.apache.org/docs/

### 9. OpenResty

Role:

- Programmable Nginx-based gateway.
- LuaJIT request processing.

Do not move financial business logic into the proxy layer.

https://openresty.org/en/

### 10. PgBouncer

Role:

- PostgreSQL connection pooling.

Evaluate:

- Existing Supabase pooler.
- Transaction pooling.
- Session requirements.
- Prepared statements.
- Connection limits.
- Drizzle behavior.
- Migration connections.
- Realtime and long-lived sessions.

Do not add another pooler in front of an existing pooler without proving why.

https://www.pgbouncer.org/

## 7.2 Mandatory infrastructure decision matrix

Create a table:

| Technology | Role | Current need | Existing equivalent | Benefit | Cost | Operational complexity | Security impact | Recommendation |
| ---------- | ---- | ------------ | ------------------- | ------- | ---- | ---------------------- | --------------- | -------------- |

For every technology choose:

- `ADOPT_NOW`
- `ADOPT_LATER`
- `KEEP_EXISTING`
- `DO_NOT_ADOPT`
- `BLOCKED_EXTERNAL`

Explain the decision with repository evidence.

## 7.3 Nginx architecture fit

Inspect the real hosting model.

Determine whether:

- Next.js runs on a managed platform.
- Fastify runs on Render or another managed service.
- PostgreSQL is Supabase-hosted.
- Desktop and mobile clients access the API directly.
- WebSockets or Realtime require special proxy handling.
- A self-hosted VPS exists.
- Docker or Kubernetes is actually used.
- A single ingress is needed.
- TLS is already terminated by the hosting provider.

Important:

If Next.js and Fastify are hosted on managed platforms, do not deploy Nginx merely to add another hop.

Nginx is most useful when Hisabche controls a VPS, dedicated server or self-managed ingress.

If Nginx is adopted, define a concrete architecture such as:

Internet
→ TLS / Edge
→ Nginx
→ Next.js
→ Fastify API
→ PostgreSQL / Supabase

But do not assume that every request must pass through one server.

Mobile and desktop clients may need direct access to a secured API endpoint.

## 7.4 Nginx implementation requirements if justified

If the current repository and deployment prove that Nginx is appropriate, create a minimal, maintainable configuration.

Include:

- Separate upstreams.
- TLS configuration.
- HTTP to HTTPS redirect.
- Correct forwarded headers.
- Request ID propagation.
- Proxy timeouts.
- Upload size limits.
- WebSocket upgrade support.
- Rate limiting for sensitive routes.
- Static asset caching only where safe.
- No caching of financial writes.
- No caching of authenticated private data by default.
- Health endpoint.
- Access logs.
- Error logs.
- Graceful reload.
- Safe configuration test.
- Rollback instructions.

Do not put credentials in configuration files.

Do not expose internal database ports.

Do not trust arbitrary forwarded headers from untrusted clients.

Do not assume Nginx provides application authentication or tenant isolation.

If no deployment target exists, create only a documented reference configuration and mark it `NOT_DEPLOYED`.

---

# 8. ADDITIONAL INFRASTRUCTURE AND OBSERVABILITY REVIEW

Evaluate whether the project needs:

## 8.1 Monitoring

- Prometheus.
- Grafana.
- OpenTelemetry.
- Loki.
- Alertmanager.
- Sentry or an existing error tracking solution.

Do not introduce duplicate monitoring systems if a current provider already covers the requirement.

Prioritize:

- API latency.
- Error rate.
- Database connections.
- Database CPU and storage.
- Replica lag.
- Sync backlog.
- Outbox age.
- Conflict queue size.
- Failed mutations.
- Auth errors.
- Background job failures.
- Storage failures.
- Device-specific performance.

## 8.2 Backup and disaster recovery

Evaluate:

- pgBackRest.
- WAL-G.
- Native PostgreSQL backup.
- Supabase backup and PITR capabilities.
- Object-storage versioning.
- Independent backup destination.
- Encryption.
- Retention.
- Restore drills.

Do not install multiple backup tools without a reason.

Choose one canonical backup workflow per deployment topology.

Prove:

- Backup creation.
- WAL continuity.
- Recovery point.
- Restore to an isolated environment.
- Schema parity.
- Financial reconciliation after restore.
- File/object restoration.

A backup file existing is not proof of recoverability.

## 8.3 Deployment and containerization

Inspect current Docker, Compose, CI/CD and hosting setup.

Evaluate whether containerization improves repeatability.

Do not introduce Kubernetes for a small deployment without a measurable need.

Do not turn a simple application into a distributed platform without an operational team and justified scale.

---

# 9. SECURITY REVIEW

Audit:

- Authentication.
- Authorization.
- Tenant isolation.
- RLS.
- API permissions.
- Role hierarchy.
- Session lifecycle.
- Token expiration.
- Refresh token rotation.
- Device trust.
- Shared devices.
- Local encryption.
- Data export.
- Data deletion.
- File access.
- Upload validation.
- SSRF.
- CSRF.
- XSS.
- SQL injection.
- Rate limiting.
- Audit logs.
- Sensitive data exposure.
- Dependency vulnerabilities.

Do not claim compliance with a standard unless a full applicable assessment exists.

Never log:

- Passwords.
- Access tokens.
- Refresh tokens.
- Secret keys.
- Full sensitive financial payloads.
- Unnecessary personal data.

Every tenant-owned read and write must be checked for isolation.

Test cross-tenant access attempts.

---

# 10. PERFORMANCE ENGINEERING

Hisabche must operate reliably on low-resource devices and unstable networks.

Respect the existing supported Android and Expo/RN constraints.

Do not upgrade Expo or React Native as part of this task without explicit approval.

Measure before optimizing.

Inspect:

- Initial application load.
- Dashboard query count.
- Invoice creation latency.
- Product search latency.
- Large inventory lists.
- Local database query plans.
- Sync batch size.
- Memory use.
- Rendering and list virtualization.
- Network request duplication.
- Image and asset sizes.
- API payload size.
- Database indexes.
- Slow queries.
- Connection pool pressure.

Prioritize the actual Redmi 9 / Android 10 / 2 GB RAM constraints if that test environment is available.

Do not fabricate device benchmarks.

If no physical device is available, report that runtime performance is unverified.

---

# 11. API AND APPLICATION QUALITY

Audit Next.js, Fastify, Electron, Expo and shared packages.

Verify:

- Route-to-hook wiring.
- Validation.
- Error contracts.
- Permission enforcement.
- Tenant scoping.
- Idempotency.
- Pagination.
- Rate limits.
- Request timeouts.
- Background jobs.
- Realtime lifecycle.
- WebSocket handling.
- File uploads.
- API versioning.
- Observability.

Do not duplicate validation schemas.

Use the existing canonical validation packages.

Do not create new generic wrappers without a demonstrated need.

Maintain workspace boundaries.

Use `packages/ui` for shared UI components.

Keep Persian, Dari and English translations aligned.

Do not confuse Persian and Dari terminology.

Preserve the business distinction between `قرض` and `نسیه`.

---

# 12. IMPLEMENTATION PRIORITY AND AUTONOMOUS EXECUTION

Do not try to implement everything at once without dependency ordering.

Use this priority system:

## P0 — Critical correctness and security

Examples:

- Financial imbalance.
- Duplicate financial writes.
- Tenant data leakage.
- Unsafe authentication.
- Data loss.
- Split-brain risk.
- Incorrect stock deduction.
- Broken migration.
- Unsafe encryption.
- Silent financial overwrite.

Fix confirmed P0 defects first.

If a P0 fix needs a production decision, implement safe preparatory work and block the dangerous operation.

## P1 — Core product blockers

Examples:

- Broken invoice lifecycle.
- Missing UI-to-service wiring.
- Incorrect payment allocation.
- Offline mutation loss.
- Incorrect stock valuation.
- Missing required permissions.
- Broken reporting.
- Missing required acceptance paths.

## P2 — Industry readiness

Examples:

- Variants.
- Batch/expiry.
- Serial/warranty.
- Resource capacity.
- Work queues.
- Manufacturing workflows.
- Project costing.
- Dispatch and delivery.

## P3 — Infrastructure and operational improvement

Examples:

- Nginx where justified.
- Additional observability.
- Performance tuning.
- Deployment simplification.
- Backup automation.
- Documentation and developer experience.

Do not postpone a verified critical security defect because it is outside the current phase.

## 12.1 Execution loop

For each task:

1. Inspect the current implementation.
2. Locate the canonical owner.
3. Identify consumers.
4. Identify dependencies.
5. Confirm the defect.
6. Write or update a failing regression test.
7. Implement the smallest safe correction.
8. Run focused tests.
9. Run relevant type and lint checks.
10. Verify callers and integrations.
11. Update canonical documentation.
12. Record the evidence.
13. Continue to the next task.

Do not create a task list and stop.

Do not ask the owner for permission for ordinary, reversible, in-repository improvements.

Ask only for:

- Production operations.
- External credentials.
- DNS changes.
- Live database writes.
- Dependency/lockfile changes prohibited by repository rules.
- Irreversible financial or data-model decisions.
- Legal or regulated-domain decisions.
- Changes with material cost or service risk.

When blocked, continue all independent tasks.

---

# 13. TESTING AND VERIFICATION

Run only repository-approved commands.

Do not run production builds.

Do not run live database mutations.

## 13.1 Required verification categories

### Static and code quality

- TypeScript.
- ESLint.
- Formatting where configured.
- Import boundaries.
- Workspace boundaries.
- No forbidden escape hatches.
- No dead code.
- No unused new abstractions.

### Domain

- Ledger balancing.
- Posting atomicity.
- Reversal.
- Payment allocation.
- Inventory movement.
- COGS.
- Customer balances.
- Supplier balances.
- Multi-currency.
- AFN zero-decimal.
- Unknown versus zero.
- Idempotency.

### API

- Authentication.
- Authorization.
- Tenant isolation.
- Validation.
- Duplicate requests.
- Error contracts.
- Pagination.
- Rate limiting.

### Database

- Constraints.
- Foreign keys.
- RLS.
- Grants.
- Migration checks.
- Transaction boundaries.
- Concurrency.
- Query plans where available.

### Offline and synchronization

- Durable outbox.
- Restart recovery.
- Duplicate replay.
- Conflict handling.
- Cross-device consistency.
- Unknown commit outcome.
- Network partition.

### Browser

- Onboarding.
- First-value workflow.
- Invoice lifecycle.
- Payment lifecycle.
- Industry-specific primary journey.
- Permission-denied behavior.
- Offline UI states.

### Infrastructure

- Proxy configuration validation.
- Health checks.
- TLS assumptions.
- Upstream failures.
- Timeouts.
- Request size limits.
- WebSocket behavior.
- Rate limiting.
- Graceful shutdown.

### Recovery

- Backup verification.
- Restore verification.
- WAL continuity.
- Financial reconciliation after restore.
- Object storage restoration.

## 13.2 Test result vocabulary

Every result must be one of:

- `PASSED`
- `FAILED`
- `SKIPPED`
- `NOT_RUN`
- `BLOCKED_EXTERNAL`
- `NOT_APPLICABLE`

Do not count skipped tests as passed.

Do not count a test file as passed if its relevant assertions were skipped.

Do not claim browser or PostgreSQL verification without actual execution.

Do not claim production readiness based on unit tests.

---

# 14. DOCUMENTATION AND SOURCE-OF-TRUTH CONTROL

Maintain one canonical source for each:

- Industry registry.
- Capability registry.
- Support matrix.
- Sellability criteria.
- Offline workflow matrix.
- API-to-UI traceability.
- Database ownership.
- Financial invariants.
- Infrastructure topology.
- Backup and restore procedure.
- Production readiness.

Generated documents must be generated by their canonical scripts.

Never hand-edit generated files to manufacture consistent numbers.

If documents disagree:

1. Find their source inputs.
2. Find their generator.
3. Determine the semantic difference.
4. Correct the canonical source.
5. Regenerate outputs.
6. Add regression guards.
7. Verify consistency.

Do not create multiple competing reports that become stale.

---

# 15. REQUIRED DELIVERABLES

At completion, produce a concise executive report and detailed technical evidence.

## A. Executive summary

- Current HEAD.
- Current branch.
- Initial worktree state.
- Scope audited.
- Scope implemented.
- Scope not implemented.
- Main risks.
- Final verdict.

## B. 67-industry report

For every registered industry:

- Name.
- Key.
- Required capabilities.
- Actual implementation.
- UI wiring.
- API wiring.
- Database evidence.
- Offline evidence.
- Test evidence.
- Commercial classification.
- Limitations.
- Next required work.

Report exact totals derived from the canonical registry.

## C. Canonical architecture report

- Accounting owner.
- Inventory owner.
- Sync owner.
- Capability resolver.
- KPI owner.
- Terminology owner.
- Database write ownership.
- UI-to-domain traceability.
- Duplicate implementation findings.

## D. HA/DR report

- Current topology.
- Active writer.
- Standby.
- Read replicas.
- Fencing.
- Replication.
- Backup.
- WAL/PITR.
- Restore evidence.
- RPO/RTO targets.
- Actual drill evidence.
- Remaining external dependencies.

Clearly distinguish target architecture from deployed architecture.

## E. Infrastructure comparison

Provide the ten-tool decision matrix:

- Nginx.
- Caddy.
- Traefik.
- HAProxy.
- Envoy.
- Apache.
- Kong.
- Apache APISIX.
- OpenResty.
- PgBouncer.

For each tool explain:

- Purpose.
- Existing equivalent.
- Fit for current hosting.
- Advantages.
- Disadvantages.
- Operational overhead.
- Security implications.
- Cost implications.
- Adopt now/later/never.
- Exact reason.

## F. Security report

- Tenant isolation.
- Auth.
- Permissions.
- Secrets.
- Local encryption.
- File storage.
- API abuse.
- Security blockers.

## G. Offline report

- Supported workflows.
- Online-only workflows.
- Unsupported workflows.
- Sync invariants.
- Conflict behavior.
- Device limitations.
- Actual tests.

## H. Performance report

- Measured bottlenecks.
- Evidence.
- Fixes.
- Benchmark methodology.
- Unverified areas.

## I. Test evidence

For every executed command:

- Exact command.
- Exit code.
- Test count.
- Passed.
- Failed.
- Skipped.
- Not run.
- Relevant output.

## J. Remediation log

For every implementation:

- Priority.
- Root cause.
- Files changed.
- Canonical owner.
- Tests added.
- Tests run.
- Remaining limitation.

## K. Owner decision register

Only decisions that genuinely require human authorization.

---

# 16. FINAL ACCEPTANCE GATES

Do not declare completion unless all applicable gates pass.

### Gate 1 — Repository integrity

- Existing user changes preserved.
- No prohibited operations.
- No secrets exposed.
- No unauthorized dependency changes.

### Gate 2 — Single-core architecture

- One canonical owner per business domain.
- No duplicate financial formulas.
- No parallel sync engine.
- No duplicate capability resolver.
- No bypassed financial write path.

### Gate 3 — Financial correctness

- Atomic posting.
- Balanced ledger.
- Idempotent writes.
- Immutable finalized records.
- Explicit reversals.
- Currency correctness.
- Reconciliation.

### Gate 4 — Industry readiness

- All registered IDs accounted for.
- Real workflow evidence.
- Honest support levels.
- No generic profile falsely marked specialized.

### Gate 5 — Offline correctness

- Durable outbox.
- Stable mutation identity.
- No financial LWW.
- Crash recovery.
- Cross-device consistency.

### Gate 6 — Database resilience

- Safe write ownership.
- Verified replication design.
- Backup and restore evidence.
- No unsupported HA claims.

### Gate 7 — Infrastructure

- Tool selection justified by current deployment.
- No unnecessary proxy layers.
- Secure configuration.
- Health and failure behavior verified.

### Gate 8 — Security

- Tenant isolation.
- Authentication.
- Authorization.
- Safe local storage.
- Auditability.

### Gate 9 — Testing

- Relevant tests genuinely executed.
- No hidden skips.
- No weakened assertions.
- Blockers reported.

### Gate 10 — Commercial truthfulness

- Sellable count supported by evidence.
- Limitations visible to sales.
- Unsupported promises explicitly prohibited.

---

# 17. FINAL VERDICT

Choose one:

- `V75_COMPLETE`
- `V75_COMPLETE_WITH_LIMITATIONS`
- `IMPLEMENTATION_ADVANCED_ACCEPTANCE_BLOCKED`
- `PARTIALLY_IMPLEMENTED`
- `BLOCKED_EXTERNAL`
- `CRITICAL_INTEGRITY_FAILURE`

Never use `V75_COMPLETE` merely because all planned files exist.

The final report must answer:

1. What was actually implemented?
2. What existed already?
3. What was incorrect?
4. What was corrected?
5. What was tested?
6. What was skipped?
7. What could not be verified?
8. Which industries can genuinely be sold?
9. Which industries are pilot-only?
10. Which industries must not be offered?
11. Which infrastructure tools should be adopted now?
12. Is Nginx appropriate for the actual hosting topology?
13. What is the real HA/DR status?
14. What remains blocked by external requirements?
15. What is the next highest-value engineering task?

Include exact file references and command evidence.

Do not invent metrics, test results, production deployment, backup recovery or commercial readiness.

Proceed autonomously through all safe repository work. Continue until completion or a genuine blocker. If a workstream is blocked, continue independent workstreams. Never stop after writing a plan.
در اخر یک وریفای کامل بکن و هر تست قرمزی دیدی سبز بکن طبق قواعد کلی پروژه
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-11-24T14:12:32-03:00.
</ADDITIONAL_METADATA>
