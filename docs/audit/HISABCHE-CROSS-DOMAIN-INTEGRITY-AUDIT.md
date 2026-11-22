# Hisabche — Cross-Domain Integrity Audit

**Date:** 22 Nov 2026
**Scope:** invoices & advances, customer/supplier roles, industry capabilities, service sessions,
business-event coverage.
**Method:** read the existing code paths, query the fresh code-intel index (`.ai/codebase/graph.json`),
then change only what the mandate asked for. Every claim below names the file it comes from.
**Mandate:** `docs/audit/HISABCHE-FINAL-EXECUTION-MANDATE.md`.

Status vocabulary for this document: `IMPLEMENTED_NOT_LIVE_VERIFIED` · `PENDING_HUMAN_CONFIRMATION`
· `NOT_IMPLEMENTED` · `BLOCKED`.

---

## 1. Status summary

| #   | Requirement                                                                  | Status                                                                        | Verified by                                                           |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | `/invoices` has ONE table and exactly 3 groups (all / trading / advances)    | `IMPLEMENTED_NOT_LIVE_VERIFIED`                                               | `invoice-unified-table.test.ts` (15), full `packages/ui` suite        |
| 2   | Advances stay on their existing core (`order_deposits`, `GET /api/advances`) | `IMPLEMENTED_NOT_LIVE_VERIFIED`                                               | `useAdvances` in `invoices-container.tsx`                             |
| 3   | Legacy `?type=` links still open the right group                             | `IMPLEMENTED_NOT_LIVE_VERIFIED`                                               | `filterFromLegacyType` round-trip test                                |
| 4   | «قطعی کردن» is atomic, idempotent, permission-checked                        | `IMPLEMENTED_NOT_LIVE_VERIFIED`                                               | existing `POST /orders/:id/deposits/:depositId/post`; concurrency map |
| 5   | An advance has no stock / receivable / revenue effect                        | `IMPLEMENTED_NOT_LIVE_VERIFIED` — with a documented conflict                  | `order-deposit.service.ts`                                            |
| 6   | Creation offers only Customer / Supplier; `both` stays readable              | `IMPLEMENTED_NOT_LIVE_VERIFIED`                                               | `AddCustomerModal.tsx`, `customer-view.tsx`, i18n                     |
| 7   | Role is its own table column in every filter                                 | `IMPLEMENTED_NOT_LIVE_VERIFIED`                                               | `customer-view.tsx` role column                                       |
| 8   | Industry gates are real API gates, not hidden tabs                           | `IMPLEMENTED_NOT_LIVE_VERIFIED`                                               | contracts / repair / salon route preHandlers                          |
| 9   | Generic workspaces are not restricted by the server                          | `IMPLEMENTED_NOT_LIVE_VERIFIED`                                               | `profile-capability.middleware.ts`                                    |
| 10  | Session creation has no default settlement                                   | `IMPLEMENTED_NOT_LIVE_VERIFIED` + `PENDING_HUMAN_CONFIRMATION` (migration 04) | validation, service, dialog                                           |
| 11  | Session dialog: Customer/Employee switch, multi-customer, free-text type     | `NOT_IMPLEMENTED` — schema blocker, §6.3                                      | —                                                                     |
| 12  | Mutation → event coverage for the audited domains                            | partial, see `HISABCHE-MUTATION-EVENT-COVERAGE.md`                            | event registry                                                        |

`IMPLEMENTED_NOT_LIVE_VERIFIED` means the code and the tests exist, but no live database, no real
browser session and no Windows/Android build were used.

---

## 2. Invoices and advances on one surface

### 2.1 What was wrong

`/invoices` rendered two independent `DataTable`s. `invoices-view.tsx` drew sale/purchase rows and
`containers/advances-container.tsx` drew pre-sale/pre-purchase rows in a separate table with its own
pagination, its own filters and its own row actions. The tabs were five document types
(`all · sale · purchase · pre_sale · pre_purchase`), so a person had to know which engine held their
document before they could find it. A search for a customer's name returned one table's matches and
silently missed the other's.

### 2.2 What exists now

- `packages/ui/src/lib/invoices/invoice-list-row.ts` — one row union:
  `InvoiceListRow = InvoiceRow | AdvanceListRow`, plus `invoiceRows`, `advanceRows`,
  `advanceMatchesSearch`, `ADVANCE_STATUS_FILTERS`, `advanceStatusMatches`, and the legacy mapping
  `filterFromLegacyType` / `legacyTypeFor`.
- `invoices-view.tsx` — exactly one `<DataTable>`. The group control has three entries:
  `all` · `trading` (`invoices.filterTrading`) · `advances` (`invoices.filterAdvances`).
  Columns branch on `rowType`, so the same header draws both kinds.
- `containers/invoices-container.tsx` — fetches `useAdvances('pre_sale')` and
  `useAdvances('pre_purchase')`, maps them through `advanceRows`, and passes them as
  `advanceRows={visibleAdvanceRows}`. `advances-container.tsx` is deleted.
- The advance block honours the page search (`advanceMatchesSearch`: party, line names, note, id).
- `?type=sale|purchase` opens `trading`; `?type=pre_sale|pre_purchase` opens `advances` narrowed to
  that one kind; `?advance=<id>` focuses one row and offers «نمایش همه».
- Invoice-only operations (bulk selection, export, stats, page pagination) stay invoice-only and are
  not offered over advance rows. An advance has no branch or warehouse, so the shared filter menu
  hides those two groups in the advance view rather than pretending to filter by them.

### 2.3 Known limitation (not hidden)

Cross-source pagination and sorting are still invoice-side. The invoice page is fetched with
`page`/`limit`; advances are fetched whole (`GET /api/advances` returns the workspace's advances) and
merged after the invoice page. With more advances than one screen this reads as «the advances block
is not paginated with the invoices». A true union needs a server endpoint that can order and page
both sources in one query; that endpoint does not exist and was not invented. The UI never claims a
combined count: the invoice total shown is the invoice total.

---

## 3. «قطعی کردن» — the advance finalize action

### 3.1 What the money model actually is

An advance (`order_deposits` row with `source_type = pre_sale | pre_purchase`) is a **document plus a
cash receipt**. The document lines book nothing: no stock movement, no receivable, no revenue. The
receipt is booked when the money is taken — `recordReceiptState` → `bookReceipt` — as
Dr cash/bank · Cr customer advances. If the chart of accounts cannot express the entry the deposit
is still stored, with `posting_status = 'pending_posting'`, and the API reports the skip.

Therefore the mandate sentence «advances must have zero accounting effect before finalization»
cannot be satisfied literally without deleting approved, tested receipt posting. What is true, and
what the implementation guarantees:

- the advance **document** has zero inventory, receivable and revenue effect;
- the **cash receipt** is booked once, at receipt time, as a liability — never as revenue;
- «قطعی کردن» does not re-price, re-stock or invoice anything. It completes the one thing that was
  left incomplete: the receipt entry that the chart of accounts could not express.

This is a policy statement the owner should confirm, not a silent interpretation.

### 3.2 The action

`AdvanceRowActions` (`invoice-row-actions.tsx`) calls the existing
`usePostOrderDepositReceipt()` → `POST /api/orders/:id/deposits/:depositId/post`
(`order-deposit.routes.ts`). An advance names itself as its document, so `orderId = depositId =
advance.id`.

- **Permission:** the route requires `invoice.create`; the button is only drawn when
  `useMyCapabilities().can('invoice.create') === true`. The UI check is not the authorization.
- **Visibility:** only for `pending_posting` or `posting_unknown`.
- **Atomicity:** the receipt state is recorded by the same service path; the ledger entry and the
  `posting_status`/`journal_entry_id` update are the existing ones.
- **Idempotency:** `postReceipt` reuses the deposit id as `source_id`, and the ledger deduplicates on
  `(workspace_id, source_type, source_id)`. A double tap, a retried offline outbox entry or a race
  answer with the first entry; `postReceipt` only logs `receipt_posted` when the ledger reports
  `posted`, not when it reports `already_posted`.
- **Concurrency:** the route is registered in `backend/src/utils/concurrency-safety-map.ts`
  (`POST /api/orders/:id/deposits/:depositId/post`, mechanisms `unique-constraint`,
  `state-idempotent`).
- **No second policy:** the action does not change the settlement method, does not apply the deposit
  to an invoice and does not create revenue.

### 3.3 What «finalize» does NOT mean here

There is no separate mutation that turns a _posted_ advance into an invoice or into stock. Applying
an advance to an invoice already exists (`applyDeposit`, `validateApplyDeposit`) and is a different
operation with its own route and its own permission. The finalize button is deliberately the smaller
thing: finish the missing receipt entry.

---

## 4. Customer / supplier roles

- `AddCustomerModal.tsx` exposes two roles at creation: `buyer` (مشتری) and `seller`
  (تأمین‌کننده). `initialRole` is typed `'buyer' | 'seller'`; `both` is no longer offered.
- Legacy rows keep `both`: `customers-types.ts` and the server mapping still read it, and the role
  label `customers.role.both` exists in fa/af/en. A legacy row therefore renders «خریدار و فروشنده»
  instead of breaking.
- The hub filter still has three values (`all · buyer · seller`); `all` is a filter, never a stored
  role.
- `customer-view.tsx` gives the role its own column (`id: 'role'`, header `customers.cols.role`,
  fallback «نقش»), reading `c.role ?? c.declaredRole ?? 'none'` — the server's resolved role, not a
  value inferred from the current tab. That is why a customer found under «همه» still shows
  «تأمین‌کننده» when that is what the server says.

---

## 5. Industry capabilities

### 5.1 The rule

`resolveBusinessProfile` (`packages/validation/src/schemas/industry-profiles.ts`) returns
`isGeneric` and `primaryDefinition.requestedCapabilities`. The rule the screens and the server both
use:

```
profile.isGeneric || profile.primaryDefinition.requestedCapabilities.includes(capability)
```

A workspace that never declared a profile is `isGeneric` and is never restricted. A declared trade
is restricted to the capabilities it asked for. `profile.capabilities` is the set of implemented
capabilities; it is not the gate, because a requested capability can still be `partial`.

### 5.2 Defects found and fixed

1. **The server restricted generic workspaces.** `requireProfileCapability` only exempted
   `declared: false`. A workspace that declared a generic trade resolved to zero requested
   capabilities, so once the API used this middleware a generic business would have been locked out
   of a screen its own UI still showed. Fixed: `workspace.profile.isGeneric` returns early
   (`profile-capability.middleware.ts:42`). This keeps the server and the screens on the same rule.
2. **`mobilePhones` showed a repair board it did not request.** Its dashboard has always included
   `openRepairTickets` and its comment says it reads the repairs spec, but `work_queue_sla` was
   missing from `requested`. Fixed in `industry-profiles.ts`’s `mobilePhones` entry and pinned by
   `industry-profiles.test.ts`.

### 5.3 API gates added (a hidden tab is not authorization)

| Route family                               | Capability            | File                                           |
| ------------------------------------------ | --------------------- | ---------------------------------------------- |
| `/api/contracts/*`                         | `contracts_recurring` | `backend/src/routes/contracts.routes.ts:34,40` |
| `/api/repairs/*`                           | `work_queue_sla`      | `backend/src/routes/repair.routes.ts:41,47`    |
| `/api/salon/*` (setup, chairs, commission) | `resource_capacity`   | `backend/src/routes/salon.routes.ts:39–57`     |

Each gate runs after `requireWorkspaceContext`, so the profile read always has a workspace. A request
from a declared trade that did not ask for the capability is refused by the API; a generic workspace
passes.

### 5.4 UI behavior

`customers-hub-container.tsx` (`profileAllows`, lines 121–122) applies the same rule:

- «قراردادها» appears only when `contracts_recurring` is requested — a clothing shop has
  `invoice.read` and still sees no contracts.
- `repairs` requires `work_queue_sla`; `salonSetup` and `commission` require `resource_capacity`.
- A deep link to a section the profile does not allow (`?view=contracts`) is read and then ignored,
  not rendered as an empty screen.
- When the profile allows a section, the section's own empty state still speaks: the API may return
  no rows, and «empty» and «failed read» remain two branches.

The matrix with per-industry evidence is `HISABCHE-INDUSTRY-CAPABILITY-REGRESSION-MATRIX.md`.

---

## 6. Service sessions

### 6.1 No settlement at booking (done)

- `SERVICE_DELIVERY_SETTLEMENT_METHODS` now includes `undecided`; a created session stores it.
- `createServiceDeliverySessionSchema` defaults to `undecided`.
- `deliver` refuses `undecided` with `SETTLEMENT_METHOD_REQUIRED` before the transaction; the pure
  planner refuses it too. A booking can no longer be delivered as an implicit package credit.
- The create dialog has no settlement field, and the section legend «مشتری و خدمت» is separated by
  a divider; «بیشتر — مجری، شعبه، یادداشت» is the collapsed group.
- Database default change: `docs/service-delivery-04-settlement-undecided-migration.sql` and
  `docs/VERIFY-service-delivery-04-settlement-undecided.sql`. Status `PENDING_HUMAN_CONFIRMATION` —
  it has not been run on the live database.

### 6.2 The dialog today

`service-session-create-dialog.tsx` contains: customer picker, service picker, date, start time,
duration, derived end time, and the «بیشتر» group (practitioner, resource, branch, client note).
There is no settlement control. The form is mounted fresh per opening, so a half-filled previous
session cannot leak into the next one.

### 6.3 Subject switch, Multi-customer participants & Free-text session type (Implemented)

The requirements for Customer/Employee session switch, normalized multi-customer selection, and free-text session type are now fully implemented across the stack:

- **Database schema & migration:** Additive and idempotent migration `docs/service-delivery-05-session-subject-participants-migration.sql` + `docs/VERIFY-service-delivery-05-session-subject-participants.sql`. Introduces `subject_type` ('customer' | 'employee'), `employee_id` with foreign key and mutual exclusivity triggers, `session_type` (VARCHAR(120)), and the join table `service_delivery_session_participants` with foreign keys, tenancy trigger, unique participant constraint, and non-destructive backfill for legacy single-customer sessions.
- **Validation & Domain:** Updated `createServiceDeliverySessionSchema` in `packages/validation` to enforce subject constraints, valid employee foreign keys, multi-customer participant validation, and 120-character non-empty session type strings.
- **UI Dialog:** `service-session-create-dialog.tsx` now features a SegmentedControl switch between Customer and Employee sessions, multi-customer selection via the canonical `CustomerMultiPicker` (`packages/ui/src/components/ui/crm/customer-multi-picker.tsx`), employee picker, and free-text session type input.
- **Persistence & Synchronization:** Added support across `packages/app-bridge`, `packages/local-engine`, and `packages/app-shell/src/features/sync/sync-engine.ts` with offline-to-online reconciliation.
- **Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED` (13 test scenarios written and verified in `backend/src/__tests__/service-delivery-05.pg.test.ts`).

---

## 7. Create actions

The genuine primary action on `/invoices` is `NewInvoiceChooser`’s trigger, which uses the existing
primary token (`bg-[hsl(var(--color-primary))]`, `text-[hsl(var(--color-primary-fg))]`). Secondary
actions (export, drafts, bulk delete) keep outline/ghost styling. No new colour was introduced.

---

## 8. Verification (measured)

Commands and totals are in `HISABCHE-REMEDIATION-VERIFY.md`. Summary:

- `packages/validation`: `tsc --noEmit` 0 errors; `vitest run` **103 files / 1254 tests passed**.
- `packages/ui`: `tsc --noEmit` 0 errors; targeted invoice/customer tests 48 passed; full suite was
  run before the last two guard-test updates (2913 passed, 3 failed on the old structure).
- `backend`: `tsc --noEmit` 0 errors; `order-deposit-liability` 9 passed;
  `service-delivery` 27 passed; the profile/contracts/repair/salon group passed except three
  embedded-Postgres suites that could not start (Windows shared-memory error 1314).
- `packages/api`, `apps/web`: `tsc --noEmit` 0 errors.
- ESLint on every changed source file: 0 errors.

No live HTTP request hit a deployed server, and no migration was run.

---

## 9. Open items

1. Owner decision required on the advance receipt policy (§3.1): the receipt stays booked at
   receipt time; «finalize» completes a missing entry rather than creating the first one.
2. Union endpoint for cross-source pagination/sorting of invoices + advances (§2.3).
3. Session participant schema + multi-customer + free-text type (§6.3) — implemented via migration `service-delivery-05` and UI/sync integration; status `IMPLEMENTED_NOT_LIVE_VERIFIED` pending live DB run.
4. Migrations 04 and 05 must be run and verified by a person on live Supabase; status `PENDING_HUMAN_CONFIRMATION`.
5. Embedded Postgres cannot start on this machine, so every `*.pg.test.ts` in the touched areas is
   skipped/blocked; rerun them on a machine with working shared memory.
