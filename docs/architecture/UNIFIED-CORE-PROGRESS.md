# HISABCHE — UNIFIED ONLINE/OFFLINE BUSINESS CORE PROGRESS LOG

**Canonical Checkpoint File**: `docs/architecture/UNIFIED-CORE-PROGRESS.md`  
**Target Architecture**: Shared Domain Core (one set of business rules, validation, calculations, state machines) + Local Adapter (SQLite + Durable Outbox) + Remote Adapter (API + PostgreSQL transaction) + Unified Sync Engine.  
**Started**: 2026-11-01T14:55:00Z  
**Last Updated**: 2026-11-01T15:19:00Z  
**Current Phase**: Phase 3 — Slice-by-Slice Migration  
**Current Slice**: Slice 2 — Returns & Refunds (Pilot Slice COMPLETED); Preparing Slice 3 (Sales & Invoicing)

---

## 0. Git Baseline & Working Tree Status

- **Git HEAD**: `01d4a66d9fdb4e19889605567cfbdb960b6e9164` ("fixed ci 14")
- **Rule 0 Compliance**: No `git commit`, `git push`, `git reset`, `git checkout --`, `git stash`, or rebase. Pre-existing work is preserved and documented separately.
- **Files Modified in Unified Core Session**:
  - `docs/architecture/UNIFIED-CORE-AUDIT.md` (new architecture audit artifact)
  - `docs/architecture/UNIFIED-CORE-PROGRESS.md` (this progress tracking artifact)
  - `packages/validation/src/schemas/universal-core/command-envelope.ts` (removed in M1.0) (new versioned command envelope contract)
  - `packages/validation/src/schemas/universal-core/offline-lease.domain.ts` (removed in M1.0) (new offline authorization lease domain)
  - `packages/validation/src/schemas/universal-core/index.ts` (exported new foundation modules)
  - `packages/validation/src/schemas/feature-registry.ts` (classified `invoice.returns` as hybrid)
  - `packages/validation/src/schemas/offline-endpoint-matrix.ts` (marked `GET /invoices/:x/returns` and `POST /invoices/:x/returns` as available)
  - `packages/validation/src/__tests__/universal-core-foundation.test.ts` (removed in M1.0) (new foundation unit tests)
  - `packages/validation/src/__tests__/unified-core-parity-harness.ts` (removed in M1.0) (new reusable parity harness)
  - `packages/validation/src/__tests__/unified-core-parity.test.ts` (removed in M1.0) (parity test suite)
  - `packages/local-engine/src/index.ts` (registered `registerInvoiceReturnsRoutes`)
  - `packages/local-engine/src/routes/invoice-returns.ts` (wired deterministic IDs, deductions, atomic restocking)
  - `packages/local-engine/src/__tests__/invoice-returns.test.ts` (new local engine route test suite)

---

## 1. Migration Phasing & Slice Status

| Slice / Phase                       | Focus                                                                                          | Status          | Gates Passed                                                                      | Blockers / Decisions                |
| :---------------------------------- | :--------------------------------------------------------------------------------------------- | :-------------- | :-------------------------------------------------------------------------------- | :---------------------------------- |
| **Phase 1: Audit & Plan**           | Comprehensive Repo Audit & Ordered Migration Plan                                              | **PASSED**      | Generated `docs/architecture/UNIFIED-CORE-AUDIT.md`                               | None                                |
| **Phase 2: Foundation**             | Boundary rules, determinism, command contract, repository ports, parity harness                | **PASSED**      | Boundary tests (4/4), command envelope tests (3/3), Parity harness (1/1)          | None                                |
| **Slice 1: Pure Calculators**       | Money rounding, tax, discount, fee, allocation                                                 | **PASSED**      | Golden vectors (20/20 node, 20/20 backend, 20/20 local-engine)                    | Zero float arithmetic on money path |
| **Slice 2: Returns & Refunds**      | Pilot slice: return calculations, restock choices, deductions, cash refund lease authorization | **PASSED**      | Validation (31/31), Local-engine (3/3), Backend (38/38), Sync (11/11), UI (12/12) | Offline cash refunds require lease  |
| **Slice 3: Sales & Invoices**       | Invoice creation, line items, pricing, multi-currency, credit limit checks                     | **IN_PROGRESS** | `invoice-math.parity.test.ts` (23/23), `invoice-grid.test.ts` (39/39)             | -                                   |
| **Slice 4: Purchases & Returns**    | Purchase bills, supplier pricing, purchase returns                                             | **PENDING**     | `purchasing.test.ts` (7/7 in local-engine)                                        | -                                   |
| **Slice 5: Inventory & Costing**    | Stock movements, AVCO/FIFO cost layers, transfers, adjustments, unvalued stock                 | **PENDING**     | `costing.test.ts` (5/5), `transfer-cost-layers.test.ts` (6/6)                     | -                                   |
| **Slice 6: Payments & Cashboxes**   | Till sessions, cash-in/cash-out, multi-currency allocations, party statements                  | **PENDING**     | `till.test.ts` (7/7 in local-engine), `payments-rule.test.ts` (28/28)             | -                                   |
| **Slice 7: General Ledger Posting** | Journal entry posting, period locking, double-entry balance, reversal ledger                   | **PENDING**     | `ledger-rule.test.ts` (32/32), `one-financial-engine.test.ts` (4/4)               | -                                   |
| **Slice 8: CRM & People**           | Customers, suppliers, credit limits, debts, employee records, attendance                       | **PENDING**     | `identity.test.ts` (14/14), `people.test.ts` (14/14)                              | -                                   |
| **Slice 9: Payroll & HR**           | Salary rules, deductions, taxes, payroll status lifecycle, booking                             | **PENDING**     | `payroll-outcome.test.ts`, `payroll-rules.ts`                                     | -                                   |
| **Slice 10: Manufacturing & BOM**   | Work orders, bill of materials, production runs                                                | **PENDING**     | `manufacturing-cost.test.ts` (23/23)                                              | -                                   |
| **Slice 11: Reports & Analytics**   | Balance sheet, income statement, trial balance, profit by currency                             | **PENDING**     | `reports.test.ts` (8/8), `analysis.test.ts` (9/9)                                 | -                                   |
| **Slice 12: Sync Engine Hardening** | Durable outbox, temp-to-real ID mapping, crash recovery, conflict resolution                   | **PENDING**     | `sync-scenarios.test.ts` (11/11 in desktop jest)                                  | -                                   |
| **Slice 13: Platform Verification** | Shared UI, Web, Electron Desktop, Android WebView, Offline state indicators                    | **PENDING**     | `returns-core-screen.test.tsx` (12/12)                                            | -                                   |

---

## 2. Decision Log & Open Points

- `DECISION-01`: Shared domain core lives in `packages/validation/src/schemas/` (existing canonical location per ADR-002).
- `DECISION-02`: Money arithmetic strictly integer minor units (`Minor`), zero floating-point math in financial core.
- `DECISION-03`: Server is the final financial authority (`PostgreSQL`); client executes local-first and revalidates on sync.
- `DECISION-04`: `invoice.returns` classified as `hybrid` in `feature-registry.ts` because return document calculation & restocking run locally, while cash refunds against a return require server authorization or a pre-issued lease (`OFFLINE_WITH_SERVER_AUTHORIZATION`).
- `NEEDS_OWNER_DECISION`: Default offline cash refund limit per device/session (safe default implemented: cash refunds without a valid server lease are refused offline, while the return document and refund request are safely recorded and queued).

---

## 3. Measured Numbers & Verification Summary

- `@hisabche/validation`: 45 test files passed, 637 passed tests (0 failed).
- `@hisabche/local-engine`: 36 test files passed, 270 passed tests (0 failed).
- `@hisabche/backend`: 38/38 return & payment tests passed (0 failed).
- `@hisabche/desktop` (sync scenarios): 11/11 tests passed (0 failed).
- `@hisabche/ui`: 12/12 returns screen tests passed (0 failed).
