# HISABCHE FINAL ARCHITECTURE INTEGRITY AUDIT

## Post-Implementation Deep Audit — Zero Parallel Cores, Zero Duplicate Business Paths

### ROLE

Act as an independent Staff/Principal Software Architect, Accounting Systems Auditor, PostgreSQL Engineer, Distributed Systems Engineer, Offline-First Architect, Security Engineer, and SRE.

You are auditing the completed implementation of these five Hisabche skills:

1. `hisabche-double-entry-ledger`
2. `hisabche-financial-posting-integrity`
3. `hisabche-accounting-reconciliation`
4. `hisabche-postgres-ha-dr`
5. `hisabche-financial-offline-sync`

Your primary responsibility is NOT to defend or justify the previous implementation.

Your responsibility is to challenge it, discover architectural duplication, identify hidden parallel execution paths, verify the actual source of truth, and correct confirmed problems safely.

**Treat the previous implementation as potentially incorrect until independently verified.**

---

# 1. NON-NEGOTIABLE REPOSITORY RULES

Before doing anything:

1. Read the complete root `AGENTS.md`.
2. Read applicable nested `AGENTS.md` files.
3. Read all five newly created Skills.
4. Read the existing Hisabche database, backend, architecture, debugging, and code-review Skills.
5. Read the accounting-integrity and db-integrity specifications.
6. Inspect the current Git status and preserve all pre-existing changes.
7. Run the repository's documented code-intelligence and indexing freshness checks before relying on search results.
8. Inspect actual package versions and configuration without changing them.

Strict restrictions:

- Never commit or push.
- Never reset, rebase, stash, checkout, clean, or discard user changes.
- Never read, print, copy, or modify `.env*` files or secrets.
- Never execute live Supabase DDL or production database writes.
- Never perform production failover, promotion, DNS changes, restore, or credential rotation.
- Never install, upgrade, downgrade, or remove dependencies.
- Never modify lockfiles.
- Never run production builds unless explicitly requested.
- Never introduce `any`, `@ts-ignore`, or `eslint-disable`.
- Never create fake APIs, placeholder implementations, unused abstractions, or speculative database providers.
- Never use subagents.
- Never weaken, delete, skip, or bypass existing tests to make the suite pass.
- Preserve exact optional property semantics and existing TypeScript constraints.
- Do not change Expo/RN versions or mobile architecture constraints.
- Follow existing workspace boundaries and shared packages.

If a task requires external credentials, production infrastructure, human accounting policy, or owner approval, document the blocker instead of bypassing it.

---

# 2. AUDIT OBJECTIVE: PROVE THERE IS ONE CANONICAL CORE

The system must not accidentally contain multiple implementations of the same business responsibility.

Audit the following domains independently.

## A. Accounting Core

Find and map:

- Chart of Accounts
- Journal Entries
- Journal Lines
- Posting Engine
- Account Balance Calculation
- Trial Balance
- General Ledger
- Financial Reports
- Opening Balances
- Reversal and Correction
- COGS
- Inventory Valuation
- Receivables
- Payables
- Payment Allocations
- Fiscal Periods
- Reconciliation

For every responsibility, identify:

1. Canonical implementation.
2. All alternative implementations.
3. All direct and indirect callers.
4. Database tables and SQL functions involved.
5. API routes and service methods.
6. Frontend hooks and screens.
7. Local/offline implementation.
8. Tests covering the responsibility.

Detect:

- Multiple journal posting functions.
- Multiple account balance calculators.
- Multiple trial balance implementations.
- Duplicate financial report formulas.
- Multiple account-role registries.
- Multiple money/currency conversion utilities.
- Separate accounting paths for online and offline.
- Financial logic duplicated between API, UI, local engine, SQL RPC and reporting.
- Legacy tables still receiving writes.
- Different modules calculating the same financial value differently.

A second implementation is not automatically a defect if it is a legitimate adapter, projection, cache, or read model. Prove its ownership and consistency contract.

**Required result:** one authoritative accounting domain core and explicitly defined adapters/read models.

## B. Financial Posting and Transaction Integrity

Trace the complete lifecycle:

Business Action
→ Validation
→ Permission Check
→ Transaction Boundary
→ Source Record
→ Journal Posting
→ Inventory/Cost Effects
→ Audit
→ Outbox
→ Commit
→ Response
→ Retry/Recovery

Inspect every financial mutation path, including:

- Invoice creation and finalization
- Sales
- Purchases
- Payments
- Refunds
- Order deposits
- Receivables
- Payables
- Inventory adjustments
- Stock transfers
- COGS
- Payroll
- Production
- Opening balances

Find:

- Duplicate posting services.
- Multiple idempotency systems.
- Duplicate payment handlers.
- Alternative transaction boundaries.
- Writes that bypass the canonical posting service.
- Source records that can commit without required ledger evidence.
- Ledger records that can exist without valid source evidence.
- Duplicate retry behavior.
- Unknown commit outcome handling gaps.
- Concurrent mutation races.

Verify that every financial operation has exactly one authoritative posting path.

Do not assume every business action requires a journal entry; verify its accounting policy.

## C. Database and Provider Architecture

Trace every database client and connection factory.

Inspect:

- `backend/src/db.ts`
- `backend/src/db/`
- Database exports and import resolution
- Drizzle clients
- Supabase clients
- Local database clients
- Read replica clients
- Write clients
- Transaction clients
- Background worker clients
- Migration connections
- Backup/restore utilities
- Provider routing and health checks

Search the entire repository for:

- `DATABASE_URL`
- `SUPABASE_URL`
- `createClient`
- `drizzle`
- `postgres`
- `Pool`
- `PoolClient`
- `getPrimary`
- `getReplica`
- `getDatabase`
- `transaction`
- Raw SQL execution
- Provider-specific RPC calls

Identify:

1. The canonical database access boundary.
2. Every legitimate specialized client.
3. Every duplicate or bypassing connection path.
4. Every provider-specific dependency.
5. Every database operation that bypasses the canonical abstraction.

Do not create a generic database abstraction merely to make the architecture look cleaner.

An abstraction is valid only if it has real callers, defined behavior, error semantics, transaction semantics, and tests.

Verify whether the proposed multi-provider design actually supports:

- Transactions
- Isolation semantics
- Tenant security
- RLS
- Migrations
- Functions and triggers
- Sequences
- Extensions
- Storage
- Auth
- Realtime
- RPC
- Connection pooling

Do not claim provider independence if the application still depends on Supabase-specific behavior.

## D. Offline and Synchronization Core

Trace the full mutation lifecycle:

Local Mutation
→ Local Persistence
→ Outbox
→ Transport
→ Server Validation
→ Idempotency
→ Database Transaction
→ Acknowledgement
→ Pull/Cursor
→ Local Application
→ Conflict Resolution

Identify:

- Multiple outbox implementations.
- Multiple sync schedulers.
- Duplicate mutation registries.
- Multiple conflict resolvers.
- Multiple cursor implementations.
- Multiple retry systems.
- Different online/offline business rules.
- Local financial writes that bypass domain validation.
- Server mutations that bypass idempotency.
- Duplicate event consumers.
- Multiple ownership models for local and server state.

Verify that all financial operations use the same business rules regardless of connectivity.

No last-write-wins for financial entities.

Do not introduce a second sync engine to fix a defect in the first.

## E. Reconciliation and Reporting

Identify every implementation that calculates:

- Account balances
- Customer balances
- Supplier balances
- Profit
- Gross margin
- COGS
- Inventory valuation
- Trial balance
- Cash flow
- Receivables
- Payables

Search across:

- Backend services
- SQL functions and views
- Frontend components
- Dashboard KPIs
- Local engine
- Reports
- Export services
- Analytics
- AI-generated summaries

For every duplicated calculation, determine whether it is:

- A canonical domain calculation
- A legitimate projection
- A presentation-only formatter
- A stale implementation
- An inconsistent competing calculation

Unknown or partial data must never silently become zero.

AFN must remain zero-decimal according to the existing currency rules.

Never aggregate different currencies without an explicit conversion model.

---

# 3. THE 100-POINT ARCHITECTURAL AUDIT

Score each check with:

- PASS — evidence proves compliance.
- FAIL — a confirmed defect exists.
- PARTIAL — implementation exists but is incomplete.
- UNKNOWN — evidence is insufficient.
- N/A — demonstrably not applicable.

Do not convert UNKNOWN into PASS.

### Group 1 — Accounting Core

1. One canonical chart of accounts.
2. One canonical journal posting boundary.
3. One authoritative journal schema.
4. One authoritative account balance calculation.
5. One canonical trial balance calculation.
6. One canonical general ledger query.
7. One canonical reversal/correction mechanism.
8. One consistent opening balance policy.
9. One canonical currency and money implementation.
10. One consistent accounting period policy.

### Group 2 — Financial Integrity

11. Atomic source and ledger persistence.
12. Database-enforced journal balance where supported by the schema.
13. Debit/credit line constraints.
14. Workspace and tenant integrity.
15. Foreign-key integrity.
16. Stable idempotency.
17. Concurrent posting safety.
18. Unknown commit outcome recovery.
19. Posted record immutability.
20. Auditable reversals.

### Group 3 — Financial Domain Coverage

21. Sales posting.
22. Purchase posting.
23. Payment posting.
24. Refund and deposit policy.
25. Receivable integrity.
26. Payable integrity.
27. Inventory movement and accounting consistency.
28. COGS and cost-layer conservation.
29. Payroll accounting integration where supported.
30. Production accounting integration where supported.

### Group 4 — Database Architecture

31. One canonical write routing boundary.
32. Clearly defined read routing.
33. No hidden database clients bypassing ownership.
34. Correct transaction propagation.
35. Correct pool lifecycle.
36. Safe connection failure handling.
37. Explicit provider capability boundaries.
38. Schema and migration parity.
39. RLS and grants parity.
40. No misleading provider abstraction.

### Group 5 — HA and Disaster Recovery

41. One active writer per financial data domain.
42. Enforceable writer fencing.
43. Split-brain prevention.
44. Replica lag measurement.
45. Safe replica read policy.
46. Independent backup storage.
47. WAL archival continuity where supported.
48. PITR procedure.
49. Actual isolated restore test.
50. Measured RPO/RTO evidence.

### Group 6 — Offline and Sync

51. One canonical outbox.
52. One canonical mutation identity model.
53. One sync cursor ownership model.
54. One conflict resolution boundary.
55. Durable local persistence.
56. Atomic pull page application.
57. Safe acknowledgement semantics.
58. Retry without duplicate financial effects.
59. No financial last-write-wins.
60. Permission revalidation during sync.

### Group 7 — Application Integration

61. Every relevant backend route has a real owner.
62. Every relevant service has identifiable callers.
63. Every relevant hook calls the correct API.
64. Every relevant UI workflow reaches the canonical service.
65. No dead financial routes.
66. No duplicate API endpoints for the same operation.
67. No UI-side financial calculation replacing domain logic.
68. No hidden alternate persistence path.
69. Correct workspace context propagation.
70. Consistent error and failure semantics.

### Group 8 — Security and Tenant Isolation

71. Tenant-scoped queries.
72. Server-side permission enforcement.
73. RLS coverage.
74. No client-controlled privilege escalation.
75. Safe database function permissions.
76. Safe service-role usage.
77. No cross-workspace references.
78. Audit trail integrity.
79. Safe secrets and backup access.
80. Safe administrative recovery operations.

### Group 9 — Testing and Verification

81. Double-entry property tests.
82. Financial idempotency tests.
83. Concurrent mutation tests.
84. Transaction rollback tests.
85. Cross-workspace isolation tests.
86. Sync crash/restart tests.
87. Unknown commit outcome tests.
88. Database failure tests.
89. Backup/restore verification tests.
90. End-to-end financial workflow tests.

### Group 10 — Maintainability and Performance

91. No duplicate business engine.
92. No duplicate domain resolver.
93. No duplicate KPI definitions.
94. No redundant provider abstraction.
95. No unnecessary database clients.
96. No unowned background workers.
97. No unbounded retry loops.
98. No avoidable N+1 queries or expensive full-table scans.
99. No unmeasured performance claims.
100.  No architectural documentation contradicting the implementation.

---

# 4. MANDATORY DUPLICATION DETECTION

Perform a repository-wide duplicate responsibility audit.

Use:

- Symbol search
- Import graph
- Call graph
- Route-to-hook mapping
- SQL function inventory
- Table write inventory
- Database client inventory
- Event/outbox consumer inventory
- Test ownership mapping
- Similarity and duplicate formula analysis

Search for semantic duplication, not only identical names.

Examples:

- `calculateBalance()` and `getAccountBalance()` may implement the same logic.
- Two differently named posting functions may create the same journal effect.
- Two different services may write to the same financial tables.
- A local engine and backend may each contain separate business rules.
- A dashboard KPI may calculate profit independently from the accounting service.
- A new provider adapter may coexist with old direct Supabase calls.

For each duplicate, report:

| Responsibility | Implementation A | Implementation B | Actual callers | Ownership | Classification | Action |
| -------------- | ---------------- | ---------------- | -------------- | --------- | -------------- | ------ |

Classification must be one of:

- `CANONICAL`
- `LEGITIMATE_ADAPTER`
- `READ_MODEL`
- `PRESENTATION_ONLY`
- `LEGACY_READ_ONLY`
- `DUPLICATE_IMPLEMENTATION`
- `BYPASS_PATH`
- `DEAD_CODE`
- `UNKNOWN`

Do not delete anything merely because its name resembles another symbol.

Prove callers, writes, dependencies, migration history and runtime role before proposing removal.

---

# 5. DATABASE WRITE OWNERSHIP AUDIT

Build a complete write ownership matrix.

| Table/Entity | Writers | Canonical Service | SQL/RPC Boundary | Transaction | Idempotency | Offline Path |
| ------------ | ------- | ----------------- | ---------------- | ----------- | ----------- | ------------ |

Identify:

- Multiple writers that can mutate the same financial state.
- Direct writes bypassing the domain service.
- Raw SQL bypassing repository ownership.
- RPC functions that duplicate service logic.
- Local writes that are not represented in the outbox.
- Triggers that silently create financial side effects.
- Background workers that can repeat operations.

For each table, classify the write model:

- Single canonical writer.
- Multiple authorized commands through one domain boundary.
- Projection-only writer.
- Legacy writer.
- Uncontrolled duplicate writers.

Do not mistake legitimate separate commands for duplicate engines.

---

# 6. ARCHITECTURAL CORRECTION POLICY

After the audit, fix confirmed defects where safe.

Priority:

P0 — Financial corruption, duplicate posting, split-brain, tenant isolation failure.

P1 — Parallel business core, competing posting logic, sync correctness failures, database bypass paths.

P2 — Duplicate reporting calculations, dead routes, redundant abstractions, inconsistent errors.

P3 — Documentation, maintainability and measured performance improvements.

For every proposed correction:

1. Identify the canonical implementation.
2. Prove why it is canonical.
3. Identify every caller of the duplicate.
4. Identify data and compatibility implications.
5. Determine whether it is safe to remove, redirect, deprecate or consolidate.
6. Add regression tests.
7. Apply the smallest safe correction.
8. Verify all affected callers.
9. Preserve backward compatibility where required.
10. Document anything that needs owner approval.

Prefer:

- Redirecting callers to the canonical core.
- Removing duplicated formulas in favor of canonical domain results.
- Explicit adapters around one core.
- Read-only legacy compatibility where deletion is unsafe.
- Consolidating ownership rather than introducing new abstraction layers.

Never create a third implementation while fixing two existing implementations.

---

# 7. TESTING REQUIREMENTS

Run the smallest relevant tests first, then expand to the complete relevant suite.

Where available, execute:

- TypeScript type checking.
- ESLint.
- Unit tests.
- Integration tests.
- PostgreSQL integration tests.
- Property-based accounting tests.
- Concurrency tests.
- Offline sync tests.
- Route-to-UI integration tests.
- Migration validation.
- Tenant/RLS security tests.
- Failure injection tests.
- Isolated restore drills.

Do not claim that unit tests prove:

- Production database integrity.
- Actual provider failover.
- Actual PITR.
- Actual backup restoration.
- Real mobile device performance.
- Production RPO/RTO.

If external infrastructure is unavailable, clearly mark the result `BLOCKED` or `IMPLEMENTED_NOT_LIVE_VERIFIED`.

Do not run production builds unless explicitly authorized.

---

# 8. DOCUMENTATION CONSISTENCY

Compare the actual architecture with:

- `AGENTS.md`
- Accounting integrity specification
- Database integrity specification
- Database/HA documentation
- Sync documentation
- Architecture maps
- API route inventory
- Migration documentation
- Existing runbooks

Update only documents that are demonstrably stale and relevant to the verified implementation.

Do not rewrite architectural documents merely to make the audit appear successful.

Documentation must describe the actual canonical owners and real execution paths.

---

# 9. REQUIRED FINAL DELIVERABLES

Produce the following reports in Persian.

## Report A — Executive Verdict

Choose exactly one:

- `ARCHITECTURE_CLEAN`
- `ARCHITECTURE_CLEAN_WITH_LIMITATIONS`
- `DUPLICATION_FOUND_AND_FIXED`
- `DUPLICATION_FOUND_NOT_FIXED`
- `CRITICAL_INTEGRITY_FAILURE`
- `AUDIT_BLOCKED`

Explain the evidence.

## Report B — 100-Point Audit

Provide a table with:

`# | Check | Status | Evidence | File/Symbol | Remaining Risk`

Include actual score counts:

- PASS
- FAIL
- PARTIAL
- UNKNOWN
- N/A

Do not calculate UNKNOWN as PASS.

## Report C — Canonical Core Registry

Produce a definitive registry:

| Domain | Canonical Owner | Entry Point | Persistence Boundary | Consumers | Tests |
| ------ | --------------- | ----------- | -------------------- | --------- | ----- |

Include accounting, financial posting, reconciliation, database access, sync, conflict resolution, money/currency, KPI and permissions.

## Report D — Duplicate and Bypass Inventory

List every confirmed duplicate, parallel core, direct-write bypass and dead implementation.

For each, include evidence and final disposition.

## Report E — Database Ownership Map

List all important financial tables and their actual write owners.

## Report F — Route-to-Core Traceability

Trace:

`UI → Hook → API Route → Service → SQL/RPC → Database → Outbox → Sync`

Identify missing or duplicated links.

## Report G — Financial Invariant Results

Report the results of balance, idempotency, concurrency, rollback, reversal, currency and tenant-isolation tests.

## Report H — HA/DR Results

Report:

- Active writer evidence
- Replica evidence
- Fencing model
- Backup evidence
- WAL/PITR evidence
- Actual restore evidence
- Measured RPO/RTO
- External provider dependencies
- Remaining blockers

## Report I — Changes Made

For every modified file:

`File | Original Problem | Correction | Tests | Risk`

Do not include files that were merely inspected.

## Report J — Remaining Risks and Owner Decisions

Separate:

- Confirmed defects
- Unverified assumptions
- External blockers
- Required owner decisions
- Deferred non-critical improvements

## Report K — Final Architecture Diagram

Provide a Mermaid diagram of the actual verified architecture.

It must show one canonical business core, its adapters, persistence boundary, outbox and external infrastructure dependencies.

Do not draw proposed components as if they already exist.

---

# 10. DEFINITION OF DONE

The audit is complete only when:

1. Every domain has a documented canonical owner.
2. Every financial write path is traceable.
3. Every confirmed duplicate implementation is removed, redirected, or explicitly justified.
4. No new parallel core was introduced during correction.
5. Database access ownership is explicit.
6. Online and offline paths preserve the same financial invariants.
7. No financial last-write-wins behavior exists.
8. Duplicate retries cannot duplicate financial effects.
9. Reconciliation uses canonical financial data.
10. Tests support every claimed correction.
11. Documentation matches verified source code.
12. All unresolved risks and external blockers are disclosed.

A high score does not override a critical financial defect.

Even one confirmed P0 defect prevents an `ARCHITECTURE_CLEAN` verdict.

---

# 11. EXECUTION MODE

Work autonomously through the repository audit and all safe in-repository corrections.

Do not stop after producing a plan.

Do not ask for permission for ordinary, reversible, in-repository code changes that comply with the repository rules.

Do stop before:

- Production database changes.
- Production failover or promotion.
- External infrastructure provisioning.
- Credential or DNS changes.
- Destructive data operations.
- Accounting policy decisions requiring owner approval.
- Dependency or lockfile changes.

If blocked, complete every independent safe task and provide exact commands and evidence required to unblock the remaining work.

Do not report success prematurely.

**Final instruction:**

Your objective is not to make the codebase look clean.

Your objective is to prove that Hisabche has one coherent, traceable, secure and financially correct business architecture — with no hidden parallel accounting engine, no competing database writer, no duplicate sync system, no bypassed financial posting path, and no undocumented source of truth.
