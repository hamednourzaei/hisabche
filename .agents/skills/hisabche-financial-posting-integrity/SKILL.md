---
name: hisabche-financial-posting-integrity
description: Use when changing invoices, payments, receivables, payables, inventory costing, COGS, payroll, order deposits, refunds, or any workflow that creates financial side effects.
---

# Hisabche Financial Posting Integrity

## Goal

Ensure a business operation produces exactly the intended durable financial and operational effects, once, atomically, with an auditable recovery path.

## Start here

- Read `AGENTS.md`.
- Read `.claude/accounting-integrity/00-SPEC.md` and `.claude/db-integrity/00-SPEC.md`.
- Read the relevant existing domain Skill (backend, database, auth, sync) before touching code.
- Find the current canonical service and SQL/RPC boundary. Never create a second posting engine.

## Five-layer outcome proof

For each capability, document:

1. Availability — route/service/database boundary exists.
2. Execution — intended handler executed and committed.
3. Outcome correctness — amounts, journal lines, receivable/payable, stock, cost layers and statuses are correct.
4. Durability/consistency — tenant scope, FK, outbox, idempotency and offline convergence hold.
5. User-visible proof — UI displays the correct amount, currency, state, permission and failure.

HTTP 200, a green unit test, or a success toast is not sufficient.

## Financial invariants

- Use integer money units and the canonical currency scale. No floating-point arithmetic.
- AFN is zero-decimal; never apply a `/100` or `*100` conversion to AFN.
- Keep currencies separate. A payment allocation across currencies must be explicitly supported by a persisted exchange-rate/conversion model; never silently coerce.
- Server derives all totals from authoritative lines and persisted domain data.
- Workspace scope is the security boundary. Every tenant read/write must use the trusted tenancy context and workspace_id.
- Use the existing permission/capability system. Never trust a permission or workspace ID from request body.
- A financial mutation must be atomic across source record, ledger, allocations, stock/cost effects, audit and outbox as applicable.
- Use the existing idempotency mechanism. Unknown commit outcome must be safe to retry.
- No last-write-wins for financial records.
- Posted/finalized financial records are immutable except explicitly permitted sync metadata. Corrections use auditable compensating entries.
- Refunds require reason and audit. Respect the existing owner decision: use the existing `payment.record` permission for order-deposit refund if that remains the current policy; do not introduce `payment.refund` without a new owner decision.
- `unknown`, `partial`, `missing`, and `not calculated` are not zero.
- Do not derive profit from revenue when COGS is unknown.
- Inventory quantity, unit, weight, warehouse and cost basis remain distinct.
- Cost-layer consumption must not exceed received quantity or remaining quantity; validate at the database and service boundaries where supported.

## Transaction and retry protocol

1. Validate actor, tenancy, capability, state transition and idempotency key.
2. Load authoritative current state inside the transaction/RPC boundary.
3. Derive amounts on the server.
4. Lock the smallest correct rows/keys to serialize conflicting operations.
5. Apply source mutation, allocations, ledger entries, inventory/cost effects, audit and outbox in one transaction.
6. Commit once.
7. If the client times out after commit may have happened, retry with the same idempotency key and return the prior outcome.
8. If outcome cannot be established, mark it unknown and reconcile; do not blindly repeat a payment or posting.
9. Never use compensating DELETE as a fake rollback after a partial multi-table write.

## Required adversarial tests

- Duplicate submit, network retry and same idempotency key.
- Same business action with a different key after first commit.
- Concurrent payments against the same receivable.
- Concurrent stock consumption against the same cost layers.
- Timeout after database commit but before HTTP response.
- Database connection loss before commit and during commit.
- Failure after source validation but before ledger write.
- Failure after ledger write but before outbox publication.
- Cross-workspace ID substitution.
- Unauthorized capability and revoked membership.
- Negative, fractional, overflow and precision-boundary money.
- AFN integer amount preserved exactly.
- Cross-currency allocation rejected unless supported by explicit conversion.
- Refund without reason rejected; duplicate refund blocked.
- Unknown COGS propagates null/unknown to every profit consumer.
- Reversal creates compensating evidence and preserves original record.

## Required output

For each change provide a table:
`Capability | Owner Core | Dependencies | Expected Outcome | Persistence Proof | Replay Proof | Offline Proof | User Proof | Failure Recovery | Alert Owner`.

List test commands and exit codes. Separate code-level verification from real PostgreSQL and production verification.
