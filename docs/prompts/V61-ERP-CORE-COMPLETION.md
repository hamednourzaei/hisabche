# HISABCHE V61 — UNIVERSAL ERP CORE COMPLETION

_A teacher's brief. The student is the implementation agent. Read it all before touching a file._

---

## 0. Why this lesson exists

An outside review compared Hisabche with ERPNext and listed 80 gaps. A list like that is a **hypothesis**,
not a fact. The teacher checked every family of claims against the code at HEAD `0b68fe4` (V60 committed).

The result is three groups:

1. **Gaps the code confirms.** The capability registry itself names the limitation.
2. **"Gaps" that are not gaps.** The feature exists, and the review did not see it.
3. **True absences.** Nothing in services, routes, migrations or UI.

Your first lesson: **never build from a gap list until you have run the search yourself.** Half of the
"missing" ERP features below already exist in Hisabche under other names. A second copy of any of them
breaks red line 3.

Second lesson: **Hisabche is not an ERPNext clone** (CLAUDE.md §10: "no competitor copy, no turning the
project into a clone"). Read ERPNext to understand a _business process_. Then express that process with
Hisabche's own cores: one ledger, one inventory engine, one invoice model, one resolver. Never copy their
DocType structure, their names or their screens.

All rules from V60 §1 still apply:

- AGENTS.md is canonical; no commit, push, stash or reset; no live SQL; no `.env`; no dependency changes; no
  builds; no subagents.
- fa/af/en for every key (Dari per `.claude/DARI-GLOSSARY.md`).
- Migrations only as `docs/*-migration.sql` + `VERIFY-*.sql` + `*.pg.test.ts`, with RLS + REVOKE + an explicit
  GRANT on every new table.
- Integer money; unknown ≠ 0; `workspace_id` is the only tenant boundary; multi-table writes via `.rpc()`;
  ledger writes only via `ledger.postDocument`.
- Execution model: implement everything, write every test, run verification **once** at the end (§9).

---

## 1. The evidence (verified at `0b68fe4`; re-verify locally, the tree may have moved)

### 1.1 The registry right now

`packages/validation/src/schemas/business-capabilities.ts` has:

- **38 capabilities:** 3 `available` (measurement, weight_pricing, multi_unit), 30 `partial`, 5 `planned`
  (table_service, asset_rental, livestock_register, crop_cycle, room_nights);
- **20 engines in `ENGINES`, and none of them records a `localEngineRoute`.**

Limitations it states itself (each is a confirmed gap):

- `LIFECYCLE_ACTIONS_UNWIRED`, `SERVER_ONLY_NO_OFFLINE_ENGINE`
- `BATCH_RETURN_RESTORE_MISSING`, `OFFLINE_SERIAL_IDENTITY_MISSING`, `COST_LAYERS_ARE_PRODUCT_KEYED`
- `SERVER_ONLY_THREE_WAY_MATCH`, `PROCUREMENT_MATCH_APPROVAL_GATE_PARTIAL`, `PACK_ROUNDING_SERVER_SIDE`
- `NO_OVERHEAD_ALLOCATION`, `OVERHEAD_ALLOCATION_NOT_CONFIGURED`
- `MILESTONE_INVOICE_WIRING_PARTIAL`, `CONCURRENT_SLOT_LOCK_SERVER_ONLY`, `SLA_BREACH_ALERT_ONLY`
- `SERVER_ONLY_QUALITY_LOG`, `CLAIMS_ONLINE_ONLY`
- `DELIVERY_NOTES_UI_UNWIRED`, `FLEET_DISPATCH_UI_UNWIRED`, `GRANT_ENDPOINT_UNWIRED`
- `DEPOSIT_AUTO_FORFEIT_NOT_WIRED`, `AUTO_DUNNING_REMINDERS_SERVER_ONLY`
- `FORECAST_HORIZON_FIXED`, `REQUIRES_OBSERVED_PAYMENT_HISTORY`
- `CORE_CHARGE_NOT_APPLIED`, `LINE_PRICING_FROM_PURITY_NOT_WIRED`, `MAKING_CHARGE_NOT_COMPUTED_ON_LINE`
- `QUANTITY_BREAK_UI_BASIC`, `LINEAR_CUT_LOSS_NOT_TRACKED`, `TANK_DIP_CALIBRATION_NOT_TRACKED`

### 1.2 The registry lies in two places (fix these first; they are cheap and they mislead everyone)

| Engine                | What `ENGINES` says                                | What the code has                                                                                                                                                                       |
| --------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `delivery_logistics`  | `clientHook: null`, `uiHost: null` (unwired)       | Hooks for courier, freight and delivery notes in `packages/api/src/hooks/universal-core.ts`, rendered in `packages/ui/src/components/ui/invoices/containers/sales-orders-container.tsx` |
| `contracts_recurring` | `clientHook: hooks/automations.ts`, `uiHost: null` | A dedicated `packages/api/src/hooks/contracts.ts` + `backend/src/routes/contracts.routes.ts`; no UI                                                                                     |

**Lesson:** a registry that a human edits by hand drifts. Make the guard prove every registry field from the
filesystem and the import graph (§3.1).

### 1.3 "Gaps" that already exist (do NOT build a second one; extend these)

| Review item                                     | Already in Hisabche (verify each)                                                                                                                                                                           |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #12/#23 stock reservation                       | `docs/stock-reservations-01-migration.sql` (`stock_reserve/release/settle/available`), `services/inventory/reservation.service.ts`, `/api/inventory/reservations`; serial hold in `traceability.service.ts` |
| #19/#24/#26 bin, shelf, internal move, capacity | shelves (`storage_locations`, `storage_place_stock`, `shelf-capacity-01`), `storage-bin-transfer-01` (`storage_move_stock`), the shelf map                                                                  |
| #25 in-transit                                  | the transfer document (`stock_transfers`: request → approve → ship → receive; stock moves at receipt)                                                                                                       |
| #27 reorder                                     | `min_stock_level` + low-stock webhooks + stock insights + `procurement-match.ts → planReordersWithPackRounding`                                                                                             |
| #15 POS shift and cash count                    | `pos_sessions` (till open, count, close), `till-payments-01`                                                                                                                                                |
| #18 sales return / credit note                  | `invoice-return-03/04/05` (`returns-settlement.domain.ts`)                                                                                                                                                  |
| #39 bank reconciliation                         | `bank_statements` / `bank_statement_lines`, `decideAutoMatches` (suggest only; matching is a click)                                                                                                         |
| #41 budgets                                     | `services/budgeting`, `/operations/budgets` (approve/archive)                                                                                                                                               |
| #43 consolidation                               | consolidation code in `services/accounting/accounting.service.ts` — read what it does and its limits                                                                                                        |
| #44 tax templates                               | `tax_settings`, `tax_components`, `tax_rules`, `invoice_tax_lines`                                                                                                                                          |
| #45 period lock                                 | `ACCOUNTING_PERIOD_LOCKED`, fiscal year close                                                                                                                                                               |
| #47 landed cost                                 | `docs/landed-costs-migration.sql` + VERIFY — **find its service and caller; it may be written-not-wired**                                                                                                   |
| #48 FX gain/loss                                | `fx_gain_loss` role in `paymentPosting`, `fx_revaluations`                                                                                                                                                  |
| #49 BOM with versions                           | the BOM revision model (`version+1`, `work_order_lines` snapshot)                                                                                                                                           |
| #55 scrap / waste                               | `inventory.waste` + production scrap                                                                                                                                                                        |
| #58/#59 leave, attendance, shift                | `leave-policy-01`, the attendance sheet, attendance devices, `hr.shifts`                                                                                                                                    |
| #61 salary structure / commission               | `compensation-plan.ts` (`compensationFor`), `provider-commission-01`                                                                                                                                        |
| #65 asset lifecycle                             | `services/assets` (depreciation, disposal)                                                                                                                                                                  |
| #67 CRM pipeline                                | `services/crm` (`interactions`, `opportunities`) — use only via its port (guard `crm-core.test.ts`)                                                                                                         |
| #72 customer portal                             | `services/customer-portal`, `customer-portal.routes.ts`                                                                                                                                                     |
| #36 discrepancy                                 | transfer receipt discrepancy (V59.1) + `evaluateThreeWayMatch`                                                                                                                                              |
| #64 timesheet billing                           | `timesheets/billing.domain.ts` (but see §2.2: the two stores)                                                                                                                                               |

### 1.4 True absences (searched in services, routes, migrations, hooks and UI: zero hits)

- **Sales:** quotation → order conversion, partial delivery / delivered quantity per order line, backorder,
  dropship.
- **Warehouse:** pick list, putaway rule.
- **Buying:** material request, RFQ, supplier quotation comparison.
- **Manufacturing:** MRP (material requirements), workstation capacity, job card, subcontracting.
- **Support:** support ticket with SLA policy, CAPA / non-conformance, preventive maintenance, knowledge base.
- **Accounting:** finance book (multi-book).

The review's other items fall between these groups: "exists but partial", which §1.1 names exactly.

---

## 2. P0 — correctness before features (in this order)

### 2.1 Registry truth (review #73)

- **Fix** `delivery_logistics` and `contracts_recurring` in `ENGINES` (§1.2).
- **Add** to each engine an `offline` field, derived **only** from `offline-endpoint-matrix.ts`. If every
  endpoint is `available` → `local`; otherwise → `online_required`. Add `localEngineRoute`, pointing at the real
  `packages/local-engine/src/routes/*.ts`, or `null`.
- **Guard:** extend `packages/validation/src/__tests__/capability-has-consumer.test.ts`:
  - every non-null `clientHook` / `uiHost` / `localEngineRoute` exists on disk;
  - every hook file the registry names really calls one of the engine's routes;
  - `uiHost` really imports that hook (read the import lines);
  - a hook that calls an engine route but is not named in the registry fails the test.
- **Injection-test** each rule (break it once, see red, restore).

### 2.2 The two time-entry stores (carried from V60.1 §2; still open)

- `project_time_entries` (`project.service.ts`, `/api/projects/:id/time-entries`) vs `time_entries`
  (`timesheets.service.ts`, `/api/operations/timesheets`). Billing reads only `time_entries`.
- Write `docs/FINDING-time-entries-two-stores.sql` (read-only counts per workspace, overlap, date range).
  Then make `time_entries` canonical:
  - the project routes go through `TimesheetsService`, with a response adapter;
  - an additive, idempotent `docs/time-entries-unify-01-migration.sql` copies rows (never deletes);
  - VERIFY + a pg test.
- Then remove the `KNOWN DEFECT` workaround in `backend/src/__tests__/v60-http-families.test.ts`.

### 2.3 Honest "workflow complete" (carried from V60.1 §1)

- `scripts/industry/coverage-data.mjs → INDUSTRY_ACCEPTANCE_TESTS` grants `workflowComplete` when a test
  **file exists**. It must require a **recorded pass**: a results file written by §9 (test file → passed +
  commit).
- Remove the `wedding` → rental-test mapping.

### 2.4 Sales order lifecycle, complete (review #9–#13; registry `LIFECYCLE_ACTIONS_UNWIRED`)

The engine is `services/orders/*` + `docs/developer-platform-03-commerce-migration.sql` (`create_sales_order`,
`transition_sales_order`). Its state machine is `pending → confirmed → invoiced → paid/fulfilled`. Extend it;
do not write a second order model.

1. **Reservation on confirm:** `confirmed` reserves each line through the existing
   `stock_reserve(...)` (idempotent per order line). Cancel releases. Invoicing settles.
   - Do it in **one** Postgres function (`transition_sales_order` rev2, in a new migration
     `sales-orders-02`), so confirm + reserve is one transaction (rule 4: no two-step writes from TS).
2. **Partial delivery:**
   - add `delivered_quantity` per `sales_order_items` row and a `sales_order_deliveries` document (lines,
     warehouse, actor, time; append-only);
   - each delivery moves stock through the existing movement path and settles that part of the reservation;
   - the order status gains `partially_fulfilled`, derived (never typed in);
   - the delivery note (`transport.service` delivery notes) is the printable form of a delivery: link to it,
     do not duplicate it.
3. **Backorder:** a line whose quantity cannot be reserved stays `backordered` (derived: ordered − reserved
   − delivered). Nothing is invented. It shows on the order and in reorder suggestions (§2.6).
4. **Quotation:** a quotation is an **order in a new initial state `quoted`**, with an expiry; "accept"
   moves it to `pending`/`confirmed`. Do not create a second document type. Prices are frozen on accept, never
   on view.
5. **Offline:** stays `online_required` until a local route + outbox + sync branch + conflict policy exist.
   The registry must say so.

**Tests:**

- pure transition-table tests in validation (`orders.domain` or a new `sales-order-lifecycle.ts` [NEW]);
- the pg test for `sales-orders-02`:
  - confirm reserves;
  - two concurrent confirms of the last unit → one succeeds, and **the error message is asserted**;
  - partial delivery twice = no double move;
  - cancel after a partial delivery releases only the rest;
  - tenant isolation;
- the HTTP family test (`v60-http-families.test.ts` wholesale) extended with a partial delivery + backorder.

### 2.5 Batch and serial correctness (review #28/#29; registry `BATCH_RETURN_RESTORE_MISSING`, `OFFLINE_SERIAL_IDENTITY_MISSING`)

- **Batch return restore:** a sale return of a batch-tracked line restores **the same batches** it consumed:
  - read `lot_allocations` for the original line;
  - restore through the existing returns RPC;
  - if allocation history is missing → refuse with a translated code, and never guess a batch (§12 no fake
    backfill).
- **Offline serial identity:**
  - local uniqueness in `packages/local-engine/src/routes/serials.ts` (it exists; complete it);
  - on sync, a serial sold on two devices → `PENDING_REVIEW` through `conflict-state.ts`
    (`resolveOfflineSerialSyncConflict` exists in validation: wire it into `packages/app-shell/src/features/sync/sync-engine.ts`).
- **Tests:**
  - return restores the exact batch quantities;
  - the missing-history refusal;
  - two-device serial replay → conflict, no overwrite (local-engine test + sync-engine test).

### 2.6 Procurement: partial receipt, match gate, payment block (review #34–#36, #38)

- **Partial receipt:** `purchasing.service.ts` receive accepts per-line quantities, with remaining tracked per
  line (verify what `received_quantity` covers today).
- **Three-way match:** `evaluateThreeWayMatch` (`procurement-match.ts`) currently runs on read. It must
  **gate payment**:
  - recording a supplier payment against an invoice with a mismatch goes through the existing approval gate
    (`workflow/approval-gate.domain.ts`) and is blocked until approved, with a translated reason;
  - no silent correction.
- **Reorder → draft PO:** suggestions create a **draft** PO only; nothing is ordered automatically.
- **Tests:**
  - payment blocked on mismatch, then allowed after approval;
  - partial receipt twice;
  - over-receipt refused.

### 2.7 Overhead allocation (review #46; registry `OVERHEAD_ALLOCATION_NOT_CONFIGURED`)

- An **explicit** allocation policy per workspace: a basis of `revenue_share | labour_hours | direct_cost |
manual`, a period, and the source accounts. Stored as a setting with a version.
- An allocation **run** posts **one** journal document per period through `ledger.postDocument`, splitting
  overhead across cost-object dimension values (`services/dimensions`). It is reversible through
  `ledger.reverseDocument`, and the same period cannot run twice (idempotency key `overhead-<period>`).
- No policy → profit reports say "overhead not allocated"; never 0 and never a guessed share.
- **Tests:**
  - each basis on a fixture with two currencies;
  - a re-run is a no-op;
  - reversal restores balances;
  - unknown cost stays `null`.

### 2.8 Resource capacity race (review #62/#75; registry `CONCURRENT_SLOT_LOCK_SERVER_ONLY`)

- Keep the server exclusion constraint (`resource-capacity-01`) as the authority.
- Offline: a booking made on a device is `tentative` locally; at sync, an overlap becomes `PENDING_REVIEW`.
  It is never dropped and never double-booked.
- **Test:** two devices book the same slot offline → one confirmed, one in review.

### 2.9 Operations → ledger, end to end (review #20)

One HTTP test per flow, through `buildServer()` + `app.inject()`, asserting **balances** (not row counts):

- sale with reservation → partial delivery → invoice → payment;
- purchase → partial receipt → matched invoice → payment;
- production run;
- repair bill;
- contract period bill;
- overhead run.

Copy every payload from the real hook (lesson from V60.1: tests written against imagined contracts proved
nothing).

---

## 3. P1 — complete what is partial, through the UI

| Item                                                                                 | Engine to extend                                                                                                                                                                                                               | Work                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contracts / leases / SLA (#78)                                                       | `contracts.routes.ts`, `hooks/contracts.ts`                                                                                                                                                                                    | A Customers-hub section: list, create, bill period, terminate, SLA flag, lease return                                                                                                                                                                                     |
| Quality inspection + non-conformance + corrective action (#69/#70)                   | `services/quality` (`quality_events`, append-only)                                                                                                                                                                             | Inspection on purchase receipt and on repair "testing". A failed inspection opens a **non-conformance** with a CAPA follow-up, as **states of the same quality event chain** (no new table if the event model can carry them). Quarantine through existing movement types |
| Warranty claims (#68 part)                                                           | `warranty.domain.ts` + repair + return disposition                                                                                                                                                                             | A claim UI; stays `online_required` until local parity                                                                                                                                                                                                                    |
| Support ticket + SLA (#68)                                                           | **Extend the work-order/repair ticket engine** into a generic service ticket (a `ticket_kind`) with an SLA policy (response/resolve targets, business hours from the workplace time zone). Do NOT build a second ticket system | Queue in `work-queue-container.tsx`; breach = alert only (no auto-penalty)                                                                                                                                                                                                |
| Milestone billing (#64)                                                              | `timesheets/billing.domain.ts` + projects                                                                                                                                                                                      | Milestones on a project (amount or % of contract), each billed once through `InvoiceService.create` (idempotent per milestone)                                                                                                                                            |
| Asset rental (#76)                                                                   | contracts + resource booking + `stock_serials` + return disposition                                                                                                                                                            | Promote `asset_rental` from planned only when an HTTP test proves out → return → inspection → deposit release                                                                                                                                                             |
| Package-credit grant (`GRANT_ENDPOINT_UNWIRED`)                                      | `package-credits.routes.ts`                                                                                                                                                                                                    | Wire it into Customers › sessions                                                                                                                                                                                                                                         |
| Delivery POD and fleet UI (`DELIVERY_NOTES_UI_UNWIRED`, `FLEET_DISPATCH_UI_UNWIRED`) | `transport.service.ts`                                                                                                                                                                                                         | POD = an append-only event with actor and time; trips list. Route optimization stays planned                                                                                                                                                                              |
| Forecast horizon (#40)                                                               | `intelligence/forecast.domain.ts`                                                                                                                                                                                              | Horizon as a parameter (30/60/90); `insufficient_data` when history is short (never 0)                                                                                                                                                                                    |
| Approvals offline (#11 of part 3)                                                    | `use-workflow.ts`                                                                                                                                                                                                              | Stays `online_required` (approval is a server decision); the registry must say so honestly                                                                                                                                                                                |
| Landed cost (#47)                                                                    | `landed-costs-migration.sql`                                                                                                                                                                                                   | Find its caller. If written-not-wired, wire it into purchase receipt **through costing layers**; otherwise record it in `unwired-capability.test.ts`                                                                                                                      |

Every UI item needs:

- `PageHub` / `HubTabs` + one `SegmentedControl`; `DataTable`; error and empty as separate branches;
- `useMyCapabilities` gates that equal the route's `requireCapability`;
- `useBookCurrency()`, never `useCurrencyStore`;
- `t()` with real keys (no `safeT` with Persian fallbacks in code);
- `typedMinor` for money;
- a `DOCS_ARTICLES` entry.

---

## 4. P2 — true absences: design notes only (no code in V61 unless P0/P1 are done and green)

For each one, write a one-page design in `docs/architecture/V61-DESIGN-<item>.md`:

- which **existing** core it extends;
- the state machine;
- the tables (if any);
- the RPC boundary;
- the offline status;
- the tests.

| Absence                                                                          | Must extend                                                                                                                                                                                      |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pick list / putaway                                                              | `stock_transfers` + shelves: a pick list is a transfer-like document that moves shelf → staging for a sales order; putaway = a suggested shelf on receipt (capacity-aware `storage_place_stock`) |
| Material request, RFQ, supplier quotation                                        | purchasing: a request is a draft PO without a supplier; an RFQ fans out to suppliers; the quotation chosen becomes the PO. One purchasing document family                                        |
| MRP                                                                              | `computeProductionCost` + BOM + reservations + stock insights: requirements = open orders × BOM − available − on order                                                                           |
| Workstation, job card, routing                                                   | manufacturing work orders: operations as ordered steps on the work order, time per step; capacity through `resource-capacity` (a workstation is a resource kind)                                 |
| Subcontracting                                                                   | purchase + production: material sent out (transfer to a supplier location), finished goods received with a service invoice                                                                       |
| Preventive maintenance                                                           | assets + resource capacity: a schedule creates a service ticket (§3); a booked maintenance window blocks the resource                                                                            |
| Finance books, multi-company consolidation beyond what exists, EDI, KB, dropship | record as `NEEDS_OWNER_DECISION`; no design required                                                                                                                                             |

---

## 5. What NOT to do

- No ERPNext-style DocType generator, no copied names (`Stock Entry`, `Material Request` as table names, etc.).
  Use Hisabche vocabulary through `useTerminology()`.
- No new module because the review "needs review" an item. Search first; record what you found.
- No `available` status without:
  - a passing HTTP test;
  - a UI host;
  - offline-matrix rows;
  - registry fields proven by the guard (§2.1).

---

## 6. Reading (concepts only; do not copy structure or text)

- ERPNext docs index — https://docs.erpnext.com/
- Selling (order → delivery → invoice → payment) — https://docs.frappe.io/erpnext/selling
- Module settings — https://docs.frappe.io/erpnext/module-settings
- Assets lifecycle — https://docs.frappe.io/erpnext/assets/introduction
- ERPNext modules overview — https://frappe.io/erpnext
- ERPNext source (read controllers to understand a process; never copy code) — https://github.com/frappe/erpnext
- PostgreSQL exclusion constraints — https://www.postgresql.org/docs/current/rangetypes.html#RANGETYPES-CONSTRAINT
- Local-first sync and conflicts — https://www.inkandswitch.com/local-first/

---

## 7. Files you will most likely touch (verify each one first)

- `packages/validation/src/schemas/`: `business-capabilities.ts`, `offline-endpoint-matrix.ts`,
  `feature-registry.ts`, `procurement-match.ts`, `universal-core/serial-batch.domain.ts`,
  `universal-core/returns*.ts`, `sales-order-lifecycle.ts` [NEW]
- `packages/validation/src/__tests__/`: `capability-has-consumer.test.ts`,
  `industry-coverage-table.test.ts`, `sales-order-lifecycle.test.ts` [NEW], `overhead-allocation.test.ts` [NEW]
- `backend/src/services/`: `orders/*`, `inventory/reservation.service.ts`, `purchasing.service.ts`,
  `timesheets/*`, `project.service.ts`, `quality/*`, `repair/*`, `contracts/*`, `accounting/*`, `dimensions/*`,
  `transport/*`, `intelligence/*`
- `backend/src/routes/`: `orders`, `purchasing`, `project`, `quality`, `contracts`, `package-credits`,
  `transport`, `repair`
- `backend/src/__tests__/`: `v60-http-families.test.ts`, `v61-erp-core-http.test.ts` [NEW], and one pg test
  per migration
- `packages/local-engine/src/routes/`: `serials.ts`, `batches.ts`, and a bookings route if §2.8 needs one
- `packages/app-shell/src/features/sync/sync-engine.ts`: the conflict branches
- `packages/api/src/hooks/`: `orders.ts`, `contracts.ts`, `purchasing.ts`, `quality.ts`, `projects.ts`
- `packages/ui/src/components/ui/`: the Sales hub orders section, a Customers-hub contracts section,
  warehouse receipt inspection, work-queue tickets, timesheets
- `docs/`: `sales-orders-02`, `time-entries-unify-01`, `overhead-allocation-01` (only if a setting table is
  needed), and `FINDING-time-entries-two-stores.sql`
- `scripts/industry/coverage-data.mjs`

---

## 8. Slices

Implement in this order, writing the tests as you go and running nothing:

1. 2.1 → 2.3 (truth)
2. 2.4 (orders)
3. 2.5 (batch / serial)
4. 2.6 (procurement)
5. 2.7 (overhead)
6. 2.8 (capacity race)
7. 2.9 (end-to-end tests)
8. §3 P1 items
9. §4 designs

After each slice, update `docs/architecture/V61-IMPLEMENTATION-PROGRESS.md` and continue. Never stop to ask:
apply the safe default, tag it `NEEDS_OWNER_DECISION`, continue.

---

## 9. Final verification (once)

Run these from each package folder, sequentially (never in parallel), with
`TMP/TEMP=C:/Users/hamed/Desktop/hisabche/.esbuild-tmp`:

- `tsc --noEmit` in validation, api, store, ui, app-shell, local-engine, backend, apps/web, apps/desktop and
  apps/admin;
- the full vitest suites for validation, api, local-engine, ui and backend (`--exclude '**/*.pg.test.ts'`);
- `npx jest` in desktop;
- ESLint on changed files.

Then:

- regenerate `node scripts/generate-capability-matrix-csv.mjs`,
  `node scripts/industry/generate-coverage-table.mjs` and `node scripts/industry/generate-industry-diff.mjs`;
- write the acceptance-results file from the real run;
- `node scripts/audit-unwired-routes.mjs`, reporting the count before and after.

`*.pg.test.ts` are `BLOCKED` on this machine (`initdb.exe` is missing): state it, never mock them green. At
most 3 fix rounds per failure group. Never weaken a guard. When a guard encodes a decision you changed on
purpose, rewrite it with the same strictness, and say so.

## 10. Persian final report

Include:

1. The decision.
2. The baseline (HEAD, dirty files).
3. The 80-item table with the **verified** status per item:
   - `ALREADY_EXISTS` (with the file);
   - `COMPLETED_IN_V61`;
   - `PARTIAL` (with the limitation code);
   - `DESIGNED_ONLY`;
   - `NEEDS_OWNER_DECISION`.
4. The registry before/after.
5. The migrations in run order, each with `PENDING HUMAN CONFIRMATION`.
6. The commands with real numbers.
7. The remaining gaps.
8. Edit accounting.

Allowed statuses: `VERIFIED_COMPLETE` · `IMPLEMENTED_NOT_LIVE_VERIFIED` · `VERIFIED_WITH_LIMITATIONS` ·
`BLOCKED` · `NOT_IMPLEMENTED`.

---

---

# PART B — The second review: 85 "ERP core" items, checked against the LOCAL code

The owner asks that the **infrastructure for all of them be built completely** in V61. The teacher checked each
item in the local tree. Read the status column before you write a line: about half of these exist already,
and building them again is the mistake this course exists to prevent.

The review's own premise is also partly wrong. It says Hisabche "only translates the UI" and has "static
variants". Both are false in the code.
**Lesson:** a reviewer who never opened the code describes the product they imagined. Your job is to describe
the product that exists, then close the real gaps.

Status legend:

- **EXISTS** — built and reachable; verify, extend if needed, and never duplicate.
- **WRITTEN-NOT-WIRED** — a domain, migration or service exists, but no route, hook or UI reaches it.
- **PARTIAL** — part of the chain exists.
- **ABSENT** — nothing in services, routes, migrations, hooks or UI.

## B.1 Status of all 85 items (re-verify each locally; record `[VERIFIED path:symbol]`)

### Accounting (1–15)

| #   | Item                                           | Status                              | Where / what to do                                                                                                                                                                                                      |
| --- | ---------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Cost centers                                   | EXISTS as **accounting dimensions** | `services/dimensions/dimension.domain.ts`, `accounting_dimensions`, `dimension_values`, `dimension_requirements`. Add P&L by dimension (branch/project) through `profit-report.domain.ts`. Never a `cost_centers` table |
| 2   | Period-end FX revaluation                      | EXISTS                              | `fx_revaluations` / `fx_revaluation_lines`, `accounting/month-end.domain.ts`. Verify that the UI runs it                                                                                                                |
| 3   | Period closing / lock                          | EXISTS                              | `ACCOUNTING_PERIOD_LOCKED`, fiscal-year close in `AccountingService`                                                                                                                                                    |
| 4   | Multi-currency journals                        | PARTIAL                             | Invoices carry `exchange_rate`; `journal_lines` has no currency (see `.claude/reverse-and-import/01-CURRENCY-AUDIT.md`). **Infrastructure (B.2.1)**                                                                     |
| 5   | Bank reconciliation                            | EXISTS                              | `bank_statements`, `bank_statement_lines`, `banking/reconciliation.domain.ts`, `decideAutoMatches` (suggestions only)                                                                                                   |
| 6   | Memorandum (contra / off-balance) accounts     | ABSENT                              | **B.2.2**                                                                                                                                                                                                               |
| 7   | Overhead allocation                            | PARTIAL                             | Part A §2.7                                                                                                                                                                                                             |
| 8   | Standard chart-of-accounts templates per trade | ABSENT                              | **B.2.3**                                                                                                                                                                                                               |
| 9   | Accrual accounting                             | PARTIAL                             | The ledger is accrual for invoices; there are no accrual/prepayment schedules. **B.2.4**                                                                                                                                |
| 10  | Cheque lifecycle                               | PARTIAL                             | `cheque` exists as a payment method and in reconciliation; there is no lifecycle. **B.2.5**                                                                                                                             |
| 11  | Unrealized FX gain/loss                        | EXISTS via #2                       | Show it as a separate report line; never mix it with realized                                                                                                                                                           |
| 12  | Budgets + variance warning on posting          | PARTIAL                             | `services/budgeting` exists; a warning at posting time is missing. **B.2.6**                                                                                                                                            |
| 13  | Instalments on an invoice                      | EXISTS                              | `commerce/installment.service.ts`, `installments_save`                                                                                                                                                                  |
| 14  | Fixed assets + depreciation + disposal         | EXISTS                              | `services/assets`                                                                                                                                                                                                       |
| 15  | Auto-reversing journals                        | ABSENT                              | **B.2.4** (same mechanism as accruals)                                                                                                                                                                                  |

### Inventory (16–30)

| #   | Item                                      | Status                          | Where / what to do                                                                                                                                              |
| --- | ----------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16  | FIFO / moving average                     | EXISTS                          | `inventory_settings.costing_method`, `inventory-costing/*`, inventory-avco-01                                                                                   |
| 17  | Stock count with adjustment documents     | EXISTS                          | `cycle-count.routes.ts`, `inventory-costing/stock-count.domain.ts`                                                                                              |
| 18  | Batch / lot / expiry                      | EXISTS (partial)                | `stock_batches`, `lot_allocations`, FEFO; return restore = Part A §2.5                                                                                          |
| 19  | Serial in / out                           | EXISTS (partial)                | `stock_serials`, traceability; offline identity = Part A §2.5                                                                                                   |
| 20  | Multiple units + factors                  | EXISTS                          | `multi_unit` (available), `product-units.routes.ts`, custom units                                                                                               |
| 21  | Transit / virtual warehouse               | EXISTS as the transfer document | Shipped-not-received _is_ in transit. Add an "in transit" stock view derived from shipped transfers                                                             |
| 22  | Transfer request with multi-step approval | PARTIAL                         | The transfer request exists (request → approve → ship → receive); multi-step approval through `workflow/approval-gate.domain.ts` is missing. **B.2.7**          |
| 23  | Reorder alert → draft PO                  | PARTIAL                         | `min_stock_level`, insights, `planReordersWithPackRounding`; draft PO = Part A §2.6                                                                             |
| 24  | Product bundle / kit                      | ABSENT                          | **B.2.8**                                                                                                                                                       |
| 25  | Write-off with reason + approval          | PARTIAL                         | `stock-waste.ts`, `product-waste-panel.tsx` (with reasons); manager approval is missing → the approval gate (B.2.7)                                             |
| 26  | Stock reservation for orders              | EXISTS (server)                 | Order wiring = Part A §2.4                                                                                                                                      |
| 27  | Slow-moving / dead-stock report           | EXISTS                          | `inventory-insights.routes.ts`, `inventory-ops-view.tsx`                                                                                                        |
| 28  | Barcode in every stock form               | PARTIAL                         | Barcode exists in the invoice builder and on products; add the shared scan input to receipt, transfer, count and waste forms (one component; no second scanner) |
| 29  | Landed cost                               | WRITTEN-NOT-WIRED?              | `docs/landed-costs-migration.sql` + VERIFY. Find the service/caller. Part A §3                                                                                  |
| 30  | Dynamic variants                          | EXISTS                          | `product_variants` with attributes, `canonicalAttributeKey`, size×colour matrix. The review is wrong                                                            |

### Sales and till (31–42)

| #   | Item                                   | Status           | Where / what to do                                                                                                                         |
| --- | -------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 31  | Real offline POS                       | EXISTS           | Local engine (`packages/local-engine/src/routes/invoices.ts`, `till.ts`), outbox, sync                                                     |
| 32  | Multiple price lists                   | EXISTS           | `price-list.service.ts`, `priceListPricing`                                                                                                |
| 33  | Pricing rules / tiered discounts       | EXISTS (partial) | `promotion.service.ts`, `quotePrice`; `QUANTITY_BREAK_UI_BASIC`                                                                            |
| 34  | Quotation → order / invoice            | ABSENT           | Part A §2.4 (`quoted` state on the order)                                                                                                  |
| 35  | Sales return with stock + receivable   | EXISTS           | `invoice-return-03/04/05`                                                                                                                  |
| 36  | Credit limit with blocking             | EXISTS           | `credit-limit.ts`, `customer-profile`                                                                                                      |
| 37  | Sales commission per invoice           | PARTIAL          | Provider commission (services); per-seller commission on goods invoices is absent. **B.2.9**                                               |
| 38  | Consignment sales                      | ABSENT           | **B.2.10**                                                                                                                                 |
| 39  | Afghan tax-compliant invoice templates | PARTIAL          | Invoice PDF exists; there is no jurisdiction template. **B.2.11** (no invented legal fields: `NEEDS_OWNER_DECISION` for the legal content) |
| 40  | Online payment gateway                 | PARTIAL          | A signed Stripe webhook exists for billing only; no gateway for customer payments. **B.2.12**                                              |
| 41  | Late fees                              | EXISTS           | `late-fee.service.ts`                                                                                                                      |
| 42  | Custom orders with prepayment          | EXISTS           | Order deposits (`order-deposit.service.ts`, local `order-deposits.ts`)                                                                     |

### Buying (43–50)

| #   | Item                                         | Status  | Where / what to do                                                                |
| --- | -------------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| 43  | RFQ to several suppliers                     | ABSENT  | Part A §4 → **promoted to build in B.2.13**                                       |
| 44  | Purchase receipt independent of the invoice  | PARTIAL | PO receive exists; partial receipt = Part A §2.6                                  |
| 45  | Additional purchase costs allocated to items | = #29   | Landed cost                                                                       |
| 46  | Purchase return                              | EXISTS  | `purchase_return` in returns (`returnType`) — verify the supplier-side accounting |
| 47  | Vendor rating                                | PARTIAL | `buildSupplierScorecard`; add quality from `quality_events`                       |
| 48  | PO approval by authority limit               | PARTIAL | The budget check exists; the approval gate by amount is missing → **B.2.7**       |
| 49  | Long-term purchase contracts with prices     | ABSENT  | **B.2.14** (extend the contracts engine)                                          |
| 50  | Consignment suppliers                        | ABSENT  | **B.2.10**                                                                        |

### CRM (51–57)

| #   | Item                                         | Status           | Where / what to do                                                                           |
| --- | -------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| 51  | Leads → customer                             | PARTIAL          | `services/crm` (`opportunities`); a lead stage + conversion through `CustomerService.create` |
| 52  | Interactions                                 | EXISTS           | `interactions` (CRM port only)                                                               |
| 53  | RFM segmentation                             | ABSENT           | **B.2.15**                                                                                   |
| 54  | Helpdesk ticketing                           | ABSENT           | Part A §3 (generic ticket on the work-order engine) — build it                               |
| 55  | Campaigns + effectiveness                    | EXISTS (partial) | `services/campaigns` — verify attribution                                                    |
| 56  | Bulk SMS / email (birthdays, debt reminders) | PARTIAL          | `email-outbox.ts` + dunning exist (`AUTO_DUNNING_REMINDERS_SERVER_ONLY`); no SMS. **B.2.16** |
| 57  | Customer portal                              | EXISTS           | `services/customer-portal`                                                                   |

### HR (58–65)

| #   | Item                                          | Status            | Where / what to do                                                                                                                         |
| --- | --------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 58  | Attendance + shifts                           | EXISTS            | Attendance sheet, devices, link, `hr.shifts`                                                                                               |
| 59  | Payroll with deductions, insurance, overtime  | PARTIAL           | `payroll-rules.ts`, `compensation-plan.ts`; verify deductions/overtime lines. Insurance rules = `NEEDS_OWNER_DECISION` (no invented rates) |
| 60  | Leave with balances                           | EXISTS            | `leave-policy-01`                                                                                                                          |
| 61  | Employee file (history, documents, contracts) | PARTIAL           | `employees`; documents/contracts on the employee. **B.2.17**                                                                               |
| 62  | Expense claims                                | WRITTEN-NOT-WIRED | `docs/expense-claims-migration.sql` + `expense-claims.domain.ts`; **no route, hook or UI**. **B.2.18**                                     |
| 63  | Internal tasks                                | EXISTS            | `project_tasks`, CRM tasks                                                                                                                 |
| 64  | Org chart                                     | PARTIAL           | `departments` exist; no `reports_to`. **B.2.17**                                                                                           |
| 65  | Performance appraisal                         | ABSENT            | **B.2.17** (minimal, owner-defined criteria; no invented scoring)                                                                          |

### Reports (66–73)

| #   | Item                                                    | Status            | Where / what to do                                                                                             |
| --- | ------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------- |
| 66  | Prebuilt dashboards per trade                           | EXISTS            | `DashboardRegistry.ts` (role × DNA), `dashboard-kpis`                                                          |
| 67  | Dynamic reports                                         | EXISTS            | `custom-reports.routes.ts`, `reporting/dataset.domain.ts`, `ReportRunView`                                     |
| 68  | Excel/PDF/CSV export everywhere                         | PARTIAL           | CSV in `packages/formatting`; audit which reports lack export and add the shared export action                 |
| 69  | Comparative reports (year over year / month over month) | PARTIAL           | Peer comparison exists; add a period-over-period parameter to the dataset runner                               |
| 70  | Margin by item, category, customer                      | EXISTS            | `getProductProfits`, `getInvoiceMargins`; add the category and customer groupings in `profit-report.domain.ts` |
| 71  | Scheduled email reports                                 | WRITTEN-NOT-WIRED | `reporting/scheduled-reports.service.ts` (in the unwired register). **B.2.19**                                 |
| 72  | Tax-office report formats                               | ABSENT            | **B.2.11**                                                                                                     |
| 73  | Saved custom reports                                    | EXISTS            | `saved-views.routes.ts`, saved reports                                                                         |

### Platform (74–85)

| #   | Item                                               | Status  | Where / what to do                                                                                                                      |
| --- | -------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 74  | Plugin / app system                                | PARTIAL | OAuth apps + versions + install exist (developer platform migration 07); `services/plugins/plugin.domain.ts` is domain-only. **B.2.20** |
| 75  | Versioned documented API                           | EXISTS  | Public API + API keys + `API_ROUTE_SCOPES` + MCP + OData — verify the version prefix and docs                                           |
| 76  | Visual workflow engine                             | PARTIAL | `workflow/builder.domain.ts`, `approval.domain.ts`, escalation; verify the builder UI. **B.2.7**                                        |
| 77  | Data-level translations (product names)            | ABSENT  | **B.2.21**                                                                                                                              |
| 78  | Field-change audit trail                           | PARTIAL | `audit_logs` (admin, immutable), `activities`, entity notes; there is no per-field before/after for business documents. **B.2.22**      |
| 79  | Custom fields                                      | EXISTS  | `custom-fields-01`, `custom-fields.routes.ts`, `custom-fields-panel.tsx`                                                                |
| 80  | Field-level permissions                            | PARTIAL | Visibility of money figures (`dashboard-visibility.domain.ts`) and custom roles; no generic field masks. **B.2.23**                     |
| 81  | Thermal printer / barcode printer                  | EXISTS  | `apps/desktop/electron/main/services/printing.ts`, `use-receipt-print.ts`, `hardware-section.tsx`                                       |
| 82  | Automated backups / point-in-time                  | PARTIAL | `data-snapshots-01`, desktop local backup, cloud migration; PITR is a Supabase plan feature (`BLOCKED_EXTERNAL`). **B.2.24**            |
| 83  | Sandbox                                            | EXISTS  | `is_sandbox`, `create_sandbox_workspace`                                                                                                |
| 84  | Document versioning (invoice before/after an edit) | ABSENT  | **B.2.22** (same engine as #78)                                                                                                         |
| 85  | Two-factor for sensitive users                     | PARTIAL | `mfa.middleware.ts` is for platform admins only. **B.2.25**                                                                             |

### Tenancy (the review's third thread)

**Done: confirmed.** 119 `workspace_id uuid,` declarations in `docs/*.sql` are nullable.
**Infrastructure B.2.26** (it comes **first** in Part B; it is the security base for everything else).

---

## B.2 Infrastructure to build (each one on an existing core; one migration family each)

Every item below needs:

- a **FINDING** query first, if it touches existing data;
- an additive, idempotent migration + VERIFY + a pg test (run twice; one write allowed, one refused; tenant
  isolation; concurrency where it matters);
- RLS + REVOKE + an explicit GRANT on every new table;
- the shared pure rule in `packages/validation`;
- a service + routes with `requireWorkspaceContext` + `requireCapability`;
- a hook with literal paths;
- offline-matrix rows;
- feature-registry + capability-registry entries (status from evidence only);
- a section inside an existing hub, with i18n in fa/af/en and a docs article;
- unit + HTTP tests (copy payloads from the real hook).

### B.2.26 Tenancy hardening (do first)

1. `docs/FINDING-workspace-id-nulls.sql`: for every table with a nullable `workspace_id`, count NULL rows and
   rows whose owner is ambiguous.
2. `tenancy-02-migration.sql`: for tables with zero NULLs, `SET NOT NULL` (via `NOT VALID` checks, then
   `VALIDATE`). For tables with NULLs, add the CHECK `NOT VALID` only (new rows protected, old rows reported).
   **Never backfill** a `workspace_id` from `user_id` (§12: a member of two workspaces makes it a guess).
3. Extend `backend/src/__tests__/tenancy-static-guard.test.ts` and `rls-coverage.test.ts`: every new table in
   V61 must be NOT NULL + RLS from birth.

### B.2.1 Multi-currency journal lines (#4)

- Add `currency`, `amount_currency_minor`, `exchange_rate` to `journal_lines`, all nullable. NULL means book
  currency. Old lines stay NULL: there is no backfill.
- `accounting_post_journal_entry` keeps checking the balance **in book currency**. The foreign amount is
  informational and is validated as `amount_currency × rate ≈ book amount`, within the rounding rule from
  `packages/formatting`.
- `ledger.postDocument` passes the invoice/payment currency and rate (they already exist on invoices and
  payments).
- Reports: the party ledger in its own currency; the trial balance stays in book currency.
- **Tests:** a fixture with two currencies; a balanced foreign entry; a rejected inconsistent rate; the trial
  balance unchanged.

### B.2.2 Memorandum (off-balance) accounts (#6)

- An account `kind = 'memorandum'` on the existing chart of accounts. Memorandum postings must balance among
  memorandum accounts only, and are excluded from the trial balance, P&L and balance sheet.
- Used for guarantees given and received, and consignment stock (B.2.10).
- **Tests:** a memorandum entry never changes any financial statement; mixing a memorandum line with a real
  line is refused.

### B.2.3 Chart-of-accounts templates per trade (#8)

- Templates as **data** in `packages/validation` (account role → code/name keys), chosen from the DNA and the
  industry profile at workspace creation through the existing `ensureAccountsForRoles`.
- Keys only; names come from i18n.
- **Never applied to a workspace that already has postings.**
- **Tests:** each template covers every role the ledger posts to (`AccountRole`); applying twice = a no-op.

### B.2.4 Accrual / prepayment schedules and auto-reversing journals (#9, #15)

- **A schedule:** one source document → N periodic journal documents (e.g. 12 months of prepaid rent).
- **An auto-reversing journal:** a journal flagged `reverse_on = <date>` gets its reversal posted by the one job
  runtime (`distributed-work.ts` / the automation tick) through `ledger.reverseDocument`, with idempotency key
  `auto-reverse-<entry>`.
- A locked period is refused (`ACCOUNTING_PERIOD_LOCKED`) and reported, never shifted silently.
- **Tests:** the schedule posts exactly once per period; the reversal posts once; locked-period handling.

### B.2.5 Cheque lifecycle (#10)

- A `cheques` register, attached to payments (in/out). States: `received/issued → deposited/endorsed →
cleared | bounced | cancelled`. Each state moves money only through `PaymentsService` and ledger roles
  (cheques-in-hand / cheques-payable).
- A bounce **reverses** the payment's allocation through the existing reversal path.
- An endorsement = a payment out to a supplier using the same cheque (one cheque, never two payments).
- **Tests:** the full state machine (illegal moves refused); a bounce restores the receivable; an endorsed
  cheque cannot be deposited; tenant isolation.

### B.2.6 Budget warning at posting (#12)

- At expense posting, read the budget for (account, dimension, period) through `services/budgeting` and return
  a **warning** (`BUDGET_EXCEEDED` + figures). It never blocks, unless the workspace policy says `block` (an
  explicit setting; default `warn`).
- **Tests:** warn, block, and no budget = silence.

### B.2.7 One approval policy for documents (#22, #25, #48, #76)

- Reuse `workflow/approval-gate.domain.ts` + `approval.domain.ts` + `builder.domain.ts`.
- A policy = (document type, condition such as amount ≥ X / reason in Y / warehouse, approver role(s), steps).
- Applies to: purchase orders, stock transfers, write-offs, supplier payments with a match mismatch, and
  journal entries above a limit.
- Steps are append-only events; the approver's session executes; requester ≠ approver.
- **Tests:** multi-step; a rejection stops it; self-approval refused; a document not covered by a policy is
  unaffected.

### B.2.8 Product bundle / kit (#24)

- A product `kind = 'bundle'` with `bundle_items` (component, quantity).
- Selling a bundle moves **component** stock in the same invoice RPC (`invoice_write_document`), never through
  a second write.
- Bundle cost = the sum of component costs through `costing`.
- A kit assembled ahead of time (stock of the kit itself) = a manufacturing run with a BOM: reuse
  manufacturing, do not add a second assembly engine.
- **Tests:** a sale moves components; a return restores components; cost = the sum; a component out of stock
  follows the existing oversell policy (M2.4).

### B.2.9 Seller commission on invoices (#37)

- Reuse `compensation-plan.ts` (`compensationFor`): a plan per seller (percent of margin or revenue).
- The seller is recorded on the invoice (`seller_employee_id`, explicit; never inferred from the session).
- The commission report is computed from invoices + returns. Unknown cost → commission on margin = `null`.
- **Tests:** a return reduces commission; unknown margin; a seller sees only their own figures (server-
  enforced).

### B.2.10 Consignment in and out (#38, #50)

- **Consignment out** (goods at a dealer): a transfer to a location of `kind = 'consignee'` (a warehouse type).
  Stock stays owned. A sale report from the consignee creates the invoice.
- **Consignment in** (supplier goods we sell): stock with `owner_party_id` (the supplier). It is not our
  inventory value: costing excludes it, and memorandum accounts (B.2.2) track it. Sales create a payable to
  the owner at the agreed price.
- **Tests:** owned vs not-owned valuation; the payable on sale; the return of unsold goods.

### B.2.11 Tax-compliant invoice templates and tax reports (#39, #72)

- A template registry for printed invoices: the fields come from the existing tax tables (`tax_settings`,
  `tax_components`, `invoice_tax_lines`).
- The jurisdiction-specific legal content (Afghanistan or any other country) is **`NEEDS_OWNER_DECISION`**:
  ship the mechanism plus a generic template; never invent legal wording or tax IDs.
- The tax report = a dataset in `reporting/dataset.domain.ts` (output tax, input tax, net, per component).
- **Tests:** the totals equal `invoice_tax_lines`; returns are subtracted; two currencies are reported
  separately.

### B.2.12 Customer payment gateway (#40)

- A provider-neutral adapter interface (like attendance devices: a hub with **no brand claimed** until it is
  tested with real credentials). A webhook with a signature check (reuse the payment-webhook pattern: raw body,
  HMAC, replay window). A paid event → `PaymentsService.recordPayment` with idempotency key `gw-<provider>-<id>`.
- With no configured provider, the UI says so. The status stays `BLOCKED_EXTERNAL_CREDENTIAL`.
- **Tests:** a bad signature is refused; a replay is a no-op; allocation to the invoice; tenant isolation.

### B.2.13 RFQ and supplier quotations (#43)

- An RFQ = a purchase document family member (draft PO without a supplier, plus invited suppliers).
- Each supplier's response is a quotation (lines, prices, lead time). "Choose" converts the chosen quotation
  into a PO.
- One purchasing family in `purchasing.service.ts`.
- **Tests:** compare by total and by line; conversion freezes prices; a PO cannot come from an expired
  quotation.

### B.2.14 Long-term purchase contracts (#49)

- The contracts engine with `direction = 'purchase'`: agreed prices per product and validity. PO lines default
  to the contract price; a deviation is flagged for approval (B.2.7).
- **Tests:** the default price; expiry; the deviation flag.

### B.2.15 RFM segmentation (#53)

- A pure function in `packages/validation`: recency, frequency and monetary per customer, **per currency**
  (never summed across currencies), from invoices.
- Segments are computed, not stored. They are shown in the CRM panel and can be used as a campaign audience.
- **Tests:** two-currency fixtures; a customer without sales = "no data", never "lost".

### B.2.16 Messaging channels: SMS (#56)

- Extend the email outbox into a **channel-agnostic outbox** (`channel: email | sms`). Same retry and same
  idempotency.
- SMS = a provider adapter with no brand claimed (`BLOCKED_EXTERNAL_CREDENTIAL` until configured).
- Templates as i18n keys + figures; never server-built sentences.
- Opt-out per customer.
- **Tests:** an opted-out customer is never sent; a retry; a failed provider.

### B.2.17 Employee file, org chart, appraisal (#61, #64, #65)

- `employees.reports_to` (nullable FK; cycles refused); employee documents reuse the existing
  customer-documents storage pattern; employment contracts = the contracts engine with
  `party_kind = 'employee'`.
- **Appraisal:** owner-defined criteria and periodic reviews; append-only; no invented scores or formulas.
- **Tests:** the org cycle is refused; a manager sees only their reports (server); appraisal immutability.

### B.2.18 Expense claims (#62) — wire what is written

- `docs/expense-claims-migration.sql` and `packages/validation/src/schemas/expense-claims.domain.ts` exist.
  Read both. Then add the service, routes, hook and UI (Team hub → pay).
- Approval through B.2.7. Reimbursement through `PaymentsService` (out to the employee).
- The ledger: expense account + payable to the employee.
- **Tests:** submit → approve → reimburse; a reject; a reimbursement only once.

### B.2.19 Scheduled email reports (#71) — wire what is written

- `reporting/scheduled-reports.service.ts` is in the unwired register. Run it from the one job runtime, deliver
  through the outbox, and **respect the recipient's permissions** (money figures hidden per
  `dashboard-visibility.domain.ts`).
- Remove its row from `unwired-capability.test.ts`.

### B.2.20 Plugins = installable apps (#74)

- Do **not** build a code-execution plugin runtime.
- Unify `services/plugins/plugin.domain.ts` with the existing OAuth-app platform: a "plugin" is an app with
  scopes + webhooks + optional UI extension points declared as **data** (menu entry → external URL, custom
  fields, report templates).
- **Tests:** an installed app sees only its scopes; uninstall revokes the key (the existing trigger).

### B.2.21 Data-level translations (#77)

- A `translations` jsonb (`{ fa, af, en }`) on product, category, service catalog and unit names. The original
  name stays the source of truth. The display picks the locale, then the original. Search covers all variants.
- **Tests:** fallback order; search; import/export of the column.

### B.2.22 Field-level audit + document versions (#78, #84)

- One append-only `document_revisions` table (document type, id, version, actor, at, before jsonb, after jsonb,
  changed_fields text[]), written **inside** the same RPC that edits the document (`invoice_write_document`
  rev, and customer/product updates). Never written from TypeScript after the fact.
- A trigger blocks UPDATE/DELETE on it.
- The UI: a "history" drawer on the invoice/customer/product shows a diff.
- **Tests:** an edit writes exactly one revision; a no-op edit writes none; tenant isolation; immutability.

### B.2.23 Field-level permissions (#80)

- Generalize the existing money-visibility rule: a registry of **sensitive fields** (cost price, margin, salary,
  supplier price) → the required capability.
- The server **removes** those fields from responses and names them in `hidden` (the existing pattern). The UI
  removes the column; it never shows 0.
- **Tests:** a seller's product list has no cost; the `hidden` list; the CSV export also omits them.

### B.2.24 Backups (#82)

- Scheduled workspace snapshots through `data-snapshots-01` + an export (the portability service); restore
  into a **sandbox** workspace first, never over live data.
- PITR = the Supabase plan: `BLOCKED_EXTERNAL`; say so.
- **Tests:** snapshot → restore into sandbox → row counts match; a restore never targets the source workspace.

### B.2.25 Two-factor for workspace users (#85)

- Extend the platform-admin TOTP (`mfa.middleware.ts`, `admin-02-security`) to workspace members: enrollment,
  recovery codes (hashed), and a step-up for sensitive capabilities (period close, payroll settle, role
  change, bank details), configurable per workspace (default: owner must enrol).
- **Tests:** a step-up is required; a recovery code is single-use; a lockout after N failures (rate limiter
  returns 429).

---

## B.3 Order of work for Part B

Do these after Part A §2 (P0):

1. B.2.26
2. B.2.22
3. B.2.7
4. B.2.1
5. B.2.2
6. B.2.5
7. B.2.4
8. B.2.18, B.2.19 (wire what is written)
9. B.2.8, B.2.10, B.2.9
10. B.2.13, B.2.14
11. B.2.6
12. B.2.3
13. B.2.15, B.2.16
14. B.2.17
15. B.2.21, B.2.23
16. B.2.11, B.2.12
17. B.2.20, B.2.24, B.2.25

Same rules: write everything, run nothing until Part A §9. Every slice updates the progress doc. Owner
decisions get the safe default + the `NEEDS_OWNER_DECISION` tag, and work continues.

The final report adds a Part B table: the 85 items with **EXISTS (file) · WIRED_IN_V61 · BUILT_IN_V61 ·
PARTIAL (limitation) · BLOCKED_EXTERNAL · NEEDS_OWNER_DECISION**.

---

---

# PART C — Survivable infrastructure: "90% of servers and databases are down, and Hisabche still works"

_This part is a course in distributed systems, taught on Hisabche's real code. The owner's requirement:_
**even if 90% of the databases and servers are down, Hisabche must not be down.**

## C.0 First lesson: say precisely what "not down" can mean

No honest engineer promises that a **ledger** keeps accepting server-side writes while 90% of its database
nodes are gone.

- With 90% of nodes lost, a consensus system (Patroni + etcd, Raft, Paxos) **has no quorum by design**.
- A system that keeps writing anyway on both sides of a split creates two truths about the same cash
  balance. That is the CAP theorem, and for money we choose consistency.

So Hisabche meets the requirement in a different way, and this way is **already half-built**:

| Layer                                 | When 90% of servers/DBs are down, the user still…                          | How (in this repo)                                                                                                                                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L0 — device**                       | sells, buys, takes payments, prints, counts stock, sees reports            | The local engine on Windows/Android (`packages/local-engine`, SQLite via `packages/app-bridge/src/local-migrations.ts`), the outbox, `sync-engine.ts`, the offline matrix (`offline-endpoint-matrix.ts`) |
| **L1 — surviving API nodes**          | logs in, syncs, uses online-only features                                  | Stateless Fastify nodes (`backend/src/index.ts`, `/ready`, SIGTERM shutdown), behind a load balancer that drops dead nodes                                                                               |
| **L2 — surviving database**           | everything server-side, **if a quorum survives**; otherwise **reads only** | Postgres primary + synchronous standby + replicas; read-only mode when the writer is lost                                                                                                                |
| **L3 — nothing server-side survives** | still works on devices; syncs later; conflicts become `PENDING_REVIEW`     | Idempotency keys, the cursor, `conflict-state.ts`                                                                                                                                                        |
| **Static**                            | landing, docs, the downloadable app                                        | CDN (Cloudflare), ISR pages                                                                                                                                                                              |

**The availability promise is: the business never stops (L0), the server degrades predictably (L1→L2), and
no money is ever written twice or lost (idempotency + one writer).** Put this sentence at the top of the
architecture spec.

Reading:

- Brewer / CAP explained — https://en.wikipedia.org/wiki/CAP_theorem
- _Local-first software_ (Kleppmann et al.) — https://www.inkandswitch.com/local-first/
- Google SRE book: _Embracing Risk_ — https://sre.google/sre-book/embracing-risk/
- Google SRE book: _Handling Overload_ — https://sre.google/sre-book/handling-overload/
- Google SRE book: _Addressing Cascading Failures_ — https://sre.google/sre-book/addressing-cascading-failures/

## C.1 What the code already does well (keep it; do not replace it)

| Already in code                                           | Evidence                                                                                                                                     | Keep because                                                                                                                                    |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Stateless backend                                         | `backend/src/index.ts`; memory "backend is stateless — all state in the DB"                                                                  | Any node can die                                                                                                                                |
| One job runtime **on Postgres**, not on Redis             | `backend/src/services/distributed-work.ts` (`FOR UPDATE SKIP LOCKED`, leases, once-per-slot), `docs/event-log-claim-migration.sql`           | Works with N nodes, with no extra infrastructure. **Do not add BullMQ**: it would be a second job runtime (guard `job-authority-guard.test.ts`) |
| Realtime that is correct across N nodes **without Redis** | `backend/src/services/sync-stream.ts`: the WebSocket carries only "head is now N"; every instance polls the head; the client pulls over HTTP | The socket is an accelerator, never the truth. **The "Redis adapter is required" claim does not apply**                                         |
| Idempotency on every money write                          | `Idempotency-Key`, `readClientRequestId` (`utils/client-request.ts`), keyed RPCs                                                             | Retries after a lost response are safe                                                                                                          |
| Multi-table writes inside Postgres functions              | `.rpc()` everywhere money moves                                                                                                              | One transaction, no compensating deletes                                                                                                        |
| Readiness + graceful shutdown                             | `/ready`, `process.on('SIGTERM')`                                                                                                            | A load balancer can drain a node                                                                                                                |
| Redis is optional                                         | `cache.service.ts` (ioredis, memory fallback); `instance-registry.ts` (observation only)                                                     | Redis down must never mean Hisabche down                                                                                                        |

## C.2 Corrections to the pasted proposal (lessons from evidence)

1. **"Drizzle ORM".** The backend talks to Postgres through `@supabase/supabase-js` (PostgREST) and `postgres`
   (postgres.js). There is a `drizzle-schema.ts` file; check whether anything imports it. If nothing does, it is
   dead code (§14).
2. **"BullMQ workers".** No: Postgres-claimed jobs exist already. Separate **worker processes** are fine
   (C.4), but they run the **same** `distributed-work.ts` claims.
3. **"Redis SETNX locks for stock reservation / period close".** No. Correctness locks stay in Postgres
   (`pg_advisory_xact_lock`, row locks inside the RPC, `EXCLUDE` constraints). A Redis lock without fencing
   tokens is unsafe for correctness; read Martin Kleppmann, _How to do distributed locking_ —
   https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html. Redis may rate-limit and cache.
   It may **never** decide whether money moves.
4. **"Redis pub/sub for realtime."** Not needed (C.1). Optional later as a latency optimization, and the
   database head must remain the truth.
5. **"Time from `transaction_timestamp()`".** Correct for **server** records. But an offline device's document
   date is the **user's business day** (`businessDayOf`, `local-day.ts`). Keep both: the server time for audit,
   the business day for accounting.
6. **"RLS on read replicas."** The backend uses the service role and filters by `workspace_id` in code (rule 1).
   The replica risk is **staleness**, not RLS: any read that **decides** something (stock check, balance before
   payment, idempotency lookup) must go to the primary.
7. **"PgBouncer in transaction mode."** Correct, with one lesson: transaction mode breaks **session**
   features. postgres.js must run with `prepare: false` behind it, and advisory locks must be
   transaction-scoped (`pg_advisory_xact_lock`, which the RPCs already use). Never `pg_advisory_lock` (session
   scope). On Supabase this is Supavisor (port 6543) — https://supabase.com/docs/guides/database/connecting-to-postgres ;
   PgBouncer features — https://www.pgbouncer.org/features.html
8. **The pasted Stack Overflow links are UNVERIFIED.** The teacher could not open them. Before citing any SO
   link, open it and confirm the title matches the claim; otherwise cite the official documentation listed here.
   Stack Overflow is good for a symptom; official docs decide behaviour.
9. **The first real bottleneck is geography, not node count.** Today the API runs on Render (Oregon, one
   service in `render.yaml`) and the database is in Sydney (memory: "latency is region, not query"). Every
   query crosses the Pacific. **Co-locate the API with the database before adding a single node.**

## C.3 Target topology (with node counts), in three stages

### Stage 1 — now → the first real customers (cheap, and removes every single point of failure)

| Component                                 | Count                                                       | Notes                                                             |
| ----------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| API (Fastify, stateless)                  | **2**, in the **same region as the DB**, in different zones | Render: `numInstances: 2`, health `/ready`; zero-downtime deploys |
| Worker process (same code, `ROLE=worker`) | **1**                                                       | Runs `distributed-work.ts` ticks + the outbox; no HTTP traffic    |
| Postgres primary                          | 1                                                           | Managed (Supabase Pro or larger), with **PITR** enabled           |
| Postgres HA standby                       | 1                                                           | Managed high availability (automatic failover)                    |
| Read replica                              | 1                                                           | Reports, dashboards, exports (C.5 routing)                        |
| Pooler                                    | managed (Supavisor)                                         | Transaction mode for the API, session mode for migrations         |
| Redis                                     | 0 or 1 (managed)                                            | Cache + rate-limit store only; Hisabche works with it down        |
| CDN                                       | Cloudflare                                                  | Landing, docs, static assets, app downloads                       |

### Stage 2 — growth (zone failure survivable, reports isolated)

| Component     | Count                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| API           | **3–6**, autoscaled on CPU **and** event-loop lag, across ≥2 zones                                                                  |
| Workers       | **2** (claims make this safe)                                                                                                       |
| Postgres      | primary + **synchronous** standby (another zone) + **2** read replicas + **1 async replica in a second region** (disaster recovery) |
| Redis         | managed with a replica (or 3-node cluster) — still non-critical                                                                     |
| Load balancer | managed, ≥2 (the provider's HA)                                                                                                     |

### Stage 3 — multi-region (region failure survivable; "90% down" drills)

- The API in **2 regions** (active/active for reads, writes forwarded to the writer region).
- Postgres: **one writer region** (active/passive). On region loss, promote the cross-region replica (RPO = the
  replication lag; RTO = minutes). Writes during promotion fall back to L0 (device outbox).
- **Sharding only when one primary is proven saturated** (measure first): shard by `workspace_id` (the tenant
  key is already everywhere). Citus is the reference design — https://docs.citusdata.com/ . Do not shard on a
  guess.

**Why one writer and not multi-master?** Two masters can each accept "sell the last unit" or "pay this
invoice". The reconciliation afterwards is a money conflict, which Hisabche's own rule forbids resolving
silently. The device outbox already gives "keep working during the outage" without that risk.

Reading:

- PostgreSQL high availability, load balancing and replication — https://www.postgresql.org/docs/current/high-availability.html
- Streaming replication / synchronous commit — https://www.postgresql.org/docs/current/warm-standby.html
- Patroni (if self-hosted) — https://patroni.readthedocs.io/
- Supabase read replicas — https://supabase.com/docs/guides/platform/read-replicas
- Supabase HA and PITR — https://supabase.com/docs/guides/platform/backups

## C.4 What to build in code (this is the V61 work; Stage-2/3 infrastructure is the owner's purchase)

Build each item as code + tests, behind configuration, so Stage 1→3 only changes environment variables.

### C.4.1 Process roles

- `ROLE=api|worker|all` (default `all`: today's behaviour).
- `api` does not start schedulers; `worker` does not listen for HTTP (it serves only `/health`).
- Lives in a **new** folder `backend/src/runtime/`:
  - `role.ts` — parse and validate;
  - `start-api.ts`, `start-worker.ts`;
  - `shutdown.ts` — the existing SIGTERM logic moved here.
- `index.ts` keeps `buildServer()` unchanged (the tests depend on it).
- **Tests:** the worker starts no listener; the API starts no tick (spy on `runAutomationTick`).

### C.4.2 Database routing: primary vs replica

- `backend/src/db/` gets three clients:
  - `primary` (today's `supabase` / postgres.js export, unchanged name for compatibility);
  - `replica` (`DATABASE_REPLICA_URL` / `SUPABASE_REPLICA_URL`; **falls back to primary** when unset);
  - `admin` (migrations / session mode).
- **The rule, enforced by a guard test:** only modules on an allow-list may use `replica`:
  - reports, analytics, dashboards, exports, insights;
  - **never** idempotency lookups, stock checks, balance checks, or anything inside a write path.
- A replica read that returns data older than `MAX_REPLICA_LAG_MS` (checked via `pg_last_xact_replay_timestamp()`
  with a short cache) falls back to the primary. Lag is exposed on `/ready` details.
- **Tests:**
  - the guard: an `import { replica }` in a write-path file fails CI;
  - the fallback when the replica URL is unset;
  - the fallback when lag is too high.

### C.4.3 Pooler-safe postgres.js

- With `prepare: false` behind a transaction pooler, a guard asserts that no `pg_advisory_lock(`
  (session-scoped) exists in `docs/*.sql` or code; only `pg_advisory_xact_lock(`.
- `statement_timeout` and `idle_in_transaction_session_timeout` are set per role, in a migration as `ALTER ROLE`
  — **a human runs it**.

### C.4.4 Load shedding and backpressure

- `@fastify/under-pressure` (**a new dependency**: allowed only with an explicit line in the progress doc plus
  the owner's approval; otherwise implement the same with `perf_hooks.monitorEventLoopDelay`, which is built
  in). Return 503 + `Retry-After` when event-loop lag, heap or RSS exceeds its threshold.
- Clients already treat 503 as "retry later" (the offline runner keeps the outbox: see
  `IdempotencyUnavailableError`).
- **Tests:** a forced lag → 503 on new requests; `/ready` reports "degraded"; `/health` stays 200.

### C.4.5 Degraded modes, explicit and visible

A single state `serviceMode = normal | read_only | degraded`, derived from:

- the primary is reachable for writes;
- replica lag;
- the pressure state from C.4.4.

- **`read_only`** (writer lost): every write route returns 503 with code `SERVICE_READ_ONLY` before
  touching the database. Reads go to replicas. Clients switch to device mode (L0) and queue writes.
- The UI shows one banner (the existing offline notice component). Never silent.
- **Tests:**
  - the write guard returns `SERVICE_READ_ONLY`;
  - a queued device write replays exactly once after recovery (idempotency).

### C.4.6 Timeouts, retries, circuit breaker

- Every outbound call has a timeout:
  - Postgres statements: per role;
  - HTTP to AI and email providers: these exist; verify every one has a timeout.
- Retries only for idempotent operations, with exponential backoff + jitter.
- A small breaker per external dependency (email, AI, payment providers), implemented in
  `backend/src/runtime/breaker.ts` with no library.
- Reading: AWS Builders' Library, _Timeouts, retries and backoff with jitter_ —
  https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- **Tests:** an open breaker fails fast; the half-open probe; a retry never repeats a non-idempotent call.

### C.4.7 Redis: strictly optional

- The `@fastify/rate-limit` store uses Redis when present and memory otherwise (verify; lesson BUG-119 says a
  limiter error must answer 429, never 500).
- Redis down → the cache falls back to memory, and the instance registry shows "unknown".
- **Test:** with Redis unreachable, every route still answers.

### C.4.8 Observability

- Structured logs: Fastify's built-in pino logger, JSON, with `requestId`, `workspaceId` (hashed or raw per
  the privacy rule; **never** customer data) and `role`.
- Metrics: request rate, errors and latency per route (RED), event-loop lag, pool wait, replica lag, job claim
  age, outbox depth. Exposed on an authenticated `/metrics` (the `system-metrics.routes.ts` page exists:
  extend it).
- Tracing: OpenTelemetry (`@opentelemetry/sdk-node`), **a new dependency**: owner approval required; design
  it now, enable it later.
- Reading: OpenTelemetry for Node.js — https://opentelemetry.io/docs/languages/js/
- SLOs (write them down):
  - API availability 99.9% monthly;
  - p95 write latency < 400 ms in-region;
  - sync convergence < 60 s after reconnect;
  - **zero** duplicate money documents (measured by idempotency-collision counters).

### C.4.9 Chaos and failover drills (prove it, do not claim it)

- `backend/src/__tests__/resilience/*.test.ts` (unit level, with a fake DB):
  - the primary is down → `read_only` → device replay is idempotent after recovery;
  - the replica is down → reads fall back to the primary;
  - Redis is down → still serving;
  - a worker dies mid-claim → the lease expires and another worker completes the job exactly once (use the
    claim functions).
- `scripts/resilience/` holds load-test scripts for **k6** (an external binary, not an npm dependency;
  https://grafana.com/docs/k6/latest/): a sync storm, an invoice burst on one workspace (hot-row contention),
  and a reports flood.
- A runbook-driven manual drill (`docs/runbooks/failover-drill.md`) on a staging project: kill the primary;
  kill one region; measure RTO/RPO; record the results. **Never on production without the owner.**

### C.4.10 Hot-row and deadlock discipline

- Write `docs/architecture/infra/LOCK-ORDER.md`: the canonical lock order for multi-table RPCs, for example
  document → lines → stock → cost layers → ledger.
- Audit every `docs/*-migration.sql` function against it.
- A guard test parses `FOR UPDATE` / `pg_advisory_xact_lock` usage in the newest version of each RPC and
  fails if the order is violated.
- Hot rows (per-workspace counters, invoice numbering) stay on sequences (`nextval`), never `UPDATE … SET n =
n + 1`.
- Reading: PostgreSQL explicit locking and deadlocks —
  https://www.postgresql.org/docs/current/explicit-locking.html

### C.4.11 Backups and restore (ties to Part B.2.24)

- PITR at the provider, plus a daily logical export per workspace into object storage, plus a **monthly
  restore test into a sandbox workspace** (an automated job; the result is recorded).
- An untested backup is a hope, not a backup.

## C.5 Folder structure, files and naming

```
backend/src/runtime/        role.ts · start-api.ts · start-worker.ts · shutdown.ts · breaker.ts · service-mode.ts · pressure.ts
backend/src/db/             primary.ts · replica.ts · admin.ts · routing.ts (allow-list) · index.ts (re-exports today's names)
backend/src/__tests__/resilience/   one file per failure mode
scripts/resilience/         k6 scripts (*.js) + README
docs/architecture/infra/    00-OVERVIEW.md · 01-TOPOLOGY.md · 02-FAILURE-MODES.md · 03-SLO.md · 04-CAPACITY.md · LOCK-ORDER.md
docs/architecture/infra/adr/   ADR-0001-one-writer.md · ADR-0002-postgres-job-claims.md · ADR-0003-redis-optional.md · …
docs/runbooks/              failover-drill.md · read-only-mode.md · restore-to-sandbox.md · region-loss.md · incident-template.md
render.yaml                 api + worker services (numInstances), health paths, region — human-applied
```

Rules:

- `db/index.ts` must keep exporting `supabase` under the same name (hundreds of imports, and the tests mock
  `'../db'`).
- New modules import `primary` / `replica` explicitly.
- No module imports a service from another service just for a constant (CLAUDE.md: constants live in leaf
  modules).

## C.6 How to document (the teacher's standard)

- **ADR** for every decision that is hard to reverse, in the MADR format —
  https://adr.github.io/madr/ :
  - context;
  - the decision;
  - the options considered;
  - the consequences;
  - the status.
    Number them and never edit an accepted ADR: supersede it.
- **C4 diagrams** in Mermaid inside `00-OVERVIEW.md` (context → containers → components) — https://c4model.com/
- **A failure-mode table** in `02-FAILURE-MODES.md`. One row per component × failure, with:
  - detection;
  - automatic behaviour;
  - the user-visible effect;
  - data risk;
  - recovery;
  - the test or drill that proves it.
- **A runbook** per incident type: the symptoms → checks (exact commands/queries) → actions → rollback → who
  is told. A runbook is written for a tired person at 3 a.m.
- **A capacity model** in `04-CAPACITY.md`: requests per active device, sync frequency, writes per invoice,
  connections per node, pooler limits. Every number has a source (a measurement or a formula), never a guess.
- **Persian summary for the owner** at the top of `00-OVERVIEW.md` (`fa`), with the engineering detail in
  English.

## C.7 How to work (spec → plan → build → prove)

1. **Spec.** Write `docs/architecture/infra/V61-INFRA-SPEC.md` first:
   - goals: the L0–L3 promise;
   - non-goals: no multi-master, no BullMQ, no Redis locks;
   - the current state with evidence;
   - the target per stage;
   - the risks;
   - the decisions (the ADRs).
2. **Plan.** `V61-INFRA-PLAN.md`: ordered slices C.4.1 → C.4.11. Each slice lists files, tests, flags,
   rollback, and the owner steps (purchases, environment variables, `render.yaml` changes the human applies).
3. **Build** slice by slice, writing tests, running nothing until the final verification (Part A §9). Update
   `V61-IMPLEMENTATION-PROGRESS.md` after each slice.
4. **Prove:**
   - the resilience unit tests pass;
   - the k6 scripts exist and are documented;
   - the drill runbook is written;
   - **the actual failover drill is an owner action**, and its status stays `BLOCKED_EXTERNAL` until it runs
     on staging.

Owner actions this part will produce (list them in the report; never perform them):

- **Region:** move the API to the database's region, or the database to the API's region. This is the
  biggest single win.
- **Purchases:** enable managed HA, PITR and a read replica.
- **Render:** add a worker service; set `numInstances ≥ 2`.
- **Database:** run the role timeouts migration (`ALTER ROLE`) by hand.
- **Drills:** run the failover drill on staging and record RTO/RPO.

Status for this part in the final report:

- **Code:** `IMPLEMENTED_NOT_LIVE_VERIFIED`.
- **Topology:** `BLOCKED_EXTERNAL` (needs purchase and configuration).
- **Drill results:** `NOT_RUN`, until the owner runs them.
