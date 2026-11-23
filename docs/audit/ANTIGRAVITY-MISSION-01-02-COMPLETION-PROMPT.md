# ANTIGRAVITY — COMPLETION PROMPT

## Mission 01 (Universal Business OS) + Mission 02 (Forensic Financial Repair)

**Paste this entire file into Antigravity as the task.**

**FIRST INSTRUCTION — read before anything else:** you may read a file once and edit it once. Do not walk
a file in slices (`#L480-505`, then `#L520-535`, then `#L1200-1207`), and do not send repeated `+1 -0`
edits to the same path. Whole-file read → complete change list → one edit operation → next file. §0.1 is
binding; a transcript that violates it is a failed run, even if the code compiles.

---

## ROLE

You are the Staff/Principal Engineer responsible for finishing Hisabche — a Persian/Dari accounting and
ERP product (pnpm + Turborepo; Fastify backend; Next.js web; Electron Windows; Expo Android; shared UI,
validation, formatting, API-hook and local-engine packages).

You are continuing work that is already in the repository. Two governing documents define the scope:

- `docs/audit/HISABCHE-MISSION-01-UNIVERSAL-BUSINESS-OS.md` — breadth: one shared business core, unified
  party model, DNA/capability resolution, industries, dashboards/KPIs, platform parity, monitoring,
  migrations, tests.
- `docs/audit/HISABCHE-MISSION-02-FORENSIC-REPAIR.md` — depth: party identity, purchase/supplier flows,
  advances, atomicity, money precision, reporting, pagination, security, offline parity.

This file is the **execution order and the current verified state**. Where this file states a fact with a
`file:line`, that fact was checked at HEAD `f0a69b9b` on 22 Nov 2026. Where it says «verify», it was not
checked and you must confirm it in source before acting.

`AGENTS.md` is authoritative over every document here, including this one.

Mission priority: **Mission 02 P0 financial defects first**, then Mission 02 P1, then Mission 01 breadth
work. A universal business OS built on a wrong ledger is worthless.

---

## 0. ABSOLUTE RULES (a violation is a failed task)

1. Never `git commit`, `git push`, `git reset`, `git rebase`, `git stash`, `git checkout -- <file>`, or
   `git clean`. The owner commits and pushes.
2. Never revert, overwrite or "tidy" existing dirty working-tree changes. They are owner/agent work in
   progress. Read them, build on them.
3. Never read, print, modify or expose `.env*` files or any secret.
4. Never run DDL or any write against live Supabase. You author files only:
   `docs/<name>-migration.sql` + `docs/VERIFY-<name>.sql`. A human runs them.
5. Never install, upgrade, remove or add a dependency. Never touch a lockfile. Never change Expo SDK,
   React Native, or enable New Architecture.
6. Never run a production build (`next build`, electron-builder, Gradle) unless this prompt names it. It
   does not.
7. Never execute anything under `C:\Users\hamed\AppData\Local\Python\`. Do not download or execute
   software. Do not change OS or antivirus settings.
8. Never introduce `any`, `@ts-ignore`, `eslint-disable`, dead code, unused imports, fake APIs, mock
   production data or placeholder UI. `exactOptionalPropertyTypes` is on: write `prop?: string | null`.
9. Never weaken, skip or delete an existing test to make a new one pass. If a guard test goes red, the
   rule it guards is what must be satisfied. If you believe the guard is wrong, stop and say so.
10. Never create a second accounting, payment, inventory, costing, KPI, money, capability, terminology or
    sync engine. Extend the canonical owner listed in `AGENTS.md` §2.
11. Never use a compensating `DELETE` as a transaction. supabase-js has no transactions — multi-table
    writes are Postgres functions called with `.rpc()`.
12. Never claim a migration was applied, a PostgreSQL test passed, or a device was verified without
    executing it. Use `PENDING HUMAN CONFIRMATION`.
13. Never edit a file this work does not require. No drive-by refactors, no reformatting a file you did
    not functionally change. `prettier --write` only on files you edited, named one by one.
14. All user-facing text: Persian communication, and every UI string in **fa, af, en**. All code,
    identifiers, comments, tests and technical docs: English.
15. Read each file once, edit each file once (§0.1). Fragment reads and repeated one-line edits on the
    same path are a failed task, even when the code compiles.

---

## 0.1 READ-ONCE / WRITE-ONCE — the strictest rule in this prompt

The owner's transcript shows the failure mode this section exists to stop:

```
Analyzed  invoice.service.ts #L480-505
Analyzed  invoice.service.ts #L520-535
Analyzed  invoice.service.ts #L1200-1207
Edited    invoice.service.ts  +1 -0
Edited    invoice.service.ts  +1 -0
```

Three slice-reads and two one-line edits on one file. That run is rejected: it burns context, produces
edits that contradict each other, and hides the real change from review. Do not reproduce it.

### The protocol, per file

1. **Read the file once, whole.** A file under 800 lines is read in ONE call, start to finish. A larger
   file is read in ONE batch containing every range you need — all ranges requested together, never one
   after another. Never open a file "to look around".
2. **Write the change list before touching it.** In your reasoning, list every edit for that file with its
   anchor: import, type, field, validation branch, service branch, route handler, test. If the list is
   incomplete, you are not ready to edit.
3. **Apply the whole list in ONE edit operation.** One multi-part edit, or one full-file write when more
   than ~30% of the file changes. Not two edits, not "one for the import and one for the body".
4. **Do not re-read to confirm.** The edit tool confirms success; `tsc` and the tests are the check.
   Re-read ONLY the failed range, and only when an exact-match edit reports no match — a formatter may
   have rewritten the file after save.
5. **Move on** to the next file with the same protocol.

### Batching

- Finish every edit of a work package, THEN run `tsc`, THEN the tests. Never `tsc` after each file.
- The same change across many files = one Node script (`Write` the script, run `node file.mjs`) that
  asserts the match count of every replacement, insertions included. One run, one report.
- Never edit backend source while a `vitest run` is in progress.

### Known-large files in this mission — batch their ranges, do not walk them

`backend/src/services/invoice.service.ts` (~1 400 lines), `backend/src/services/sales/order-deposit.service.ts`,
`backend/src/services/payments/payments.service.ts`,
`packages/ui/src/components/ui/invoice-builder/containers/invoice-builder-container.tsx`,
`packages/app-bridge/src/local-migrations.ts`.
For these, request every needed range in ONE batch — for `invoice.service.ts` typically the import block,
the create/validation region, the party-resolution helpers and the list/filter region — then make a
single edit call.

### Self-check before every edit call

- Have I read this file whole, or all its needed ranges in one batch? If no — read; do not edit.
- Do I have the complete change list for this file? If no — plan; do not edit.
- Is this my second edit call on this file? If yes — stop. Fold it into one operation, or state the
  concrete reason the file genuinely needs a second pass (a formatter rewrote it, or the first edit
  revealed a compile error in a different region).
- Am I touching a file this work package does not need? If yes — stop.

### Reporting

`files edited: N, total edit operations: M`. M must be close to N. If M > N + 2, explain every extra pass
in the final report. A transcript that shows `Edited <same path> +1 -0` more than once is an automatic
finding against the change, and you must say so instead of calling it complete.

---

## 1. PREFLIGHT — establish truth before the first edit

Run and record the real output:

```bash
git rev-parse --short HEAD          # expected f0a69b9b
git status --short                  # 22 entries expected; see §2.2
pnpm code-intel status              # record FRESH / STALE / unavailable
```

Then read: `AGENTS.md`, `CLAUDE.md`, `docs/ai/CODE-INTELLIGENCE-WORKFLOW-GUIDE.md`,
`docs/architecture/OUTCOME-DRIVEN-INTEGRITY-STANDARD.md`, `.claude/DARI-GLOSSARY.md`, and the two
mission documents named above.

Use code intelligence (`pnpm code-intel symbol|callers|callees|impact|source`) before editing an existing
service. If the index is unavailable or stale, say so and fall back to scoped `rg`, never to a wide
repository sweep.

If HEAD differs from `f0a69b9b`, do not revert anything. Re-run the checks in §2 against the actual code
and continue; state the difference in the final report.

---

## 2. CURRENT VERIFIED STATE

### 2.1 Already implemented — do NOT rebuild

| Area                                                | Evidence                                                                                                                                                     | Action                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Service sessions: owner/participants/free-text type | `docs/service-delivery-05-session-subject-participants-migration.sql`, `docs/VERIFY-service-delivery-05-session-subject-participants.sql`                    | verify only                                            |
| Service offering optional                           | `docs/service-delivery-06-optional-service-offering-migration.sql`, `docs/VERIFY-...-06...sql`, `backend/src/__tests__/service-delivery-06.pg.test.ts`       | verify only                                            |
| Local schema v37 + participants table               | `packages/app-bridge/src/local-schema.ts:15` (`SCHEMA_VERSION = 37`), `packages/app-bridge/src/local-migrations.ts:953` (`V37_SESSION_SUBJECT_PARTICIPANTS`) | verify only                                            |
| Session participants read path                      | `backend/src/services/service-delivery/service-delivery.service.ts:139-238` (participant rows joined per session)                                            | verify only                                            |
| Invoice header accepts supplier id                  | `backend/src/services/invoice.service.ts:1204-1205` (`customer_id: data.customerId \|\| null`, `supplier_id: data.supplierId \|\| null`)                     | do not "fix" this line                                 |
| Invoice validation accepts `supplierId`             | `packages/validation/src/schemas/invoice.schema.ts:330`                                                                                                      | extend, don't duplicate                                |
| Purchase label in the party panel                   | `packages/ui/src/components/ui/invoice-builder/customer-panel.tsx:96,143-144,192-193`                                                                        | the label exists; the data source does not — see WP-02 |
| Replay-safe business events (session, advance)      | `logBusinessEvent` call sites in service-delivery / order-deposit services                                                                                   | extend to remaining domains, WP-16                     |
| Invoice list table includes advances                | invoice list row/view/container files                                                                                                                        | verify, then close the pagination gap in WP-10         |

### 2.2 Dirty working tree — do not revert

`AGENTS.md`, `CLAUDE.md`, `backend/src/__tests__/service-delivery-http.test.ts`,
`backend/src/routes/invoice.routes.ts`, `backend/src/services/service-delivery/service-delivery.service.ts`,
`packages/api/src/hooks/universal-core.ts`, `packages/i18n/messages/{af,en,fa}/common.json`,
`packages/ui/src/components/ui/service-delivery/*`, `packages/validation/src/__tests__/service-delivery.domain.test.ts`,
`packages/validation/src/schemas/invoice.schema.ts`,
`packages/validation/src/schemas/universal-core/service-delivery.domain.ts`,
plus untracked `backend/src/__tests__/helpers/service-delivery-06-scenarios.ts`,
`backend/src/__tests__/service-delivery-06.pg.test.ts`, `docs/VERIFY-service-delivery-06-optional-service-offering.sql`,
`docs/service-delivery-06-optional-service-offering-migration.sql`,
`packages/ui/src/__tests__/service-session-create-dialog.test.tsx`,
and the two mission documents.

### 2.3 Verified-open defects (P0 first)

**D-1 — Pre-purchase validates the supplier against `customers` and stores it as a customer.**
`backend/src/routes/order-deposit.routes.ts:214-222` selects from `customers` for both kinds, then
`:227` passes `customerId: body.partyId`. `backend/src/services/sales/order-deposit.service.ts:68` types
the field `customer_id: string`, `:497` writes `customer_id: input.customerId`, while `:104` already
knows `pre_purchase` is `supplier_advances`. Result: a supplier advance is a customer advance with a
supplier's id in `customer_id` — any statement, aging or refund that reads it is wrong.

**D-2 — Invoice creation refuses a credit purchase that has a supplier but no customer.**
`backend/src/services/invoice.service.ts:1127` throws `INVOICE_CREDIT_NEEDS_PARTY` when `customerId` is
missing, regardless of `type`. A purchase on credit with a valid `supplierId` is rejected; a cash
purchase with neither party is accepted.

**D-3 — No supplier selection exists in the invoice builder.**
`packages/ui/src/components/ui/invoice-builder/customer-panel.tsx` labels the field «تأمین‌کننده» for
purchase, but the control is `CustomerPicker` (`packages/ui/src/components/ui/customer-picker.tsx:7,60`
— `useCustomers` only). `packages/ui/src/components/ui/invoice-builder/containers/invoice-builder-container.tsx`
never references `supplierId`; no `*supplier-picker*` component exists. So `supplier_id` is always null
for a purchase made in the UI.

**D-4 — Supplier 360 truncates lifetime figures.**
`backend/src/services/supplier/supplier.service.ts:204` reads `.limit(100)`, then `:226` sets
`purchaseCount: rows.length` and `purchasedValue:` the sum of those rows. A supplier with 101 purchases
reports 100 and an incomplete lifetime value.

**D-5 — Customer-only governance on purchase creation.** Verify and fix each:
`assertWithinCreditLimit` (`invoice.service.ts:1137-1150`) receives only `customerId`;
`verifiedCustomerName` / party-name resolution (`:1030`, `:892-898`) resolves only a customer; list
filters, printed document and detail view must show the supplier for a purchase. Branch on `type`, never
on "which id happens to be present".

### 2.4 Reported, not yet confirmed here — verify in source before changing

- `OrderDepositService.listAdvances()` calls `order_deposit_balance` once per row (N+1). Confirm the
  call site and the RPC, then batch it.
- Multiple payment entries collapsing into the first payment method on invoice creation.
- Supplier/customer monthly activity sharing one function that counts sales for a supplier.
- Invoice + advance cross-source pagination: the UI merges one invoice page with an unpaginated advance
  list and therefore cannot show an honest combined count.
- Advance receipt timing (liability at receipt vs. at finalisation) — **owner decision, do not change.**

---

## 3. WORK PACKAGES

Execute in the order given. Each package is finished only when its acceptance tests exist and pass, its
i18n keys exist in fa/af/en, and its evidence is recorded.

### WP-01 — Party contract truth table (P0, no code change beyond doc + guards)

Produce `docs/architecture/PARTY-CONTRACT.md`: one page, generated from the migration SQL (not memory),
stating for `customers`, `suppliers`, `invoices`, `payments`, `payment_allocations`, `order_deposits`,
`purchase_orders` — which column identifies which role, its nullability, its FK, and the invariant every
write path must satisfy. Include the rule: **a role is set by the document kind, never inferred from
whichever id is non-null**, and a supplier id must never enter a `customer_id` column.

Acceptance: every write path listed in §2.3 cites the truth table; a grep list of every place a
`customerId`/`supplierId` is written or read is attached to the document; the two known violations (D-1,
D-3) are closed or explicitly blocked.

### WP-02 — Purchase invoice selects a real supplier (P0)

- Extend **one** picker. Prefer adding a `partyType`/`source` prop to `customer-picker.tsx` (supplier
  query via the existing supplier hook) over creating a second component; if the existing component
  cannot be extended without breaking sale flows, justify it in the report before adding one.
- Wire `supplierId` end to end: builder state/store → payload → `POST /api/invoices` → header `supplier_id`
  (already mapped) → detail → list → search/filter → print/PDF → navigation.
- Branch server governance on document kind: credit check (D-2), credit limit (D-5), party-name resolution,
  statements.
- Refuse wrong-role parties explicitly: `INVOICE_PARTY_WRONG_ROLE` (sale with a supplier id, purchase with
  a customer id) instead of silently ignoring the field.
- Keep multi-party participants working for sales; for purchases only the supported relationship.

Acceptance (HTTP inject): purchase + supplier only + unpaid → 201 and `supplier_id` persisted;
purchase + customer only → 4xx `INVOICE_PARTY_WRONG_ROLE`; purchase + supplier from another workspace →
4xx; sale unchanged (existing sale tests still green); printed/list row shows the supplier name.

### WP-03 — Supplier payments (P0)

Payment direction `out`, `party_type = 'supplier'`, `party_id` = the real supplier, allocations against
the intended purchase invoice. Do **not** change the working `openInvoicesFor` party-column rule
(`customers.customer_id` vs `supplier_id`) — fix the caller and the data contract.

Acceptance: a partial supplier payment produces one payment, one allocation, the correct ledger
direction, the supplier statement line, the reduced outstanding balance, and an aging bucket that matches
the allocation. A second payment allocates to the remainder, not to the same invoice twice.

### WP-04 — Pre-purchase party identity end to end (P0)

- Additive migration: `docs/advances-04-party-identity-migration.sql` (+ VERIFY + PG test). Model the
  party explicitly (`party_type` + `party_id`, or `customer_id`/`supplier_id` + CHECK) — do not guess.
  Classification: `ADDITIVE` + `DATA_BACKFILL` only if a deterministic mapping exists; otherwise
  `POTENTIALLY_LOCKING`/historical-unresolved and no backfill.
- Before any constraint: a read-only `docs/FINDING-advances-party-identity.sql` counting rows where a
  `pre_purchase` row's id is not a supplier of the same workspace. Never invent the mapping. Unresolved
  historical rows must be excluded from statements/aging and reported, not silently re-pointed.
- Update: route validation (supplier for `pre_purchase`, customer for `pre_sale`), service types,
  `applyDeposit`/refund/convert party checks (same workspace, same role, same currency), balance queries,
  activity/audit metadata, local-engine schema + route, sync pull/push payloads, API hooks, UI form, cache
  invalidation.

Acceptance: `POST /api/advances` with `kind=pre_purchase` and a customer id → 4xx; with a supplier id →
201 and the supplier persisted in the supplier column/role; refund and apply refuse a mismatched party;
offline create → sync → server keeps the same party identity.

### WP-05 — Document lifecycle vs. money lifecycle vs. advance usage (P0)

Separate document state (draft / awaiting approval / finalised / cancelled) from payment state
(unpaid / partial / paid / refunded) and from advance usage (unused / partial / applied / refunded). An
unpaid pre-invoice must be representable **without** creating a zero-value payment, cash movement or
journal entry. Do not force an advance record when no money moved.

**Stop condition:** the accounting timing of an advance receipt (liability at receipt vs. at
finalisation) is an `OWNER_DECISION`. Implement the separation and the proforma path; do not change the
receipt posting policy.

### WP-06 — Multi-method payments (P0)

Verify the collapse in source, then model per-tranche `method` + `amount` so cash + bank, cash +
transfer and multiple transfers stay distinct through allocation, ledger, till and bank reconciliation.
Never attribute an aggregate to one method. The server derives amounts; the client total is not authority.

Acceptance: one invoice, two tranches (cash + bank) → two payment rows, two ledger effects with the right
accounts, till only sees the cash tranche, invoice `paid_amount` equals the sum of allocations, replay
produces no duplicates.

### WP-07 — Atomic finalisation and idempotency (P0)

Invoice + its creation tranches must commit together through a Postgres function; per-tranche stable
idempotency keys; replay returns the same result; a retry never leaves an invoice with a missing tranche,
allocation, journal entry or stock movement. `paid_amount` stays derived from allocations. Never accept a
client `paid_amount` as authority.

Acceptance (real PostgreSQL): inject a failure after the header and prove nothing persists; send the same
request twice and prove one document; send a different amount with a reused key and prove a 4xx.

### WP-08 — Money and currency precision (P0/P1)

Use the canonical catalogue (`fractionDigits`). Audit every `* 100`, `/ 100`, `round2`, `minor`,
`majorToTillMinor`, `tillMinorToMajor` and hardcoded `2`; classify each as an internal unit contract or a
real defect. AFN/IRR/IRT/PKR are 0-digit; USD 2. Never sum across currencies; never use an implicit rate
of 1.

Acceptance: 0-, 2- and 3-digit currencies, negative reversal, rounding boundary and a large amount, each
through invoice → payment → allocation → ledger → UI `Money`. A guard test fails if a hardcoded
`/ 100` is reintroduced on a money path.

### WP-09 — Reporting and party ledger integrity (P1)

Fix D-4 with a real count/aggregate (no `.limit` feeding a lifetime number). Verify supplier monthly
activity does not count customer sales. Rules: sales and purchases never merged into one ambiguous total;
receipts and payments separated; correct receivable/payable direction; opening balances included; returns
reverse the original; cancelled documents excluded from active debt; a failed read throws, never renders
as zero; unknown stays `null`, never `0`.

Acceptance: supplier with > 100 purchases reports the true count and value; a supplier statement over a
month boundary matches hand-computed totals; an unreadable aggregate shows «cannot be calculated».

### WP-10 — Pagination, counts and N+1 (P1)

Replace per-row balance RPCs with a batch query or aggregate. Any total or KPI that a person decides on
must not come from one page. Invoice + advance cross-source listing must either gain a real union endpoint
with server pagination and count, or stop claiming a combined count in the UI — do not fake it.

Acceptance: > 100 and > 1 000 rows, empty and last page, concurrent insert, duplicate sort value; record
the round-trip count before/after.

### WP-11 — Dates, timezone, null and errors (P1)

Separate business document date, UTC timestamp, due date and audit timestamp using the existing local-day
helpers. Audit empty catch blocks: formatting may recover from `Intl`; money, ledger, inventory, sync and
security failures must surface. A failed read must never become "no records", a pending state must never
render as posted.

### WP-12 — Inventory, costing and document effects (P0/P1)

One movement per source document; approval-held invoice moves no stock until approval; cancellation and
rejection reverse exactly once; a purchase advance adds no stock; a purchase invoice never receives stock
twice; a sale never consumes twice; every movement names its source document. Use the shared costing
core — never price from `products.buy_price` at sale time.

Acceptance: finalise purchase → one receipt movement; cancel → compensated reversal with balanced
balances (assert balances, not row counts); held sale → no movement until approval, then exactly one.

### WP-13 — Security, tenancy and database functions (P0)

For every advance/deposit/lock RPC: `SET search_path = public, pg_temp`, `REVOKE EXECUTE FROM PUBLIC,
anon, authenticated`, workspace taken from the session/membership, row locks scoped by workspace, FK
ownership verified, cross-workspace references rejected, idempotency unique per workspace. Every tenant
table read filters `workspace_id`; every insert carries it; role comes from `request.tenancy.role`.

Acceptance: real-PostgreSQL cross-workspace tests that must fail for invoice, payment, advance, allocation
and refund.

### WP-14 — Offline, sync and platform parity (P0)

Path to prove: UI → domain command → local DB → outbox → API → Postgres → change log → pull → reconcile.
Stable mutation ids, idempotent retries, workspace-scoped cursor, no LWW for financial rows, no silent
deletion, no stale snapshot overwriting newer local state. Confirm the session owner/participant/type
fields and the advance party identity exist in the local schema, the pull mapping and the payloads —
raise the local schema version only if a column or table is genuinely missing (an additive migration +
`SCHEMA_VERSION` bump + upgrade path from the previous version).

Acceptance: create offline → restart the app → outbox still present → sync → one server row; replay the
same mutation → no duplicate; two devices, one stock conflict → conflict classified, not silently lost.

### WP-15 — Session slice verification (no rebuild)

Confirm: 05/06 migrations and VERIFY match the code; `service_delivery_sessions` allows an employee
session and enforces exactly one subject; participants table has workspace/session consistency, unique
(session, person) and RLS; `session_type` trims to 1..120; deliver refuses `undecided` settlement; an
employee session cannot settle from a customer package and returns `SETTLEMENT_CUSTOMER_REQUIRED`;
pull mapping covers `employee_id`, `session_type` and the participants entity; the create dialog test
covers customer, employee and multiple participants. Fix only real mismatches.

### WP-16 — Mutation-event coverage (P1)

Extend `logBusinessEvent` with replay-safe keys to the domains still missing: repair jobs, salon
appointments, customer create/update, product create/update, contracts, deposit apply and refund. Update
`docs/audit/HISABCHE-MUTATION-EVENT-COVERAGE.md` with the before/after matrix. A duplicate delivery of
the same event must not create a second row.

### WP-17 — Documentation and ledger (P1)

Update existing canonical documents — do not create parallel reports:
`docs/audit/HISABCHE-MIGRATION-LEDGER.md` (or the current ledger), `HISABCHE-MUTATION-EVENT-COVERAGE.md`,
`HISABCHE-CROSS-DOMAIN-INTEGRITY-AUDIT.md`, `HISABCHE-INDUSTRY-CAPABILITY-REGRESSION-MATRIX.md`,
`HISABCHE-REMEDIATION-VERIFY.md`, plus the two mission documents with an execution log section.
Every finding keeps its original ID and gets exactly one status.

---

## 4. VERIFICATION GATES

Run from the package you changed; report the real command, exit code and counts.

```bash
cd backend      && npx tsc --noEmit && npx vitest run
cd packages/ui  && npx tsc --noEmit && npx vitest run
cd packages/validation && npx tsc --noEmit && npx vitest run
cd packages/api && npx tsc --noEmit
cd apps/web     && npx tsc --noEmit
npx eslint <each changed file>          # 0 errors required
```

PostgreSQL evidence:

- Use the repo-local data directory (`.pgtest/`). `%TEMP%` is ACL-restricted for `initdb` on this machine.
- The embedded PG **17.10** binary fails on this Windows build with
  `could not create shared memory segment: error code 1314` / `CreateFileMapping(... Global/PostgreSQL:<dir>)`.
  The **18.4** binary at `C:\Users\hamed\node_modules\@embedded-postgres\windows-x64\native\bin` starts
  correctly with the same repo-local data directory. Do not change dependencies to work around it; if the
  harness needs a repository-level binary override, implement it without touching lockfiles and explain it.
- A `pg.test.ts` that cannot start must be reported as `BLOCKED (environment)`, never as passed.

Known pre-existing failures (not yours, do not "fix", do not count as your regression):
backend `sales-chart-window.test.ts` (1); `packages/ui` 9 tests — `i18n-keys-exist` (3),
`customers-hub` (1), `sales-funnel` (1), `personal-view` (1), `sales-hub` (1), `warehouse-hub` (2).

If you add a guard test, undo the fix once, watch the guard go red, then restore the fix byte-for-byte.

---

## 5. MIGRATION RULES

Every schema change ships as a trio:

1. `docs/<name>-migration.sql` — additive, idempotent, `CREATE ... IF NOT EXISTS`, constraints added
   `NOT VALID` then `VALIDATE` only after a `docs/FINDING-*.sql` read-only count proves how many rows
   break; `REVOKE ALL` before grants on every new table; functions `SET search_path = public, pg_temp`
   with EXECUTE revoked from `PUBLIC, anon, authenticated`; header states
   `Safety classification: ADDITIVE | DATA_BACKFILL | POTENTIALLY_LOCKING | DESTRUCTIVE` and a rollback or
   forward-recovery block.
2. `docs/VERIFY-<name>.sql` — read-only queries that prove the intended state.
3. A `*.pg.test.ts` that runs the file on real PostgreSQL **twice** (idempotency), plus the write it must
   refuse and the write it must allow.

Never write «PASS» for a migration. Use exactly:
`Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.

Add the row to the migration ledger in the same change.

---

## 6. STATUS VOCABULARY (use exactly these)

`VERIFIED_COMPLETE` · `IMPLEMENTED_NOT_LIVE_VERIFIED` · `VERIFIED_WITH_LIMITATIONS` ·
`SOURCE_CONFIRMED` · `TEST_CONFIRMED` · `RISK` · `TEST_GAP` · `BLOCKED` · `NOT_IMPLEMENTED` ·
`PENDING_HUMAN_CONFIRMATION` · `OWNER_DECISION`

`VERIFIED_COMPLETE` requires live HTTP/DB evidence. You do not have live Supabase access, so you will not
use it. Report implementation, automated tests, runtime/device verification, production verification,
migration confirmation and index freshness as **six separate statuses**.

---

## 7. OWNER DECISIONS — implement around them, never decide them

| Decision                                                                     | Safe default until answered                                                              |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Advance receipt accounting timing (liability at receipt vs. at finalisation) | Keep the current behaviour; separate lifecycles around it; do not change postings        |
| Employee-owned session settlement (package credit vs. complementary)         | Refuse package credit with `SETTLEMENT_CUSTOMER_REQUIRED`; complementary remains allowed |
| Historical `pre_purchase` rows whose id is not a supplier                    | Exclude from statements/aging, mark unresolved, never guess a mapping                    |
| Any destructive backfill or table merge                                      | Do not perform; produce a plan and a finding query                                       |

---

## 8. BLOCKERS — record, do not fake

- No live Supabase access: migrations and cross-tenant production proof stay `PENDING HUMAN CONFIRMATION`.
- Embedded PG 17.10 cannot start here (see §4); 18.4 works.
- No physical Android device: source/Jest evidence only, reported as `BLOCKED (device)`.
- `graphify-out` rebuild is blocked (`.graphify_python` points at a removed interpreter; the only remaining
  Python install is prohibited). Do not rebuild, do not edit `graph.json`.

---

## 9. EXECUTION ORDER

1. Preflight (§1) and the §2 re-verification.
2. WP-01 truth table.
3. WP-04 party identity, WP-02 purchase supplier, WP-03 supplier payments (one vertical slice: schema →
   validation → service → route → hook → UI → local/offline → tests → i18n).
4. WP-07 atomicity, WP-06 multi-method, WP-05 lifecycle separation.
5. WP-08 money, WP-12 inventory.
6. WP-13 security.
7. WP-09 reporting, WP-10 pagination, WP-11 dates/errors.
8. WP-14 offline parity, WP-15 session verification.
9. WP-16 events, WP-17 documents.
10. Full verification gates and the final report.

After each slice: inspect `git diff` for that slice only, run the focused tests, confirm no unrelated file
changed, and record the evidence.

Do not stop after the first green suite. Do not stop after a plan. Continue until every actionable item is
implemented with evidence or explicitly `BLOCKED`/`OWNER_DECISION`.

---

## 10. FINAL REPORT (Persian, this exact order)

1. **وضعیت** — one status per area, from the §6 vocabulary. Never a blanket "done".
2. **فایل‌های تغییریافته** — every path, one line on what and why.
3. **اعداد اندازه‌گیری‌شده** — the exact commands and their real totals/exit codes. Anything not run:
   «اجرا نشد».
4. **آنچه انجام نشد** — with the reason and the exact blocker.
5. **تصمیم‌های مالک** — the rows from §7 that are still open.
6. **برای مالک** — migrations to run in order, and the deploy order (backend before web).
7. **وضعیت نهایی درخت** — HEAD, dirty entries, and confirmation that no commit/push/reset/stash/clean
   happened.
8. **files edited: N, total edit operations: M** — M close to N; explain any divergence.

---

## 11. DEFINITION OF DONE

- A purchase invoice can only be created against a real supplier, and a sale against a real customer,
  enforced on the server and visible in list, detail and print.
- A pre-purchase advance is a supplier advance end to end — server, local DB, sync, statement, refund.
- Supplier payments are outgoing, allocated, and appear in supplier statement, aging and 360 with correct
  lifetime figures.
- Invoice creation with tranches is atomic and replay-safe on real PostgreSQL.
- Money paths use catalogue precision; no hardcoded 100; no cross-currency sum.
- Every changed screen has fa/af/en keys and correct RTL logical properties.
- Every migration has a VERIFY file, a PG test and a ledger row, marked pending human application.
- `tsc` 0 errors in backend, ui, validation, api, web; eslint 0 on changed files; the only red tests are
  the pre-existing ones listed in §4.
- One read and one edit operation per file (§0.1); the reported `files edited` and `edit operations` counts
  are close, with every extra pass explained.
- No forbidden construct, no new dependency, no second engine, no commit.

**Final principle: fix the root cause or do not claim the fix. A green suite over a wrong ledger is a
failed task.**
