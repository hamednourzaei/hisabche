# V61 Implementation Progress

- **Started:** 2026-11-12
- **HEAD:** `0b68fe4e`
- **Unwired routes (before):** `routes: 946 · client path strings: 746 · with no caller: 100`
- **Baseline UI fixes (V60.1 carryover):** Fixed `customers-hub-container.tsx` (`useHubSection`), `docs-content.ts` + `fa/af/en` (`docs.contracts-recurring.*`), `no-hardcoded-currency.test.ts` (path), `composition-plan-summary.tsx` (statusMap + default menuGroups).

---

## 0. Corrections — 12 Nov 2026

This file said «[x] done» for work that was not in the product. The audit found the gap in the
code, not only in the wording. What was wrong, and what the working tree now contains:

| Claim as written                    | What the audit found                                                                                                                                                                                                                                                                                                                                                    | Now                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B.2.18** expense claims «wired»   | five endpoints, a service, and **no screen in web, desktop or mobile**; `amount = totalMinor / 100`, so a 5,000 AFN claim left the business as 50; a claim with 5,000 AFN + 20 USD lines «totalled» 5,020; approval called `ledger.postDocument({ lines: [] })` with `sourceType: 'expense_claim' as never` and `.catch(() => undefined)` — nothing posted, nobody told | «مطالبات هزینه» section in **Team & payroll → Pay** (`expense-claims-section.tsx`), 5 hooks, 63 keys × `fa/af/en`, `tillMinorToMajor`, mixed-currency and currency-mismatch refusals, approval books nothing **and the class comment and the screen say so**, `expense-claims-migration.pg.test.ts` + a real `VERIFY` |
| **B.2.5** cheques                   | the screen did not exist; amounts converted with `/100`; «today» came from UTC, not the workspace's day                                                                                                                                                                                                                                                                 | `ChequesTab.tsx` under **Accounting → Treasury**; `tillMinorToMajor`; `today(ctx.timeZone)`; idempotency key                                                                                                                                                                                                          |
| **B.2.4** accrual / **assets**      | `/100` on the schedule amount and on depreciation                                                                                                                                                                                                                                                                                                                       | `tillMinorToMajor(..., currency)` in `accrual-schedules.service.ts` and `assets.service.ts`                                                                                                                                                                                                                           |
| 19 migrations                       | on Supabase a new table is born with `ALL` granted to `anon` and `authenticated`; nothing took it back                                                                                                                                                                                                                                                                  | the 19 migrations now `REVOKE ALL` and grant `service_role` only; their VERIFY files carry a `clients_locked` row (19 files); `migration-client-lockdown.test.ts` pins it                                                                                                                                             |
| **B.2.25** workspace 2FA            | a service that stored a flag — no second factor existed                                                                                                                                                                                                                                                                                                                 | Supabase-Auth **TOTP** (enrol / verify / challenge), a step-up policy per action, a dialog host. Inert until TOTP is enabled in the Supabase project and the actions are chosen in settings — that is an owner action, not code                                                                                       |
| payments guard test (tenancy guard) | `services/payments/platform-gateways.service.ts` read `platform_payment_gateways`, a table with no `workspace_id`, so the guard failed. The tempting «fix» was to exempt it                                                                                                                                                                                             | moved to `services/admin/platform-gateways.service.ts`: a platform-level table belongs to the platform service, not to a workspace's payment service                                                                                                                                                                  |
| `capability-matrix.csv`             | hand-edited                                                                                                                                                                                                                                                                                                                                                             | regenerated by `scripts/generate-capability-matrix-csv.mjs` — 657 rows                                                                                                                                                                                                                                                |

**Still open, and stated as open** (§NEEDS_OWNER_DECISION below):

1. Expense approval books **nothing** to the ledger: there is no operating-expense `AccountRole`
   (`accountRoles` has `salary_expense`, `cogs`, `purchase`). A correct posting needs a role plus a
   decision about which account a business's expense goes to.
2. A reimbursement pays the employee through the one payment path, but `payments` allows only
   `customer | supplier` (`payments_party_check`), so the party label is `supplier`. A first-class
   `employee` party is a schema and payments decision.
3. Accrual-schedule creation still writes the schedule and its periods in two statements;
   supabase-js has no transactions, so this needs a Postgres function (RPC) and a migration.
4. `*.pg.test.ts` cannot run on this host (`embedded-postgres` `initdb.exe` missing). Every pg result
   in this file is **PENDING HUMAN CONFIRMATION**.

---

## 0.1 Corrections, second pass — 12 Nov 2026 (the Part B items marked [x])

> **خلاصه برای مالک.** بخش B «انجام‌شده» علامت خورده بود ولی بیشترِ آن فقط سرور بود، و چند سرویس **هرگز
> کار نکرده بودند**: ستون‌هایی را می‌خواندند که در دیتابیس وجود ندارد (هر فراخوان ۵۰۰). تست‌ها سبز بودند چون
> فقط تابع‌های خالص را می‌سنجیدند. حالا هر سرویس با دیتابیس ساختگیِ دو-کسب‌وکاره تست می‌شود و یک گارد
> ستون‌ها را با فایل‌های SQL می‌سنجد. شش صفحه‌ی تازه ساخته شد. ۳ مهاجرت تازه منتظر اجرای شماست.

**Services that could not have worked (500 on every call):**

| Item                          | Defect                                                                                                                                                               | Fix                                                                                                                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B.2.17 org chart / reports-to | read `employees.name`, `.department`, `.is_active` — none exist                                                                                                      | real columns (`first_name`, `last_name`, `department_id`, `termination_date`); manager must be current staff of this business; documents/appraisals refuse another business's employee; document link https only |
| B.2.15 RFM                    | read `invoices.issue_date` (the column is `date`); counted purchase invoices; ×100; hard-coded AFN; UTC day; one page of 1,000                                       | sales only, every page, each currency's digits, book currency, business day                                                                                                                                      |
| B.2.9 seller commission       | read `invoices.cost_total` (no such column), mixed currencies, rate from the query string, filtered on `seller_employee_id` which nothing writes; `catch (err: any)` | **route removed** — NEEDS_OWNER_DECISION: who is «the seller» of an invoice                                                                                                                                      |
| B.2.23 field permissions      | `/api/products/redacted` read `products.cost_price` (no such column), redacted by `product.cost.read` (no such capability) — hid cost from everyone                  | route removed (no caller); the shared rule now names real capabilities                                                                                                                                           |
| B.2.24 restore to sandbox     | answered `restoredToSandbox` and restored nothing; never checked the target                                                                                          | route removed; PITR stays `BLOCKED_EXTERNAL`                                                                                                                                                                     |

**Writes that broke rule 4 or tenancy:**

| Item                                         | Defect                                                                                                                                           | Fix                                                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| B.2.13 RFQ choose                            | three separate writes, two errors ignored, `/100` (AFN), UTC day, double click = two POs, wrote `purchase_orders` (no screen)                    | `rfq_choose_quotation` — one transaction, lock order RFQ→quotation, no purchase document (`rfq-purchase-contracts-02`)                  |
| B.2.13 add quotation / B.2.14 contract price | any RFQ / supplier / product / contract id accepted                                                                                              | each proven to be this workspace's; contract must be with that supplier, in its currency                                                |
| B.2.8 bundles                                | mark + DELETE + INSERT as three calls; foreign components allowed                                                                                | `product_bundle_set_items` — one transaction, no nesting, no foreign component (`bundles-consignment-commission-02`)                    |
| B.2.10 consignment                           | any party / warehouse / product id                                                                                                               | proven to be this workspace's                                                                                                           |
| B.2.4 accruals                               | two inserts (a zero period left a schedule with no periods); accounts unchecked; 31 Jan + 1 month = 3 Mar                                        | `accrual_schedule_create` — one transaction, both accounts this workspace's, periods add up; month-end clamped (`accrual-schedules-02`) |
| B.2.5 / B.2.18 client                        | the hooks unwrapped ONE layer of `{ data }` from the axios response: the expense-claims list was always empty, the cheque list crashed on `.map` | `lib/response-body.ts` (two layers), used by both                                                                                       |
| B.2.5 cheque screen                          | its table read a namespace-scoped translator — `t()` threw on «cheques.cheques.…»                                                                | full-key reader `useTableLabel`                                                                                                         |

**Screens added (routes that had no client):** RFQ + contract prices and consignment (warehouse hub ›
stock), org chart + employee file (team hub › team), RFM (customers hub › outreach), record snapshots
(data hub, manager and up), bundle editor (product page). Each: `DataTable`, separate loading / error /
empty, refusal codes translated, fa/af/en, offline-matrix rows (`online_required`). Guards:
`packages/ui/src/__tests__/erp-core-screens.test.ts`, `backend/src/__tests__/v61-audit-services.test.ts`,
`backend/src/__tests__/v61-columns-exist.test.ts` (injection-tested: putting `name` back turns it red).

**Still not done (honest):** accrual schedules have no screen yet; bundle sales do not expand into
component stock (`expandBundleStockAndCost` has no caller); purchase-contract prices do not prefill the
purchase invoice (`resolvePurchaseContractPrice` has no caller); product translations are stored but
displayed nowhere; approval policies (B.2.7) are a second approval engine beside `/approvals` and no
document ever creates a request (`createRequestIfRequired` has no caller) — NEEDS_OWNER_DECISION: merge
into the existing workflow approvals; seller commission (above).

**Migrations added — PENDING HUMAN CONFIRMATION** (run after their `-01`): `rfq-purchase-contracts-02`,
`bundles-consignment-commission-02`, `accrual-schedules-02`, each with `VERIFY-*.sql` and a
`*.pg.test.ts` (pg tests BLOCKED here: `initdb.exe` missing). The `hr-org-appraisal-01.pg.test.ts`
inserted employees by `name`; it was corrected.

## 0.2 Owner decisions — 12 Nov 2026

> **خلاصه برای مالک.** فروشنده‌ی فاکتور حالا یکی از اعضای کسب‌وکار است (پیش‌فرض: صادرکننده) و فروش هر نفر
> در هاب تیم دیده می‌شود. تأییدها یک موتور شدند (`/approvals`): صادرکننده نمی‌تواند سند خودش را تأیید کند،
> و شرط مبلغ به ارز دفاتر و برای فروش/خرید جدا نوشته می‌شود. «آسان پرداخت» درگاه ایرانی است — ساخته نشد.

| Decision          | What the owner chose                                                | What was built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Status                        |
| ----------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1 · seller        | a workspace MEMBER (owner, manager, employee…), the owner sees each | `invoices.seller_user_id` (override only; NULL = the issuer `user_id`), proven a current member on the server (`resolveSellerOverride`); seller picker on a sale (`SellerSelectField`); `GET /api/invoices/sales-by-seller` per seller and currency, owner/admin/manager see all, others only themselves; team hub › «فروش هر نفر». No commission: no rate exists. Migration `invoices-seller-01`                                                                                                                                                  | IMPLEMENTED_NOT_LIVE_VERIFIED |
| 2 · approvals     | merge into `/approvals` for sensitive documents                     | ONE engine (rules + workflow templates + `/approvals`). Ported the V61 rule: the issuer of an invoice cannot approve it (owner exempt — a one-person business must not be stuck) — `refusesSelfApproval`. A template's condition now names sales / purchases / both and compares `invoice.total_book` (total × the invoice's rate). The V61 policy engine (4 routes, service, 4 hooks, schema) was removed: no screen, no caller creating requests, and any member could write a policy. Its tables are left; dropping them is a separate decision | IMPLEMENTED_NOT_LIVE_VERIFIED |
| 3 · local gateway | «آسان پرداخت»                                                       | **Not built.** asanpardakht.ir is an Iranian PSP (Tehran, licensed by Iran's central bank), not an Afghan gateway. The Afghan gateway with public merchant docs is HesabPay (docs.hesab.com: hosted checkout + webhook, AFN). No adapter is written against an API that has not been run with real merchant credentials                                                                                                                                                                                                                            | NEEDS_OWNER_DECISION          |

**Not covered by the merged engine (said, not hidden):** expense claims, returns and manual journal
entries are not held by a rule — the template screen says «not applied to this kind of document yet».
The proposal's `approval_thresholds` table + `document_requires_approval` function were NOT built: a
third engine, with seed rows on a fake workspace id and a currency TODO.

**Console (V63 items the owner listed):** IP allow-list, sessions + force logout and 2FA for every admin
were already built (V63-113 #46–48); the failed-login monitor (#49) was built by the parallel V63 session;
two-person approval now also covers the two console DELETIONS — removing a member (`MEMBER_REMOVE`) and an
IP allow-list entry (`IP_ALLOWLIST_REMOVE`): the click proposes, a different admin's approval deletes,
before the request reads APPROVED. Migration `admin-action-types-03`; until it runs those two deletions
answer 503 `ADMIN_ACTION_TYPE_NOT_INSTALLED` (no direct-delete fallback).

**Migrations — PENDING HUMAN CONFIRMATION:** `invoices-seller-01`, `admin-action-types-03` (after 02),
each with `VERIFY-*.sql` and a `*.pg.test.ts` (pg BLOCKED here: `initdb.exe` missing).

## Phase 0 — Preflight & Specs

- [x] Read `AGENTS.md`, `CLAUDE.md`, `.claude/skills/hisabche-session-rules/SKILL.md`, `docs/prompts/V61-ERP-CORE-COMPLETION.md`
- [x] Static checks (`git status --short`, `git log -3`, `node scripts/audit-unwired-routes.mjs`)
- [x] Write `docs/architecture/V61-PREFLIGHT-AUDIT.md`
- [x] Write `docs/architecture/infra/V61-INFRA-SPEC.md`
- [x] Write `docs/architecture/infra/V61-INFRA-PLAN.md`

---

## Part A §2 — P0 (in order)

- [x] **2.1** Registry truth (`business-capabilities.ts`, `capability-has-consumer.test.ts`, injection-tested)
- [x] **2.2** Two time-entry stores (`FINDING-time-entries-two-stores.sql`, `time-entries-unify-01-migration.sql`, `TimesheetsService` adapter, remove `KNOWN DEFECT` in `v60-http-families.test.ts`)
- [x] **2.3** Honest `workflowComplete` (`coverage-data.mjs`, remove `wedding` rental alias)
- [x] **2.4** Sales order lifecycle (`sales-orders-02-migration.sql`, `VERIFY`, `.pg.test.ts`, `sales-order-lifecycle.ts`, `orders/*`, `v60-http-families.test.ts`)
- [x] **2.5** Batch & serial correctness (`TraceabilityService.restoreBatchesForReturn`, `InvoiceReturnService`, `local-engine/routes/serials.ts`, `handleSerialSyncConflict` in `sync-engine.ts`)
- [x] **2.6** Procurement (`PurchasingService.receiveGoods` partial receipt + over-receipt refusal, `checkSupplierPaymentMatchGate` in `PaymentsService.recordPayment`)
- [x] **2.7** Overhead allocation (`overhead-allocation-01-migration.sql`, `overhead-allocation.service.ts`, `ledger.postDocument` / `reverseDocument`, `accounting.routes.ts`)
- [x] **2.8** Resource capacity race (`local-engine/routes/bookings.ts`, `handleBookingSyncConflict` in `sync-engine.ts`, `offline-endpoint-matrix.ts`)
- [x] **2.9** Operations → ledger E2E HTTP tests (`v61-erp-core-http.test.ts`)

---

## Part B — 85 ERP Core Items (B.3 order)

- [x] **1. B.2.26** Tenancy hardening (`FINDING-workspace-id-nulls.sql`, `tenancy-02-migration.sql`, `VERIFY-tenancy-02.sql`, `tenancy-02.pg.test.ts`, `tenancy-static-guard.test.ts`, `rls-coverage.test.ts`)
- [x] **2. B.2.22** Field-level audit + document versions (`document-revisions-01-migration.sql`, `VERIFY-document-revisions-01.sql`, `document-revisions-01.pg.test.ts`, `document-revisions.ts`, `audit.service.ts`, `audit.routes.ts`, `audit-trail.ts`, `record-history-panel.tsx`)
- [x] **3. B.2.7** One approval policy for documents (`approval-policy-01-migration.sql`, `VERIFY-approval-policy-01.sql`, `approval-policy-01.pg.test.ts`, `approval-policy.ts`, `approval-policy.service.ts`, `workflow.routes.ts`, `use-workflow.ts`, `approval-policy.test.ts`)
- [x] **4. B.2.1** Multi-currency journal lines (`journal-lines-currency-memorandum-01-migration.sql`, `VERIFY-journal-lines-currency-memorandum-01.sql`, `journal-lines-currency-memorandum-01.pg.test.ts`, `accounting.domain.ts`, `accounting.repository.ts`, `journal-currency-memorandum.test.ts`)
- [x] **5. B.2.2** Memorandum (off-balance) accounts (`journal-lines-currency-memorandum-01-migration.sql`, `accounting.reports.ts`, `accounting.domain.ts`, `accounting.repository.ts`, `journal-currency-memorandum.test.ts`)
- [x] **6. B.2.5** Cheque lifecycle (`cheques-01-migration.sql`, `VERIFY-cheques-01.sql`, `cheques-01.pg.test.ts`, `cheques.ts`, `cheques.service.ts`, `payments.routes.ts`, `payments.ts`, `cheques.test.ts`) — money and day fixed, screen added (§0)
- [x] **7. B.2.4** Accrual/prepayment schedules + auto-reversing journals (`accrual-schedules-01-migration.sql`, `VERIFY-accrual-schedules-01.sql`, `accrual-schedules-01.pg.test.ts`, `accrual-schedules.ts`, `accrual-schedules.service.ts`, `accounting.routes.ts`, `accrual-schedules.test.ts`) — amounts fixed (`tillMinorToMajor`); **schedule creation is still two writes without an RPC** (§0.3)
- [x] **8. B.2.18, B.2.19** Expense claims + scheduled reports (`expense-claims.service.ts`, `expense-claims.domain.ts`, `expense-claims-section.tsx`, `human-resources.routes.ts`, hooks in `packages/api/src/hooks/expense-claims.ts`, `expense-claims.test.ts`, `expense-claims-screen.test.ts`, `expense-claims-migration.pg.test.ts`, `scheduled-reports.service.ts`, `scheduled-reports.test.ts`) — the screen exists now; approval books nothing, by decision (§0.1)
- [x] **9. B.2.8, B.2.10, B.2.9** Product bundles, Consignment in/out, Seller commission (`bundles-consignment-commission-01-migration.sql`, `VERIFY-bundles-consignment-commission-01.sql`, `bundles-consignment-commission-01.pg.test.ts`, `bundles-consignment-commission.ts`, `bundles-consignment-commission.service.ts`, `product.routes.ts`, `warehouse.routes.ts`, `invoice.routes.ts`, `bundles-consignment-commission.test.ts`)
- [x] **10. B.2.13, B.2.14** RFQ & supplier quotations, Long-term purchase contracts (`rfq-purchase-contracts-01-migration.sql`, `VERIFY-rfq-purchase-contracts-01.sql`, `rfq-purchase-contracts-01.pg.test.ts`, `rfq-purchase-contracts.ts`, `rfq-contracts.service.ts`, `purchasing.routes.ts`, `rfq-purchase-contracts.test.ts`)
- [x] **11. B.2.6** Budget warning at posting (`budget-posting-warning.ts`, `accounting.routes.ts`, `budget-posting-warning.test.ts`)
- [x] **12. B.2.3** Chart-of-accounts templates per trade (`coa-templates.ts`, `accounting.service.ts`, `accounting.routes.ts`, `coa-templates.test.ts`)
- [x] **13. B.2.15, B.2.16** RFM segmentation, SMS channel-agnostic outbox (`rfm-segmentation.ts`, `crm.routes.ts`, `messaging-outbox-01-migration.sql`, `VERIFY-messaging-outbox-01.sql`, `messaging-outbox-01.pg.test.ts`, `messaging-outbox.service.ts`, `notification.routes.ts`, `rfm-sms-outbox.test.ts`; SMS stays `BLOCKED_EXTERNAL_CREDENTIAL`)
- [x] **14. B.2.17** Employee file, org chart (`reports_to`), appraisal (`hr-org-appraisal-01-migration.sql`, `VERIFY-hr-org-appraisal-01.sql`, `hr-org-appraisal-01.pg.test.ts`, `hr-org-appraisal.ts`, `hr-org-appraisal.service.ts`, `human-resources.routes.ts`, `hr-org-appraisal.test.ts`)
- [x] **15. B.2.21, B.2.23** Data-level translations, Field-level permissions (`data-translations-01-migration.sql`, `VERIFY-data-translations-01.sql`, `data-translations-01.pg.test.ts`, `data-translations-and-field-perms.ts`, `product.routes.ts`, `translations-field-perms.test.ts`)
- [x] **16. B.2.11, B.2.12** Tax-compliant invoice templates + tax report, Customer payment gateway (`tax-templates-and-gateway.ts`, `tax.routes.ts`, `customer-payment-gateway-01-migration.sql`, `VERIFY-customer-payment-gateway-01.sql`, `customer-payment-gateway-01.pg.test.ts`, `customer-gateway.service.ts`, `payment-webhook.routes.ts`, `tax-templates-and-gateway.test.ts`; `NEEDS_OWNER_DECISION` for Afghan legal tax wording; gateway `BLOCKED_EXTERNAL_CREDENTIAL`)
- [x] **17. B.2.20, B.2.24, B.2.25** Plugins = installable apps, Backups/restore-to-sandbox, Workspace 2FA (`plugin-manifest.ts`, `developer.routes.ts`, `snapshots.routes.ts`, `workspace-2fa-01-migration.sql`, `VERIFY-workspace-2fa-01.sql`, `workspace-2fa-01.pg.test.ts`, `services/authorization/workspace-2fa.service.ts`, `settings/two-factor-section.tsx`, `auth.routes.ts`, `plugins-backups-2fa.test.ts`; real TOTP, §0; PITR stays `BLOCKED_EXTERNAL`)

---

## Part C — Survivable Infrastructure (C.4.1 → C.4.11)

- [x] **C.4.1** Process roles (`backend/src/runtime/{role,start-api,start-worker,shutdown}.ts`, `render.yaml`)
- [x] **C.4.2** DB routing primary vs replica (`backend/src/db/{primary,replica,admin,routing,index}.ts` + guard)
- [x] **C.4.3** Pooler-safe postgres.js + `pg_advisory_lock` guard + `docs/role-timeouts-01-migration.sql`
- [x] **C.4.4** Load shedding & backpressure (`runtime/pressure.ts` + wired in `backend/src/index.ts`)
- [x] **C.4.5** Degraded modes (`runtime/service-mode.ts`, `SERVICE_READ_ONLY` wired in `backend/src/index.ts`)
- [x] **C.4.6** Timeouts, retries, circuit breaker (`runtime/breaker.ts`)
- [x] **C.4.7** Redis strictly optional
- [x] **C.4.8** Observability (`/metrics` + structured logs + SLOs + OTel ADR)
- [x] **C.4.9** Chaos & failover resilience tests + `scripts/resilience/*.js` (k6) + runbooks
- [x] **C.4.10** Hot-row & deadlock discipline (`LOCK-ORDER.md` + guard)
- [x] **C.4.11** Backups & monthly restore-to-sandbox job + infra docs (`00-OVERVIEW`..`04-CAPACITY`, ADRs, runbooks)

---

## Part A §3 & §4 — P1 UI & P2 Design Notes

- [x] **P1** Contracts/leases/SLA UI (`customers/contracts-section.tsx`), Quality inspection + CAPA (`quality.routes.ts` / `quality_events`), Warranty claim UI (`invoices/warranties-section.tsx`), Support ticket + SLA (`packages/validation/src/schemas/repair-tickets.ts` — `TICKET_KINDS`, `isTicketSlaBreached`), Milestone billing (`project.routes.ts`), Asset rental (stays `planned` pending HTTP deposit release), Package-credit grant UI (`service-delivery/package-grants-panel.tsx`), Delivery POD + fleet UI (`sales-orders-container.tsx` + `transport.routes.ts`), Forecast horizon (`?horizon` / `?windows` 30/60/90 + `insufficient_data`), Approvals offline registry (`online_required`), Landed cost (`docs/landed-costs-migration.sql` + `inventory-costing/repost.service.ts`)
- [x] **P2** Design notes (`V61-DESIGN-PICK-LIST-PUTAWAY.md`, `V61-DESIGN-MRP.md`, `V61-DESIGN-WORKSTATION-ROUTING.md`, `V61-DESIGN-SUBCONTRACTING.md`, `V61-DESIGN-PREVENTIVE-MAINTENANCE.md`, `V61-PART-C-OWNER-ACTIONS.md`)

> The P1 paths above were checked on disk on 12 Nov 2026: the first version of this line named
> `warranties-section.tsx`, `package-grants-panel.tsx` and `backend/src/routes/repair-tickets.ts`,
> and **none of the three is at that path** — the features exist, the paths did not.

---

## NEEDS_OWNER_DECISION Log

- **Expense approval → ledger (`B.2.18`):** needs an operating-expense `AccountRole` and a decision
  about which account a business's expense is posted to. Until then approval records the decision and
  books nothing, and both the service and the screen say so.
- **Employee as a payment party (`B.2.18`):** `payments_party_check` allows `customer | supplier`; a
  reimbursement is recorded as `supplier` with the employee id. A first-class `employee` party is a
  schema change plus a payments decision.
- **Accrual schedule creation (`B.2.4`):** two tables written in two statements; needs a Postgres
  function (supabase-js has no transactions).
- **Afghan legal tax template wording (`B.2.11`):** Tax template rates and official wording require
  owner/CPA legal confirmation before production use.
- **External SMS & customer payment gateway providers (`B.2.16`, `B.2.12`):**
  `BLOCKED_EXTERNAL_CREDENTIAL` — channel-agnostic outbox and webhook verifier built; requires live
  provider credentials from owner.
- **Managed HA / PITR / Read Replica / Region Co-location (`Part C`):** `BLOCKED_EXTERNAL` —
  documented in `V61-PART-C-OWNER-ACTIONS.md` for the Supabase & Render dashboards.
- **Scope deferrals (`Part A §4`):** Finance books, multi-company consolidation beyond existing
  workspace model, EDI, KB, and dropship require owner product decision before any design/build.

---

## Final Verification — measured, 12 Nov 2026

Commands were run from each package's folder. «Not re-run» means exactly that: the number beside it
comes from an earlier run of this round and was not re-measured today.

| Package                | Command                                                               | Result                                                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/ui`          | `npx vitest run`                                                      | **218 passed \| 1 skipped** of 219 files · **2708 passed \| 2 skipped** of 2710 tests · 0 failed                                                                               |
| `packages/ui`          | `npx tsc --noEmit`                                                    | exit **0**                                                                                                                                                                     |
| `packages/ui`          | `npx eslint` (expense-claims-section, team-and-payroll-view, 2 tests) | **0 errors, 0 warnings**                                                                                                                                                       |
| `packages/ui`          | `npx eslint` (containers/team-and-payroll-container.tsx)              | 0 errors, **1 pre-existing** `react-hooks/exhaustive-deps` warning (`employees` feeding a `useMemo`) — the file was edited, the warning was already there                      |
| `packages/i18n`        | `npx vitest run`                                                      | **2 files · 29 tests passed** (all three locales parse; 63 new keys × 3)                                                                                                       |
| `packages/validation`  | `npx tsc --noEmit`                                                    | exit **0**                                                                                                                                                                     |
| `packages/validation`  | `npx vitest run src/__tests__/universal-core.test.ts`                 | **28/28 passed** (whole package not re-run)                                                                                                                                    |
| `packages/api`         | `npx tsc --noEmit`                                                    | exit **0**                                                                                                                                                                     |
| `packages/api`         | `npx eslint src/hooks/expense-claims.ts src/index.ts`                 | exit **0**                                                                                                                                                                     |
| `backend`              | `npx tsc --noEmit`                                                    | exit **0** (including the new `expense-claims-migration.pg.test.ts`)                                                                                                           |
| `backend`              | `npx vitest run src/__tests__/expense-claims.test.ts`                 | **14/14 passed**; injection-tested: restoring `totalMinor / 100` turned 2 red                                                                                                  |
| `backend`              | `npx vitest run --project unit --maxWorkers=8`                        | **425 passed \| 16 failed** of 441 files · **5579 passed \| 26 failed** of 5605 tests — every failure is in the **abandoned V63 admin-console** files in this tree (see below) |
| `backend` (pg project) | `npx vitest run --project pg`                                         | **NOT RUN** — `embedded-postgres` `initdb.exe` is missing on this host                                                                                                         |
| `apps/desktop`         | `npx jest`                                                            | not re-run this round                                                                                                                                                          |

**The 26 red backend tests are not this round's work.** They come from the uncommitted V63
admin-console changes still in the working tree (`admin-*.routes.ts`, `blog.routes.ts`,
`oauth.routes.ts`, `market.routes.ts`, `ai-chat.routes.ts`, `admin-rbac.middleware.ts`, plus the new
`admin-route-chain.test.ts` and `monitoring-wall.test.ts`), whose guard tests still expect the old
source shape. V63 was abandoned, so they were left untouched: fixing them means choosing V63's
future, not V61's. **Owner decision, 12 Nov 2026: leave them exactly as they are and record the
failure here.** With the V63 paths removed from the tree, every other backend unit test passes.

**pg / SQL.** `docs/expense-claims-migration.sql` had no `*.pg.test.ts`; it has one now
(`expense-claims-migration.pg.test.ts`, migration run twice, then the VERIFY, then refusals and
allowances), and `docs/VERIFY-expense-claims.sql` grew from a column listing to 9 named checks.
Neither could be executed here. Migration verification:
`Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.
