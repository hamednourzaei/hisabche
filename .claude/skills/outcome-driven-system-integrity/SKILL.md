---
name: outcome-driven-system-integrity
description: Audits and verifies software systems by proving real operational outcomes rather than relying on process health, HTTP status, successful job execution, green dashboards, or passing unit tests. Use when auditing operational cores, onboarding, business workflows, synchronization, background jobs, backups, monitoring, reliability, and production readiness.
---

# Outcome-Driven System Integrity

## 1. Core Philosophy

A running service is not necessarily a healthy system.

A successful HTTP response is not proof that a business operation succeeded.

A completed background job is not proof that the expected result was produced.

A successful backup export is not proof that the data can be restored.

A passing unit test is not proof that a real user can complete the workflow.

The primary principle is:

**Verify the expected outcome, its correctness, its durability, and its visibility to the user.**

Never equate:
- Process alive with service healthy.
- API reachable with workflow successful.
- Database running with data integrity.
- Job completed with business outcome achieved.
- Backup generated with recoverability proven.
- Migration authored with migration applied.
- UI rendered with workflow usable.
- Capability registered with capability operational.
- Onboarding form completed with workspace correctly activated.
- Unit tests passing with production readiness.

## 2. The Five-Layer Verification Model

Every important feature, service, operational core, and onboarding stage must be examined across five layers.

### Layer 1 — Availability

Verify:
- Process and instance state.
- HTTP endpoint availability.
- Authentication and authorization.
- Dependency reachability.
- Database connection and availability.
- Stream and real-time connectivity.
- Client-facing page availability.

Availability is necessary but insufficient.

### Layer 2 — Execution

Verify:
- Whether the intended operation actually ran.
- Whether the correct handler and domain service executed.
- Whether the transaction committed.
- Whether the background job was claimed and completed.
- Whether retries, timeouts, and cancellations behaved correctly.
- Whether replay or duplicate execution was prevented.
- Whether the expected downstream operation was triggered.

### Layer 3 — Outcome Correctness

Define the expected output before executing the workflow.

Verify:
- Correct resulting records.
- Correct computed values.
- Correct state transitions.
- Correct relationships between entities.
- Correct ledger and inventory effects.
- Correct job output.
- Correct capability resolution.
- Correct onboarding activation facts.

Use independently calculated expected values wherever possible.

Do not compare a function against itself and call that independent verification.

### Layer 4 — Durability and Consistency

Verify:
- Database persistence.
- Transaction atomicity.
- Tenant/workspace isolation.
- Foreign keys and constraints.
- Outbox delivery.
- Synchronization and reconciliation.
- Idempotency.
- Version and cursor consistency.
- Offline-to-online round trips.
- Backup restore and integrity.
- Event and audit persistence.
- Recovery after crashes and partial failures.

### Layer 5 — User-Visible Proof

Verify from the actual user's perspective:
- The result appears in the correct screen.
- The displayed values match persisted values.
- Permissions are enforced.
- The UI reflects loading, success, empty, error, and unknown states correctly.
- No stale data is presented as current.
- The user can complete the intended journey.
- Industry-specific navigation, terminology, forms, and KPIs are correct.
- Mobile, desktop, and web behavior is consistent where supported.

## 3. Evidence Classification

Every finding must have evidence.

Use these classifications:

- VERIFIED: directly demonstrated by executed code, real database, or real runtime evidence.
- SOURCE_CONFIRMED: directly supported by inspected source code, but not runtime-verified.
- TEST_CONFIRMED: demonstrated by an executed automated test.
- RISK: a credible failure path inferred from code or architecture, not yet demonstrated.
- TEST_GAP: required behavior lacks sufficient verification.
- BLOCKED: verification cannot proceed because of an explicit external dependency.
- OWNER_DECISION: business policy or authorization decision requires the system owner.

Never turn a risk into a confirmed bug without reproducing it.

Never turn a written test into a passing test without its actual exit code.

Never turn a migration file into an applied migration.

Never turn a dashboard screenshot into proof of data correctness.

Every finding must contain:

1. Unique ID.
2. Severity: P0, P1, P2, P3.
3. Affected core or workflow.
4. Exact file and symbol.
5. Evidence and reproduction path.
6. Expected behavior.
7. Actual behavior or missing proof.
8. Business and technical impact.
9. Recommended correction.
10. Required regression test.
11. Verification status.

## 4. Operational Core Audit

Build a complete inventory of existing operational cores from the actual codebase.

Do not invent cores or duplicate existing domain services.

For each core trace:

UI → API hook → route → authorization → service → domain rules → database → events → notifications → outbox → sync → reporting → user-visible result.

Inspect:

- Ownership and boundaries.
- Route-to-core attribution.
- Read and write paths.
- State transitions.
- Database constraints.
- Tenant isolation.
- Permission enforcement.
- Dependency behavior.
- Failure handling.
- Retry and replay safety.
- Transaction atomicity.
- Audit and event coverage.
- Offline behavior.
- UI integration.
- Test coverage.

A core is not complete merely because its route exists.

A capability is not operational merely because its registry entry exists.

A workflow is not complete merely because its UI can submit a request.

For every important mutation, identify the final business effect.

Examples:
- Invoice creation → correct persisted invoice and derived totals.
- Payment → correct allocation and ledger effect.
- Inventory movement → correct quantity and cost-layer effect.
- Payroll → correct employee obligation and financial effect.
- Service delivery → correct session lifecycle and settlement behavior.
- Repair completion → correct work status and resulting customer obligation.
- Purchase finalization → correct supplier, inventory, and accounting effects.

Never assume every operation must affect inventory or accounting. Derive the expected effects from the actual domain rules and approved business policy.

## 5. Outcome-Based Monitoring Audit

Inspect the existing monitoring architecture before proposing changes.

Use the existing canonical collector, registry, metrics pipeline, alert evaluator, and UI.

Do not create parallel monitoring engines.

For every important operational core determine:

- What is measured?
- What is not measured?
- What is UNKNOWN?
- What is inferred?
- What is directly observed?
- What is the measurement coverage?
- What is the data freshness?
- What is the SLO?
- What is the business outcome invariant?

Evaluate:

### Service health
- Availability.
- Latency percentiles.
- Error rates.
- Timeouts.
- Concurrency.
- Saturation.
- Dependency latency.

### Database health
- Connection saturation.
- Slow important queries.
- Lock waits.
- Long transactions.
- Failed queries.
- Database errors.
- Migration compatibility.
- Data integrity.

### Background jobs
- Pending and processing queues.
- Stuck jobs.
- Lease expiry.
- Retry exhaustion.
- Execution duration.
- Expected result.
- Actual result.
- Output validation.
- Idempotency.
- Dead-letter or terminal failure handling.

### Backup and recovery
- Backup completion.
- Artifact existence and size.
- Checksum and integrity.
- Schema compatibility.
- Restore into an isolated environment.
- Restored record counts.
- Referential integrity.
- Sampled business invariants.
- Recovery time and recovery point.

### Real-time and synchronization
- Stream connection.
- Heartbeat freshness.
- Reconnect behavior.
- Missed events.
- Cursor progress.
- Outbox backlog.
- Conflict backlog.
- Duplicate mutation detection.
- Cross-device consistency.

### Alert quality
Every alert must define:
- Severity.
- Threshold.
- Duration.
- Owner.
- Affected core.
- Evidence.
- User impact.
- First response action.
- Escalation path.
- Deduplication.
- Cooldown.
- Resolution condition.

Do not alert on every harmless event.

Do not mark a core healthy if its required measurements are unavailable.

UNKNOWN must remain UNKNOWN.

## 6. Onboarding Integrity Audit

Audit the entire onboarding journey, not just the wizard component.

Trace:

Signup → Authentication → Profile → Workspace creation → Industry selection → Primary trade → Operational DNA → Capability resolution → Currency → Conditional configuration → Team invitation → Initial data → Server activation → Dashboard.

Verify:

- One canonical onboarding state machine.
- One canonical industry registry.
- One canonical capability resolver.
- One canonical Operational DNA model.
- Server-authoritative persistence.
- Draft autosave.
- Resume after browser refresh.
- Multi-device resume where supported.
- Idempotent completion.
- Partial failure recovery.
- Workspace ownership.
- Tenant isolation.
- Activation gate.
- Correct dashboard routing.
- Industry-specific modules.
- Correct KPI and terminology.
- Correct Persian, Dari, and English localization.

Test:
- New user.
- Existing user.
- No workspace.
- Multiple workspaces.
- Incomplete profile.
- Unsupported industry.
- Unknown industry.
- Generic profile.
- Interrupted onboarding.
- Offline onboarding where supported.
- Failed persistence.
- Duplicate completion.
- Stale local draft.
- Missing migration.
- Unauthorized activation attempt.

A wizard reaching its last step is not proof of activation.

Activation requires server-confirmed state and the correct workspace.

## 7. Cross-Domain Invariants

Identify and test invariants that cross operational cores.

Examples:
- Finalized invoices are not silently mutated.
- Payments reconcile with allocations and ledger entries.
- Financial reversals preserve balance.
- Inventory movements reconcile with quantities and costing.
- Customer and supplier identities are not confused.
- Workspace boundaries are preserved across all reads and writes.
- Events are not duplicated during replay.
- Notifications correspond to actual committed mutations.
- Offline changes do not overwrite newer authoritative data.
- Reports reconcile with source records.
- Industry capability restrictions agree between UI and API.

Use existing canonical domain rules. Do not implement a second version of the same business rule.

## 8. Testing Strategy

Use a verification pyramid:

1. Static/source analysis.
2. Unit tests for pure domain logic.
3. API and authorization integration tests.
4. Real PostgreSQL tests.
5. Migration upgrade tests.
6. Browser workflow tests.
7. Offline/online synchronization tests.
8. Recovery and fault-injection tests.
9. Staging smoke tests.
10. Production verification, only with explicit authorization.

Tests must assert outcomes, not just status flags.

For each critical workflow:
- Calculate expected values independently.
- Verify persisted records.
- Verify related records.
- Verify event and notification behavior.
- Verify permissions.
- Verify replay behavior.
- Verify what the user sees.

Do not weaken tests to make them pass.

If a test cannot execute, report BLOCKED with the exact cause.

## 9. Severity and Prioritization

P0:
- Data loss.
- Cross-tenant data exposure.
- Financial corruption.
- Unauthorized access to critical operations.
- Irrecoverable backup or restore failure.
- System-wide activation or synchronization failure.

P1:
- Core workflow produces incorrect business outcomes.
- Important operational core unavailable.
- Silent data inconsistency.
- Critical onboarding failure.
- Unbounded queue or repeated job failure.
- Missing essential recovery or audit controls.

P2:
- Partial workflow failures.
- Missing observability.
- Inaccurate reports or misleading UI states.
- Significant performance degradation.
- Missing regression coverage.

P3:
- Minor UX, documentation, or noncritical observability gaps.

Prioritize by real impact, not finding count.

## 10. Implementation Rules

Before modifying anything:

- Read repository instructions.
- Inspect current branch and working tree.
- Use code intelligence and existing architecture.
- Find existing implementations before creating new ones.
- Preserve user modifications.
- Identify migration requirements.
- Define acceptance criteria.

Implement all safe, authorized, actionable fixes.

Do not:
- Duplicate business engines.
- Introduce fake data or placeholder APIs.
- Hide failures.
- Convert unknown values to zero.
- Weaken permissions.
- Bypass tenant isolation.
- Add monitoring that measures only its own success.
- Execute production DDL or writes without explicit authorization.
- Claim runtime verification without actual execution.

Use additive, idempotent migrations following repository conventions.

Every migration must have a matching verification script and real PostgreSQL test when supported.

## 11. Required Deliverables

Produce:

1. Operational core inventory.
2. Core-to-route-to-service-to-database wiring matrix.
3. Outcome invariant matrix.
4. Monitoring coverage matrix.
5. Alert ownership and runbook matrix.
6. Onboarding stage and persistence matrix.
7. Cross-domain integrity matrix.
8. Findings ledger with evidence.
9. Fix implementation.
10. Regression tests.
11. Migration and verification files where required.
12. Production verification checklist.

## 12. Final Status Rules

Report separate statuses for:

- Source implementation.
- Automated tests.
- PostgreSQL verification.
- Browser verification.
- Device verification.
- Staging verification.
- Production verification.

Use:

- VERIFIED_COMPLETE
- IMPLEMENTED_NOT_LIVE_VERIFIED
- VERIFIED_WITH_LIMITATIONS
- BLOCKED
- NOT_IMPLEMENTED
- PENDING_HUMAN_CONFIRMATION

A system is production-ready only when its critical user journeys and business outcomes have sufficient independent evidence.

A green dashboard alone can never establish production readiness.
