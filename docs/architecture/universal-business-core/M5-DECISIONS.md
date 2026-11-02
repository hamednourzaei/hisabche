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

| ID     | Short question                                                                                                                | Answer (owner)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| :----- | :---------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OD-5   | Unused credit at expiry: grace? forfeit to income, or keep as liability?                                                      | **2 Nov 2026, owner:** «همینجوری معلق بمونه تا تمدید بشه»; clarified: «فروش دوباره همون بسته یا دیگر بسته ها با خرید اشتراک جدید — مثلا اشتراک ۱ ماهه کاربر تمام میشود باید اکانت معلق شود تا دوباره اشتراک ماهانه یا سالانه یا ۶ ماهه خریداری شود». **Reading:** a package is a subscription with a term (1 month / 6 months / 1 year); when the term ends the ACCOUNT is suspended (no use) until a new subscription is bought (the same package again, or another); the unused balance is KEPT, never forfeited: no breakage income, no forfeit posting, the remainder stays a liability. **Still open:** where the term STARTS (the sale date, or the first day of use — the owner's first reply mentioned «از تاریخ اولین روزی که استفاده می‌کنند»); whether the kept balance becomes usable again after a renewal; whether «suspended» is per account or per package. |
| M5-1   | Prepaid package revenue: recognise at sale, or defer until each delivery?                                                     | **2 Nov 2026, owner: «تحویل» — revenue is recognised at DELIVERY.** Reading: the package sale posts a liability (deferred revenue); each delivered session moves one unit's value from the liability to revenue; a cancelled delivery moves it back. Unit value = price paid, net of tax ÷ units granted, in the invoice currency at its frozen rate. Packages sold before the cut-over keep their posted revenue (no backfill).                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| M5-2   | Refund of unused credit: cash? which method? what value? who may do it?                                                       | **CLOSED 2 Nov 2026, owner: «نه هیچ بازپرداختی وجود ندارد» — there is NO refund of package credit, ever.** Not offered: no route, no ledger entry type, no button; `backend/src/__tests__/package-credit-has-no-refund.test.ts` keeps it that way. (The analysis in §3 stays as history.) The owner's other reply of that day is about returned GOODS: see RG-1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| M5-3   | Correction of a delivered, invoiced session: credit note, or re-bill?                                                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| M5-4   | Tax on prepaid packages: recognised with the sale, or with delivery?                                                          | **2 Nov 2026, owner: «با فروش» — tax is recognised WITH THE SALE.** Only the revenue is deferred (M5-1); the tax line of a package invoice posts exactly as today.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| M5-5   | Two devices consume the last credit offline: undo, or ask a person?                                                           |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| OD-6   | Restore from backup                                                                                                           | out of scope (no action)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| RG-1   | **Returned goods disposition** (new, from the owner's 2 Nov 2026 replies; belongs to the RETURNS core, not to package credit) | **Owner:** «اگر منظورت کالای مصرف نشده است هست با تایید کارکنان یا مدیر میتواند به انبار برگردد اگر بلا استفاده باشه باید از انبار حذف شده و قیمت خریدش به عنوان ضرر در اکانتیگ محاسبه شود»; approver: «مالک میتونه دسترسی بده به کارمند اما مدیر و مالک دیفالت میتوانن عودت بدن». **Reading:** unused goods go back to the warehouse only with approval; by DEFAULT manager and owner may do it, the owner can delegate it to an employee (one capability, default lowest role: manager); goods of no use are removed from the warehouse and their PURCHASE cost is recorded as a loss. **Still open:** loss valuation when the goods have several cost layers (default proposed: the layer they were sold from).                                                                                                                                                          |
| M5-A4  | Grant release attribution for pooled balance                                                                                  | **Proposed default:** FIFO (First-In, First-Out) attribution. Consume uses oldest active grants with deferred amounts first; exact remainder released on last unit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| M5-A8  | Delete/Cancel/Edit invoice for partly consumed package                                                                        | **Proposed default:** Strictly fail-closed with `PACKAGE_INVOICE_PARTLY_CONSUMED`. Invoices with consumption cannot be deleted, cancelled, or have package lines edited.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| M5-A9  | Profit Report basis after deferred revenue                                                                                    | **Proposed default:** Align profit report package revenue with recognized journal revenue (sale total minus deferred liability change). Gated until owner confirms.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| M5-A10 | Behavior of existing `/package-credits/expire` route under OD-5                                                               | **Proposed default:** Refuse expiry if package grant has a deferred amount. Retain balance as suspended until renewal; zero forfeiture.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| M5-B1  | Capability scope for restock and scrap                                                                                        | **Assumption 1:** Restock and scrap are both inventory disposition decisions guarded by the same capability (`invoice.return_restock`, default `manager`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| M5-B2  | Scrap with unknown purchase cost                                                                                              | **Assumption 2:** Fail-closed with `SCRAP_COST_UNKNOWN` if cost layer purchase cost cannot be resolved (`null` is not zero).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

---

## 3. The decisions, one by one

### RG-1 — what happens to returned goods (owner's rule; NOT a package-credit decision)

**Owner's words (verbatim).** «اگر منظورت کالای مصرف نشده است هست با تایید کارکنان یا مدیر میتواند به انبار برگردد اگر بلا استفاده باشه باید از انبار حذف شده و قیمت خریدش به عنوان ضرر در اکانتیگ محاسبه شود» and, for the approver, «مالک میتونه دسترسی بده به کارمند اما مدیر و مالک دیفالت میتوانن عودت بدن».
**What the code does today.** The returns core (`packages/validation/src/schemas/universal-core/returns-settlement.domain.ts`, `backend/src/services/sales/invoice-return.service.ts`) lets the person choose `restock` or `scrap` per line, with a default from the goods' condition. There is **no approval step** for restocking, and `scrap` has **no accounting entry**: `packages/validation/src/schemas/standard-accounts.ts` has no loss/write-off role, so a scrapped return books no loss.
**What it unlocks (its own slice, not M5).** A capability for restocking (default lowest role manager; the owner can grant it through the existing custom-role mechanism) enforced on the server route and mirrored on the device; and a write-off posting on `scrap` (debit an inventory-loss expense, credit inventory at the purchase cost, through `ledger.postDocument`, dated, period-lock checked) which needs a NEW account role — the five-file change (SQL CHECK, standard-accounts, labels in fa/af/en, account-name, device ensure) — and the device twin.
**Open.** How the loss is valued when the goods have several cost layers (proposed: the layer they were sold from).

---

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

---

## 9. Batch 2 of the owner's decisions (2 Nov 2026) and where they stand

The owner pasted eight policy decisions. They are recorded here as given; the second column says what the code does today.

| #    | Owner decision (summary)                                                                                                                                         | State in code                                                                                                                                                                                                                                                                                                                                                  |
| :--- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B2-1 | The term of a package starts at the FIRST valid CONSUME, never at the sale (`SOLD != ACTIVATED`); server-authoritative; a package never used never expires.      | `docs/package-deferred-revenue-01-migration.sql` derives the start from the allocation rows (immutable, append-only). Offline date: see C3.                                                                                                                                                                                                                    |
| B2-2 | Renewal is a new GRANT; every GRANT keeps its identity; an expired GRANT is skipped, never merged; no LWW on the ledger.                                         | The trigger allocates oldest GRANT first and skips an expired one. Whether an expired remainder is ever usable again: see C1.                                                                                                                                                                                                                                  |
| B2-3 | Suspension applies to ONE GRANT; model and invariants now, behaviour may follow.                                                                                 | `package_credit_suspensions` (append-only) exists and is read by the allocation rule. No screen and no route yet.                                                                                                                                                                                                                                              |
| B2-4 | Deferred revenue is traceable to its source GRANT; never more than that GRANT holds; no double release; a cancellation reverses exactly the earlier recognition. | GRANT stores its own `deferred_amount`; `package_credit_allocations` records, per CONSUME/REVERSAL, which GRANT gave how many units and released how much. ONE journal entry per release (not one per GRANT). Proven by 22 PGlite scenarios.                                                                                                                   |
| B2-5 | The profit report must come from the accounting ledger, not from invoice totals.                                                                                 | **NOT DONE** - see C2. The report still reads invoices (`backend/src/services/accounting/accounting.service.ts`, `getProfitReport`).                                                                                                                                                                                                                           |
| B2-6 | Expire only ends usability; no payment, refund, debt or revenue; EXPIRE event recorded; history kept.                                                            | Nothing writes revenue on expiry. The old `/api/package-credits/expire` route is unchanged (see C1).                                                                                                                                                                                                                                                           |
| B2-7 | Loss valuation from the real cost layers and the existing costing source; unknown cost fails closed.                                                             | `docs/invoice-return-06-scrap-loss-migration.sql`: the SAME weighted consumed-cost rule the `restock` branch uses; no cost -> `SCRAP_COST_UNKNOWN`.                                                                                                                                                                                                            |
| B2-8 | The scrap capability is reusable and stock-scoped, not package-specific; extend an existing one.                                                                 | `stock.adjust` (it already existed on the device as a manager capability) now exists on the server too, minimum role manager, in the permission module "انبار و کالا" (write level), so the owner can delegate it. Enforced on the return route ONLY for a line that scraps (C5 corrected the first answer: a sound restock needs only the return permission). |

### The five conflicts inside batch 2 - ALL CLOSED (owner, 2 Nov 2026, final)

- **C1 - CLOSED.** An expired GRANT is never usable again, not even after a renewal. A renewal always creates a NEW GRANT with its own entitlement; the old remainder is kept, auditable, visible in history, and can no longer be consumed. Nothing revives an expired GRANT, moves its balance to the new one, or merges the two. Allocation draws only from valid, non-expired GRANTs - the same rule in the shared function (`packages/validation/src/schemas/universal-core/package-grant-allocation.domain.ts`), the SQL trigger (`docs/package-deferred-revenue-01-migration.sql`), the device (`packages/local-engine/src/routes/package-allocation.ts`) and the sync replay (a replayed consume writes nothing new).
- **C2 - CLOSED.** The accounting ledger is the source of truth of profit; every posting is in the books currency at a valid exchange rate and the invoice keeps the chain `currency -> rate -> ledger amount` (100 USD x 65 = 6 500 AFN). A foreign invoice with no valid rate is refused whole: no default, no 1:1, no last rate, no raw USD in an AFN ledger. Tax, revenue, deferred revenue, COGS and inventory loss all use that one conversion, once. The profit report reports only invoices that have a posted ledger entry (an invoice without one is a reference, not a figure) and takes the deferred-revenue change from the ledger. **Honest limit:** the per-product revenue and cost rows are still read from invoice lines and cost consumptions (restated at the invoice's frozen rate) and then constrained by the ledger; a report whose every amount is a ledger-account sum is not built (it would be a second reporting engine). Recorded as PARTIALLY_IMPLEMENTED, not as an open question.
- **C3 - CONFIRMED** by the owner's "no more questions": the term starts on the session date the server accepted (`effective_date`), never the receipt time or a device clock.
- **C4 - DONE.** Allocation rows keep one consume per session and give per-GRANT traceability.
- **C5 - CLOSED (corrects the first answer).** RETURN and SCRAP are different events. Return + restock needs only the permission a return already has (`invoice.create`); only a line that writes goods off (scrap -> inventory loss) needs `stock.adjust` (manager by default, delegable by the owner, no new permission engine). A line that names neither restock nor scrap is refused whole (`RETURN_DISPOSITION_REQUIRED`), on the server route and on the device, by one function (`packages/validation/src/schemas/universal-core/return-disposition.domain.ts`). Scrap with an unknown cost is refused (`SCRAP_COST_UNKNOWN`).

### Not built, on purpose

The screens to create a PACKAGE product with a term (the product form has no "package" type at all today; the schema and service accept `packageTermMonths`); syncing the device's allocation and suspension tables to and from the server (the server derives its own from the same rule, and a device that accepted a consume the server refuses gets a conflict, never a silent loss); a profit report in which every amount is a ledger-account sum.
