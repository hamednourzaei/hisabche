# Phase 2 — the rules leave the server

> Offline Edition, phase 2 of 10. Read `docs/offline/01-CAPABILITY-MATRIX.md` §5.2
> first: it holds the owner's approved L/C split and the three decisions this
> phase runs on.

- **Started:** 19 Oct 2026, after Gate 1 was approved with three amendments.
- **Gate 2 status: ALL SEVEN RULES MOVED (19 Oct 2026); the gate evidence and the
  verdict are in `docs/offline/gates/2.md`.** Every rule now lives in `packages/validation/src/schemas/` and the
  backend file that used to own it re-exports it, so both runtimes import one
  implementation.
- **Scope of this slice:** all seven rules of §1. The owner asked for rule 1
  first (proving the device total and the server total agree to the smallest unit
  of the currency, and fixing F2-01) and rule 2 next; the rest follow §1's order.

---

## 0. Measured state

| Measurement                          | Value                                                                                 | Command                                                                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validation test files                | **21 passed**                                                                         | `packages/validation` → `npx vitest run`                                                                                                                                            |
| Validation tests                     | **353 passed**                                                                        | same                                                                                                                                                                                |
| Parity tests (rule 1)                | **10 passed**                                                                         | `npx vitest run src/__tests__/invoice-math.parity.test.ts`                                                                                                                          |
| Stock-rule tests (rule 2)            | **10 passed**                                                                         | `npx vitest run src/__tests__/stock-warehouse.test.ts`                                                                                                                              |
| Payments tests (rules 4, 5, 7)       | **28 passed**                                                                         | `npx vitest run src/__tests__/payments-rule.test.ts`                                                                                                                                |
| Costing tests (rule 3)               | **19 passed**                                                                         | `npx vitest run src/__tests__/costing-rule.test.ts`                                                                                                                                 |
| Profit-report tests (rule 6)         | **23 passed**                                                                         | `npx vitest run src/__tests__/profit-report-rule.test.ts`                                                                                                                           |
| Ledger tests (rule 4)                | **28 passed**                                                                         | `npx vitest run src/__tests__/ledger-rule.test.ts`                                                                                                                                  |
| One-rule-each tests                  | **59 passed** (29 rules × 2 + 1)                                                      | `packages/ui` → `npx vitest run src/__tests__/one-rule-each.test.ts`                                                                                                                |
| Backend invoice subset (F2-01 fixed) | **4 files / 80 tests passed**                                                         | `npx vitest run src/__tests__/invoice-derived-money.test.ts src/__tests__/invoice-edit-rules.test.ts src/__tests__/pricing-engine.test.ts src/__tests__/collections-engine.test.ts` |
| Backend warehouse subset (re-export) | **3 files / 32 tests passed**                                                         | `npx vitest run src/__tests__/product-stock-warehouse.test.ts src/__tests__/multi-warehouse.test.ts src/__tests__/warehouse-product-and-units.test.ts`                              |
| Backend costing subset (re-export)   | **5 files / 96 tests passed**                                                         | `npx vitest run ...inventory-costing-rules repost-service stock-count buy-price-and-transfer-history transfer-lifecycle`                                                            |
| Backend payments subset (re-export)  | **6 files / 85 tests passed**                                                         | `npx vitest run ...db-integrity-code currency-audit.characterisation till-on-payments opening-capital-and-fees invoice-exchange-rate money-primitive-guard`                         |
| Backend profit subset (re-export)    | **5 files / 67 tests passed**                                                         | `npx vitest run ...profit-report profit-foreign-currency cost-unknown-is-not-zero break-even-scenarios evidence-chain`                                                              |
| `tsc --noEmit`                       | exit 0 in `backend`, `packages/validation`, `packages/ui`, `packages/api`, `apps/web` | each package                                                                                                                                                                        |
| ESLint on the changed files          | exit 0                                                                                | `npx eslint <files>`                                                                                                                                                                |

The backend-wide suite was run separately, twice. The final run reported
**356 files / 5,074 tests — 1 failed, 8 skipped**: the one failure is the
known-red `sales-chart-window.test.ts` that `AGENTS.md` §8 lists as not part of
this work, and the 8 skipped are two `*.pg.test.ts` suites
(`invoice-exchange-rate-01`, `workspace-access`) that failed to START because
`embedded-postgres` did not bind a port under the parallel load. Both were
re-run alone: **2 files / 8 tests passed**, which is the flakiness `AGENTS.md`
§7 describes. The earlier run had the same 356 files / 5,074 tests and one
extra load-related flake (`supabase-fetch-metrics`, 5/5 alone). No file this
phase touched failed in any run.

---

## 1. The seven rules of Gate 2

| #   | Rule                                                       | From                                                         | To                                                        | Status                                   |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- | ---------------------------------------- |
| 1   | Invoice totals, line rounding, discount, tax               | `backend/src/services/invoice.service.ts`                    | `packages/validation/src/schemas/invoice-math.ts`         | **moved; F2-01 fixed by owner decision** |
| 2   | Stock movement per warehouse (`stockEditWarehouse`)        | `backend/src/services/inventory/warehouse-summary.domain.ts` | `packages/validation/src/schemas/stock.ts`                | **moved**                                |
| 3   | Cost layers FIFO / AVCO (`coverSoldUnits`)                 | `backend/src/services/inventory-costing/costing.domain.ts`   | `packages/validation/src/schemas/costing.domain.ts`       | **moved**                                |
| 4   | Ledger lines for invoice / payment / FX (`paymentPosting`) | `services/accounting/{accounting,invoice-posting}.domain.ts` | `schemas/{accounting.domain,invoice-posting.domain}.ts`   | **moved**                                |
| 5   | Payment allocation by currency (`settlesInCurrency`)       | `backend/src/services/payments/payments.domain.ts`           | `packages/validation/src/schemas/payments.domain.ts`      | **moved**                                |
| 6   | Profit report, `costStatus`                                | `backend/src/services/accounting/profit-report.domain.ts`    | `packages/validation/src/schemas/profit-report.domain.ts` | **moved**                                |
| 7   | Party balances by currency                                 | `backend/src/services/payments/payments.domain.ts`           | `packages/validation/src/schemas/payments.domain.ts`      | **moved**                                |

Rules 4, 5 and 7 are one file's worth of rules: `payments.domain.ts` (allocation,
posting and party balances) plus the ledger core. Rule 4's `paymentPosting` moved
with rule 5; its accounting half (`invoiceLedgerLines`, `validateEntryLines`, …)
moved with `accounting.domain.ts`.

⚠️ §1's "To" column named three files (`allocation.ts`, `posting.ts`,
`costing.ts`) that no longer match what was built. The programme spec
(`OFFLINE-EDITION-PROMPT.md` §"the rules are not rewritten in the engine — they
are moved … into a `*.domain.ts` in `packages/validation`") asks for the backend
**domain file** to move, not to be cut into new files, so each rule moved as the
file that already held it: `payments.domain.ts`, `costing.domain.ts`,
`accounting.domain.ts`, `invoice-posting.domain.ts`, `profit-report.domain.ts`.
Splitting them would have meant inventing four new files and moving helpers
between them — a refactor in the middle of an extraction.

Extraction order was #1, #2, then #5, #4, #3, #6, #7: numbering and every write
path depend on #1.

---

## 2. What moved — and what did not

**Created:** `packages/validation/src/schemas/invoice-math.ts`

It now declares exactly these things:

| Declaration                                      | Was                     | Why it is a rule and not a server capability                                                                                         |
| ------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `computeItemTotal`                               | `invoice.schema.ts:102` | one line's money: quantity, components, percentage discount                                                                          |
| `computeInvoiceMoney`                            | `invoice.schema.ts:157` | the header: derives each line from its item, then calls `sumInvoiceLines`                                                            |
| `sumInvoiceLines`                                | new — F2-01             | rounds each line to the currency's minor unit, then applies discount and tax. **Both** the server and the grid's `summarize` call it |
| `roundInvoiceMoney`                              | new — F2-01             | one amount to the currency's smallest unit; the builder's money rounding                                                             |
| `minorFactor`, `nudge`, `toMinorUnits` (private) | `round2`                | the rounding boundary, now currency-aware                                                                                            |

**Changed:** `packages/validation/src/schemas/invoice.schema.ts` — the two
functions were deleted from it and it now carries one re-export:

```ts
export { computeItemTotal, computeInvoiceMoney } from './invoice-math'
```

This is a name, not a second formula. Every existing import still resolves:
`packages/validation/src/index.ts` re-exports through this file, the backend
imports from `@hisabche/validation`, and `invoice-grid.ts` imports the rule
from `./invoice-math`.

**What changed, and only this** (owner decision, 19 Oct 2026):

1. `computeInvoiceMoney` requires the invoice's `currency`. It rounds **each
   line** to that currency's minor unit before adding the lines (F2-01). The
   old code added the exact fractions and rounded the sum.
2. `summarize` no longer sums or rounds the header itself: it passes the row
   totals to `sumInvoiceLines`, so the screen and the server run one function.
3. `InvoiceService.create` settles `bookCurrency` **before** the money, because
   the rule needs it. The four independent reads still run together; only the
   currency read is now on the critical path.
4. `InvoiceService.update` passes the invoice's stored `currency` to the same
   function. An edit cannot move an invoice into another currency.

**Not changed:** no saved invoice is re-totalled and there is no backfill. The
new rounding applies to invoices created after the deploy; every stored total
remains the number it was stored with (§12). The ledger, the receivable and the
profit report read `invoices.total`, so they follow the header without a second
rounding of their own.

⚠️ `rowTotal` (the per-row line the builder prints) still rounds at
`ctx.precision`, deliberately. The manufacturing editor reuses it with four
decimals on a currency that has none — a component cost of 0.06 a gram must not
become zero — and reading the currency there broke four manufacturing tests
(seen during this change, fixed by reverting that one call site). For an
invoice grid `ctx.precision` **is** the currency's precision, and the header no
longer depends on it: `sumInvoiceLines` rounds each line at the currency.

---

## 3. The parity proof — the point of this slice

`packages/validation/src/__tests__/invoice-math.parity.test.ts`

For every fixture and every currency it does exactly what the product does:

1. builds the rows with `defaultColumns(currency)` and `emptyRow`, as the
   invoice builder does;
2. calls `summarize(...)` — the number a person approves on screen, and the
   number the offline device will compute with no network;
3. maps the same rows through `rowToInvoiceItem(...)` — byte-for-byte what
   `POST /invoices` receives;
4. calls `computeInvoiceMoney(...)` — what `InvoiceService.create` stores in
   `invoices.total`;
5. compares **subtotal, discount, tax and total as integers in the currency's
   smallest unit** (`Math.round(amount × 10^FRACTION_DIGITS[currency])`).

A tolerance is never used. `Math.abs(a − b) < 1` would call a one-afghani
difference equal, which is the whole defect this test exists to catch.

### The fixtures (two currencies in every one)

| Fixture                                           | AFN                       | USD                      | What it catches                                                        |
| ------------------------------------------------- | ------------------------- | ------------------------ | ---------------------------------------------------------------------- |
| two whole-priced lines, fixed discount, 5% tax    | 2 × 1,200 + 3 × 75        | 2 × 100.25 + 3 × 50.10   | the ordinary sale; no rounding                                         |
| a percentage discount on one line                 | 4,500 at 12%              | 42.75 at 12%             | a line discount is a percentage in the grid and money on the server    |
| a quantity in grams (0.333)                       | 0.333 × 250               | 0.333 × 250.75           | a fraction of a cent per line                                          |
| a price half a unit above a whole number, 10% tax | 3 × 1,200.5 + 2 × 75.25   | 3 × 12.005 + 2 × 0.7525  | a 0-minor-unit currency and a 2-decimal one, with tax on top           |
| three sub-cent quantities (0.335 × 3) — **F2-01** | 0.335 × 250 × 3 = **252** | 0.335 × 1 × 3 = **1.02** | per-line rounding vs sum-then-round; the old answers were 251 and 1.01 |

Measured result: **10 of 10 pass.** The two sides agree exactly in the integer
unit of both currencies.

Why they agree even when the float arithmetic does not: the same function
rounds each line — `sumInvoiceLines` — is called by `summarize` (on the row
totals) and by `computeInvoiceMoney` (on the item totals), and it rounds each
line to `FRACTION_DIGITS[currency]` before adding. The comparison is never a
tolerance.

---

## 4. F2-01 / BUG-130 — decided by the owner and fixed

**Measured before the fix:**

| Input                                      | Grid (`summarize`)                     | Server (`computeInvoiceMoney`)     |
| ------------------------------------------ | -------------------------------------- | ---------------------------------- |
| USD, 3 lines × quantity 0.335 × price 1.00 | lines 0.34 each → **1.02** (102 minor) | exact 1.005 → **1.01** (101 minor) |

One cent. It was not float noise: the grid rounded **each line** and the server
rounded **the sum** once. An invoice must foot to its printed lines.

**Decision (owner, 19 Oct 2026):** the invoice total is the sum of the printed
lines — each line rounded first to the currency's minor unit, via
`FRACTION_DIGITS`.

The five conditions and where each is satisfied:

| Condition                                                                                      | Where                                                                                                                        |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| one place only: `invoice-math.ts`                                                              | `sumInvoiceLines` rounds and adds; `computeInvoiceMoney` derives the lines and calls it; `summarize` calls the same function |
| saved invoices are never recomputed                                                            | no backfill, no write to an existing row; only `create`/`update` compute new money                                           |
| journal, receivable, payment, profit read the same total                                       | they read `invoices.total`, written from `money.total`; nothing re-rounds it                                                 |
| two currencies + a line that is not a multiple of the minor unit; delete the known-defect test | the 0.335 fixture is in the passing table (AFN and USD); `KNOWN DEFECT F2-01` is deleted                                     |
| behaviour changed by owner decision                                                            | this section, dated                                                                                                          |

**Injection proof:** changed the subtotal back to «sum the lines, round once» →
parity **2 of 10 failed** (AFN and USD 0.335) and backend `invoice-derived-money`
**2 of 27 failed** (the same two cases). Restored: **10/10** and **27/27**.
The IQD case stayed green under the injection on purpose: at three minor units
0.335 × 1 is exactly 335, so per-line and sum-then-round agree — it is the
scale assertion beside the two exact ones, not a third witness of the defect.

---

## 4b. Rule 2 — the warehouse a stock change lands in

**Created:** `packages/validation/src/schemas/stock.ts`.

It declares `stockEditWarehouse`, `checkAssign`, `productWarehouseBreakdown` and
their row types (`WarehouseRow`, `WarehouseStockRow`) — the pure half of
`backend/src/services/inventory/warehouse-summary.domain.ts`. The reporting
functions (`warehouseOverview`, `warehouseProducts`, `unassignedQuantities`)
stay in the backend: they call `summarizeStock`, which is a later rule.

**Changed:** the domain file now imports the two row types it still uses and
re-exports the three functions and their types from `@hisabche/validation`:

```ts
export { checkAssign, productWarehouseBreakdown, stockEditWarehouse } from '@hisabche/validation'
```

So `product.service.ts`, `manufacturing.service.ts`, `warehouse.service.ts`, the
routes and `multi-warehouse.test.ts` all keep their existing imports. No call
site changed.

**Tests added:** `packages/validation/src/__tests__/stock-warehouse.test.ts`,
10 tests. Every case that can have two warehouses has two — «more than one» is
exactly where the rule could become a guess, and BUG-080 was that guess:

| Case                                   | Answer                                                        |
| -------------------------------------- | ------------------------------------------------------------- |
| named, live                            | that warehouse                                                |
| named, unknown or deactivated          | `PRODUCT_WAREHOUSE_NOT_FOUND`                                 |
| two warehouses, edit, none named       | `PRODUCT_WAREHOUSE_REQUIRED` — asks, never guesses            |
| two warehouses, create, none named     | `null` («بدون انبار»، the documented opening-stock behaviour) |
| one live warehouse (+ one deactivated) | that one                                                      |
| none at all                            | `null`                                                        |
| `checkAssign(11, 10)`                  | `WAREHOUSE_ASSIGN_EXCEEDS_UNASSIGNED`                         |
| breakdown                              | 20 = −10 in the warehouse + 30 in none                        |

The existing backend tests that pin the same rule
(`product-stock-warehouse.test.ts`, `multi-warehouse.test.ts`,
`warehouse-product-and-units.test.ts`) pass unchanged against the re-export:
**3 files / 32 tests**.

⚠️ The re-export is a name, not a second copy: `one-rule-each` fails if any of
the three functions is declared twice.

---

## 4c. The money primitives — the rule every other rule is written in terms of

**Moved:** `backend/src/utils/money.ts` → `packages/validation/src/schemas/money.ts`
(`round2`, `roundHalfAwayFromZero`, `minor`, `sumRounded`). The backend file is
now four re-export lines.

This was not optional. Every rule that follows is written in terms of `round2`
and `minor`, and a rule cannot move to a package that cannot reach its own
arithmetic. Leaving a second copy of `round2` in the shared package is what the
`money-primitive-guard` test exists to forbid.

**The guard got STRONGER, not weaker.** It used to walk `backend/src` only and
require the declaration in `utils/money.ts`. It now walks **both** trees, requires
**exactly one** declaration in the repository — named by path in the failure
message — and adds: the backend file must re-export it from `@hisabche/validation`
and must not declare one. The arithmetic lock (the `Math.round(value * 100)` body)
now reads the shared file.

⚠️ It also learned to strip `//` comments, which is a defect it had all along.
The guard's docstring claimed «comments are stripped before matching, so this
file's own explanation cannot satisfy the pattern it forbids», but
`stripComments` removed only SQL's `--` and `/* … */`. The header comment added to
`profit-report.domain.ts` in this slice — which _mentions_ the forbidden
declaration — was reported as a second implementation. The guard's comment
described behaviour the code did not have; that is fixed rather than worked around.

### The sixth copy is gone — and the guard now sees the form it hid in

(owner decision, 19 Oct 2026, after Gate 2 was returned)

`profit-report.domain.ts` declared an **arrow**:

```ts
const round2 = (value: number) => Math.round(value * 100) / 100
```

The guard only ever matched `function round2`, so this copy was invisible from
the day it was written. The owner's decision is now the rule:

- **`round2` stays ONE function and does not decide meaning.** It answers `0` for
  a value it cannot round (`NaN`, `Infinity`); the **caller** decides whether 0
  is an answer. Where a non-finite value means «could not be read» — a cost, a
  revenue, a profit — the caller returns `null` («unknown is not zero»,
  `CLAUDE.md` §3). There is no second rounding variant for money.
- Six backend copies became an import: `accounting/evidence.domain.ts`,
  `ai/pipeline/pipeline.domain.ts`, `analytics/break-even.domain.ts`,
  `analytics/cohort.domain.ts`, `crm/crm.domain.ts`,
  `financing/working-capital.domain.ts`. Five were byte-identical. The one that
  was **not** — `pipeline.domain.ts` added an `EPSILON` before rounding, so
  `1.005` became `1.01` there and `1.00` under `round2` — was aligned to the
  shared function, and the figure it changes is asserted in the guard's own
  docstring test.
- In `profit-report.domain.ts` the imported `round2` is paired with two decisions
  made **before** it: an `unreadable` flag on a consumption whose amount is not
  finite (the row becomes uncosted, profit `null`) and a `figuresRead` check on a
  row whose revenue or cost is not finite (profit and margin `null`, and the
  period's `grossProfit` null with them) — three new tests in
  `profit-report-rule.test.ts`.
- The guard matches **both** forms the owner named: `function round2` /
  `function roundMoney`, and `round2 =` / `roundMoney = (` /
  `roundMoney = function`. The genuine alias in `costing.domain.ts`
  (`const roundMoney = round2`) is not a copy and the patterns spare it on
  purpose.
- **Proof:** a scratch file in `backend/src/services/` declaring a second
  `function round2(` turned the guard red and printed that file's path; deleted,
  the guard alone is **6 passed**.

---

## 4d. Rules 4, 5 and 7 — payments: what settles what, and what a party owes

**Moved:** `backend/src/services/payments/payments.domain.ts` →
`packages/validation/src/schemas/payments.domain.ts` (verbatim: 725 lines, one
import line changed). The backend file re-exports every name, so
`services/payments/index.ts`, `payments.service.ts`, `customer.service.ts`, the
routes, `supplier.service.ts` (which imports `round2` from `../payments`) and the
tests are unchanged.

Covered by this one move: rule 5 (`settlesInCurrency`, `outstandingOf`,
`openInvoices`, `validateAllocations`, `autoAllocate`, `unallocatedOf`), rule 4's
payment half (`paymentPosting`, `cashMovedOf`, `moneyAccountRole`, the till
conversions) and rule 7 (`partyBalance`, `partyBalancesByCurrency`,
`runningLedger`).

**Tests:** `packages/validation/src/__tests__/payments-rule.test.ts`, **28
tests**. Every money fixture uses AFN and USD (and IQD where the three minor
units matter). The cases that matter most:

| Case                                                | Asserted                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| `settlesInCurrency`                                 | a USD invoice refuses an AFN payment; `null` means the books one   |
| `outstandingOf`                                     | total − allocated; an over-settled invoice owes 0, not a negative  |
| `autoAllocate`                                      | oldest first, the remainder is an advance — 500 over 300 + 300     |
| `validateAllocations`                               | duplicate, exceeds-outstanding, over-allocated, unknown invoice    |
| `paymentPosting` in / gain                          | 100 USD booked at 70, paid at 72 → cash 7200, party 7000, **+200** |
| `paymentPosting` in / loss (USD books, EUR payment) | cash 210, party 220, difference **−10** (1000 minor units)         |
| `paymentPosting` out                                | the sign flips: paid 6800 against 7000 owed → **+200** gain        |
| a fee                                               | 3 USD fee on a 100 USD payment → cash 6790, difference **0**       |
| an advance                                          | cash 10800, party 10600, difference 200                            |
| `partyBalancesByCurrency`                           | AFN 600 and USD 100 — **never** the 1100 a sum would give          |
| the till                                            | 2,000 AFN is 2,000, not 200,000 (the live 14 Oct defect)           |
| the till                                            | a toman payment into a dollar drawer is `null`, not a guess        |

Three expectations were wrong on first run and were corrected against the code,
not the other way round: a zero payment reports **two** codes
(`PAYMENT_AMOUNT_INVALID` **and** `PAYMENT_OVER_ALLOCATED`); an invalid allocation
amount `continue`s, so an unknown invoice is not also reported; and
`lineRevenues` does not round (that is the report's job).

---

## 4e. Rule 3 — costing: what a sale actually cost

**Moved:** `backend/src/services/inventory-costing/costing.domain.ts` →
`packages/validation/src/schemas/costing.domain.ts` (verbatim, one import line).
The backend file re-exports everything, so `costing.service.ts`,
`costing.repository.ts`, `repost.domain.ts`, `repost.service.ts`,
`stock-count.domain.ts`, `transfer.domain.ts`, `unvalued-stock.domain.ts`, the
service index and the tests are unchanged.

⚠️ **`coverSoldUnits` is not in this file and was not moved.** It is a
DB-backed method on `CostingService` — it reads a stock position and writes a
receipt. Its _arithmetic_ is `planConsumption`, which did move, and which
`coverSoldUnits` already called. What the device needs is the arithmetic; the row
lock that stops two sales of the last unit from both succeeding belongs to
Postgres, and on the device it will be the device's own transaction.

**Tests:** `packages/validation/src/__tests__/costing-rule.test.ts`, **19
tests**, two currencies per money fixture: FIFO across a layer boundary
(10 @ 100 then 5 @ 150 = 1,750 AFN; 10 @ 1.25 then 5 @ 2.50 = 25.00 USD), AVCO
pricing every unit at 6 when two cost 10 and eight cost 5, a shortfall priced
from the last known cost and flagged `isEstimated`, `mayIssue` under both
policies, and the four-decimal quantity boundary.

⚠️ The name became **permanent** (owner decision, 19 Oct 2026): the costing
`stockValue` (Σ remaining layer × unit cost) is **`layersValue`** — in the shared
file, at the barrel, in the backend's re-export shell and at every call site. The
alias that kept the old name alive (`export { layersValue as stockValue }`) is
gone; the rename touched `costing.service.ts` (its import and one call),
`inventory-costing/index.ts`, `inventory-costing-rules.test.ts` and
`costing-rule.test.ts`. Two functions with one name is what the guard exists to
prevent, and an alias only hides the collision from the reader.

⚠️ The finding that proposed the other name was **wrong on one fact**, and the
correction is recorded rather than quietly applied: Gate 2 reported
`product.schema.ts#stockValue` as «quantity × **buy** price», so
`stockValueAtBuyPrice` was suggested for it. The body multiplies by `sellPrice`,
and the buy-price figure already exists beside it as `purchaseValue`. That
function is therefore `stockValueAtSellPrice`; the **warehouse map's** figure
(quantity × buy price — the number the map shows) took `stockValueAtBuyPrice`.
Three names, three meanings, one guard row each.

---

## 4f. Rule 6 — the profit report, and the cost that is not known

**Moved:** `backend/src/services/accounting/profit-report.domain.ts` →
`packages/validation/src/schemas/profit-report.domain.ts` (verbatim: the file
imports nothing at all, so nothing had to be rewired). The backend file
re-exports everything, so `accounting.service.ts`, `accounting.repository.ts`,
`evidence.domain.ts`, `break-even.domain.ts`, `benchmark.domain.ts` and the tests
are unchanged.

**Tests:** `packages/validation/src/__tests__/profit-report-rule.test.ts`, **23
tests**. The centre of the file is the case with no answer: a sale whose goods
were never costed shows `profit: null` and `marginPercent: null` — never its full
revenue as profit (INV-000077) — in both currencies. Beside it: a partial
consumption (six of ten units) makes the row `partial`, the total unknown, and
`knownGrossProfit` still reports the part that _is_ real; a text line is `none`,
not `unknown`; `restateAtRates` leaves an invoice with no rate untouched, in its
own currency.

Two expectations were corrected against the code:
`lineRevenues` returns unrounded shares (`40 × 0.9045` is
`36.18000000000001` in IEEE-754 — the test rounds the shares and asserts they
still add up to the invoice's net sales), and a single partially-costed row makes
`knownGrossProfit` 0 because that row's profit is `null`.

---

## 4g. Rule 4 — the ledger: what balances and what may be posted

**Moved:** `backend/src/services/accounting/accounting.domain.ts` →
`packages/validation/src/schemas/accounting.domain.ts`, and
`invoice-posting.domain.ts` → `packages/validation/src/schemas/invoice-posting.domain.ts`.
The `AccountRole` type now comes from the sibling `accounting.schema.ts` and
`round2` from `./money`; the backend files re-export every name, so
`accounting.service.ts`, `accounting.repository.ts`, `accounting.reports.ts`,
`operational-reports.ts`, `year-end.domain.ts`, `ledger.port.ts`, the aggregates,
`invoice.service.ts`, the AVCO real-Postgres E2E and the unit tests are unchanged.

⚠️ **`LedgerPeriodLock` is the permanent name** (owner decision, 19 Oct 2026),
not an alias at the barrel: the ledger's branch-aware lock
(`{ branchId, lockedUntil, reason }`) is declared as `LedgerPeriodLock` in the
shared file, exported under that name, and imported under that name by
`accounting.repository.ts` and `period-lock-branch.test.ts`. `PeriodLock` remains
what it always was in this package — the API payload of `periodLockSchema`, which
has no `branchId`. The two are NOT the same shape, and a union of them would
type-check while losing the branch.

**Tests:** `packages/validation/src/__tests__/ledger-rule.test.ts`, **28 tests**:
an entry that only balances in minor units (`0.1 + 0.2` against `0.3`) is
accepted; every refusal code by name; a reversal is the original with the sides
exchanged and reversing twice is the identity in minor units; `collapseLines`
nets, drops a zero, and works in both currencies; the company lock covers a branch
and a branch lock cannot unlock a company-closed period; `invoiceLedgerLines`
books a purchase with no revenue, a sale with its consumed cost, and no cost lines
at all when the cost is zero.

⚠️ Two source-assertion tests were **re-pointed**, not weakened:
`invoice-exchange-rate.test.ts` and `currency-audit.characterisation.test.ts` read
the posting file to assert `return rate === 1 ? amount : Math.round(amount * rate *
100) / 100` and the receivable line. They now read
`packages/validation/src/schemas/invoice-posting.domain.ts`. The assertions are
identical; only the path followed the rule to its one home. A copy left behind
would have been a second formula.

---

## 4h. The findings this slice produced — and the owner's decisions (19 Oct 2026)

Gate 2 was **returned** with these five findings in it. The owner decided each
one; all five are now done, and the decisions are the rules from here on.

| #   | Finding                                                                                                                                                                                                                                   | Decision                                                                                                                                                                                                                                                                                                                                                                                               | Where it now lives                                                                                                                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **A sixth copy of `round2`** — an arrow in `profit-report.domain.ts`, invisible to a guard that matched only `function round2`                                                                                                            | **One `round2`, and it decides no meaning.** The caller answers `null` when a value could not be read. The guard matches `function round2` **and** `round2 =`.                                                                                                                                                                                                                                         | §4c above: six copies replaced by the import, the `EPSILON` one aligned, three «unreadable is not zero» tests, the arrow form added to the guard.                                                                                                                                                                  |
| 2   | **Two functions named `grossProfit`** — the line's (`costing.domain.ts`) and a period's (`insights.domain.ts`)                                                                                                                            | The money-path one keeps the name; the period one is renamed. The owner suggested `periodGrossMargin`; **`periodGrossProfit`** is used instead, because the function returns MONEY and `grossMargin` beside it returns a PERCENTAGE — two things called «margin» with different units is a worse name than the one being fixed.                                                                        | `insights.domain.ts` (`periodGrossProfit`), its barrel, `insights.service.ts` (5 call sites) and `insights-rules.test.ts`. The payload's `'grossProfit'` **metric name** is untouched: it is what the screen's i18n key is built from.                                                                             |
| 3   | **Two types named `PeriodLock`** — the branch-aware ledger lock and the `periodLockSchema` payload                                                                                                                                        | Rename, don't alias: **`LedgerPeriodLock` is the permanent name**.                                                                                                                                                                                                                                                                                                                                     | `accounting.domain.ts` declares it, the barrel exports it, `accounting.repository.ts` and `period-lock-branch.test.ts` import it by that name. `PeriodLock` stays the API payload.                                                                                                                                 |
| 4   | **Two functions named `stockValue`** — and, as it turned out, a third in `warehouse-map.domain.ts`                                                                                                                                        | A name per price: **`layersValue`** (cost layers), **`stockValueAtSellPrice`** (one product), **`stockValueAtBuyPrice`** (the warehouse map). ⚠️ Gate 2's own report had this one **wrong** (§4e): it described `product.schema.ts#stockValue` as a buy-price figure. It multiplies by `sellPrice`, so the suggested `stockValueAtBuyPrice` named the function that already exists as `purchaseValue`. | `costing.domain.ts`, `product.schema.ts`, `warehouse-map.domain.ts`, the barrel, the backend re-export shell, `costing.service.ts`, `inventory-costing/index.ts`, the warehouse-detail container, and four tests. No alias survives at the barrel.                                                                 |
| 5   | **`invoice_items.total_price` still came from the client** — `item.totalPrice \|\| item.quantity * item.unitPrice`, so a request could set the line's money and the profit report's revenue share and a purchase's cost layer followed it | The server **derives** it: `computeItemTotalRounded(item, currency)` — the same call `computeInvoiceMoney` totals with — and the request's number is ignored.                                                                                                                                                                                                                                          | `invoice-math.ts` (new `computeItemTotalRounded`), `invoice.service.ts` (`withDerivedLineTotals`, used by `create` and by `replaceInvoiceItems` for `update`), `buildItemRows` writes the derived figure. Tests: `invoice-line-total-derived.test.ts` (9), the new parity block (13), and an injection proof (§5). |

⚠️ **One divergence this fix exposed, and did NOT fix — it needs a decision.**
The grid's `COLUMN.tax` is a **row-level** tax percent. `rowTotal` applies it
(`net + net × tax/100`), so the grid's printed line **and** its `summarize`
subtotal include it. `rowToInvoiceItem` skips the built-in tax column, so the
item the server receives carries no trace of it, and `computeInvoiceMoney` cannot
count it. Before this fix the client's `totalPrice` carried it into the stored
line but not into the stored header (an invoice that did not foot); now both the
stored line and the header exclude it (an invoice that foots, with the screen's
line higher than the stored one by the row tax). Either way a row tax percent is
never **booked**. Deciding where it should land — a line detail, an invoice-level
`taxTotal`, or forbidding the column — is a product decision, not a rename.

Findings 1–5 are recorded in `.claude/BUG-REGISTRY.md` as BUG-131 … BUG-135 and
closed there; the row-tax divergence is recorded as BUG-136.

---

## 5. The guard — `packages/ui/src/__tests__/one-rule-each.test.ts`

**35 rows / 71 tests, all green** (`npx vitest run src/__tests__/one-rule-each.test.ts`
in `packages/ui`). Every row contributes the same three checks: the declaring
function exists in **exactly one file** in the repository, the importer **names**
it and takes it from the shared module, and the importer **does not declare** it.
A row is added, never an exception, because an exception is how a second formula
comes back.

| Rule | Rows                                                                                                                                                                  | Owner (the one file)                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1    | `computeInvoiceMoney`, `computeItemTotal`, `computeItemTotalRounded`, `sumInvoiceLines`, `roundInvoiceMoney`                                                          | `schemas/invoice-math.ts`                                                                         |
| 2    | `stockEditWarehouse`, `checkAssign`, `productWarehouseBreakdown`                                                                                                      | `schemas/stock.ts`                                                                                |
| 3    | `planConsumption`, `averageUnitCost`, `mayIssue`, `layersValue`, `grossProfit`                                                                                        | `schemas/costing.domain.ts`                                                                       |
| 4    | `validateEntryLines`, `toMinorUnits`, `sumMinorUnits`, `reverseLines`, `collapseLines`, `LedgerPeriodLock`, `invoiceLedgerLines`, `inBooksCurrency`, `paymentPosting` | `schemas/accounting.domain.ts`, `schemas/invoice-posting.domain.ts`, `schemas/payments.domain.ts` |
| 5    | `settlesInCurrency`, `outstandingOf`, `validateAllocations`, `autoAllocate`                                                                                           | `schemas/payments.domain.ts`                                                                      |
| 6    | `buildProfitReport`, `lineRevenues`, `restateAtRates`, `isCostDeterminate`, `invoiceMargins`                                                                          | `schemas/profit-report.domain.ts`                                                                 |
| 7    | `partyBalancesByCurrency`                                                                                                                                             | `schemas/payments.domain.ts`                                                                      |
| —    | `stockValueAtSellPrice`, `stockValueAtBuyPrice`, `periodGrossProfit`                                                                                                  | `schemas/product.schema.ts`, `inventory/warehouse-map.domain.ts`, `insights/insights.domain.ts`   |

⚠️ Two rows still need care, and both are now recorded decisions rather than open
defects: `grossProfit` is pinned by its **full signature** (it is the money-path
line profit; the period-level one is `periodGrossProfit`, and pinning the
signature states which formula the row is about), and `restateAtRates` is matched
**without its parenthesis** because its declaration continues with type
parameters (`export function restateAtRates<I extends …>`).

The `stockValueAtBuyPrice` row names a **test** as its importer: the figure is
used only inside its own module (`buildWarehouseMap`, `summarizeStock`), and the
test is the one other file that holds the name — which is exactly where a copy
would be noticed.

**Injection proofs (every one restored afterwards):**

- Removed the per-line rounding (`sumInvoiceLines` summed the lines and rounded
  once): parity **2 of 10 failed** (AFN and USD 0.335); backend
  `invoice-derived-money` **2 of 27 failed**. Restored: **10/10** and **27/27**.
- Broke the rule (`total: taxable + taxTotal` → `total: taxable`): parity
  **4 failed / 5 passed**; backend `invoice-derived-money` **1 failed**.
  Restored: **9 passed** and **24 passed** (the counts before F2-01).
- Added a duplicate `computeInvoiceMoney` declaration in a scratch file:
  the guard failed by name, listing
  `packages/validation/src/schemas/temp-duplicate.ts`. Deleted: **5 passed**
  (the count before the two new rules were added).

⚠️ **Every proof below is FAIL-BOTH-SIDES**, which is what Gate 2 asks for: the
rule is broken in its one home in `packages/validation`, and BOTH the shared
rule test **and** the backend test that goes through the re-export shell go red.
A backend test that stayed green would mean the backend had kept a copy.

| Rule                 | What was broken (one edit, in the shared file)                      | Shared test red                                                   | Backend test red                       |
| -------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------- |
| 4 / 5 / 7 — payments | `settlesInCurrency` → `return true`                                 | **2 of 28**                                                       | `db-integrity-code` **3 of 6**         |
| 3 — costing          | `averageUnitCost` → the newest layer's unit cost                    | **2 of 19**                                                       | `inventory-costing-rules` **2 of 25**  |
| 6 — profit report    | `isCostDeterminate` → `return true`                                 | **5 of 23**                                                       | `cost-unknown-is-not-zero` **6 of 15** |
| 4 — ledger           | `reverseLines` → the lines unchanged (sides not exchanged)          | **1 of 28**                                                       | `accounting-ledger-rules` **1 of 34**  |
| money primitives     | a scratch file declaring a second `function round2(`                | guard **1 of 6**, naming `…/temp-duplicate-round2.ts`             | —                                      |
| the guard itself     | a scratch file declaring a second `export function paymentPosting(` | `one-rule-each` **1 of 59**, naming `…/temp-duplicate-posting.ts` | —                                      |

Every edit was reverted and the delete confirmed
(`REMAINING_TEMP_FILES=0`). After restoration: `payments-rule` + `costing-rule` +
`profit-report-rule` + `ledger-rule` + parity + stock = **6 files / 118 tests
passed**; `one-rule-each` **59 passed**; `money-primitive-guard` **6 passed**;
the full validation suite **21 files / 353 tests passed**; the four backend files
named above **4 files / 80 tests passed**.

**Second round — the two decisions from the return (19 Oct 2026):**

| What was broken                                 | One edit                                                                                                                                      | Red                                                                                                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the sixth `round2`, in the form it hid in       | `backend/src/services/__scratch-round2.ts`, declaring a second `function round2(`                                                             | `money-primitive-guard` **1 of 6**, printing that file's path. Deleted → **6 passed**.                                                                                      |
| the stored line total, trusted from the request | `withDerivedLineTotals` back to a pass-through and `buildItemRows` back to `total_price: item.totalPrice \|\| item.quantity * item.unitPrice` | `invoice-line-total-derived` **6 of 9 failed**: the USD 9.99, the footing (303 ≠ 909), the IQD 0.001, the components 1, and two source assertions. Restored → **9 passed**. |
| the renamed name, copied                        | `backend/src/services/__scratch-layers-value.ts`, declaring a second `export function layersValue(`                                           | `one-rule-each` **1 of 71**, printing `backend/src/services/__scratch-layers-value.ts`. Deleted → **71 passed**.                                                            |

After the second round, with nothing left behind: `packages/validation` **21 files /
369 tests passed**, `one-rule-each` **71 passed**, the eight backend files this
round touched **8 files / 147 tests passed**, `backend` `tsc --noEmit` **EXIT=0**.

The backend-side names are the proof that matters: «a payment settles invoices of
its own currency — ⚠️ «he paid me 500 afghani» never eats the older dollar debt»,
«AVCO — weights by quantity, not by the number of layers», «INV-000077: no
consumption → no profit and no margin, not 450,000 and 100%», «a reversal mirrors
the original — exchanges the two sides and leaves the amounts alone».

To add a rule in a later slice, add one row to `RULES`. There is no exception
list, because an exception is how a second formula comes back.

---

## 6. What is not done

- ⚠️ **The local engine itself is not built.** All seven rules are reachable from
  `packages/validation`, which is what Gate 2 asks for, but nothing imports them
  from a device yet: `packages/local-engine` is Phase 3.
- ⚠️ **The `exchangeRate` decision is still on the server.** The rate is frozen on
  the invoice (`storedExchangeRate`, `INVOICE_EXCHANGE_RATE_REQUIRED`) and the
  posting rule consumes the converted amount. Extracting the _decision_ means
  moving `storedExchangeRate`'s fallback order (invoice's own rate → workspace
  rate → refuse), which is a read of two tables and belongs with the local engine's
  data access in Phase 3, not with a pure rule.
- The five findings of §4h are **fixed** (owner decisions, 19 Oct 2026). The
  divergence the last fix exposed is **not**: a row-level tax percent
  (`COLUMN.tax`) is never booked — the screen's line carries it, the stored line
  and the stored total do not. §4h says exactly where it is lost and why the
  choice is a product decision.
- The «unreadable is not zero» guard covers the profit report's ROW profit and the
  period's totals, but `ProductProfitRow.revenue` / `.cost` remain `number`
  (widening them ripples into `break-even.domain.ts`, `evidence.domain.ts`, the
  API and the screens). A product row whose revenue could not be read therefore
  still prints 0 for that revenue while its profit prints a dash; the period
  profit is `null`, which is the figure a person decides on.
- The Phase-2 requirement to extract the **currency rate** (`exchangeRate`)
  into `invoice-math.ts`: superseded by the line above — the conversion rule is
  `inBooksCurrency` in the shared package, and what remains on the server is the
  decision _which_ rate, which is data.
- A migration for the device schema (`SCHEMA_VERSION` 2 → 3, integer minor units)
  is Phase 3. Nothing in this phase touches the database.
- The duplicate `inventory` redirect the owner asked to remove in Phase 2
  (§3 rows 41/69 / BUG-129): **done** — one line deleted from `app.tsx`, and
  `route-parity.test.ts` gained a declaration-count test (35/35 pass). The file
  also pins the web redirect list at **28** and forbids a duplicate address in
  it; the old assertion said 27 while `next.config.js` had held 28 since
  `HEAD`, so that test was red before this phase touched it.
- No local engine, no device schema, no migration: those are Phases 3–4.

## 7. Commands run

```
packages/validation  npx tsc --noEmit                                  EXIT=0
packages/validation  npx vitest run                                    21 files / 353 tests passed
packages/validation  npx vitest run src/__tests__/invoice-math.parity.test.ts     10 passed
packages/validation  npx vitest run src/__tests__/stock-warehouse.test.ts         10 passed
packages/validation  npx vitest run src/__tests__/payments-rule.test.ts           28 passed
packages/validation  npx vitest run src/__tests__/costing-rule.test.ts            19 passed
packages/validation  npx vitest run src/__tests__/profit-report-rule.test.ts      23 passed
packages/validation  npx vitest run src/__tests__/ledger-rule.test.ts             28 passed
packages/ui          npx tsc --noEmit                                  EXIT=0
packages/ui          npx vitest run src/__tests__/one-rule-each.test.ts           59 passed (29 rules)
packages/api         npx tsc --noEmit                                  EXIT=0
apps/web             npx tsc --noEmit                                  EXIT=0
backend              npx tsc --noEmit                                  EXIT=0
backend              npx vitest run <4 invoice files>                  4 files / 80 tests passed
backend              npx vitest run <3 warehouse files>                3 files / 32 tests passed
backend              npx vitest run <5 costing files>                  5 files / 96 tests passed
backend              npx vitest run <6 payments files>                 6 files / 85 tests passed
backend              npx vitest run <5 profit files>                   5 files / 67 tests passed
backend              npx vitest run <30 ledger/invoice/payment files>  30 files / 399 tests — 3 failed, all source-assertions reading the moved file
backend              npx vitest run <7 of those files, after re-pointing>  7 files / 119 tests passed
backend              npx vitest run (whole suite)                     2 files failed | 354 passed (356 files); 1 failed | 5,065 passed | 8 skipped (5,074 tests)
backend              npx vitest run email-outbox.pg money-primitive-guard  2 files / 14 tests passed (the pg flake, re-run alone)
packages/app-shell   npx tsc --noEmit                                  EXIT=0
apps/desktop         npx jest route-parity                            35/35 passed
packages/validation  npx eslint <6 files>                              EXIT=0
packages/ui          npx eslint <1 file>                               EXIT=0
backend              npx eslint <3 files>                              EXIT=0 (warnings only, all pre-existing)
packages/app-shell   npx eslint <2 files>                              EXIT=0
packages/validation  npx prettier --check <6 files>                    fixed by --write, then green
packages/ui          npx prettier --check <1 file>                     green
docs/offline/02-RULE-EXTRACTION.md  npx prettier --check              fixed by --write, then green
```
