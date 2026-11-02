# Production deployment checklist — v52.0 gate (2 Nov 2026)

Written from the repository and the owner's own reports. **Nothing here was run against production.** Tick each box yourself.

## 0. Status of the database, as REPORTED by the owner

| Migration                                                                                                                                                                                                                                         | Owner-reported result                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/accounts-role-deferred-and-loss-01-migration.sql`, `docs/invoice-write-grant-01-migration.sql`, `docs/package-deferred-revenue-01-migration.sql`, `docs/invoice-return-06-scrap-loss-migration.sql`, `docs/m5-forward-fix-01-migration.sql` | applied; `docs/VERIFY-m5-combined.sql` 27 of 27 pass                                                                                                                                                                                                                              |
| `docs/inventory-void-receipt-01-migration.sql`                                                                                                                                                                                                    | applied; `docs/VERIFY-inventory-void-receipt-01.sql` 7 of 7 pass (function once, `voided_at` exists, SECURITY DEFINER, marker `inventory-void-receipt:rev1`, `service_role` may execute, `authenticated` and `anon` may not) — `VERIFIED_COMPLETE` for **schema and grants only** |

What the 7 rows do NOT prove: the behaviour of a real cancel on the real database (see step 3).

## 1. Migrations that CLAUDE.md still lists as «waiting for run and VERIFY»

Check each against your own record before deploying code that relies on it. This file does not know whether you ran them.

`docs/attendance-devices-01-migration.sql`, `docs/attendance-02-migration.sql`, `docs/invoice-exchange-rate-01-migration.sql`, `docs/till-payments-01-migration.sql`, `docs/custom-units-01-migration.sql`, `docs/dashboard-fx-01-migration.sql`, `docs/shelf-capacity-01-migration.sql`, `docs/db-integrity-01-migration.sql`, and the returns chain `docs/invoice-return-03-repair-migration.sql` → `docs/invoice-return-04-one-per-invoice-migration.sql` → `docs/invoice-return-05-core-migration.sql` (each with its `docs/VERIFY-*.sql`).

New migrations from this release that are NOT yet applied: **none** (the only new one, the void-receipt one, is applied and verified).

## 2. Code in this working tree, by what it needs

| Change                                                                                                                                       | Needs the database? | Notes                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cancel / delete of a purchase invoice refuses when its goods were drawn from (`PURCHASE_LAYER_CONSUMED`) and voids its cost layers otherwise | yes — step 0, done  | `backend/src/services/invoice.service.ts`, `backend/src/services/inventory-costing/`                                                                                                    |
| Project create / update / delete and member changes require a manager                                                                        | no                  | `backend/src/routes/project.routes.ts`. **Behaviour change:** a seller can no longer create or delete a project or change its members; tasks and time entries stay open to every member |
| Writing a custom-field value needs the record's own write capability                                                                         | no                  | `backend/src/routes/custom-fields.routes.ts`                                                                                                                                            |
| Device: purchase cancel is server-only (501 `OFFLINE_NOT_AVAILABLE`)                                                                         | no                  | `packages/local-engine/src/routes/invoices.ts`. **Behaviour change** on Windows and Android: cancelling a purchase invoice from the device is refused; do it from the web               |
| Device: till movement uses the booking rate; branch locks (company + per branch) for invoice, payment and cancels                            | no                  | `packages/local-engine/src/routes/`                                                                                                                                                     |
| Web: a request sent before the business is known is replayed once with `x-workspace-id`                                                      | no                  | `packages/api/src/lib/client.ts`                                                                                                                                                        |

## 3. Order

1. Back up the database (snapshot) — as for every release.
2. Confirm section 1 against your records.
3. Commit (you, not the agent; stage only the files of this release — `git diff --cached` before committing).
4. Deploy the **backend** first (`x-workspace-id` is already in `allowedHeaders`; no new header was added).
5. Deploy the **web**, then build **Windows** and **Android** (`pnpm run android:release` — the shell first, then Gradle; check the APK date).
6. Smoke test on staging or with a test business: (a) cancel an unsold purchase → its layers show `remaining_qty = 0`, `voided_at` set, valuation drops; (b) cancel a purchase whose goods were sold → refused with `PURCHASE_LAYER_CONSUMED`, nothing changed; (c) cancel the same purchase twice → second is a no-op; (d) a seller opening Projects can log time but not delete a project; (e) sign in with a two-business account → no 403 on the first load.
7. Only then run the PostgreSQL tests: set `HISABCHE_TEST_PG_URL` and `HISABCHE_TEST_PG_DISPOSABLE=yes` on a **throwaway** server and run `*.pg.test.ts` and `backend/src/__tests__/m5-real-postgres.pg.test.ts`.

## 4. Known and accepted at release

| Item                                                            | Why it is acceptable                                                                                                                                                | Where recorded |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| The device cannot learn a branch lock set on the server         | the server re-checks company and branch locks (in `accounting_post_journal_entry`) when the document syncs; the person sees a visible refusal, not a silent booking | AUDIT §19, §20 |
| Payroll, till and package postings on the device pass no branch | they have no single branch; the company lock applies                                                                                                                | AUDIT §20      |
| 16 registry keys mean both «read» and «write»                   | a plan that ended is enforced for writes on invoice creation only; splitting the keys is a registry + matrix + UI change that needs its own slice                   | AUDIT §15, §20 |
| Credit limit is advisory                                        | measured: the server shows a warning, it never refuses an invoice, online or offline                                                                                | AUDIT §19      |
| Offline payment without a named invoice stays `unallocated`     | OD-4 conservative rule, tested                                                                                                                                      | AUDIT §11      |
