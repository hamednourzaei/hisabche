# Core Readiness & Portability Assessment (CORE-READINESS.md)

This report assesses the purity, portability, and readiness of the shared business domain core in `packages/validation/src/schemas/` across each domain. It records every blocker (I/O, Clock, Randomness, Intl, Floats, Database calls) and specifies the exact changes required.

---

## 1. Domain Readiness Matrix

| Domain                                                                       | Pure & Portable? | I/O / DB Calls? | Floats / Precision?                                        | Clock / Randomness?              | Intl / Locale? | Readiness Status |
| :--------------------------------------------------------------------------- | :--------------- | :-------------- | :--------------------------------------------------------- | :------------------------------- | :------------- | :--------------- |
| **Invoicing (`invoice-grid`, `invoice-math`)**                               | YES              | None            | Minor units (`Minor`), input `parseFloat` at boundary      | Injected `nowIso`                | None           | **READY**        |
| **Inventory & Costing (`costing.domain`)**                                   | YES              | None            | Integer unit costs & quantities (`roundQty`, `roundMoney`) | Pure functional                  | None           | **READY**        |
| **Payments & Till (`payments.domain`, `installment.domain`)**                | YES              | None            | Integer minor units                                        | `now` injected in till helpers   | None           | **READY**        |
| **Accounting & Ledger (`accounting.domain`, `accounting.reports`)**          | YES              | None            | Integer minor units, strict balance `debit === credit`     | Date parsing via ISO strings     | None           | **READY**        |
| **Payroll & HR (`payroll-rules`, `human-resources.schema`)**                 | YES              | None            | Minor units for salary & taxes                             | Injected `nowIso` in transitions | None           | **READY**        |
| **Validation & Entitlement (`feature-registry`, `offline-endpoint-matrix`)** | YES              | None            | None                                                       | None                             | None           | **READY**        |

---

## 2. Granular Blocker Audit & Resolution Decisions

### A. Floating-Point & String Parsing

- **`invoice-grid.ts:77`**: `const value = parseFloat(latin)`
  - _Context:_ Parses raw string input from user in UI table cells into numbers before minor unit conversion.
  - _Decision:_ Valid boundary operation. All downstream calculation (`computeInvoiceLines`, `computeInvoiceMoney`) converts and computes in integer minor units.
- **`invoice.schema.ts:503, 507`** & **`product.schema.ts:111, 116`**: `.transform((val) => (typeof val === 'string' ? parseFloat(val) : val))`
  - _Context:_ Zod schema input coercion.
  - _Decision:_ Retained at the schema boundary. Internal domain types represent monetary totals in integer minor units.

### B. Clock & Timestamps (`Date.now()` / `new Date()`)

- **`offline-license.ts:322`**: `const nowMs = new Date(options.now ?? Date.now()).getTime()`
  - _Context:_ License validation.
  - _Decision:_ Already accepts injected `options.now`. Defaulting to `Date.now()` is safe for standalone UI calls; test suites explicitly inject `now`.
- **`till-view.ts:288, 312`**: `now = Date.now()`
  - _Context:_ Till cash-flow aggregation.
  - _Decision:_ Function signatures accept optional `now: number | string`. Injectable via `Clock` port defined in ADR-004.
- **`crm.schema.ts:26`** & **`purchasing.schema.ts:21`**: `.default(() => new Date().toISOString())`
  - _Context:_ Defaulting timestamps when building fresh draft objects in UI.
  - _Decision:_ Valid for UI object initialization. Commands sent to the domain core require explicit `clientTimestamp` in the event header.
- **`accounting.domain.ts:354`**, **`budget-plan.ts:144`**, **`collections.domain.ts:355`**, **`installment.domain.ts:117`**: `new Date(Date.UTC(...))`
  - _Context:_ Pure calendar arithmetic (year/month/day shifting and end-of-month clamping).
  - _Decision:_ Fully deterministic across all JavaScript runtimes because all inputs and outputs use UTC methods (`Date.UTC`, `getUTCFullYear`, `getUTCMonth`).

### C. Internationalization & Locale (`Intl.*`)

- **`calendar-day.ts:31-37`**: `new Intl.DateTimeFormat('en-u-ca-${calendar}-nu-latn', ...)`
  - _Context:_ Deterministic Gregorian ↔ Jalali (Persian) ↔ Hijri (Islamic) calendar date conversion.
  - _Decision:_ Fully portable. The locale string explicitly forces Latin digits (`nu-latn`), preventing localized digit substitution during parsing. Hermes (React Native) and Node 18+ include full standard ICU support for these standard calendar extensions.

### D. Randomness (`Math.random()`)

- Zero occurrences of `Math.random()` inside pure accounting, invoice, inventory, costing, or ledger rules.
- ⚠️ **CORRECTED 25 Oct 2026:** the previous line here said IDs use an `IdGenerator` port
  (ADR-004) in `domain-ports.ts`. That file was **deleted**: it declared `Clock`,
  `IdGenerator` and `UnitOfWork` with zero production consumers (ADR-006 §4). ID generation
  happens where it always did — in the callers — and `architecture-boundaries.test.ts` now
  asserts the unused scaffolding has not come back.

---

## 3. Summary of Required Phase 1 Core Tasks

1. ~~Expose `Clock` and `IdGenerator` ports in `domain-ports.ts`~~ — **not done, and withdrawn.**
   The ports were built, had no consumer, and were deleted (ADR-006). Publishing a port is only
   worth doing together with the first real consumer; until then it is a promise the code does
   not keep.
2. Define standard command/event contracts:
   `Command<T>` + `FactsSnapshot` -> `DomainResult<E, D>` — **also withdrawn** for the same
   reason (`domain-events.ts` was deleted).
3. Add a CI check in `packages/validation` ensuring no new un-injected calls to global
   non-deterministic APIs are introduced into pure domain logic. **Still open** — the audit in
   §2 holds the current inventory, but nothing fails a build when a new one appears.

---

## SHADOW COVERAGE — which money paths re-derive with the shared core

Added 25 Oct 2026. A money path is **wired** when the server re-derives its result with the
shared core on real traffic and records a `core_divergence` row when the two disagree.
**Out of scope** means the rule is not a shared-core function with two readers, so wiring it
would compare one implementation with itself — which passes always and proves nothing.

| Money path                                     | Rule                                             | Second reader?                                        | Status                                 | Reason / evidence                                                                                                                                                                                                                                                                                 |
| :--------------------------------------------- | :----------------------------------------------- | :---------------------------------------------------- | :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`POST /api/payments`**                       | `validateAllocations`, `paymentPosting`          | **Yes** — `local-engine/src/routes/payments.ts`       | **WIRED**                              | `verifyPaymentPosting` called from `routes/payments.routes.ts`; `core-shadow.test.ts` proves a wrong stored posting records exactly one row and the kill switch stops it                                                                                                                          |
| **Payment allocation**                         | `autoAllocate`                                   | **Yes** — engine                                      | **COVERED INDIRECTLY**                 | `paymentPosting` receives the allocations, so `party`/`difference` change if allocation changes; the same comparison catches it                                                                                                                                                                   |
| **`POST /api/invoices`**                       | `computeInvoiceMoney`, `computeItemTotalRounded` | **Yes** — engine                                      | **OUT OF SCOPE (by design)**           | `InvoiceService.create` **already calls `computeInvoiceMoney`** (`invoice.service.ts:863`) and stores what the core derived. A shadow check would compare the core with itself; the _stored row_ equality is asserted by `invoice-derived-money.test.ts` and `invoice-line-total-derived.test.ts` |
| **Invoice cancel / delete** (`reverseEffects`) | `reverseLines`, DB balance                       | Partly                                                | **OUT OF SCOPE**                       | A reversal, not a derivation. The arithmetic is golden vector LEDG-003; atomicity is the Postgres function                                                                                                                                                                                        |
| **`POST /api/payments/:id/cancel`**            | `reverseLines`                                   | **Yes** — engine                                      | **OUT OF SCOPE**                       | Same as above                                                                                                                                                                                                                                                                                     |
| **Stock consumption (FIFO / AVCO)**            | `planConsumption`, `averageUnitCost`             | **Yes** — `local-engine/src/routes/cost-layers.ts:73` | **OUT OF SCOPE (best next candidate)** | Shared and two-reader, so the right next target — but the server derives at invoice post while the engine derives at sale. Defining a «same facts» comparison that does not flag legitimate timing is a design task; wiring it badly would flag every backdated sale                              |
| **Period lock**                                | `evaluatePeriodLock`                             | **Yes** — engine                                      | **OUT OF SCOPE**                       | A refusal, not a derived amount; both sides read the same lock table, so a disagreement would be about the table, not the rule                                                                                                                                                                    |
| **Payroll**                                    | `planPayrollOutcome`                             | **Yes** — `local-engine/src/routes/payroll.ts:377`    | **OUT OF SCOPE (candidate)**           | Shared and two-reader; needs the same «same facts» moment as costing                                                                                                                                                                                                                              |
| **Installment plan**                           | `buildInstallmentPlan`                           | No                                                    | **OUT OF SCOPE**                       | One reader on the money path                                                                                                                                                                                                                                                                      |
| **Late fee**                                   | `planLateFeeAssessment`                          | No                                                    | **OUT OF SCOPE**                       | One reader; the fee becomes a normal invoice, already covered                                                                                                                                                                                                                                     |

### What «wired» was proven to mean

`backend/src/__tests__/core-shadow.test.ts` (the project's own vitest) asserts: an agreeing
posting records nothing; a one-minor-unit error records exactly one tenant-scoped row with both
outputs and the inputs; shadow off records nothing; the kill switch returns the capability to
`SERVER_LEGACY`; and a non-finite amount is reported as `core_threw` rather than as a money
divergence (`round2` maps non-finite to `0`, which would otherwise invent a divergence on every
malformed payment). Injection proof: flipping the comparison from `!==` to `===` turns it red.

**Summary: 1 path wired (+ allocations through it), 8 out of scope with a code-level reason.**
