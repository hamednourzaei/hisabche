# UNIVERSAL BUSINESS CORE — CONSOLIDATION DESIGN (M0 output)

**Date**: 2026-11-01 · **Inputs**: `UNIVERSAL-BUSINESS-AUDIT.md` (findings F-01…F-09).
<!-- target-vocabulary -->

> Function and table names in this design that are not in the repository yet (`buildReturnDocument`, `returnLedgerLines`, `planTransfer`,
> `package_credit_entries`, `offering_type`, …) are **target** names; the paths are checked.

**Rule of this document**: extend the working core; add no engine, no package, no resolver that the audit did not prove necessary.

---

## 1. Where each rule lives today, and who must change

| Concern                                             | Authoritative implementation (today)                                                                                      | What is wrong                                 | Direction                                                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invoice arithmetic                                  | `packages/validation/src/schemas/invoice-math.ts` (`computeItemTotal(Rounded)`, `sumInvoiceLines`, `computeInvoiceMoney`) | equal by composition, not by one call         | **keep**; add one parity test that feeds identical inputs to both entry points (it exists: `packages/validation/src/__tests__/invoice-math.parity.test.ts`) |
| Invoice policy (credit limit, approval, plan limit) | server only (`detectBreaches`, `decideApproval`, `mayPostDocument`)                                                       | offline skips them                            | **keep online-only**; the offline invoice must be _marked_ "policy pending" (state exists: `PENDING_SYNC`) — owner decision OD-3                            |
| Ledger lines of invoice / payment                   | `invoiceLedgerLines`, `paymentPosting` (shared, used by both sides)                                                       | —                                             | **keep**                                                                                                                                                    |
| Ledger lines of a **return**                        | plpgsql inside `invoice_return_create` only                                                                               | no TS function; local engine writes none      | add `returnLedgerLines` (pure, in `validation`); local uses it; SQL mirrors it; parity by golden vectors (§2)                                               |
| Return amounts                                      | SQL + `previewReturn`/`computeReturnDeductions`/`proportionalReturnTaxMinor` + local `calculateReturnDocument`            | three implementations                         | one composition function, §2                                                                                                                                |
| Period lock                                         | `evaluatePeriodLock` (server) vs inline check in `packages/local-engine/src/routes/accounting.ts` (line 276)              | duplicate                                     | local calls the shared function; only the _storage_ of the lock differs                                                                                     |
| Payment allocation                                  | `autoAllocate` (server) vs explicit-only (local)                                                                          | different result for the same input           | local calls `autoAllocate` (pure, already exported) — OD-4                                                                                                  |
| Stock transfer guard                                | SQL function vs local inline                                                                                              | duplicate, 0 shared fns                       | shared pure `planTransfer`; SQL mirrored by vectors                                                                                                         |
| Availability of a feature                           | five layers (F-09)                                                                                                        | one spec names a resolver that does not exist | **do not merge**; guard + explainer, §3                                                                                                                     |
| Command shape                                       | outbox row (`buildEnqueue`) + `Idempotency-Key`                                                                           | a second, unused envelope was added           | §4                                                                                                                                                          |
| Sync                                                | one engine, `packages/app-shell/src/features/sync/sync-engine.ts`                                                         | —                                             | **keep**; no per-domain sync                                                                                                                                |

## 2. Returns — the pilot, done properly (slice M1.1)

The goal is _one stored meaning for every column_, on every device, and one set of rules that all three implementations are
measured against.

1. **Shared pure composition** in `packages/validation/src/schemas/universal-core/`:
   `buildReturnDocument({ originalLines, invoiceTaxMinor, priorReturnedByLine, existingReturnCount, requested, deductions, fractionDigits })`
   → `{ lines, subtotalMinor, discountMinor, taxMinor, deductionMinor, netCreditMinor }` or a typed refusal
   (`RETURN_QUANTITY_EXCEEDS_ORIGINAL`, `INVOICE_ALREADY_RETURNED`, `RETURN_DEDUCTION_*`).
   It reuses `proportionalReturnTaxMinor`, `computeReturnDeductions`, `returnNetCreditMinor` — it does not copy them.
2. **Golden vectors** (`packages/validation/src/__golden__/`, the existing mechanism) for returns, executed three times:
   pure TS · plpgsql (the 19 scenarios already running on a real Postgres engine become vectors) · local SQLite route.
   The three must agree to the minor unit. This is the parity guard that today exists for invoices only.
3. **Local schema v10 (additive, idempotent, preserves `sync_queue`)**: `invoice_returns` gains `deduction_minor`, `refunded_minor`,
   `reason_code`, `notes`, `client_request_id`; new `invoice_return_deductions`; `invoice_return_lines.condition_code`.
   `grand_total_minor` means **net credit** everywhere. Before the migration, a read-only check counts existing local
   `invoice_returns` rows (the route was unregistered until this working tree, so the expected count is 0; if not, those rows
   are gross-valued and are migrated by `grand_total_minor − deduction_minor` with deductions unknown = 0, never guessed).
4. **Local route**: one `db.transaction` covering header, lines, deductions, stock movement, cost-layer restoration
   (`planConsumption` inverse already used by sales), the `returnLedgerLines` journal entry and the outbox row — all or nothing.
5. **Sync payload** carries every document field (`reasonCode`, `notes`, per-line `conditionCode`, deductions) and the idempotency key.
   On a server refusal (e.g. another device returned the same invoice first) the local state moves to `REJECTED`/`PENDING_REVIEW`
   and the stock movement is reversed by a **compensating movement**, never deleted (law: no silent discard).
6. **Permissions**: `requireCapability('invoice.create')` — the same key as the server route.
7. **Refund stays online-only** (`online_required`) until OD-1 is decided; no lease code is wired before then.

Until M1.1 lands, the safe state is to close the offline door on returns (matrix `online_required`, registry `server`) —
**owner decision OD-1**, because the opposite choice was made deliberately in this working tree.

## 3. Capability layers — a catalogue, not a merge (slice M1.5)

Merging five resolvers into one function would change security behaviour for no business gain. Instead:

- A **catalogue document + guard test** listing the five layers, their inputs, and the rule that every
  `feature-registry` key resolves in exactly one _plan_ entry, one _offline-matrix_ row (or is explicitly `server`), and one _nav_ destination when it has a screen.
  (`packages/api/src/__tests__/offline-matrix-guard.test.ts` already enforces the second; the guard extends it, it does not replace it.)
- A **read-only explainer** `describeAvailability(context, key)` that returns _which layer says no and why_, for support and for the
  UI's "why is this disabled" text. It never grants anything; enforcement stays in each layer.

## 4. Command envelope and lease — owner decision OD-2

The outbox row + `Idempotency-Key` **is** the project's command model. Two options, one recommendation:

| Option                                                                                                                                                                                    | Consequence                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **A (recommended)** delete `command-envelope.ts` (removed in M1.0) and `offline-lease.domain.ts` (removed in M1.0) and their tests until a consumer exists (CLAUDE.md §14 "no dead code") | zero risk; `OfflineLease` can be re-introduced with the first real offline cash-refund feature, designed against the real outbox             |
| B adopt the envelope as a typed _view_ of the outbox row (`buildEnqueue` builds it)                                                                                                       | needs a mapping and tests; only worth it if more metadata (`rulesVersion`, `configVersion`, `dependsOn`) is going to be stored in the outbox |

## 5. Offering / package credit / service delivery (M2–M5) — start conditions

Not built (audit §5). Preconditions before slice M2.1, none of which require new architecture:

- `product` is goods-shaped. **Extend** it with `offering_type` (additive column + Zod discriminated union); do not create a parallel `offering` table.
- A service line must not create a stock movement or consume a cost layer (guard test, written _before_ the change).
- Package credit = an append-only ledger table (`package_credit_entries`) written only by a Postgres function / local transaction; remaining credit is **derived**, never stored (same pattern as `paid_amount`).
- Deferred revenue posts through the existing ledger port with new account roles — the `accounts.role` CHECK constraint, `packages/validation/src/schemas/standard-accounts.ts`, the labels in three languages and `packages/ui/src/lib/accounting/account-name.ts` must change together (known trap).

## 6. Slice order (reconciles prompt M1–M8 with the spec pack's slices S0–S5)

| v51 milestone                                       | What it means in this repository                                                                                       | Slices                                                                                                                        | Depends on |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **M1** shared foundation                            | close the proven gaps: returns parity, period-lock/allocation/transfer parity, capability catalogue, envelope decision | M1.1 returns · M1.2 period lock · M1.3 allocation · M1.4 transfers · M1.5 capability catalogue · M1.6 envelope/lease decision | OD-1, OD-2 |
| M2 offering & mixed commerce                        | `offering_type` on product, service lines without stock                                                                | S3.1–S3.4                                                                                                                     | M1         |
| M3 package credit                                   | append-only credit ledger, redemption, expiry                                                                          | S4.1                                                                                                                          | M2         |
| M4 service delivery & attendance                    | delivery sessions, practitioner attendance link                                                                        | S4.2                                                                                                                          | M3         |
| M5 refund & accounting integrity                    | deferred revenue, refund of unused credit, fiscal-lock proofs                                                          | S4.3, S5.x                                                                                                                    | M3, OD-1   |
| M6 manufacturing / projects / subscriptions "-lite" | extend existing manufacturing and recurring invoices; projects only if the owner confirms the need                     | new                                                                                                                           | M2         |
| M7 reporting & integration                          | shared KPI definitions; API/webhook through existing commands                                                          | new                                                                                                                           | M1         |
| M8 AI governance, hardening, platform verification  | real device runs, backup/restore drills, load measurements                                                             | new                                                                                                                           | all        |

Every slice follows the prompt's loop (inspect → characterize → smallest extension → shared contract → adapters → tests → parity → diff → evidence → gate) and ends with the commands and numbers in `UNIVERSAL-BUSINESS-PROGRESS.md`.

## 7. Owner decisions raised by M0

| ID   | Question                                                                                                                                                 | Recommended default                                                          |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| OD-1 | Offline returns: close the door now (matrix/registry back to online-only) until M1.1 is done, or leave open?                                             | **DECIDED 1 Nov 2026: closed** (applied in M1.0)                             |
| OD-2 | Delete the unused command envelope / lease domain, or adopt the envelope over the outbox?                                                                | **DECIDED 1 Nov 2026: deleted** (option A, applied in M1.0)                  |
| OD-3 | An invoice made offline skips credit-limit/approval/plan-limit checks until sync. Accept and label it, or hold such invoices as `PENDING_AUTHORIZATION`? | label + hold only when the customer is near the limit (needs a cached limit) |
| OD-4 | Offline payment without an allocation: settle the oldest invoice (like online) or keep it as an advance?                                                 | settle oldest (consistency)                                                  |
| OD-5 | Unused package credit at expiry (from the earlier spec): grace + forfeit to breakage income?                                                             | keep the earlier safe default (30-day grace)                                 |
| OD-6 | Restore from backup: product decision still pending (`01-CURRENT-STATE.md`)                                                                              | no speculative auto-restore                                                  |
