# PROMPT FOR ANOTHER AGENT — COMPLETE M5 (package credit: refund, expiry, deferred revenue, fiscal proofs)

> Version 2, written 2 Nov 2026 after (a) the M4 integrity audit, (b) M4.2 (UI) + its follow-up that made a cancellation carry a reason
> (migration 03, device schema v16), and (c) the first M5 attempt, which correctly stopped at the entry gate and wrote only the decisions
> document. This prompt does **not** repeat the general rules of the first M5 prompt; it ADDS to it. Read both:
> `PROMPT-M5-REFUND-AND-ACCOUNTING-INTEGRITY.md` (rules, invariants, report format) and this file (what is known now, and the exact build plan per answer).

You work in the Hisabche monorepo (pnpm + Turbo, branch `main`, large uncommitted tree that belongs to the owner: never `git add -A/-u`, `commit`, `push`, `reset`, `stash`, `checkout --`). Persian-speaking solo owner; code/comments/tests English; every user string in `fa`, `af` (Dari), `en`. No subagents. Never read `.env`. No live DDL.

---

## 1. ENTRY GATE v2 — measure it yourself, do not trust this list

Stop and report (write nothing but the status table) if any is red. Show the command and the exit code for each.

| #   | Gate                                                                                                                                      | How to measure                                                                                                                                                                                                                                                        | State when this prompt was written                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| G1  | The 6 known backend failures are closed                                                                                                   | `cd backend && npx vitest run src/__tests__/invoice-return-once.test.ts src/__tests__/reverse-sales-return.test.ts src/__tests__/sync-pull-columns.test.ts`                                                                                                           | RED (5 × `.in is not a function` on a mock of the returns service; 1 × `offering_type` missing from the pull columns) |
| G2  | Migrations ran **on a real test database, twice each**, in this order, and the human pasted the `VERIFY-*.sql` row                        | `docs/offering-type-01-migration.sql`, `docs/package-credit-ledger-01-migration.sql`, `docs/service-delivery-01-migration.sql`, `docs/service-delivery-02-atomic-migration.sql`, `docs/service-delivery-03-cancellation-reason-migration.sql` (+ each `VERIFY-*.sql`) | NOT RUN (all `PENDING HUMAN CONFIRMATION`)                                                                            |
| G3  | A working Postgres exists for `*.pg.test.ts`, **or** the owner wrote «PGlite logic proofs are enough, concurrency stays BLOCKED_EXTERNAL» | `backend/src/__tests__/service-delivery-02.pg.test.ts` must show `started`, not skipped                                                                                                                                                                               | RED (embedded `postgres.exe` missing)                                                                                 |
| G4  | The owner answered the decisions in section 2                                                                                             | open the decisions file next to this one (`M5-DECISIONS.md`) and read the **Answer** column                                                                                                                                                                           | EMPTY                                                                                                                 |
| G5  | Service Delivery UI is in the tree                                                                                                        | `packages/ui/src/components/ui/service-delivery/` has the dialogs; its tests pass                                                                                                                                                                                     | GREEN                                                                                                                 |

The facts below changed since the first attempt — re-verify, don't assume:

- `service_delivery_cancel` now has **four** arguments `(workspace, session, reversalEntryId, reason)`; the 3-argument version is dropped by migration 03 and migration 02 will not recreate it (guarded). A cancellation **requires a reason** in the domain (`CANCELLATION_REASON_REQUIRED`), the device route, the server route and the SQL function; it is stored in `cancellation_reason` (PostgreSQL column + SQLite schema v16). Cancelling needs `invoice.create` on both sides.
- The ledger refuses a second CONSUME and a second REVERSAL **per service session** by unique index in both databases.
- Delivery settlement is chosen, never inferred (`package_credit` needs a package and credit; `invoice` links an existing invoice of the same customer; `complementary` needs a reason).

## 2. WHAT THE OWNER MUST ANSWER (do not answer for them, do not implement behind a flag)

Seven items are listed with options and a recommended default in `M5-DECISIONS.md`. In short: **OD-5** (expiry: grace? forfeit to breakage income or stay a liability?), **M5-1** (recognise package revenue at sale — what the code does today — or defer until delivery), **M5-2** (cash refund of unused units: value per unit, method/till, who may), **M5-3** (undoing a delivered _invoiced_ session), **M5-4** (tax on prepaid packages), **M5-5** (two offline devices spending the last credit), **OD-6** (restore). Until an item is answered its operation is refused with a stable code (`PACKAGE_REFUND_POLICY_NOT_DECIDED`, …) and has **no UI**.

Known contradictions you must resolve **with the owner, in writing**, never by picking a side: `08-PACKAGE-CREDIT-LEDGER.md` §3 expects deferred revenue while `backend/src/services/invoice.service.ts` recognises revenue at sale; `BILLABLE_OVERAGE` in §4 is not in the code; there is **no `REFUND` entry type** in `PACKAGE_CREDIT_ENTRY_TYPES` nor in the ledger CHECK.

## 3. BUILD PLAN — what each answer unlocks (implement ONLY the rows whose answer is on file)

Always: failing test first, one reference rule + golden vectors shared with the SQL function and the device, one Postgres function per multi-table write (session/parent row `FOR UPDATE`, idempotency derived from the document), membership RLS, `REVOKE` on internal functions, additive + idempotent + rollback block + `VERIFY`, run **twice** on a real engine (PGlite runner pattern: `backend/src/__tests__/helpers/service-delivery-02-scenarios.ts` + a scratch `run-*.mjs`; plus a `*.pg.test.ts` for CI).

### 3.0 Prerequisite refactor (decision-free, do it first once G1–G3 are green): ONE balance rule

The package-credit balance (`GRANT/ADJUSTMENT/REVERSAL` minus `CONSUME/EXPIRE`) is written inline in plpgsql in `package_credit_consume`, `service_delivery_deliver`, and again in TypeScript (`derivePackageBalance`) and on the device. Any new entry type (REFUND) that must reduce the balance would have to be added in every copy — the exact «three independent copies» the project forbids.
→ Add ONE SQL function `package_credit_balance(workspace, customer, product)` (and keep `derivePackageBalance` as the TS reference), replace the inline sums in the existing functions **by `CREATE OR REPLACE` in a new migration** (never edit an applied migration), prove with golden vectors that the three agree **before** adding any entry type. This slice changes no behaviour; its proof is the existing 14 PGlite scenarios + the existing domain/device tests staying green.

### 3.1 OD-5 answered → expiry

- Grace period is an explicit workspace setting with an explicit default (guardrail G4), read in one place.
- `EXPIRE` becomes reachable through one service/route (`requireCapability`, offline-matrix row = `online_required`), idempotent per `(account, expiry date)`, append-only, visible (who/when/why).
- **Posting:** only if the owner chose «forfeit to breakage income». That needs a new account role → the **five-file change that must land together**: the `accounts.role` CHECK (SQL), `packages/validation/src/schemas/standard-accounts.ts`, labels in `fa/af/en` `common.json`, `packages/ui/src/lib/accounting/account-name.ts`, and the device `ensureAccountsForRoles` / `ensureDefaultAccounts`. A role an existing workspace lacks is created on first use. Posting goes through `ledger.postDocument` only (server) / `postDocument` in `packages/local-engine/src/routes/local-ledger.ts` (device), dated, period-lock checked before the first write, reversal by `ledger.reverseDocument` / `reverseLedgerEntry`.

### 3.2 M5-1 answered «defer revenue»

- The package invoice line must post **to a liability** instead of revenue, and each delivery moves one unit's value from liability to revenue. This changes the invoice posting rule — which lives in ONE shared function used by the server and the device (find it: the invoice ledger-lines function in `packages/validation`, called from `invoice.service.ts` and `packages/local-engine/src/routes/invoices.ts`). Change it there, with golden vectors, never in the two callers.
- **No backfill.** Packages sold before the cut-over keep their posted revenue (CLAUDE.md §12). Make the cut-over an explicit, stored date; report the legacy liability as `null`/«unknown», never zero.
- Unit value = price paid for the package line ÷ units granted, in the invoice's currency, converted at the invoice's frozen rate. A fixture with only one currency proves nothing: use two.
- Deliver and cancel (and their device twins) post/reverse the transfer inside the SAME transaction as the session change.

### 3.3 M5-2 answered → refund of unused units

- Reuse the returns core (`returns-settlement.domain.ts`: net credit, deductions, `refundableMinor`, reserve → pay → settle). Do not write a second refund engine.
- New ledger entry type `REFUND` (reduces balance): CHECK constraint (drop + re-add; old rows validate), `PACKAGE_CREDIT_ENTRY_TYPES`, the balance function of 3.0, the device table, `VERIFY`, labels. Money leaves only through `PaymentsService` (out-payment keyed by the refund document id), refunds stay `online_required`, cap read under a lock server-side, `till` chosen by the person (never inferred).
- Capability: the owner's answer decides; do not invent one.

### 3.4 M5-3 answered → correcting a delivered, invoiced session

Through the existing returns/credit-note document of the invoice; the session's `DELIVERED_INVOICE_CORRECTION_REQUIRED` refusal stays for every other path.

### 3.5 Decision-free proofs (may start as soon as G1–G3 are green, before any answer)

- **M5.0** a read-only instrument + `docs/FINDING-package-credit-*.sql`: per workspace, credit granted/consumed/reversed/expired, the **liability** (units × unit value, `null` where the unit value is unknown), sessions delivered with no consume and consumes with no session (the legacy rows VERIFY counts). Numbers + the command that produced them.
- **M5.1** fiscal-lock proof for every path that writes a package-credit fact or an accounting entry: both sides of the boundary, server and device, nothing edits a closed-period row.
- **M5-5** (two devices): the server already refuses the second consume and the device keeps a visible `REJECTED` command. If the owner wants «needs reconciliation», build ONLY a visible state (a rejected delivery shows as such in the sessions list) — never an automatic undo, never last-write-wins.

## 4. Everything else is the first M5 prompt

Invariants (workspace_id boundary, integer minor units, no multi-table write from Node, append-only ledger, closed-list guards edited not loosened, offline matrix row + feature registry for every endpoint, `write-routes-have-a-capability` ledger, `viewer-cannot-write`, full repo paths in documents, `verify-spec-references` at 0, honest status tokens, Persian report with real numbers and exit codes) are in `PROMPT-M5-REFUND-AND-ACCOUNTING-INTEGRITY.md`. Report product-code changes separately from documents. A rendering screen or a green TypeScript check never means `VERIFIED_COMPLETE`: that token needs real HTTP/DB evidence, and PostgreSQL concurrency stays `BLOCKED_EXTERNAL` until a real Postgres ran it.

## 5. Out of scope

A second ledger/invoice/payment/refund/attendance/sync engine; generic workflow; subscriptions/projects; payroll; automatic reconciliation or LWW for money; any policy not on file; running migrations; commits.
