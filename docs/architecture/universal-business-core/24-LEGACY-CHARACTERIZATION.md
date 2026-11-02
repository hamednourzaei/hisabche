# 24 — LEGACY SYSTEM CHARACTERIZATION SPECIFICATION

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/24-LEGACY-CHARACTERIZATION.md`

---

## 1. Characterization Principle: `LEGACY_FULL`

> **CANONICAL PRINCIPLE**:
> `LEGACY_FULL` is **NOT** a speculative preset name.
> It is an **executable behavioral snapshot** proving that all existing functionality runs with zero regression after the Universal Business Core architecture is active.

---

## 2. Granular Behavioral Characterization Matrix

| Subsystem               | Current Proven Behavior                                      | Source Evidence                                                       | Target Architecture Invariant                                 | Required Regression Test                                                                |
| :---------------------- | :----------------------------------------------------------- | :-------------------------------------------------------------------- | :------------------------------------------------------------ | :-------------------------------------------------------------------------------------- |
| **Sales Navigation**    | Navigation hubs use `PageHub` + `HubTabs`                    | `packages/app-shell/src/app/app.tsx`                                  | Tabs dynamically filter based on active capabilities          | `packages/ui-contract/src/__tests__/nav-visibility.test.ts`, `nav-module-locks.test.ts` |
| **Invoice Calculation** | Line net = $(q \times p) - d$; minor integer units           | `packages/validation/src/schemas/invoice-grid.ts:45`                  | Identical arithmetic; generalized to service offerings        | `invoice-math.parity.test.ts` (23 passed)                                               |
| **Cost Layers**         | FIFO/AVCO layer depletion; missing = `null`                  | `packages/validation/src/schemas/costing.domain.ts:34`                | Depletion executes only when `trackInventory === true`        | `cost-unknown-is-not-zero.test.ts`                                                      |
| **Till Shifts**         | Session opening float, transactions, variance on close       | `packages/local-engine/src/routes/till.ts:48`                         | Single-writer till drawer; immutably preserves variance       | `till.test.ts` (7 passed in local-engine)                                               |
| **Ledger Balancing**    | $\sum \text{Debits} \equiv \sum \text{Credits}$; period lock | `packages/validation/src/schemas/accounting.domain.ts:50`             | Re-posting returns existing ID; period lock enforced          | `ledger-rule.test.ts` (32 passed)                                                       |
| **Returns Math**        | Proportional line restoration & deductions                   | `packages/validation/src/schemas/universal-core/returns.domain.ts:69` | Restocks physical units only if `restockChoice === 'restock'` | `unified-core-parity.test.ts` (removed in M1.0) (passed)                                |
| **Payments Allocation** | Payment currency must match invoice currency                 | `packages/validation/src/schemas/payments.domain.ts:85`               | Package credit can act as tender method                       | `payments-rule.test.ts` (28 passed)                                                     |
| **Offline Sync Outbox** | `sync_queue` pushes domain routes with idempotency key       | `packages/app-shell/src/features/sync/sync-engine.ts:557`             | Service delivery sessions route through domain push           | `sync-scenarios.test.ts` (11 passed)                                                    |
| **Tenant Isolation**    | Workspace context strictly scoped                            | `packages/local-engine/src/context.ts:80`                             | Forbidden cross-workspace read/write                          | `tenant-isolation-http.test.ts`                                                         |
| **Offline Licensing**   | Bounded offline JWT token + clock tamper guard               | `packages/validation/src/schemas/offline-license.ts:40`               | Pre-allocated cryptographic refund leases                     | `offline-license.test.ts` (16 passed)                                                   |
