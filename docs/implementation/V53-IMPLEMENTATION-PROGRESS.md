# V53 — Implementation progress

State machine: `V53-IMPLEMENTATION-STATE.json`. This file is the human-readable log.
Scope of this run: **Phases A–C only.** Store, Teacher and adaptive onboarding were deliberately not started (see §5).

## 1. Phase A — baseline and P13

**Baseline (read before editing)**

- One profile resolver already exists: `resolveBusinessProfile` (`packages/validation/src/schemas/industry-profiles.ts`). Six UI consumers, **zero** backend consumers (P4 still open).
- Zero `industry ===` / `businessType ===` conditionals in production code (guard: `industry-profile-guard.test.ts`; re-checked by grep). No `TeacherCore`/`GoldCore`-style service exists.
- Registry: 13 capability keys, statuses were only `available | planned`.

**P13 — "capabilities must have a UI destination or leave the claim"** (`V53-FOUNDATION-PLAN.md` §6)

- The honest half is done: the five audited overclaims are no longer `available`.
- The UI-exposure half (10 hooks with no consumer: `LEGACY-DOCUMENT-RECONCILIATION.md` M15) is **NOT_IMPLEMENTED** and belongs to Phase E, where a menu/hub destination and its consumer are built together. Building screens here would be UI with no profile composition behind it.

## 2. Phase B — capability architecture (`business-capabilities.ts`)

| Change                                               | Why                                                                                                                                                                                                                           | Consumer                                             |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `status: 'partial'` + `limitations` (stable codes)   | `variants`, `serialized_items`, `auto_fitments`, `gold_purity`, `making_charges` work at product level but are not bound to invoice/stock/pricing. `planned` would hide working UI (`warehouse-detail-container.tsx:324-330`) | `resolveBusinessProfile`, `industry-support-note.ts` |
| `version`, `requires[{key,minVersion}]`, `conflicts` | dependency graph                                                                                                                                                                                                              | `resolveCapabilities`                                |
| `resolveCapabilities(requested, registry?)`          | one deterministic answer: closure of dependencies, cycle/version/planned refusal, conflict removal (earlier registry key wins), every outcome a typed diagnostic                                                              | `resolveBusinessProfile`                             |
| `validateCapabilityRegistry(registry?)`              | structural guard: cycles, unknown/self requirements, status order (a complete capability cannot need a partial one), limitation/evidence/status consistency, version sanity                                                   | `capability-composition.test.ts` (CI)                |

Real graph edges: `weight_pricing`, `length_pricing`, `volume_pricing` → `measurement`; `gold_purity` → `weight_pricing`; `making_charges` → `gold_purity`. **No real conflict edge exists** — none was invented (decision D3); the mechanism is exercised on patched registries.

## 3. Phase C — effective profile from the resolver (`industry-profiles.ts`)

- `ProfileDefinition.requestedCapabilities` keeps what a trade asks for; `capabilities` is the usable subset.
- `resolveBusinessProfile` now takes its capability set from `resolveCapabilities`. New fields: `partialCapabilities`, `diagnostics`. `unsupported` is now real — before, it was derived from an already-filtered list and was **always empty** (pharmacy's `batch_expiry` was silently dropped).
- The result is deep-frozen: an effective profile is a value.
- A trade on a partial capability gets `industry.supportNote.partial` (fa / af / en) in onboarding and settings, so a half-built chain is never presented as finished.
- Not done in C, on purpose: **policies, terminology composition, navigation composition** — see D2. `vocabulary` and `recommendedModules` already exist; extending them needs a Phase D/E consumer.

## 4. Evidence

| Check          | Command                                                                                                                | Result                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Types          | `cd packages/validation && npx tsc --noEmit`                                                                           | clean                                                                         |
| Focused        | `vitest run capability-composition industry-profiles industry-diff-doc capability-has-consumer industry-profile-guard` | 5 files / 61 tests pass                                                       |
| Package        | `cd packages/validation && npx vitest run`                                                                             | 52 files / 791 tests pass                                                     |
| UI package     | `cd packages/ui && npx tsc --noEmit` ; `npx vitest run`                                                                | tsc clean; 196 files pass + 1 skipped / 2560 tests pass + 2 skipped           |
| Lint / format  | `npx eslint <changed files>` ; `npx prettier --check`                                                                  | 0 eslint problems; changed files formatted (generated docs intentionally raw) |
| Doc generators | `generate-industry-diff.mjs --check`, `generate-coverage-table.mjs --check`                                            | OK (both were `STALE` at HEAD — see §6)                                       |
| PostgreSQL     | —                                                                                                                      | `BLOCKED_EXTERNAL`                                                            |

Test edits (ledger — no test was deleted or skipped):

| File                        | Edit                                                                                                                                                 | Why                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `industry-profiles.test.ts` | "only available capabilities attached" → "only usable (not planned) capabilities attached"; "every available … evidence" → "every usable … evidence" | spec change: `partial` is a usable state. Evidence check now covers **more** capabilities, not fewer |
| `industry-diff-doc.test.ts` | active column: `partial` → `فعال (جزئی)`                                                                                                             | generator now emits partial                                                                          |

## 5. Why Store / Teacher / onboarding are not started

The user asked for A–C first. Also, by the plan's own order, Store needs P2 (variant ↔ invoice/stock) and Teacher needs P1 (order deposit posts nothing) — both change financial/inventory semantics and need owner approval (`NEEDS_OWNER_DECISION`), so they were not touched.

## 6. Findings worth the owner's attention

1. **Generated docs drift because of formatting.** `INDUSTRY-COVERAGE-TABLE.md` and `industry-diff.generated.md` compare byte-for-byte with the generator, but the pre-commit prettier reformats them. That is the likely reason both `--check`s were `STALE` at HEAD (observed in the audit); `industry-coverage-table.test.ts` fails whenever the check does. They were regenerated raw; the next commit will reformat them again unless they are added to `.prettierignore` (not changed here — config).
2. `profile.unsupported` was dead before this run (fixed above).

## 7. Run 2 — foundation defects that are safe without an owner decision

Scope decision: of the mission's thirteen phases, this run did what could be **proven here and does not guess financial/permission semantics**. Phases 3–5 and 7–10 are NOT started; the reasons are recorded as D4–D7 in `V53-IMPLEMENTATION-STATE.json`.

### 7.1 Draft purchase orders — one rule (audit GAP-NEW-2) — `IMPLEMENTED_NOT_LIVE_VERIFIED`

| Before                                                                                                                                         | After                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server refused a line with no supplier / no price; the offline engine invented a supplier called `default-supplier` and accepted `unitPrice 0` | `planDraftPurchaseOrders` (`packages/validation/src/schemas/draft-purchase-order.domain.ts`) is called by both `backend/src/routes/inventory-insights.routes.ts` and `packages/local-engine/src/routes/purchasing.ts`. Same refusal code `DRAFT_PO_LINE_INCOMPLETE`, all-or-nothing, first-seen supplier order |

Still different, on purpose (not guessed): the server stores status `pending`, the device `draft`; the device checks `warehouse.manage`, the server `purchase.write`; the device uses a random local id. These are persistence/permission naming, not a business rule — recorded for the owner.
Tests: `draft-purchase-order.test.ts` (6, rule), `purchasing.test.ts` (+4 device route tests: happy path writes 1 order; no supplier → 400 and 0 rows; free item → 400; one bad line refuses the batch).

### 7.2 Cycle count (audit GAP-NEW-1) — `IMPLEMENTED_NOT_LIVE_VERIFIED`, completion is `PARTIALLY_IMPLEMENTED`

- Movements now name the counted warehouse (`to_warehouse_id`, the shape the product-page adjustment already uses) — before, stock landed in «no warehouse» (BUG-080 pattern).
- `countAdjustmentMovements` (domain, pure) skips products that already have a movement for the count → a retry or double click cannot adjust twice. Tested, including a half-written crash.
- The close is a compare-and-swap that now checks it actually closed a row; zero rows → `CYCLE_COUNT_NOT_OPEN`.
- `docs/cycle-count-02-migration.sql` + `docs/VERIFY-cycle-count-02.sql` + `cycle-count-02.pg.test.ts` + `helpers/cycle-count-02-scenarios.ts`: partial unique index `(workspace_id, reference_id, product_id) WHERE reference_type='cycle_count'`; refuses to apply (changes nothing) if a duplicate already exists. **Not applied by me.**
- Evidence: PGlite 5/5 scenarios + VERIFY row pass (logic only); real PostgreSQL `BLOCKED_EXTERNAL`.
- **Not done:** a single database transaction around movements + close (D5), and the shrinkage journal entry (the account does not exist — owner decision, unchanged).

### 7.3 Not done, with reason

| Item                                                                          | Status                 | Why                                                        |
| ----------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------- |
| Backend profile authority + capability guard (Phase 3)                        | `NEEDS_OWNER_DECISION` | profile is per user, not per workspace (D4)                |
| Audit hash writer                                                             | `NOT_IMPLEMENTED`      | must be DB-side; replaces what `audit.test.ts` covers (D6) |
| Order deposit                                                                 | `NEEDS_OWNER_DECISION` | accounting meaning (D7)                                    |
| Variant ↔ invoice/stock                                                       | `NOT_IMPLEMENTED`      | invoice + inventory + sync contract change (D7)            |
| Branch restriction on device                                                  | `NOT_IMPLEMENTED`      | needs a server→device branch-scope pull                    |
| Store / Teacher / onboarding / navigation, terminology, dashboard composition | `NOT_IMPLEMENTED`      | depend on D4 and on P1/P2                                  |

### 7.4 Evidence for run 2

| Check                 | Command                                                                 | Result                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend types         | `cd backend && NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit` | clean                                                                                                                                                                                                                                                                                                                                                                                               |
| Backend suite         | `cd backend && npx vitest run --exclude "**/*.pg.test.ts"`              | 360 files / 5009 tests pass                                                                                                                                                                                                                                                                                                                                                                         |
| Real PostgreSQL files | same suite **with** `*.pg.test.ts`                                      | each file waits 120 s and is reported **skipped** (binary cannot start) — run aborted, `BLOCKED_EXTERNAL`                                                                                                                                                                                                                                                                                           |
| Local engine          | `cd packages/local-engine && npx vitest run`                            | 64 files pass, **1 fails**: `package-deferred-revenue-device.test.ts` → `INSUFFICIENT_ELIGIBLE_PACKAGE_CREDIT` (409). Not caused by this run's changes (only `routes/purchasing.ts` changed in that package; the test exercises package credits with fixed 2026-10/11 dates and is probably date-sensitive). **Not verified against HEAD** — left unfixed and unmasked; needs its own investigation |
| Cycle-count scenarios | PGlite `SETUP=setupCycleCount02`                                        | 5/5 pass + VERIFY row pass (logic only)                                                                                                                                                                                                                                                                                                                                                             |
| Lint                  | `eslint` on all changed backend/local-engine files                      | 0 problems (the one `any` in `cycle-count.service.ts` removed)                                                                                                                                                                                                                                                                                                                                      |

## 8. Continuation 1 — verification of run 2, the red test, the real PostgreSQL blocker

### 8.1 The local-engine red test is explained and fixed (`FAILED` → `VERIFIED_COMPLETE`)

`package-deferred-revenue-device.test.ts` › «switch ON, then 10 deliveries…» failed with `INSUFFICIENT_ELIGIBLE_PACKAGE_CREDIT`.
Root cause (read from the test, then proved by the fix): `sell()` posted the package invoice **without a `date`**, so the grant took the real clock's today (2026-11-03), while the ten sessions are scheduled on the fixed day 2026-11-02 — **before** the grant starts, so no credit was eligible. The test passed on 2 Nov 2026 (the day it was written) and fails from 3 Nov.
It is unrelated to this mission's edits (only `routes/purchasing.ts` changed in that package). Fix: `sell()` now sends `date: '2026-11-01'`, exactly as the other helper in the same file already does. No assertion was changed. Result: 65 files / 470 tests pass.

### 8.2 Why «PostgreSQL is blocked» — now precisely known (`BLOCKED_EXTERNAL`)

Every `*.exe` is missing from the embedded-postgres package (29 files, DLLs only; `postgres.exe` → `spawn ENOENT`): the executables were removed from disk, most likely by antivirus. Each `*.pg.test.ts` then waits for its `beforeAll` to time out (120 s) and reports its tests _skipped_ (the file shows as failed). That is why an unfiltered backend run takes hours. Owner step: restore/allow the binaries (host action, not repo code). PGlite is the stand-in proof, and is labelled logic-only.

### 8.3 Cycle count is now one transaction when the function is installed (`IMPLEMENTED_NOT_LIVE_VERIFIED`)

`docs/cycle-count-02-migration.sql` also creates `cycle_count_complete(...)`: movements (with `to_warehouse_id`), frozen line figures and the status change in one transaction under a row lock. `CycleCountService.complete` calls it (`completeAtomically`) and falls back to the idempotent two-step path **only** when the function does not exist (`42883` / `PGRST202`), so the code can ship before the migration.
PGlite scenarios (10/10): one transaction writes everything; a second completion → `not_open`, no extra movement; a mid-way failure (bad uuid) rolls back **all** — no movement, count still `counting`; movements an older non-atomic run already wrote are not duplicated; another business's / unknown count → `not_found`; plus the 5 index scenarios. `VERIFY-cycle-count-02.sql` has 9 checks (index + function exists / SECURITY DEFINER / version marker / privileges). Real PostgreSQL: `BLOCKED_EXTERNAL`.
Still not claimed: the shrinkage **journal entry** (no account exists — owner decision).

### 8.4 Draft purchase order — server proven too

`draft-po-route.test.ts` (5 tests, Fastify inject): server drafts one order per supplier; refuses a missing supplier, a free item, an empty batch; **all-or-nothing** (a good first line + a bad second line → 400 and `createPurchaseOrder` never called). Device side: `purchasing.test.ts` (4 tests). Both call `planDraftPurchaseOrders`.

### 8.5 D4 sharpened (the single biggest unblocker)

The repository already holds a workspace-level profile design (`docs/business-profile-01-migration.sql`, 2026-10-27) that **no code reads**, and an invariant (`docs/business-profile/IMPLEMENTATION-MAP.md` §2.1: profile policy never changes authorization) that conflicts with the mission's «backend rejects operations needing an unavailable capability». So the owner must say whether a profile may _refuse_ an API call. Until then the profile stays advisory and no guard was added (an enforcement guard would also silently lock out API clients of generic workspaces).

### 8.6 Final numbers for this continuation (nothing else running while measured)

| Check                 | Command                                                                | Result                               |
| --------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| Backend, no pg files  | `cd backend && npx vitest run --exclude "**/*.pg.test.ts"`             | 361 files / 5015 tests pass          |
| Local engine          | `cd packages/local-engine && npx vitest run`                           | 65 files / 470 tests pass            |
| Validation            | `cd packages/validation && npx vitest run` (twice)                     | 53 files / 797 tests pass, both runs |
| Types                 | `backend`: `tsc --noEmit` (clean); validation, local-engine, ui: clean | clean                                |
| Cycle-count scenarios | PGlite                                                                 | 10/10 + VERIFY row                   |
| Real PostgreSQL       | —                                                                      | `BLOCKED_EXTERNAL` (§8.2)            |

Two things that went red and why (neither is hidden):

- `capability-matrix-csv.test.ts` — my edit to `inventory-insights.routes.ts` moved a route line the generated matrix cites. `node scripts/generate-capability-matrix-csv.mjs` regenerated it (8 lines).
- `architecture-boundaries.test.ts › one definition per core business rule` timed out once (5000 ms default on a whole-tree file scan) while other suites were running; alone it takes ~1.8 s and the full package passed 2/2 afterwards. A load-sensitive pre-existing guard; not changed.

## 9. Continuation 2 — the owner's decisions applied

Contract and the five adopted defaults: `V53-OWNER-DECISIONS.md`. State: `V53-IMPLEMENTATION-STATE.json` (D10–D12).

### 9.1 D4 = B — built (`IMPLEMENTED_NOT_LIVE_VERIFIED`)

- `backend/src/services/workspace-profile.ts`: the server's copy of the workspace profile, resolved by the same pure resolver as the screens. Undeclared (NULL/empty, or migration not applied) ⇒ never restricted; a failed read throws (never reads as «undeclared»); writing touches the profile columns only.
- `backend/src/middleware/profile-capability.middleware.ts`: the second half of an authorization. `requireCapability` (permission) **and** `requireProfileCapability` (capability); the profile never grants a permission.
- `GET|PUT /api/workspace/profile` (`workspace-profile.routes.ts`): PUT needs `workspace.manage`, accepts registry keys only, is audited (`profile_changed`).
- Guarded writes: `POST /api/products/:id/variants` (`variants`), `POST /api/products/:id/fitments` (`auto_fitments`).
- Client: `useWorkspaceProfile` / `useSaveWorkspaceProfile` (`packages/api`), `useBusinessProfile` prefers a **declared** workspace profile and otherwise keeps the person's own trades; the settings section also saves the workspace profile (a 403 is tolerated — the personal profile is saved; `null` = migration not applied).
- Tests: `workspace-profile.test.ts` (14, real middleware + real resolver, database replaced): undeclared passes; declared-without-capability → 403 `CAPABILITY_NOT_ENABLED` and the service is not called; declared-with passes; **no permission ⇒ no write even with the capability**; failed read refuses; PUT admin-only / validated / audited / migration-missing → 409.
- **Not done, on purpose** (each recorded in D10): metal-rate / serial / warranty / vehicle writes are not capability-guarded — the jewellery profile deliberately has no `gold_purity` (asserted by `industry-profiles.test.ts`, OPEN-QUESTIONS #4), so a guard would lock out every declared gold shop; nothing is enforced on the device (offline).
- **Blocked on a human:** `docs/business-profile-01-migration.sql` (already in the repo) must be applied; until then `PUT` answers 409 and every workspace stays undeclared.

### 9.2 PO = Draft Purchase — built (`IMPLEMENTED_NOT_LIVE_VERIFIED`)

Reorder suggestions create `draft` on the server (was `pending`) and on the device; the device asks for `purchase.write`; a draft is never receivable (`PURCHASE_ORDER_DRAFT`); `draft` is a settable status; ordinary orders still default to `pending`; legacy rows untouched (no migration). Tests: validation (+2), backend route (status `draft`), device (+3: status, not receivable & stock unmoved, seller refused with 0 rows).

### 9.3 Not built — and why each is not a half-measure waiting to happen (D12)

P1 deposit-as-liability, P2 variant binding, CC accounts, OD-3 credit override, OD-4 WIP: each needs a migration, new account roles / permission names, and a change on a hot financial path that cannot be proven here without PostgreSQL. The exact ledger contracts are in the state file. Two facts found while reading: nothing on the server reads `workspaces.credit_limit_mode` or calls `evaluateCreditLimit` (UI only), and `customers.credit_limit` has no currency.

## 10. Continuation 3 — 3 Nov 2026: re-measured, no product code changed

This run changed **no** backend, UI, device or migration file. It re-measured the M5 entry gate, took the
PGlite logic evidence that was only claimed before, and checked the V53 slices already in the tree.

| Gate | Command / evidence                                                                                                                                        | Result                                                                                                                                         |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| G1   | `cd backend; npx vitest run src/__tests__/invoice-return-once.test.ts src/__tests__/reverse-sales-return.test.ts src/__tests__/sync-pull-columns.test.ts` | **GREEN** — `Test Files 3 passed (3)`, `Tests 18 passed (18)`, exit 0                                                                          |
| G2   | human-run `VERIFY-*.sql` output under `docs/`                                                                                                             | **RED** — still none; the five migrations stay `PENDING HUMAN CONFIRMATION`                                                                    |
| G3   | embedded-postgres `windows-x64/native/bin`                                                                                                                | **RED (`BLOCKED_EXTERNAL`)** — 29 files, **0** `.exe`; `postgres.exe` still absent                                                             |
| G4   | Answer column of `M5-DECISIONS.md`                                                                                                                        | **PARTIAL** — owner answered OD-5, M5-1, M5-2, M5-4, RG-1, OD-6; **M5-3 and M5-5 still blank**; M5-A4/A8/A9/A10/B1/B2 hold agent defaults only |
| G5   | `packages/ui/src/components/ui/service-delivery/`                                                                                                         | **GREEN** — 9 files                                                                                                                            |

PGlite logic evidence (real PostgreSQL engine, one connection; lock contention still `BLOCKED_EXTERNAL`):

- `service-delivery-02/03`: `setup OK`, both VERIFY rows all `true` and every `legacy_*` `0`, **ALL 14 PASSED**, exit 0.
- `cycle-count-02`: `setup OK`, VERIFY `pass: true`, **ALL 10 PASSED**, exit 0.

V53 slices already in the tree, re-run today:

| Suite                                                                                | Files / tests | Exit |
| ------------------------------------------------------------------------------------ | ------------- | ---- |
| backend `workspace-profile` + `draft-po-route` + `cycle-count-guard` + `stock-count` | 4 / 65        | 0    |
| validation `draft-purchase-order` + `capability-composition`                         | 2 / 36        | 0    |

Why no product code this run: G2/G3 are human/host steps, G4 still has two blank owner answers, and every
remaining decided slice (P1 deposit, CC accounts, OD-3 credit, OD-4 WIP) is a posting change on a hot
financial path whose only proof here would be PGlite — the same reason D12 recorded in continuation 2.

## 11. Continuation 4 — 3 Nov 2026: P1, a deposit is a liability (`IMPLEMENTED_NOT_LIVE_VERIFIED`)

Owner decision P1 is now implemented for the RECEIPT, through the existing ledger port — no parallel
financial engine, no new table, no backfill.

**What runs**

- `POST /api/orders/:id/deposits` validates with zod (uuid customer, positive integer minor amount,
  optional method and accounting date), records the deposit, and books
  **Dr cash|bank / Cr customer advances** through `ledger.postDocument` with
  `sourceType: 'order_deposit'`, `sourceId: <deposit id>`. The unique index on
  `(workspace_id, source_type, source_id)` is what makes a retry post nothing new.
- The money account follows the method (`moneyAccountRole`: cash → cash, anything else → bank), the
  same rule payments use — so a «bank» deposit no longer risks landing in the drawer.
- The amount comes from `order_deposits.amount_minor` through `tillMinorToMajor(amount, booksCurrency)`.
  **AFN has 0 fraction digits and USD has 2**, so a hardcoded ÷100 would have posted 100× the afghani
  deposit; both are covered by tests.
- A chart of accounts that cannot express the posting still records the deposit and answers
  `posting: { status: 'skipped', reason: 'missing_accounts' }`; nothing is guessed and nothing is
  silently dropped.
- New role `customer_advances` (liability, standard code 2150, «پیش‌دریافت مشتریان») in
  `accountRoles`, `STANDARD_ACCOUNT_FOR_ROLE`, the UI name map and all three locales.

**Files**

`docs/customer-advances-01-migration.sql` (widens `accounts_role_check`, `NOT VALID` then `VALIDATE`,
rollback block, idempotent), `docs/VERIFY-customer-advances-01.sql`,
`backend/src/__tests__/helpers/customer-advances-01-scenarios.ts`,
`backend/src/__tests__/customer-advances-01.pg.test.ts`,
`backend/src/__tests__/order-deposit-liability.test.ts`,
`backend/src/services/sales/order-deposit.service.ts`, `backend/src/routes/order-deposit.routes.ts`,
`backend/src/services/accounting/ledger.port.ts`, `backend/src/utils/concurrency-safety-map.ts`,
`packages/validation/src/schemas/accounting.schema.ts`,
`packages/validation/src/schemas/standard-accounts.ts`,
`packages/ui/src/lib/accounting/account-name.ts`, `packages/i18n/messages/{fa,af,en}/common.json`.

**Evidence**

| Check                                               | Command                                                                                 | Result                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Route + service (real Fastify inject, real service) | `cd backend && npx vitest run src/__tests__/order-deposit-liability.test.ts`            | 9/9, exit 0                                             |
| SQL migration twice, real Postgres engine           | `node scripts/pg/run-scenarios.mjs` with `SCENARIOS=…customer-advances-01-scenarios.ts` | `setup OK`, VERIFY all `true`, **ALL 6 PASSED**, exit 0 |
| Validation package                                  | `cd packages/validation && npx vitest run`                                              | 53 files / 799 tests, exit 0                            |
| Types                                               | `backend`, `packages/validation` `tsc --noEmit`                                         | clean                                                   |
| ESLint                                              | every changed file                                                                      | 0 errors                                                |

**Not done, on purpose**

`apply to a final invoice` (Dr customer advances / Cr receivable) and `refund`
(Dr customer advances / Cr cash|bank) change invoice/refund state and are their own slice. The deposit
is recorded correctly as a debt today; it is simply not settled yet. The device records a deposit but
books nothing locally (no local-ledger step) — a phase 11 gap, written down rather than hidden.
`docs/customer-advances-01-migration.sql` is **PENDING HUMAN CONFIRMATION**: it has not been run on the
owner's database.

## 12. Continuation 5 — 3 Nov 2026: P1 apply and refund, one transaction; refund reason mandatory (`IMPLEMENTED_NOT_LIVE_VERIFIED`)

The owner rejected «post the entry, then update the status»: a second statement that dies leaves a
posting with no settlement. Both operations are therefore a single Postgres function, called with
`.rpc()`, and reuse the existing Ledger, Payment and Invoice machinery instead of a parallel engine.

**What runs**

- `docs/order-deposit-apply-refund-01-migration.sql` adds three functions
  (`order_deposit_balance`, `order_deposit_apply`, `order_deposit_refund`), two append-only tables
  (`order_deposit_applications`, `order_deposit_refunds`) and three columns on `order_deposits`
  (`currency`, `posting_status` = `posted` | `pending_posting`, `journal_entry_id`). Everything is
  additive and idempotent; no row is deleted or rewritten.
- **Apply** locks the deposit `FOR UPDATE`, then the invoice, and refuses an unknown deposit, a
  receipt that never posted (`DEPOSIT_NOT_BOOKED` / `DEPOSIT_PENDING_POSTING`), an unknown or
  different currency, another customer's invoice, a draft/cancelled document, an invoice with no
  posted own entry, an amount over the invoice's real remaining balance, and an amount over the
  deposit's remaining balance. It then writes a `payments` row (direction `in`, method
  `order_deposit`), its `payment_allocations` row through `payments_record`, and one
  **Dr customer advances / Cr receivable** entry through `accounting_post_journal_entry`, keyed by
  the payment id.
- **Refund** is independent of any invoice: a `payments` row (direction `out`, no allocation) and
  **Dr customer advances / Cr cash|bank**. Apply + refund can never exceed what was received, and the
  unused part stays a Customer Advance.
- **Refund reason (owner Option B, 3 Nov 2026)** is mandatory: trimmed, 3..500 characters, validated
  in SQL and in the reusable domain schema, stored on `order_deposit_refunds.reason` and copied into
  `audit_logs.new_data` together with `actor_id`, `occurred_at`, amount, currency, `deposit_id`,
  `payment_id` and `journal_entry_id`. The refund route uses the canonical `payment.record`
  capability; no `payment.refund` exists. The old 11-argument function is **DROPPED**, so no caller can
  reach a version that skips the reason. A refund row is written only after the posted journal entry is
  re-read (`DEPOSIT_REFUND_NOT_POSTED` otherwise), in the same transaction. The same idempotency key
  with a different reason or amount is `DEPOSIT_IDEMPOTENCY_CONFLICT`.
- A repeated request with the same `idempotencyKey` (a body field) replays the first result; the same
  key on a different amount is `DEPOSIT_IDEMPOTENCY_CONFLICT`. The two UNIQUE indexes are the second
  line of defence.
- Cancelling the apply payment through the existing payments path deletes the allocation, which
  reopens the invoice, and the balance function stops counting it — the scenario proves it.
- Minor units are converted with `p_fraction_digits` (from `FRACTION_DIGITS`) plus a round-trip check:
  AFN books 12,345 as 12,345; USD books 12,345 as 123.45; a 3-decimal currency is refused, never
  rounded.
- `POST …/deposits/:depositId/post` re-posts a `pending_posting` receipt idempotently and flips the
  flag — the recoverable state, not a silent skip.

**Files**

`docs/order-deposit-apply-refund-01-migration.sql`, `docs/VERIFY-order-deposit-apply-refund-01.sql`,
`packages/validation/src/schemas/universal-core/order-deposit.domain.ts` (+ barrel),
`packages/validation/src/__tests__/order-deposit.domain.test.ts`,
`backend/src/services/sales/order-deposit.service.ts`, `backend/src/routes/order-deposit.routes.ts`,
`backend/src/utils/concurrency-safety-map.ts`,
`backend/src/__tests__/order-deposit-apply-refund.test.ts`,
`backend/src/__tests__/order-deposit-apply-refund-01.pg.test.ts`,
`backend/src/__tests__/helpers/order-deposit-apply-refund-01-scenarios.ts`,
`backend/src/__tests__/order-deposit-liability.test.ts`,
`packages/i18n/src/locales/{en,fa-AF,fa-IR}.json`,
`packages/ui/src/components/ui/invoice-detail/invoice-related-panel.tsx`.

**Evidence**

| Check                                                             | Command                                                                                                                                                                    | Result                                                                                                                         |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| SQL, migration twice, real function bodies extracted from `docs/` | `node scripts/pg/run-scenarios.mjs` with `SCENARIOS=…order-deposit-apply-refund-01-scenarios.ts`                                                                           | `setup OK`, VERIFY all true (12-arg signature, 12 columns, reason NOT NULL, reason check VALIDATED), **ALL 39 PASSED**, exit 0 |
| Route + service (real Fastify inject, real service)               | `cd backend && npx vitest run src/__tests__/order-deposit-apply-refund.test.ts src/__tests__/order-deposit-liability.test.ts src/__tests__/concurrency-safety-map.test.ts` | 3 files / 65 tests, exit 0                                                                                                     |
| Backend unit suite (pg files excluded)                            | `cd backend && npx vitest run --project unit --exclude "**/*.pg.test.ts"`                                                                                                  | 364 files / 5066 tests, exit 0                                                                                                 |
| Validation package                                                | `cd packages/validation && npx vitest run`                                                                                                                                 | 54 files / 833 tests, exit 0                                                                                                   |
| Types                                                             | `backend`, `packages/validation`, `packages/ui`, `apps/web` `tsc --noEmit`                                                                                                 | clean                                                                                                                          |
| ESLint                                                            | every changed file                                                                                                                                                         | 0 errors                                                                                                                       |

**Not proven / not done, on purpose**

- PGlite has one connection: two transactions contending for the same deposit row is **not** proven by
  it. `order-deposit-apply-refund-01.pg.test.ts` runs the scenarios on real PostgreSQL and races two
  connections; with the embedded binary absent it reports SKIPPED, never passed.
- No screen calls apply/refund yet (the existing `useOrderDeposits` hook has no consumer — a
  pre-existing gap). The device does not book or apply a deposit (no local ledger step) — an offline
  phase gap, written down rather than hidden.
- Migration status: **PENDING HUMAN CONFIRMATION**. Run
  `docs/customer-advances-01-migration.sql` first, then
  `docs/order-deposit-apply-refund-01-migration.sql`, and `docs/VERIFY-…` afterwards. Deploy the
  backend before the web app, since the service inserts the new columns.

---

## Continuation 6 — CC accounts (4.3) and credit-limit enforcement (4.4, OD-3 = C)

**4.3 Cycle count: separate shrinkage / gain accounts — `IMPLEMENTED_NOT_LIVE_VERIFIED`**

- Roles `inventory_shrinkage` (5210, expense) and `inventory_gain` (4910, revenue) added with names in
  three languages. The count journal is gross: shortage Dr shrinkage / Cr inventory, surplus Dr inventory /
  Cr gain (`countJournalLines`).
- Accounts are resolved, never guessed. Missing accounts => the count moves to `pending_accounts`, nothing is
  adjusted or posted. `provisionAccounts: true` creates the standard accounts and needs `account.manage`.
- Atomic finish is the new Postgres function `cycle_count_finish` (`docs/cycle-count-03-migration.sql` +
  `docs/VERIFY-cycle-count-03.sql`). PGlite scenarios: ALL 10 PASSED. Real PostgreSQL: BLOCKED_EXTERNAL.
- Without the function and with a journal to post the service answers `CYCLE_COUNT_MIGRATION_REQUIRED`
  instead of falling back to an unbalanced path.
- **Migration PENDING HUMAN CONFIRMATION.** Run after `cycle-count-02` and `customer-advances-01`, then
  `VERIFY-cycle-count-03.sql`. Deploy the backend first only if it is acceptable that a count with a journal
  answers `CYCLE_COUNT_MIGRATION_REQUIRED` until then.
- Fixed in passing: `offline-contract.test.ts` now documents `order_deposits`,
  `order_deposit_applications`, `order_deposit_refunds` (pull-only).

**4.4 Credit limit — `IMPLEMENTED_NOT_LIVE_VERIFIED` (server); UI override dialog NOT_IMPLEMENTED**

- `InvoiceService.create` now enforces the limit before a number is used up. Rule = the existing
  `evaluateCreditLimit`; exposure = Payments Core receivable + what this sale leaves owing, converted at the
  frozen invoice rate. Mode `block` refuses (409 `OVER_LIMIT` / `CASH_ONLY_CUSTOMER`).
- Passing the limit needs BOTH the permission `credit.override` (provisional name, manager minimum) AND a
  reason of at least 3 characters; permission alone or reason alone is refused; the pass is written to the
  invoice history as `credit_limit_overridden`. Off / warn modes, customers without a limit, non-sales,
  fully paid sales and import/system invoices are never refused.
- Missing columns (`credit_limit_mode`, `credit_limit`) fall back to `warn` / no limit; any other read
  failure throws (never "no limit").
- Files: `backend/src/services/credit-limit.ts`, `invoice.service.ts`, `routes/invoice.routes.ts`,
  `authorization.domain.ts`, `packages/local-engine/src/auth.ts`, `__tests__/invoice-credit-limit.test.ts`
  (18 tests).
- Not done: invoice-builder dialog that asks for the reason, offline `PENDING_CREDIT_VALIDATION`.

### Continuation 6b — credit limit: warn semantics and invoice override UI

- Server: `warn` and `block` both refuse an over-limit sale unless the caller holds `credit.override` and
  gives a reason (`warn` is what the SCREEN does; it never authorizes exceeding). `off` still skips.
  Behaviour change to announce: a workspace on the default `warn` with customer limits set now needs the
  override for over-limit sales (tests: `invoice-credit-limit.test.ts`, 18).
- UI: `credit-override-panel.tsx` + `invoice-preview-container.tsx`: the server's refusal opens a panel with
  a mandatory reason; the request is re-sent with `creditOverride.reason`; a permission refusal is shown as
  such. 3 locales (`invoiceBuilder.creditOverride.*`). Tests: `credit-override-panel.test.ts`.
- Still NOT implemented: offline `PENDING_CREDIT_VALIDATION` (local engine posts the invoice locally today),
  concurrent-invoice test on real PostgreSQL, 4.1 closure items (delta pull for `order_deposits`, backup
  tables, restart test, mobile, real-Postgres concurrency), 4.2 variants, 4.5–4.8.

### Continuation 6c — offline credit approval (PENDING_CREDIT_VALIDATION) and 4.1 verification

**What an offline over-limit sale does now** (design: the device NEVER decides the credit question — it holds
no per-customer limit and no authoritative receivable; the server decides on sync):

1. The device writes the sale and its outbox row as before (provisional local projection, temporary number).
2. On sync the server refuses it (409 `CREDIT_LIMIT_EXCEEDED` / `CASH_ONLY_CUSTOMER`). The engine stores a
   REFUSAL; nothing retries it alone; nothing is made on the server; the device keeps the sale whole.
3. `outbox-stage.ts` classifies that refusal as stage `credit_validation` ("waiting for credit approval"), the
   sync centre offers "Approve…" with a mandatory reason (min 3 chars).
4. The SAME clientId (= same Idempotency-Key) is queued again with `creditOverride.reason`; the server checks
   `credit.override` itself. Without it: `CREDIT_OVERRIDE_FORBIDDEN` → stage `rejected`, sale still kept.
5. A duplicate delivery of an approved sale returns the existing invoice (idempotent replay).
   Files: `packages/app-shell/src/features/sync/{outbox-stage,sync-page}.ts(x)`, `app/providers.tsx`,
   `shared/i18n/desktop-strings.ts`, `packages/i18n/src/locales/{en,fa-IR,fa-AF}.json`.
   Tests (real sync engine, stubbed network + outbox): `credit-validation.test.ts` (9).

**Known limits, not hidden**

- The device's provisional projection of a credit-refused sale (local journal, local stock) stays on the device
  until approval or manual removal; device-side reports include it. Not changed in this round.
- Same-instance serialization only: `backend/src/utils/keyed-lock.ts` orders sales of one customer inside one
  backend process (`InvoiceService.create` → `createUnserialized`). Across instances the stale-read race needs a
  database advisory lock in the invoice transaction — NOT implemented. Real two-connection concurrency tests:
  `BLOCKED_EXTERNAL` (no PostgreSQL binary on this machine; embedded-postgres `.exe` files missing).
- Not implemented: credit-note / payment-allocation interleaving tests on real PostgreSQL.

**4.1 re-verified (not rebuilt)**: delta pull of `order_deposits` + both movement tables exists in
`sync-engine.ts` (with own-echo suppression); tests `deposit-pull.test.ts`, `order-deposit-sync-pull-device`,
`order-deposit-backup-restore`, `order-deposit-restart` (real on-disk database, closed and reopened),
mobile `order-deposit-parity` (expo-sqlite adapter vs node:sqlite). New: `order-deposit-cancellation.test.ts`
(order status is not an input; no delete; no cancellation fee path). Fixed two stale tests found red:
`sync-pull.test.ts` (unknown snapshot entity `order_deposits`), `migrations.test.ts` (hard-coded schema version 9).
NEEDS_OWNER_DECISION: retaining a cancellation fee from a deposit (no code path exists; refund is full).

### Continuation 7 — variant binding (P2 slice) and tamper-evident audit chain (4.7)

**P2 variants — `IMPLEMENTED_NOT_LIVE_VERIFIED`, PARTIAL (invoice line only)**

- `checkVariantBinding` (`variants.domain.ts`): product with active variants must name one; variant must exist, belong to
  the product and workspace, be active; a product without variants is sold as itself; historical rows are never re-checked.
- `invoiceItemSchema.variantId`, route mapping (`invoice.routes.ts`), `InvoiceService.assertVariantBindings` (one read for all
  lines, before a number is used), `variant_id` written to the line only when present.
- Migration `docs/variant-binding-01-migration.sql` (+ `VERIFY-variant-binding-01.sql`): nullable `invoice_items.variant_id`,
  NOT VALID foreign key, partial index; nothing backfilled. **PENDING HUMAN CONFIRMATION.**
- NOT IMPLEMENTED: stock per variant (stock is per product/warehouse — a variant sale moves the PARENT's stock, so no double
  counting, but there is no variant-level stock), purchase lines, returns, supplier returns, adjustments, POS, local engine,
  sync payload, UI selectors, valuation per variant. These need a stock-key design decision before code.

**4.7 Audit chain — `IMPLEMENTED_NOT_LIVE_VERIFIED`**

- `docs/audit-hash-01-migration.sql` + `VERIFY-audit-hash-01.sql`: BEFORE INSERT trigger numbers each workspace's rows,
  stores `prev_hash` and `hash` (sha256 over a canonical jsonb array of explicit fields), serialised per workspace by a
  locked head row; `audit_chain_verify(ws)` names `HASH_MISMATCH | BROKEN_LINK | MISSING_RECORD | TAIL_REMOVED`;
  `audit_chain_head(ws)` is the value to export as a trust anchor. Legacy rows are counted, never rewritten.
- PGlite: 16 scenarios PASSED (`PGLITE_VERIFIED`). Real two-connection race: `audit-hash-01.pg.test.ts` — `BLOCKED_EXTERNAL`.
- `AuditService.verifyChain` now asks the database. The old check treated rows with no hash as fine and answered "verified"
  for a table nobody had ever chained; a database without the migration now answers `migrationRequired`, never verified.
- `GET /api/audit/verify` now needs `workspace.manage` (was `report.operational.read`).
- Threat model: detects edits, forged hashes, broken links, removed middle rows and removed newest rows. Does NOT stop an
  operator who recomputes the whole chain and rewrites the head. OWNER DECISION: where the exported head lives.
- No UI shows the verdict yet (`useVerifyAuditLog` is typed but has no screen).

**Not started in this continuation:** 4.6 Store/Teacher/adaptive onboarding, 4.8 branch/device restrictions, OD-4 order WIP,
consolidated invariant suite. 4.5 D4 was reviewed, not extended: workspace profile service/routes/hook exist and four screens
read it; only `variants` and `auto_fitments` routes carry a profile guard.

**Build/verify results:** see the final report of this turn (web build OK; desktop build blocked by an esbuild temp-file
"Access is denied" on this machine).

### Continuation 8 — Phase H (invariants + audit verdict UI), Phase D guards, Phase C structured credit refusal

**Baseline re-measured (Phase A), real numbers:** backend `371 files / 5152 tests / exit 0`; validation
`55 files / 841 tests` (the one red, `industry-coverage-table`, was stale generated docs — regenerated, now green);
local-engine `69 / 499 / exit 0`; ui `199 files / 2576 tests, 1 failed` (`seo-public-pages` sitemap, not ours),
2 skipped; desktop jest `34 suites / 320 tests, 2 failed` (the two build-dependent suites), 10 failed tests;
mobile jest `18 suites / 212 tests / exit 0`.

**Phase H — audit verdict UI — `IMPLEMENTED_NOT_LIVE_VERIFIED`**

- `AuditService.verifyChain` also reads `audit_chain_head(ws)` (never recomputes a hash in TypeScript) and returns
  `head: { seq, hash } | null`. Missing migration → `head: null`; any other read failure throws.
- `AuditIntegrityCard` (owner only; hidden on 401/403) shows verified with the checked count, broken with
  `failedAtSeq` + reason, and `migrationRequired` as its own state — never «verified»; it prints the head with
  `copyText` and states the limitation. `useVerifyAuditLog` is now exported and consumed.
- 17 keys × fa/af/en. Tests: `audit.test.ts` 11/11, `audit-integrity-card.test.tsx` 4/4.

**Phase H — consolidated invariants — `IMPLEMENTED_NOT_LIVE_VERIFIED`**

- `backend/src/__tests__/v53-financial-invariants.test.ts` 11/11: over-apply/over-refund/one balance, overspent ≠
  zero, fractional/oversized refusal, refund reason 3..500, currency precision (AFN 0, USD 2, IQD 3, unknown null),
  `numeric(18,2)` third decimal refused, balanced/reversed deposit journals, credit block/warn/boundary/cash-only/
  unlimited/off, variant required/identity/wrong workspace/wrong product/inactive.
- The DB half (two concurrent refunds, rollback on posting failure) remains in the skipped `*.pg.test.ts` +
  PGlite scenario files: `BLOCKED_EXTERNAL`.

**Phase D — guarded routes + proof — `PARTIALLY_IMPLEMENTED`**

- New guards: `PUT /api/products/:id/units` → `multi_unit`, `POST /api/warranties` → `serialized_items`.
- `workspace-profile.test.ts` is table-driven over every guarded route (undeclared passes; declared-without → 403
  `CAPABILITY_NOT_ENABLED` and the service is not called; declared-with passes; missing permission → 403 anyway),
  plus a new test proving a profile change reaches `workspaces` and no other table. 27/27 with
  `workspace-guard-order`.
- `unwired-capability-hooks.test.ts` 4/4: every universal-core hook is either consumed by a screen or listed with a
  reason, and a listed capability must not be `available`.
- NOT DONE: one terminology helper for nav/title/breadcrumb; the offline profile is the local workspace row pulled
  with the session, not its own sync entity.

**Phase C — structured credit refusal — `IMPLEMENTED_NOT_LIVE_VERIFIED`**

- `BaseError.context` travels in the error body (`context`), the message unchanged. The credit refusal sends
  `{ code, limit, exposure, excess, projected, currency }`; the override panel prints limit / current debt /
  projected total in the books currency with locale digits, and invents nothing when an older server omits them.
- Tests: `invoice-credit-limit` 17/17, `credit-override-panel` 6/6.
- NOT IMPLEMENTED: cross-instance advisory lock; local `credit_pending` marker, exclusion from device «final»
  reports and «cancel this sale».

**Phases B, E, F, G: `NOT_IMPLEMENTED`** — variant stock end-to-end, device/branch scope, order WIP and the
Store/Teacher journeys each need a migration plus a cross-cutting change (local schema bump, new tables, new
accounts). None was started rather than half-built.

**Migration run order for the owner (each followed by its `VERIFY-*.sql`):** `customer-advances-01` →
`order-deposit-apply-refund-01` → `cycle-count-02` (applied) → `cycle-count-03` → `variant-binding-01` →
`audit-hash-01`. `variant-stock-02`, `device-scope-01` and `wip-01` are not written yet.

### Continuation 8 — final verification (measured on this machine)

Measured, not inferred. Commands and their real output:

| Area                | Command                                                                                                                                                                                       | Result                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| backend unit        | `cd backend && npx vitest run --project unit --maxWorkers=4`                                                                                                                                  | **372 files / 5176 tests / exit 0**, 142.79s                                                                       |
| backend (V53 files) | `npx vitest run --project unit src/__tests__/audit.test.ts src/__tests__/workspace-profile.test.ts src/__tests__/v53-financial-invariants.test.ts src/__tests__/invoice-credit-limit.test.ts` | 4 files / 65 tests / exit 0                                                                                        |
| validation          | `npx tsc --noEmit && npx vitest run`                                                                                                                                                          | tsc clean; **55 files / 841 tests / exit 0**                                                                       |
| ui                  | `npx tsc --noEmit`; 6 relevant test files                                                                                                                                                     | tsc clean; 30/30                                                                                                   |
| api                 | `npx tsc --noEmit`                                                                                                                                                                            | clean                                                                                                              |
| web                 | `cd apps/web && npx next build`                                                                                                                                                               | exit 0 · compiled 33.8s · 131/131 static pages                                                                     |
| generators          | three `--check` runs                                                                                                                                                                          | coverage-table OK (118 rows) · industry-diff OK · capability-matrix OK (513 rows)                                  |
| audits              | `verify-spec-references.mjs`, `audit-unwired-routes.mjs`                                                                                                                                      | 47 docs / 849 refs / 333 symbols / 0 unbacked · 840 routes / 650 client strings / 118 with no caller · both exit 0 |
| lint/format         | `eslint`, `prettier --check`, `git diff --check`                                                                                                                                              | 0 errors · clean · clean                                                                                           |

**The one honest wrinkle — the 5000ms budget.** With the default worker count the backend suite failed 1–5 tests per
run in four consecutive runs (read-error-not-404, referral-programme ×2, supabase-fetch-metrics,
http-failure-diagnostics, ledger-batch-idempotency). Every failure was literally `Error: Test timed out in 5000ms.`
— no assertion failed, and each file is green when run alone. With `--maxWorkers=4` the **whole** suite is green and
_fast_ (142.79s against 184.26s), so the machine, not the code, was saturated. No timeout was widened and no test was
skipped to get there. Recommended command for this machine is in `testCommands.backend`.

**Two guard tests repaired (assertions untouched).** `industry-coverage-table` had gone stale because three test files
were added after the table was regenerated — regenerated, 6/6. `unwired-capability-hooks` re-read four source trees
once per hook and crossed 5s on a cold cache; it now reads each file once and matches in memory (8.3s → 0.29s), same
assertions, 4/4.

**Not run, and why.** Every `*.pg.test.ts` (`BLOCKED_EXTERNAL`: `embedded-postgres` windows-x64 ships 29 DLLs and
0 `.exe`, so `postgres.exe` never spawns). Desktop renderer build (`vite:esbuild-transpile` → `Access is denied` on a
temp file; two build-dependent desktop jest suites stay red). Mobile shell build: mobile was not touched.
