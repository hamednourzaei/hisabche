# Hisabche — Outcome-Driven System Integrity Standard

> **CANONICAL ARCHITECTURAL STANDARD:** This document governs how any feature, core, workflow, or migration is evaluated, verified, and audited in Hisabche.
> Root references: `AGENTS.md` §0.7 · `CLAUDE.md` §0.6 · `.agents/skills/outcome-driven-system-integrity/SKILL.md`.

---

## 1. Core Philosophy

A running service is not necessarily a healthy system.
A successful HTTP 200 response is not proof that a business operation succeeded.
A completed background job is not proof that the expected business outcome was produced.
A passing unit test is not proof that a real user can complete the workflow.

**Hisabche verifies the expected outcome, its correctness, its durability, and its visibility to the user.**

Never equate:

- Process alive with service healthy.
- API reachable with workflow successful.
- Database running with data integrity.
- Job completed with business outcome achieved.
- Migration authored with migration applied.
- UI rendered with workflow usable.
- Capability registered with capability operational.
- Onboarding completed with workspace correctly activated.
- Unit tests passing with production readiness.

---

## 2. The Five-Layer Verification Model

Every operational core and user workflow must satisfy all five layers:

### Layer 1 — Availability

- Process and instance state.
- Route reachability and endpoint status.
- Tenancy and authentication resolution (`TenancyContext`, `request.tenancy.role`).
- Database connection and table availability.

### Layer 2 — Execution

- The intended business handler and domain service executed.
- Mutation committed within PostgreSQL transaction boundary.
- Duplicate execution and idempotency races prevented (`idempotency_key`, `findForReplay`).
- Background jobs claimed via atomic lease (`claim_webhook_deliveries` with `SKIP LOCKED`).

### Layer 3 — Outcome Correctness

- Exact business outcome achieved (e.g. invoice finalized, receivable debited, revenue credited).
- Integer minor units derived from line items without floats (`toMinor`, `fractionDigits`).
- Cost layers evaluated via FIFO/AVCO (`costing.recordIssue`), never buy price.
- Ledger entries balanced (Debits == Credits).
- Unknown values remain `null` («نامعلوم، صفر نیست»).

### Layer 4 — Durability and Consistency

- Database persistence with `workspace_id` isolation on every row.
- Foreign keys and uniqueness constraints enforced.
- Domain events and audit records persisted (`logBusinessEvent`).
- Offline-first local engine compatibility (`packages/local-engine`, `app-bridge`).
- Two-way sync convergence without overwriting newer authoritative edits.

### Layer 5 — User-Visible Proof

- Screen displays the exact persisted state.
- Dynamic permissions and capabilities enforced (`useMyCapabilities`, `profileAllows`).
- Loading, empty, error, and unknown states handled distinctly.
- Full RTL and tri-lingual localization (`fa`, `af`, `en`).

---

## 3. Mandatory Capability Registration Schema

Whenever a capability or workflow is added, edited, or audited, it must register its Outcome Integrity Record:

```markdown
| Field                 | Value / Verification                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Capability**        | [e.g. Service Session Creation & Multi-Customer Allocation]                                                      |
| **Owner Core**        | [e.g. Service Delivery]                                                                                          |
| **Dependencies**      | [e.g. Customers, Employees, Calendar, Pricing]                                                                   |
| **Expected Outcome**  | [e.g. Session record created with subject_type, normalized participant rows linked, undecided settlement stored] |
| **Persistence Proof** | [e.g. PostgreSQL `service_delivery_sessions` and `service_delivery_session_participants` rows]                   |
| **Replay Proof**      | [e.g. `client_request_id` / idempotency key returns existing session without duplication]                        |
| **Offline Proof**     | [e.g. Stored in SQLite/dexie local schema and reconciled during sync]                                            |
| **User Proof**        | [e.g. Visible in `/fa/service-delivery` table with correct subject tag and customer names]                       |
| **Failure Recovery**  | [e.g. Raced booking or conflict rolls back atomically, reports `RESOURCE_BOOKING_OVERLAP`]                       |
| **Alert Owner**       | [e.g. Service Delivery Core Lead]                                                                                |
```

---

## 4. Evidence Classification

When reporting or auditing:

- `VERIFIED`: Directly demonstrated by executed code, real database, or live HTTP inject.
- `SOURCE_CONFIRMED`: Inspected and verified in source code, but not live runtime executed.
- `TEST_CONFIRMED`: Verified via automated test suite execution (exit code 0).
- `RISK`: Credible architectural vulnerability not yet demonstrated.
- `TEST_GAP`: Missing test coverage for a critical invariant.
- `BLOCKED`: Blocked by external limitation (e.g. Windows shared memory error 1314).
- `OWNER_DECISION`: Requires solo founder approval.
