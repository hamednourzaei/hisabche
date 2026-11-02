# 21 — GRANULAR SLICE BREAKDOWN (STRANGLER PATTERN)

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/21-SLICES.md`

---

## 1. Slice Inventory & Implementation Blueprint

```
M0: Specification
 └─ S0.1: Architecture Specification & Boundary Tests [PASSED]

M1: Pure Calculators & Parity
 ├─ S1.1: Integer Minor-Unit Math & Fraction Digits [PASSED]
 ├─ S1.2: Deterministic Command Envelope Contract [PASSED]
 └─ S1.3: Reusable Cross-Adapter Parity Harness [PASSED]

M2: Pilot Slice — Returns & Refunds
 ├─ S2.1: Universal Return Calculation & Deductions [PASSED]
 ├─ S2.2: Local Engine SQLite Return Wiring & Stock Restoration [PASSED]
 └─ S2.3: Offline Lease Authorization for Cash Refunds [SPECIFIED]

M3: Universal Offerings & Commercial Invoicing
 ├─ S3.1: Offering Polymorphism (Goods vs Services vs Packages)
 ├─ S3.2: Local SQLite Offering Migration & Schema
 ├─ S3.3: Invoicing Line Item Wiring to Offerings
 └─ S3.4: Sales Invoice Re-validation in Backend

M4: Package Credit Ledger & Service Delivery
 ├─ S4.1: Package Credit Ledger Schema & Invariants
 ├─ S4.2: Service Delivery Session Recording (Local & Server)
 ├─ S4.3: Credit Redemption & Deferred Revenue Ledger Posting
 └─ S4.4: Anti-Overdraw & Overage Billing Protocol

M5: Sync Hardening & Conflict Management
 ├─ S5.1: Bounded Offline Refund Lease Issuance in Backend
 ├─ S5.2: Three-Tier Conflict Resolution Dispatcher
 └─ S5.3: Crash Recovery & Stale Command Drain Tests
```

---

## 2. Granular Slice Cards (Sample Specifications)

### Slice S3.1: Offering Polymorphism

- **Goal**: Generalize `product.schema.ts` to support `type: 'goods' | 'service' | 'package'`.
- **Dependencies**: S0.1, S1.2
- **Files Affected**:
  - `packages/validation/src/schemas/product.schema.ts`
  - `packages/validation/src/schemas/universal-core/offerings.domain.ts` (planned, not built)
- **DB Impact**: None (Zod schema level expand).
- **Tests**: `packages/validation/src/__tests__/offerings-domain.test.ts` (planned, not built)
- **Gate**: Zero type-check errors, 100% test pass.

### Slice S4.1: Package Credit Ledger

- **Goal**: Implement credit account tracking, redemption, and expiration in pure core.
- **Dependencies**: S3.1
- **Files Affected**:
  - `packages/validation/src/schemas/universal-core/package-credit.domain.ts` (planned, not built)
- **Tests**: Unit tests asserting balance calculations and expiry rules.
- **Gate**: Property-based tests verifying credits remaining cannot be negative.
