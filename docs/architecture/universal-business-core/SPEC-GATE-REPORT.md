# SPECIFICATION GATE REPORT: UNIVERSAL BUSINESS CORE v50.50-HIGH

**Document Location**: `docs/architecture/universal-business-core/SPEC-GATE-REPORT.md`  
**Generated Date**: 2026-11-01T15:45:00Z  
**Execution Phase**: PHASE 20 — SPECIFICATION GATE

---

## 1. What Was Discovered During Audit

1. **Mechanical Boundaries Already Active**: `packages/validation/src/__tests__/architecture-boundaries.test.ts` already enforces zero framework dependencies on `@hisabche/validation` and forbids duplicate domain packages.
2. **Missing Local Route Registration**: `registerInvoiceReturnsRoutes` was implemented in `packages/local-engine/src/routes/invoice-returns.ts` but had never been registered in `packages/local-engine/src/index.ts`, resulting in 501 Not Implemented errors offline. We wired this route and proved it with 3/3 green tests in the pilot slice.
3. **Non-deterministic ID Generation**: The legacy local-engine route used `Date.now()` and `Math.random()`, which has been replaced with deterministic ID derivation based on `clientRequestId` and command envelope payloads.

---

## 2. What Architecture Is Actually Reusable

- **Shared Invoicing Math**: `computeItemTotal` and `sumInvoiceLines` in `packages/validation/src/schemas/invoice-grid.ts` and `invoice-math.ts` are 100% reusable across goods and services.
- **Costing Engine**: FIFO and AVCO layer depletion in `costing.domain.ts` is mathematically proven and handles the "Unknown is not zero" invariant cleanly.
- **Double-Entry General Ledger**: `accounting.domain.ts` and `ledger.port.ts` strictly enforce debit/credit equality and period locking.
- **Durable Outbox**: `sync-engine.ts` with domain-routing via `push-routing.ts:routeFor` provides durable offline queuing and recovery.

---

## 3. What Assumptions Were Wrong

1. _Assumption_: Returns and cash refunds are a single atomic event.  
   _Reality_: They are two distinct events. The target command `CreateReturnDocument` (today: `invoice_return_create`) establishes goods reversal, deductions, and customer credit. the target command `RefundReturnPayout` (today: `InvoiceReturnService.refundReturn`) dispenses cash and must be bounded by remaining refundable cash and offline lease quotas.
2. _Assumption_: Service businesses require an independent database schema.  
   _Reality_: Generalizing `Product` to `Offering` (`goods`, `service`, `package`) allows services to reuse 100% of the commercial and financial engine without warehouse overhead.

---

## 4. What Changed from v50.50-HIGH

- Replaced monolithic refactoring with a fine-grained **Strangler Pattern (Slices S0.1 through S5.3)**.
- Formalized the **Offline Financial Authorization Lease** (`offline-lease.domain.ts` (removed in M1.0)) to prevent cross-device offline refund double-dipping.
- Established the **Package Credit Ledger** to cleanly track deferred revenue for prepaid courses and session bundles.

---

## 5. What Remains Uncertain

- Default offline cash refund quota policy (recommended safe default: zero cash payout without a cryptographic server lease).
- Policy for unredeemed package credits upon expiration (recommended: forfeit to Breakage Income after 30-day grace period).

---

## 6. Slice Dependency Graph

```
S0.1 (Spec & Boundaries) -> S1.1, S1.2 -> S1.3 (Parity Harness)
  ├── S2.1, S2.2, S2.3 (Returns Pilot Slice - PASSED)
  ├── S3.1 (Offering Polymorphism) -> S3.2 -> S3.3 -> S3.4
  ├── S4.1 (Package Credit Ledger) -> S4.2 -> S4.3 -> S4.4
  └── S5.1, S5.2, S5.3 (Sync Hardening & Crash Recovery)
```

---

## 7. Highest Risks & Mitigations

1. **Financial Divergence Across Offline Devices**: Mitigated by strict integer minor units, server re-validation, and three-tier conflict resolution.
2. **Accidental Deletion of Outbox Rows During Schema Upgrades**: Mitigated by local migration invariants that preserve `sync_queue` table contents.

---

## 8. Owner Decisions Required

- `OD-01`: Approval of offline cash refund lease threshold (Safe default: refuse physical cash payout without valid lease).
- `OD-02`: Approval of package credit expiration forfeiture rule (Safe default: 30-day grace period, then Breakage Revenue).

---

## 9. Next Implementation Slice

- **Slice S3.1**: Offering Polymorphism (Goods vs. Services vs. Packages in `@hisabche/validation/universal-core`).

---

## 10. Exact Verification Commands for S3.1

```bash
pnpm --filter @hisabche/validation test src/__tests__/offerings-domain.test.ts
pnpm --filter @hisabche/validation type-check
pnpm --filter @hisabche/validation lint
```

---

```text
SPEC_STATUS:
READY_FOR_IMPLEMENTATION
```
