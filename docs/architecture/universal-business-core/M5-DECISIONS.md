# M5 — OWNER DECISIONS REQUIRED BEFORE ANY M5 PRODUCT CODE

**Status**: `NEEDS_OWNER_DECISION` — no M5 product code was written.
**Created**: 2 Nov 2026, after measuring the entry gate of
`docs/architecture/universal-business-core/PROMPT-M5-REFUND-AND-ACCOUNTING-INTEGRITY.md` §1 as **red**.
**How to answer**: fill the «Answer» column in §2. One line per decision is enough. Until an answer exists,
every operation below keeps the fail-closed behaviour recorded in §4 — nothing is guessed, and nothing is
implemented "temporarily" behind a flag (prompt §2).

> This document records the question, what the code does **today**, the options, the safest default the
> agent may hold until the owner answers, and what the answer unblocks. It answers none of them.

---

## 1. Entry gate — measured, RED (2 Nov 2026)

| #   | Gate item                                                                                              | Evidence (real command)                                                                                                                                   | Result                                                                                                                                                                                                                                                                                                                                           |
| :-- | :----------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The 6 known backend failures resolved by their owners                                                  | `cd backend; npx vitest run src/__tests__/invoice-return-once.test.ts src/__tests__/reverse-sales-return.test.ts src/__tests__/sync-pull-columns.test.ts` | **RED** — `Test Files 3 failed (3)`, `Tests 6 failed \| 12 passed (18)`, exit 1: `invoice-return-once` ×2, `reverse-sales-return` ×3, `sync-pull-columns` ×1. Unchanged.                                                                                                                                                                         |
| 2   | The three migrations and their `VERIFY-*.sql` run by the human, output in front of the agent           | search for a human VERIFY result under `docs/`                                                                                                            | **RED** — no human VERIFY output exists in the tree. `docs/package-credit-ledger-01-migration.sql`, `docs/service-delivery-01-migration.sql`, `docs/service-delivery-02-atomic-migration.sql` stay **PENDING HUMAN CONFIRMATION**.                                                                                                               |
| 3   | `service-delivery-02.pg.test.ts` and `package-credit-concurrency.pg.test.ts` ran on a working Postgres | `cd backend; npx vitest run --project pg src/__tests__/service-delivery-02.pg.test.ts`                                                                    | **RED / BLOCKED_EXTERNAL** — the suite never starts: `spawn …\@embedded-postgres\windows-x64\native\bin\postgres.exe ENOENT`, `12 skipped`, hook timed out at 120005 ms, exit 1. The native binary is missing on this machine, so **0** Postgres suites started, including `package-credit-concurrency.pg.test.ts` which spawns the same binary. |
| 4   | M4.2 (Service Delivery UI) in the tree                                                                 | `packages/ui/src/components/ui/service-delivery/`, `packages/ui/src/__tests__/service-delivery-screen.test.tsx`                                           | **GREEN (in the working tree, not committed)** — M5 UI work is therefore limited to what already exists.                                                                                                                                                                                                                                         |

Per the gate rule, M5.0–M5.3 product code is **not started**. Only this decision document was written.

---

## 2. Decision register

| ID   | Short question                                                            | Answer (owner)           |
| :--- | :------------------------------------------------------------------------ | :----------------------- |
| OD-5 | Unused credit at expiry: grace? forfeit to income, or keep as liability?  |                          |
| M5-1 | Prepaid package revenue: recognise at sale, or defer until each delivery? |                          |
| M5-2 | Refund of unused credit: cash? which method? what value? who may do it?   |                          |
| M5-3 | Correction of a delivered, invoiced session: credit note, or re-bill?     |                          |
| M5-4 | Tax on prepaid packages: recognised with the sale, or with delivery?      |                          |
| M5-5 | Two devices consume the last credit offline: undo, or ask a person?       |                          |
| OD-6 | Restore from backup                                                       | out of scope (no action) |

---

## 3. The decisions, one by one

### OD-5 — unused credit at expiry

**Question.** When a package's validity ends, what happens to the units nobody used: is there a grace
period, and does the remaining balance become income (breakage) or stay a liability?

**What the code does today** (`backend/src/services/package-credits/package-credits.service.ts`,
`packages/local-engine/src/routes/package-credits.ts`): `expire` writes one `EXPIRE` row into
`package_credit_ledger` and its own comment states the invariant — _"Zero cash movements, zero payments,
zero accounting journal modifications"_. There is **no grace period** anywhere: the only grace in the
codebase is the subscription one in `backend/src/services/billing.service.ts`, which is unrelated.

**What the specs say.** `docs/architecture/universal-business-core/08-PACKAGE-CREDIT-LEDGER.md` §3 row 3
prescribes _Debit Unearned Revenue / Credit Breakage Income_ on expiry, and
`docs/architecture/universal-business-core/25-OWNER-DECISIONS.md` `OD-02` says the same ("Breakage Income
after 30-day grace period"). The spec therefore contradicts today's code, and `OD-02` was never applied.

**Options.**

|     | Option                                                                                                                        | Consequence                                                                                                                                                             |
| :-- | :---------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | 30-day grace, then forfeit to breakage income (spec `OD-02` as written)                                                       | Needs a breakage/income account role (a five-file change, see `M5-3` trap in §4 of the prompt) and a posting on expiry; recognises income the customer may still claim. |
| B   | 30-day grace, then the `EXPIRE` fact only — the balance stays a liability until it is refunded or the owner decides otherwise | Nothing is posted; the liability stays on the books; every day of silence is visible in the report.                                                                     |
| C   | No grace, forfeit immediately                                                                                                 | Punishes a customer whose session was delayed; hardest to defend.                                                                                                       |
| D   | Never expire                                                                                                                  | Permanent liability; the package is an open-ended promise.                                                                                                              |

**Recommended safe default (this is what the agent would implement once the gate is green):** **B** —
30-day grace as an **explicit workspace setting with the default 30** (project guardrail G4), the `EXPIRE`
ledger fact unchanged, **no accounting posting**. It is the only option that does not invent an income
number the owner has not approved.

**Blocked until answered:** the grace setting (M5.2), any expiry posting (M5.3), a breakage/income account
role, and any report that assumes expiry removes the liability.

**Fail-closed today:** the operation exists and posts nothing — the safe default is already the code's
behaviour for the posting half; only the explicit grace setting is missing.

---

### M5-1 — revenue recognition of a prepaid package

**Question.** A package invoice line grants credit and the invoice posts its revenue like any sale.
Should revenue be recognised at sale, or deferred until each session is delivered?

**What the code does today** (`backend/src/services/invoice.service.ts`,
`grantPackageCreditsForInvoice`): one package line = one `GRANT` in `package_credit_ledger`, with the
comment _"Zero cash/payment movement; payment and double-entry accounting remain untouched"_. The invoice
itself posts revenue through the ordinary sale path, so **the whole package price is revenue on the day of
sale**, before a single session is delivered. No unearned/deferred revenue account role exists in
`packages/validation/src/schemas/standard-accounts.ts` (the roles stop at `sales`, `cogs`, `fx_gain_loss`).

**What the specs say.** `docs/architecture/universal-business-core/08-PACKAGE-CREDIT-LEDGER.md` §3 rows 1–2
prescribe _Debit Cash / Credit Unearned Revenue_ at sale and _Debit Unearned / Credit Service Revenue_ at
each delivery — i.e. deferral. The code does the opposite.

**Options.**

|     | Option                                                                    | Consequence                                                                                                                                                                                                             |
| :-- | :------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Recognise at sale (keep today)                                            | Simplest; profit is overstated for undelivered credit; a refund later has to unwind revenue that was already recognised.                                                                                                |
| B   | Defer: cash → unearned liability at sale, revenue at each delivery (spec) | Correct for prepaid credit; changes every reported profit figure; needs the new account role, a migration, and a stated policy for credit already outstanding today (unknown stays unknown, never backfilled by guess). |
| C   | Defer per delivered session only for packages, keep sales as they are     | A split rule; two revenue meanings in one ledger.                                                                                                                                                                       |

**Recommended safe default:** **B** (the spec's own model) — but it is the owner's call because it changes
figures they report. Until then the code is unchanged and **no existing package invoice posts differently**.

**Blocked until answered:** the deferral posting, a new _unearned revenue_ account role (SQL CHECK +
`packages/validation/src/schemas/standard-accounts.ts` + `fa/af/en` labels +
`packages/ui/src/lib/accounting/account-name.ts` + `ensureAccountsForRoles`), the per-delivery revenue
recognition, and the treatment of the credits outstanding today.

**Fail-closed today:** nothing to refuse — no new posting path is added; existing invoices keep posting as
they do now.

---

### M5-2 — refund of unused credit

**Question.** Can unused credit be refunded for cash? Through which method/till? At what value per unit
(price paid ÷ quantity? discounts? tax? fees)? Who may do it?

**What the code does today.** There is **no refund route and no refund button**:
`backend/src/routes/package-credits.routes.ts` exposes `balance`, `ledger`, `grant`, `consume`, `reverse`,
`expire`, `adjust` only, all writes gated by `invoice.create`. `reverse` reverses a ledger fact — it does
not move money and is not a refund. `PACKAGE_CREDIT_ENTRY_TYPES`
(`packages/validation/src/schemas/universal-core/package-credit-ledger.domain.ts`) has no `REFUND` type,
and `docs/package-credit-ledger-01-migration.sql` has the matching `CHECK` constraint, so a refund cannot
even be recorded today without a new entry type (a five-place change).

**What the specs say.** `docs/architecture/universal-business-core/10-REFUND-MODEL.md` §1 separates the
return document from the cash payout: credit first, then a payout capped by
`min(net credit − unpaid debt − prior refunds)`. `docs/architecture/universal-business-core/10-REFUND-MODEL.md`
§3 and `25-OWNER-DECISIONS.md` `OD-01` keep offline cash payouts at zero without a server lease.

**Options.**

|     | Option                                                                                                                                                                                                                                                                                                   | Consequence                                                                                                                                   |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Cash refund of the **unused** units at the unit value actually paid (price paid ÷ granted units, discounts included, tax excluded unless the owner says otherwise), as a return-style document through `packages/validation/src/schemas/universal-core/returns-settlement.domain.ts`, manager capability | Reuses the returns core and the till; needs a statement rule, a `REFUND` (or `REVERSAL`-plus-payout) ledger representation, and a capability. |
| B   | No cash: convert unused credit to store credit / another package                                                                                                                                                                                                                                         | No till, no cash ceiling; the customer may not accept it.                                                                                     |
| C   | No refund at all — expiry only                                                                                                                                                                                                                                                                           | Simplest; hardest on the customer and legally exposed in some markets.                                                                        |
| D   | Treat the package as a normal product and refund the whole invoice through the invoice-return path                                                                                                                                                                                                       | Returns a _product_, not a consumed service; refunds units that were already delivered.                                                       |

**Recommended safe default:** **A**, with the money movement delegated to the existing returns core, and
**manager-only**. It is the only option that keeps the money path in code that already exists.

**Blocked until answered:** the refund route, the refund capability, the `REFUND` ledger representation
(or the decision to express it as `REVERSAL` + payout), and the UI entry point.

**Fail-closed today:** the operation does not exist — no route, no button, no entry type. When a refund
route is added, it must refuse with `PACKAGE_REFUND_POLICY_NOT_DECIDED` until this table is answered.

---

### M5-3 — correction of a delivered, invoiced session

**Question.** A session was delivered and invoiced; it now needs correcting. Credit note, or re-bill?

**What the code does today.** The operation is refused: `DELIVERED_INVOICE_CORRECTION_REQUIRED` is thrown
by `packages/validation/src/schemas/universal-core/service-delivery.domain.ts` and surfaced unchanged by
`backend/src/services/service-delivery/service-delivery.service.ts`, the device route
`packages/local-engine/src/routes/service-delivery.ts`, and the UI list
`packages/ui/src/components/ui/service-delivery/service-delivery-errors.ts`. The cancel dialog is disabled
for an invoiced session and says why.

**Options.**

|     | Option                                                     | Consequence                                                                                            |
| :-- | :--------------------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| A   | Credit note through the existing returns document          | One money path, reversal visible, audit trail intact.                                                  |
| B   | Void the invoice line and issue a new invoice              | Two documents for one sale; the void has to be a posting of its own or the ledger forgets the revenue. |
| C   | Allow editing the delivered session and post an adjustment | Edits an append-only fact; the ledger and the session disagree from then on.                           |

**Recommended safe default:** **A**.

**Blocked until answered:** the correction route, the correction capability, and any UI on a delivered
session.

**Fail-closed today:** `DELIVERED_INVOICE_CORRECTION_REQUIRED` — unchanged, and it is the right refusal.

---

### M5-4 — tax on prepaid packages

**Question.** Is tax on a prepaid package recognised with the sale, or with each delivery?

**What the code does today.** There is no package-specific tax branch: the invoice's normal tax core
(`applyTax` in `backend/src/services/invoice.service.ts`) runs for every invoice, including one whose line
grants package credit, and freezes the result onto the document. If M5-1 changes revenue timing, tax
timing has to be stated in the same answer, or a deferred-revenue change would silently leave tax on the
sale date.

**Options.**

|     | Option                                                                                 | Consequence                                                                                                  |
| :-- | :------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| A   | Follow M5-1: tax follows the revenue (with delivery if deferral, with the sale if not) | One rule for revenue and tax.                                                                                |
| B   | Always with the sale, whatever M5-1 says                                               | Tax is due on the invoice date in many jurisdictions; may be the legally correct answer even under deferral. |
| C   | Always with delivery                                                                   | A prepayment could carry tax collected with no tax document.                                                 |

**Recommended safe default:** **A** — but it is empty until M5-1 is answered; the recommended pairing is
B-if-the-owner-picks-deferral, because the tax point is a legal question, not an accounting preference.

**Blocked until answered:** any change to tax timing, and the tax half of the deferral migration.

**Fail-closed today:** no tax change; the invoice behaves as it does now.

---

### M5-5 — two devices consuming the last credit offline

**Question.** Two offline devices each believe the customer has one credit left and both deliver. Undo the
local delivery, or ask a person?

**What the code does today.** Nothing auto-undoes. The server refuses the losing consumption
(`planPackageConsumption` in
`packages/validation/src/schemas/universal-core/package-credit-ledger.domain.ts`), and the refusal is
visible on the row: M4.2 added the sync-state column backed by
`packages/api/src/lib/entity-sync-state.ts` with the four states `pending` / `confirmed` / `rejected` /
`attention` — _"A delivery that the server refused is still on the device in its local state — there is no
automatic reconciliation"_. There is **no** `BILLABLE_OVERAGE` code in the repository, although
`docs/architecture/universal-business-core/08-PACKAGE-CREDIT-LEDGER.md` §4 prescribes it.

**Options.**

|     | Option                                                                                                                | Consequence                                                                                     |
| :-- | :-------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- |
| A   | Surface "needs reconciliation" and let a person decide; never auto-undo (current behaviour, extended with a workflow) | No data is lost; a human bears the decision; the customer waits.                                |
| B   | Auto-undo the local delivery                                                                                          | Deletes a service that was actually performed; the customer's visit disappears from the device. |
| C   | Auto-convert the excess to a receivable (`BILLABLE_OVERAGE` as the spec says)                                         | Bills the customer without asking; a policy decision about who bears the loss.                  |

**Recommended safe default:** **A**; C only as the automatic policy after the owner says who bears the
loss.

**Blocked until answered:** the reconciliation workflow (a screen/action that resolves `attention` rows),
overage invoicing, and any change to the device's local state on refusal.

**Fail-closed today:** the visible `rejected`/`attention` state — unchanged.

---

### OD-6 — restore from backup

Out of scope for M5. `25-OWNER-DECISIONS.md` `OD-04` already holds the current position
(`REQUIRES_PRODUCT_DECISION`; export works, restore is manual). No action.

---

## 4. Fail-closed matrix (what happens right now, per operation)

| Operation                                  | Today                                       | Stable code / state                                                |
| :----------------------------------------- | :------------------------------------------ | :----------------------------------------------------------------- |
| Expire unused credit                       | `EXPIRE` ledger row; **no** journal entry   | — (nothing to refuse)                                              |
| Post expiry to accounting                  | does not exist                              | — (blocked by OD-5)                                                |
| Refund unused credit for cash              | does not exist (no route, no button)        | — ; a future route must answer `PACKAGE_REFUND_POLICY_NOT_DECIDED` |
| Reverse a credit entry                     | `REVERSAL` ledger row, append-only, no cash | —                                                                  |
| Cancel a delivered, invoiced session       | refused                                     | `DELIVERED_INVOICE_CORRECTION_REQUIRED`                            |
| Consume the last credit on a second device | server refuses; the row says so             | `rejected` / `attention` in the sync column; **no auto-undo**      |
| Post into a closed fiscal period           | refused whole, before the first write       | `ACCOUNTING_PERIOD_LOCKED`                                         |

---

## 5. Contradictions the answers settle (do not "fix" them by reading only one file)

1. `25-OWNER-DECISIONS.md` `OD-02` promises breakage income after a grace period, but
   `PackageCreditsService.expire` posts nothing and the accounting model has no breakage account role.
2. `08-PACKAGE-CREDIT-LEDGER.md` §3 prescribes deferred revenue (unearned → service revenue), while
   `grantPackageCreditsForInvoice` deliberately leaves accounting untouched and the invoice recognises the
   whole price at sale.
3. `08-PACKAGE-CREDIT-LEDGER.md` §4 prescribes `BILLABLE_OVERAGE`; no code implements it.
4. `10-REFUND-MODEL.md` §1 defines a refund as a return document **plus** a capped payout; package credit
   has neither, and `PACKAGE_CREDIT_ENTRY_TYPES` has no `REFUND` member.
5. `10-REFUND-MODEL.md` §3 / `OD-01` keep offline cash payouts at zero without a server lease; a package
   refund built on the returns core inherits that rule and must not bypass it.

---

## 6. What the gate must show before M5.0/M5.1/M5.2 may start

| Gate item | Needs                                                                                                                                                                                                                                                           |
| :-------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | The six backend tests green in `backend/src/__tests__/invoice-return-once.test.ts`, `backend/src/__tests__/reverse-sales-return.test.ts`, `backend/src/__tests__/sync-pull-columns.test.ts` — resolved by their owners or a separate slice, not by hiding them. |
| 2         | The human's real output of `docs/VERIFY-package-credit-ledger-01.sql`, `docs/VERIFY-service-delivery-01.sql`, `docs/VERIFY-service-delivery-02.sql` after running the three migrations (twice each) on a test database.                                         |
| 3         | Either a working Postgres for `backend/src/__tests__/service-delivery-02.pg.test.ts` and `backend/src/__tests__/package-credit-concurrency.pg.test.ts`, or an explicit decision to accept PGlite-only logic proofs and keep concurrency `BLOCKED_EXTERNAL`.     |
| 4         | Already green (M4.2 in the tree).                                                                                                                                                                                                                               |

Until then the only M5 work that exists is this document.
