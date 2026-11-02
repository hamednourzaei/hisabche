# 15 — SECURITY, MULTI-TENANCY & THREAT MODEL SPECIFICATION

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/15-SECURITY-TENANCY.md`

<!-- target-vocabulary -->

> **Vocabulary note (M0, 1 Nov 2026):** commands, events, tables and function names in this document that do not
> exist in the repository are **target** names of a design, not claims about current code.
> `node scripts/audit/verify-spec-references.mjs` keeps checking every file path here.

---

## 1. Tenancy Boundary Rules

1. **`workspace_id` is the Only Security Boundary**:
   `user_id` identifies who performed an action; it is never a tenancy boundary. Every query on a tenant table must carry `.eq('workspace_id', ctx.workspaceId)`.
2. **Role Verification**:
   The actor role is read strictly from `request.tenancy.role`, never trusted from client request headers.
3. **Restricted Field Stripping**:
   Sellers and cashiers have restricted financial metrics (`buy_price`, `unit_cost`, `profit`, `margin`) stripped from query responses both on the server and in the local engine.

---

## 2. Threat Model & Mitigation Matrix

| Threat                        | Attack Vector                                                        | Architectural Mitigation                                                                                                                    |
| :---------------------------- | :------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| **ID Tampering**              | Attacker crafts a command modifying an entity from another workspace | Server enforces `workspace_id = request.tenancy.workspaceId` in SQL update clause; foreign IDs return 404/403.                              |
| **Command Replay**            | Attacker intercepts a payment or refund command and replays it       | Bounded idempotency cache (`client_requests`); server returns cached replay result with 0 duplicate executions.                             |
| **Stale Device Overwrite**    | Device offline for 30 days attempts to overwrite edited customer     | Optimistic concurrency version checks on push; conflicts routed to Tier 3 human review.                                                     |
| **Revoked User Sync**         | Fired employee creates invoices offline after revocation             | Server sync checks user status; if revoked, commands are quarantined into `sync_rejected_queue` for manager inspection.                     |
| **Cross-Branch Stock Leak**   | Device at Branch A issues stock transfers from Branch B              | Role and branch capability checks require user assignment to origin branch.                                                                 |
| **Offline Cash Refund Abuse** | Employee pays out massive fraudulent refunds offline                 | Enforces bounded, time-limited cryptographic leases (`offline-lease.domain.ts` (removed in M1.0)). Payouts without valid lease are blocked. |
