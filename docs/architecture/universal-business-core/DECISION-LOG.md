# ARCHITECTURAL DECISION LOG (ADR)

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/DECISION-LOG.md`

---

## Decision ADR-UBC-001: Core Location in `@hisabche/validation`

- **Question**: Where should the universal domain core live? Should we create a new `packages/domain`?
- **Alternatives**:
  1. Create a new `packages/domain`.
  2. Centralize within `packages/validation/src/schemas/universal-core/`.
- **Repository Evidence**: `packages/validation/src/__tests__/architecture-boundaries.test.ts:10` explicitly forbids `packages/domain` and requires zero framework dependencies.
- **Decision**: Centralize in `packages/validation/src/schemas/universal-core/`.
- **Reason**: `packages/validation` already holds pure TypeScript Zod schemas, compiles with 0 external dependencies, and is shared by web, desktop, mobile, and backend.
- **Reversible**: Yes, via package rename in pnpm workspace if ever required.
- **Owner Approval**: Pre-approved in ADR-002.

---

## Decision ADR-UBC-002: Offline Cash Refund Authorization Leases

- **Question**: How do we prevent duplicate cash payouts across multiple offline devices without disabling offline returns?
- **Alternatives**:
  1. Allow unrestricted offline cash refunds.
  2. Block offline cash refunds completely (allow online only).
  3. Pre-allocated cryptographic offline lease quota per device.
- **Repository Evidence**: `backend/src/services/payments/payments.service.ts` tracks remaining refundable balances.
- **Decision**: Implement pre-allocated bounded leases (`offline-lease.domain.ts` (removed in M1.0)). If a lease exists and is within quota, cash is dispensed; otherwise, the return document is saved, and a refund request is queued without physical cash payout.
- **Reason**: Protects merchant cash drawers against double-dipping while preserving 100% offline document processing.
- **Risk**: Cashiers without network or remaining lease quota cannot hand over physical cash immediately.
- **Reversible**: Yes, threshold configurable per workspace.

---

## Decision ADR-UBC-003: Offering Model Polymorphism

- **Question**: How do we support service businesses (e.g. language teachers, clinics) without duplicating the sales and invoicing engine?
- **Alternatives**:
  1. Build a separate `services` table and independent invoicing engine.
  2. Generalize `Product` to `Offering` with `type: 'goods' | 'service' | 'package'`.
- **Repository Evidence**: Invoicing rules in `invoice-grid.ts` and `invoice-math.ts` operate on line quantities and unit prices; physical warehouse moves are only triggered when inventory is tracked.
- **Decision**: Generalize `Product` into `Offering`. Service line items bypass physical inventory deduction and cost-layer depletion while sharing the identical financial, tax, and discount engine.
- **Reason**: Upholds the core principle: **ONE DOMAIN CORE, MULTIPLE ADAPTERS**.
- **Reversible**: Yes.
