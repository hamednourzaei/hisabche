# HISABCHE — FORENSIC ROOT-CAUSE REPAIR, FINANCIAL INTEGRITY & END-TO-END COMPLETION

**Repository:** `hamednourzaei/hisabche`
**Target baseline:** `f0a69b9b3df56dcf8184987cf07e1d2f0c1dce4f`
**Primary branch:** `main`
**Mission type:** IMPLEMENTATION, NOT REPORTING.

---

## MISSION

Act as the Staff/Principal Engineer responsible for completing the actual repairs identified by the two Hisabche code-audit reports and the independent verification findings.

This is not another audit document, recommendation list, proposed architecture or roadmap. The task is to:

1. Independently verify reported findings against the actual repository.
2. Identify and consolidate root causes.
3. Implement all confirmed and applicable fixes.
4. Repair every affected downstream consumer.
5. Preserve existing architectural ownership and extend existing shared cores.
6. Add regression, integration, PostgreSQL, offline and UI tests.
7. Run available verification commands.
8. Continue until implementation is complete or a genuinely external human-only blocker is reached.

**A report is not a deliverable. Actual working code and verified business outcomes are the deliverables.**

Do not stop after auditing. Do not stop after writing a plan. Do not stop after fixing the first six issues. Do not stop after making tests pass. Do not replace implementation with documentation.

---

## PHASE 0 — NON-NEGOTIABLE REPOSITORY RULES

Read `AGENTS.md` completely before any change. Also inspect relevant sections of `CLAUDE.md`, `.claude/`, `.agents/skills/`, `docs/ai/CODE-INTELLIGENCE-WORKFLOW-GUIDE.md` and `docs/architecture/OUTCOME-DRIVEN-INTEGRITY-STANDARD.md`. Follow the repository's canonical rules.

Mandatory restrictions:

- Never commit or push.
- Never reset, rebase, stash or discard user changes.
- Never overwrite dirty working-tree changes.
- Never read, print, modify or expose `.env*` files or secrets.
- Never perform live Supabase DDL or database writes.
- Never execute migrations against production.
- Never install, upgrade or remove dependencies.
- Never modify lockfiles.
- Never run production builds unless explicitly authorised.
- Never use subagents.
- Never introduce `any`, `@ts-ignore`, `eslint-disable`, dead code or fake APIs.
- Never weaken or delete an existing test to make a new test pass.
- Never create a parallel business engine, resolver, KPI system, money engine, payment engine or inventory engine.
- Never use compensating DELETE operations as a substitute for database transactions.
- Never invent production verification or database execution results.

Preserve `exactOptionalPropertyTypes`. All user-facing explanations and final communication must be Persian. All source code, identifiers, tests and comments must be English. Preserve existing architecture, dependency versions, offline constraints and shared UI contracts.

### Mandatory preflight

1. Run `git status --short`.
2. Record current branch and HEAD.
3. Compare current HEAD with the target baseline.
4. Preserve all pre-existing changes.
5. Run `pnpm code-intel status`.
6. Use code intelligence for symbols, callers, callees, tests and impact.
7. Inspect actual schemas and migrations.
8. Inspect all relevant web, mobile, desktop and backend callers.

If HEAD differs from the baseline, do not revert or overwrite anything. Apply the investigation to the actual current code and establish whether fixes already exist.

If the index is unavailable or stale, use scoped searches and report the limitation internally. Never treat an empty index result as proof a symbol does not exist.

---

## PHASE 1 — FORENSIC VERIFICATION OF ALL FINDINGS

Recover and inspect both original audit reports if available in context or repository. Preserve original finding identifiers F-01 through F-100. Do not invent missing descriptions. Consolidate duplicates into root-cause groups while retaining traceability from every finding to its resolution.

Internal statuses:

- VERIFIED_BUG
- REPRODUCED_BUG
- VERIFIED_ARCHITECTURAL_GAP
- VERIFIED_PERFORMANCE_GAP
- VERIFIED_SECURITY_RISK
- VERIFIED_PRODUCT_GAP
- FALSE_POSITIVE
- DUPLICATE_ROOT_CAUSE
- DOCUMENTED_UNVERIFIED
- HUMAN_ONLY_BLOCKER

Do not treat a test's existence as proof the feature works. Do not treat HTTP 200, a passing TypeScript check, a green dashboard or a passing mock test as proof of correct financial outcomes.

For each verified defect establish: exact source location, actual root cause, direct callers, downstream effects, existing architectural owner, required implementation, regression test and cross-platform impact. After verification, proceed directly to implementation. Do not stop to ask permission for ordinary code changes.

---

## PHASE 2 — CANONICAL PARTY IDENTITY & CUSTOMER/SUPPLIER REPAIR

**Priority: P0.**

Critical verified areas:

- `packages/ui/src/components/ui/invoice-builder/customer-panel.tsx`
- `packages/ui/src/components/ui/customer-picker.tsx`
- `packages/ui/src/components/ui/invoice-builder/containers/invoice-preview-container.tsx`
- `backend/src/routes/order-deposit.routes.ts`
- `backend/src/services/sales/order-deposit.service.ts`
- `backend/src/services/invoice.service.ts`
- `backend/src/services/payments/payments.repository.ts`
- `backend/src/services/payments/payments.service.ts`
- `backend/src/services/supplier/supplier.service.ts`

### 2.1 Establish the canonical party contract

Inspect the real schema, historical migrations, customer/supplier services, invoices, payments, party statements and local-engine schema. Resolve inconsistencies between `customers`, `suppliers`, `invoices.customer_id`, `invoices.supplier_id`, `payments.party_type`, `payments.party_id` and `order_deposits.customer_id`.

A business contact must be able to participate in supported roles without duplicate financial identities or disconnected balances. Do not blindly merge existing tables. Choose and implement the smallest correct canonical model supported by the actual schema. Where customer and supplier remain separate records, every transaction must use the correct relationship. Where a shared party identity exists, use and extend it. A polymorphic party reference must validate workspace ownership and party type; it must not accept arbitrary IDs.

### 2.2 Repair purchase invoice creation

Implement the real supplier selection flow.

Requirements:

- Purchase invoice selects a genuine supplier; sale invoice selects a genuine customer.
- Purchase selection must not use a customer-only data source.
- Preserve the shared picker architecture; extend rather than duplicate.
- Preserve multi-party behaviour only where the financial relationship is supported.
- The first financial party must be explicit.
- Save the correct supplier ID to `supplier_id`.
- Never silently substitute `customer_id` for `supplier_id`.
- Validate the selected supplier in the current workspace.
- Return explicit validation errors for missing, deleted or cross-workspace parties.
- Correct invoice detail, list, search, filtering, navigation and printed documents.
- Correct seller/customer/supplier terminology in fa, af and en.

### 2.3 Repair supplier payments

For purchase invoices:

- Payment direction must be `out`.
- Party type must be `supplier`.
- Party ID must be the actual supplier ID.
- Allocations must reference the intended purchase invoice.
- Payment history must appear in supplier statements.
- Supplier outstanding balances must agree with invoice allocations.
- Supplier aging must include the correct invoices.
- Supplier 360 must show correct financial data.

Do not modify the working `openInvoicesFor` party-column rule without evidence. It already distinguishes `customer_id` and `supplier_id`. Fix the actual upstream caller and data contract.

### 2.4 Repair pre-purchase identity

`POST /api/advances` must validate:

- `pre_sale` against a valid customer.
- `pre_purchase` against a valid supplier.

Do not validate both kinds through `customers`. Persist the correct party relationship. Update request schemas, DTOs, services, repositories, database migrations, balance calculation, refund operations, apply operations, activity records, audit metadata, local SQLite schema, offline mutation contracts, sync payloads, UI forms, query hooks, cache invalidation and tests.

Preserve old data safely. If historical pre-purchase rows stored a customer ID instead of a supplier ID, build an explicit migration and reconciliation strategy. Never guess the supplier mapping. If an old record cannot be mapped with certainty, preserve it as unresolved historical data and prevent incorrect financial statements.

---

## PHASE 3 — ADVANCE, PRE-SALE, PRE-PURCHASE & FINALIZATION

**Priority: P0.**

Use the existing deposit and advance engine. Do not create a second deposit engine.

Relevant files:

- `backend/src/routes/order-deposit.routes.ts`
- `backend/src/services/sales/order-deposit.service.ts`
- `packages/local-engine/src/routes/order-deposits.ts`
- `packages/ui/src/components/ui/accounting/components/advance-entry-actions.tsx`
- `packages/ui/src/components/ui/invoice-builder/containers/invoice-builder-container.tsx`
- `packages/ui/src/components/ui/invoice-builder/containers/invoice-preview-container.tsx`
- `docs/advances-02-migration.sql`
- `docs/advances-03-migration.sql`

### 3.1 Separate document lifecycle from money lifecycle

Document lifecycle: draft, awaiting_approval, finalized, cancelled.

Payment lifecycle: unpaid, partially_paid, paid, refunded, partially_refunded.

Advance usage lifecycle: unused, partially_applied, fully_applied, partially_refunded, fully_refunded.

Use existing canonical vocabulary where equivalent. Do not introduce duplicate status engines. A document's status must not be inferred from payment or usage status.

### 3.2 Unpaid pre-invoices

A pre-invoice without an actual payment must be representable. Do not force a zero-value payment into the advance engine. Do not create a cash, bank, payment or journal entry when no money has moved. Use the existing draft mechanism or the smallest correct proforma/document-lifecycle extension.

Keep separate: unpaid quotation/pre-invoice; received customer advance; paid supplier advance; finalised sale invoice; finalised purchase invoice. A pre-invoice must not affect inventory, revenue, COGS, receivables or payables before the corresponding finalisation event.

### 3.3 Advance creation

Pre-sale: Dr cash/bank, Cr customer advances liability.
Pre-purchase: Dr supplier advances asset, Cr cash/bank.

Do not recognise revenue or expense merely because an advance was created. Server-side pricing remains authoritative. The server derives totals from document lines. The advance cannot exceed its document's valid amount.

### 3.4 Multi-method payments

Fix the confirmed issue where multiple payment entries collapse into the first payment method. Support genuine combinations: cash + bank, cash + transfer, multiple bank transfers. Preserve individual amounts and methods. The ledger, till, bank reconciliation, payment history and advance balance must agree. A single aggregate amount must never be falsely attributed to one method. Design the smallest correct transaction model compatible with the existing engine.

### 3.5 Advance application and finalisation

A user must be able to:

1. Create a pre-sale or pre-purchase document.
2. Record the actual advance.
3. View remaining balance.
4. Open complete details.
5. Create the corresponding final invoice from stored document lines.
6. Apply the available advance to that invoice.
7. Finalise the invoice.
8. See resulting accounting and inventory effects.
9. Refund unused amounts under existing reason and audit rules.

Preserve the existing `payment.record` refund permission decision; do not add a redundant permission. Do not blindly add a second conversion implementation if existing invoice/advance workflows provide the operations. If conversion is required, it must be one logical, idempotent operation with a deterministic outcome. No duplicate invoice, payment, journal entry or stock movement may result from retries. A pre-purchase must settle a purchase invoice of the same supplier; a pre-sale must settle a sale invoice of the same customer. Validate invoice type, party, currency, status, approval and remaining balance on the server and in the database transaction.

---

## PHASE 4 — ATOMIC FINANCIAL OPERATIONS & IDEMPOTENCY

**Priority: P0.**

Audit all multi-step financial operations: invoice creation, payment creation, payment allocation, advance receipt, advance application, advance refund, purchase/sale finalisation, inventory movements, costing, journal posting, returns, transfers and till operations.

### Mandatory invariants

One user action must not partially create an inconsistent financial operation. Use PostgreSQL functions/RPC for multi-table transactional writes per `AGENTS.md`. Do not use supabase client-side sequences as transactions. Implement appropriate transaction boundaries. Where operations intentionally span recoverable stages, use durable operation state and a transactional outbox.

Each operation needs: stable idempotency identity, workspace validation, actor validation, input consistency validation, atomic database effects, replay-safe response, failure recovery, audit trail and explicit final state.

### Invoice creation and payments

Fix the observed sequence where invoice and accounting effects can exist before all creation payments are recorded. A replay must not return the invoice while leaving payment tranches incomplete. Use stable per-operation/per-tranche idempotency keys. Retries must not lose or duplicate a tranche, allocation, till movement, journal entry or party identity, or reuse a key for different financial input. Keep `paid_amount` derived from allocations. Never accept client-supplied `paid_amount` as authoritative.

### Financial accounting

Preserve double-entry: total debits = total credits. Validate account roles, workspace ownership and currency. No silent skip may be represented as successful posting. No finalised invoice may claim a ledger effect that does not exist. No posted payment may lack its required journal or allocation effects.

---

## PHASE 5 — MONEY, CURRENCY & PRECISION

**Priority: P0.**

Use the existing canonical money implementation. Inspect `packages/formatting/src/money.ts`, `packages/validation/src/schemas/money.ts`, `packages/validation/src/schemas/payments.domain.ts`, `backend/src/utils/money.ts`, `backend/src/services/base-currency.ts`, `backend/src/services/sales/order-deposit.service.ts`, `backend/src/services/payments/payments.service.ts` and `packages/local-engine/`. Do not create a new money engine.

### Currency invariants

Verify all supported precision tiers. Preserve explicit product policy, including AFN 0 digits, IRR 0, IRT 0, PKR 0, USD 2, other supported ISO currencies per the canonical catalogue, and supported metals per explicit policy. Never assume 100 minor units. Never replace canonical `fractionDigits` with local constants.

Audit every `* 100`, `/ 100`, `Math.round`, `round2`, `minor`, `majorToTillMinor`, `tillMinorToMajor` and `fractionDigits` occurrence, classify by unit contract, and do not mechanically replace valid internal database decimal arithmetic. Correct real mismatches between invoice, payment, allocation, till, journal, ledger, advance, returns, FX, UI Money and local-engine values. Never mix currencies in an unlabelled total. Never silently use an exchange rate of 1 for unsupported FX. Test 0-, 2- and 3-digit precision, negative reversals, rounding boundaries and large amounts. AFN must never be scaled by 100 as a product-level conversion.

---

## PHASE 6 — REPORTING, PARTY LEDGER & KPI INTEGRITY

**Priority: P1.**

Audit customer/supplier statements, Customer 360, Supplier 360, receivables, payables, aging, open invoices, monthly activity, sales/purchase totals, receipts, payments, advance balances, refunds, dashboard KPIs, profit and COGS.

Rules:

1. Sales and purchases never mixed under an ambiguous total.
2. Receipts and outgoing payments separated.
3. Customer debt and supplier debt use correct direction.
4. Opening balances included.
5. Returns reverse the correct original transaction.
6. Cancelled invoices do not appear as active debt.
7. A missing financial read does not become zero.
8. Unknown party identity does not become customer/supplier by assumption.
9. Currency balances shown separately or converted with a verified rate.
10. Profit uses actual costing, not sales-minus-purchases.

Fix the confirmed Supplier 360 truncation: `SupplierService.get360` must not calculate lifetime `purchaseCount` and `purchasedValue` from only the newest 100 invoices. Use complete aggregation or correct pagination. Fix supplier monthly activity if the shared function counts customer sales/receipts for supplier statements. Preserve the shared `party-statement` and payments-domain ownership; do not create parallel UI calculations.

---

## PHASE 7 — PAGINATION, PERFORMANCE & QUERY CORRECTNESS

**Priority: P1.**

Audit `.limit(100)`, `.limit(500)`, `.limit(1000)`, missing `.range()`, unbounded `.select()`, N+1 queries, repeated RPC calls, full scans, incorrect counts and aggregate scopes.

Verified starting point: `OrderDepositService.listAdvances()` calls `order_deposit_balance` once per row. Replace the N+1 with a batch balance query or existing aggregate. Apply the same investigation to customer deposits and related lists.

Do not remove legitimate pagination without designing a contract. A lifetime KPI must not use one page. A list page may be limited, but total count and financial summary must represent the entire filtered set. Use deterministic ordering and stable cursors. Test >100, >500, >1,000 records, empty/last page, concurrent inserts, duplicate sort values and large histories. Measure round trips before/after.

---

## PHASE 8 — DATE, TIMEZONE, NULL & ERROR HANDLING

**Priority: P1.**

Use existing local-day and business-timezone abstractions. Separate business document date, UTC timestamp, scheduled time, due date, expiry date and audit timestamp. Never interpret a business date as a UTC timestamp without a contract. Test midnight boundaries, timezone changes, DST where applicable and offline documents.

Audit empty/broad catch blocks. Formatting may recover from Intl errors; failed payment/ledger/inventory/sync/security operations must never be silently swallowed. Use explicit error states. Never convert unknown to zero, missing to empty success, failed read to no records, failed write to successful creation, or pending to posted.

---

## PHASE 9 — INVENTORY, COSTING & OPERATIONAL INTEGRITY

**Priority: P0/P1.**

Verify warehouse/product ownership, variant binding, base-unit conversion, unit precision, reservations, movements, purchase receipt, sale consumption, returns, transfers, cost layers, AVCO/FIFO, COGS, negative stock policy, expiry/batch and WIP/production.

A purchase advance must not add stock. A purchase invoice must not create stock twice. A sale invoice must not consume stock twice. An approval-held invoice must not move stock before approval. A cancelled/rejected document must not leave unexplained movements. Never implement a second inventory engine. Use shared inventory, costing and accounting cores. Every movement has a traceable source document.

---

## PHASE 10 — SECURITY, TENANCY & DATABASE FUNCTIONS

**Priority: P0.**

Audit RLS, RPCs, SECURITY DEFINER functions, triggers, realtime channels and workspace boundaries, especially advance functions. For each function verify safe `search_path`, execution grants, workspace identity, actor identity, membership/permission validation, workspace-scoped row locks, FK ownership, cross-workspace rejection, idempotency uniqueness, audit records and transaction boundaries.

Never trust client-supplied workspace ID, role or total. Never allow a party, invoice, payment, account or warehouse from another workspace. Realtime subscriptions are workspace-scoped. Add cross-workspace PostgreSQL regression tests. Do not expose/inspect credentials or run live writes.

---

## PHASE 11 — OFFLINE-FIRST, SYNC & MULTI-PLATFORM PARITY

**Priority: P0.**

Preserve and verify the full offline path: UI → domain command → local DB → outbox → API → PostgreSQL → change log → pull → local reconciliation.

Requirements: stable mutation IDs; idempotent retries; version-aware updates; workspace scoping; no LWW for financial data; no silent participant/record deletion; no stale snapshot overwriting newer local changes; deterministic conflict handling; replay-safe events; historical immutability where required.

Do not introduce polling, Redis or a second sync engine. If the architecture cannot support a behaviour safely, implement the smallest compatible extension and document the limitation.

---

## PHASE 12 — UI, I18N & USER-VISIBLE PROOF

Every affected workflow must render the real persisted outcome: correct state, amounts, currency, counterparty, permissions, loading/empty/error/unknown states, and RTL. Add keys in fa/af/en. Use shared pickers and selects; no raw `<select>` where banned. Never claim success before the server/device outcome exists. Never show a count or total that the query does not support.

---

## PHASE 13 — TESTS, MIGRATIONS & VERIFICATION

For every schema change: `docs/<name>-migration.sql`, `docs/VERIFY-<name>.sql`, a real PostgreSQL test, explicit safety classification (ADDITIVE / DATA_BACKFILL / POTENTIALLY_LOCKING / DESTRUCTIVE) and migration-ledger inclusion. Migrations are additive, idempotent, tenant-safe, RLS-protected, constrained/indexed and reversible or forward-recoverable. Never mark applied without execution.

Test layers: domain unit, golden vectors, invariants, local SQLite, Fastify HTTP injection, real PostgreSQL, API/hook contracts, shared UI, offline replay, cross-tenant isolation, migration idempotency and UI proof. Do not substitute mocks for database invariants. Run focused tests, then package suites, `tsc --noEmit`, and eslint on changed files. Report exact commands and exit codes. Never claim a test passed without seeing it.

---

## PHASE 14 — DOCUMENTATION & FINAL REPORT

Update existing canonical documents rather than creating duplicates: migration ledger, mutation-event coverage, cross-domain integrity audit, industry capability regression matrix, remediation verification and service-delivery migration documentation. Every item has exactly one status: `VERIFIED_COMPLETE`, `IMPLEMENTED_NOT_LIVE_VERIFIED`, `BLOCKED`, `NOT_IMPLEMENTED`, `PENDING_HUMAN_CONFIRMATION`, `OWNER_DECISION`.

Never mark a migration applied or a PostgreSQL test passed without execution.

### Final Persian report

Include: executive result; exact migrations created; schema changes/backfills; backend/API changes; domain/validation changes; UI changes; offline/sync changes; mutation-event coverage before/after; exact test commands/results; PostgreSQL status and environmental blocker; migration status (authored / locally executed / verified / production pending); files modified/created/deleted; remaining owner decisions; remaining blockers; final git status and confirmation that no commit/push/reset/stash occurred.

---

## EXECUTION POLICY & SAFETY BOUNDARIES

Authorised: inspect repository/schema; modify application code; add migration and VERIFY SQL; add PostgreSQL integration tests; update documentation/ledgers; execute tests and migrations against disposable local/test infrastructure; fix repository-level test infrastructure when safe.

Not authorised: execute migrations against production; live Supabase DDL/writes; change production data; read/expose secrets; commit/push; change dependencies/lockfiles; change Expo/RN versions or enable New Architecture; destroy existing local databases or user data; destructive schema changes.

If staging credentials or production access exist, do not use them. Do not stop for approval for ordinary additive code/migration authoring. Stop only for a genuine business-owner decision or an action outside these boundaries.

---

## COMPLETION CRITERIA

1. All actionable schema-dependent gaps implemented.
2. All required additive migrations exist.
3. Every migration has a matching VERIFY script and an integration test.
4. Fresh-install and upgrade paths checked where infrastructure allows.
5. Customer/employee session distinction works end to end.
6. Multiple customer participants work end to end.
7. Free-text session type works end to end.
8. Offline and replay behaviour covered.
9. Mutation-event coverage updated and verified.
10. Invoice/advance behaviour has no new accounting regression.
11. Industry/API/UI capability parity verified.
12. Relevant type checks, lint and tests pass.
13. PostgreSQL limitations explicitly reported.
14. Git working-tree preservation confirmed.

Do not invent a 100% completion claim. If an item cannot be completed, continue all other independent work and report the exact blocker, affected files, missing prerequisite and safest next action. Do not stop after producing a plan. Execute the implementation.

**Final principle: Build the missing schema, connect the complete workflows, and prove them with tests. Do not turn migration authoring into another audit-only exercise.**

---

## Execution log — 23 Nov 2026

### Party identity (D-1)

- `docs/advances-04-party-identity-migration.sql` + VERIFY + pg test: **12/12** assertions on
  PostgreSQL 18.4.
- `docs/advances-05-supplier-advance-party-migration.sql` + VERIFY + pg test: **11/11**. It resolves
  the party from `supplier_id` first, still applies a historical row whose supplier sits in
  `customer_id`, refuses an unresolved party on apply **and** on refund, refuses another workspace's
  advance, and is executable by `service_role` only. The file was renamed from
  `advances-05-supplier-advance-party.sql` so the ledger's `*-migration.sql` convention finds it.

### Lifecycle and money (WP-05, WP-06, WP-07, WP-08)

- WP-05: `advanceUsageOf` / `ADVANCE_USAGE_STATES` in
  `packages/validation/src/schemas/universal-core/order-deposit.domain.ts`; `advance-usage.test.ts`
  **10/10**. `usage` is exposed by the server view and the device engine and rendered as a badge.
- WP-07: `finishReplayedInvoice` records the creation payments on the replay path too, with
  per-tranche keys `<clientRequestId>:payment:<index>`.
- WP-08: `finalizeAdvance` books with the deposit's own fraction digits (AFN has 0) instead of
  dividing by 100, refuses `DEPOSIT_CURRENCY_UNKNOWN` / `DEPOSIT_CURRENCY_PRECISION_UNSUPPORTED`, and
  uses `advance-finalize:<advanceId>` for both writes.

### Balances and pagination (WP-10)

- `docs/order-deposit-balances-01-migration.sql` + VERIFY + pg test adds a batched
  `order_deposit_balances`, so a deposit page reads every balance in one call; the service keeps a
  per-row `order_deposit_balance` fallback for a database where the migration has not run yet.
- `order-deposit-customer-list.test.ts` → **5/5**.

### Status

All of the above is `IMPLEMENTED_NOT_LIVE_VERIFIED`: no live Supabase call was made, and every
migration is `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`. The advance
receipt timing stays the owner's decision (booked at receipt time; finalize completes, never creates,
the first entry).

### Recurring purchase template carried its supplier as a customer (found and fixed 23 Nov)

The invoice itself mapped a purchase to `supplierId`; the recurring-template payload beside it did
not — it sent `customerId` for every type (`invoice-preview-container.tsx:411`). The template schema is
`z.record(z.unknown())`, so the compiler could not see it, and the server validates the template with
the invoice's own schema: a purchase template was either refused at save or saved with its supplier
filed as a customer, and every issue repeated it.

Fixed by the same purchase/sale branch the invoice uses. Guard:
`packages/ui/src/__tests__/recurring-purchase-party.test.ts` — proven red without the fix
(`1 failed`) and green with it (`1 passed`).
