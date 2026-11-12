# V61 Implementation Progress

- **Started:** 2026-11-12
- **HEAD:** `0b68fe4e`
- **Unwired routes (before):** `routes: 946 · client path strings: 746 · with no caller: 100`
- **Baseline UI fixes (V60.1 carryover):** Fixed `customers-hub-container.tsx` (`useHubSection`), `docs-content.ts` + `fa/af/en` (`docs.contracts-recurring.*`), `no-hardcoded-currency.test.ts` (path), `composition-plan-summary.tsx` (statusMap + default menuGroups).

---

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
- [x] **6. B.2.5** Cheque lifecycle (`cheques-01-migration.sql`, `VERIFY-cheques-01.sql`, `cheques-01.pg.test.ts`, `cheques.ts`, `cheques.service.ts`, `payments.routes.ts`, `payments.ts`, `cheques.test.ts`)
- [x] **7. B.2.4** Accrual/prepayment schedules + auto-reversing journals (`accrual-schedules-01-migration.sql`, `VERIFY-accrual-schedules-01.sql`, `accrual-schedules-01.pg.test.ts`, `accrual-schedules.ts`, `accrual-schedules.service.ts`, `accounting.routes.ts`, `accrual-schedules.test.ts`)
- [x] **8. B.2.18, B.2.19** Wire `expense_claims` + `scheduled-reports.service.ts` (`expense-claims.service.ts`, `human-resources.routes.ts`, `employees.ts`, `custom-reports.routes.ts`, `unwired-capability.test.ts`, `expense-claims.test.ts`, `scheduled-reports.test.ts`)
- [x] **9. B.2.8, B.2.10, B.2.9** Product bundles, Consignment in/out, Seller commission (`bundles-consignment-commission-01-migration.sql`, `VERIFY-bundles-consignment-commission-01.sql`, `bundles-consignment-commission-01.pg.test.ts`, `bundles-consignment-commission.ts`, `bundles-consignment-commission.service.ts`, `product.routes.ts`, `warehouse.routes.ts`, `invoice.routes.ts`, `bundles-consignment-commission.test.ts`)
- [x] **10. B.2.13, B.2.14** RFQ & supplier quotations, Long-term purchase contracts (`rfq-purchase-contracts-01-migration.sql`, `VERIFY-rfq-purchase-contracts-01.sql`, `rfq-purchase-contracts-01.pg.test.ts`, `rfq-purchase-contracts.ts`, `rfq-contracts.service.ts`, `purchasing.routes.ts`, `rfq-purchase-contracts.test.ts`)
- [x] **11. B.2.6** Budget warning at posting (`budget-posting-warning.ts`, `accounting.routes.ts`, `budget-posting-warning.test.ts`)
- [x] **12. B.2.3** Chart-of-accounts templates per trade (`coa-templates.ts`, `accounting.service.ts`, `accounting.routes.ts`, `coa-templates.test.ts`)
- [x] **13. B.2.15, B.2.16** RFM segmentation, SMS channel-agnostic outbox (`rfm-segmentation.ts`, `crm.routes.ts`, `messaging-outbox-01-migration.sql`, `VERIFY-messaging-outbox-01.sql`, `messaging-outbox-01.pg.test.ts`, `messaging-outbox.service.ts`, `notification.routes.ts`, `rfm-sms-outbox.test.ts`; SMS stays `BLOCKED_EXTERNAL_CREDENTIAL`)
- [x] **14. B.2.17** Employee file, org chart (`reports_to`), appraisal (`hr-org-appraisal-01-migration.sql`, `VERIFY-hr-org-appraisal-01.sql`, `hr-org-appraisal-01.pg.test.ts`, `hr-org-appraisal.ts`, `hr-org-appraisal.service.ts`, `human-resources.routes.ts`, `hr-org-appraisal.test.ts`)
- [x] **15. B.2.21, B.2.23** Data-level translations, Field-level permissions (`data-translations-01-migration.sql`, `VERIFY-data-translations-01.sql`, `data-translations-01.pg.test.ts`, `data-translations-and-field-perms.ts`, `product.routes.ts`, `translations-field-perms.test.ts`)
- [x] **16. B.2.11, B.2.12** Tax-compliant invoice templates + tax report, Customer payment gateway (`tax-templates-and-gateway.ts`, `tax.routes.ts`, `customer-payment-gateway-01-migration.sql`, `VERIFY-customer-payment-gateway-01.sql`, `customer-payment-gateway-01.pg.test.ts`, `customer-gateway.service.ts`, `payment-webhook.routes.ts`, `tax-templates-and-gateway.test.ts`; `NEEDS_OWNER_DECISION` for Afghan legal tax wording; gateway `BLOCKED_EXTERNAL_CREDENTIAL`)
- [x] **17. B.2.20, B.2.24, B.2.25** Plugins = installable apps, Backups/restore-to-sandbox, Workspace 2FA (`plugin-manifest.ts`, `developer.routes.ts`, `snapshots.routes.ts`, `workspace-2fa-01-migration.sql`, `VERIFY-workspace-2fa-01.sql`, `workspace-2fa-01.pg.test.ts`, `workspace-2fa.service.ts`, `auth.routes.ts`, `plugins-backups-2fa.test.ts`; PITR stays `BLOCKED_EXTERNAL`)

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

- [x] **P1** Contracts/leases/SLA UI (`contracts-section.tsx`), Quality inspection + CAPA (`quality.routes.ts` / `quality_events`), Warranty claim UI (`warranties-section.tsx`), Support ticket + SLA (`repair-tickets.ts` `TICKET_KINDS` + `isTicketSlaBreached`), Milestone billing (`project.routes.ts`), Asset rental (stays `planned` pending HTTP deposit release), Package-credit grant UI (`package-grants-panel.tsx`), Delivery POD + fleet UI (`sales-orders-container.tsx` + `transport.routes.ts`), Forecast horizon (`?horizon` / `?windows` 30/60/90 + `insufficient_data`), Approvals offline registry (`online_required`), Landed cost (`docs/landed-costs-migration.sql` + `repost.service.ts`)
- [x] **P2** Design notes (`V61-DESIGN-PICK-LIST-PUTAWAY.md`, `V61-DESIGN-MRP.md`, `V61-DESIGN-WORKSTATION-ROUTING.md`, `V61-DESIGN-SUBCONTRACTING.md`, `V61-DESIGN-PREVENTIVE-MAINTENANCE.md`, `V61-PART-C-OWNER-ACTIONS.md`)

---

## NEEDS_OWNER_DECISION Log

- **Afghan legal tax template wording (`B.2.11`):** Tax template rates and official wording require owner/CPA legal confirmation before production use.
- **External SMS & customer payment gateway providers (`B.2.16`, `B.2.12`):** `BLOCKED_EXTERNAL_CREDENTIAL` — channel-agnostic outbox and webhook verifier built; requires live provider credentials from owner.
- **Managed HA / PITR / Read Replica / Region Co-location (`Part C`):** `BLOCKED_EXTERNAL` — documented in `V61-PART-C-OWNER-ACTIONS.md` for Supabase & Render dashboards.
- **Scope deferrals (`Part A §4`):** Finance books, multi-company consolidation beyond existing workspace model, EDI, KB, and dropship require owner product decision before any design/build.

---

## Final Verification (§9)

- [x] `packages/validation`: `tsc --noEmit` + `vitest run` (`76/76` files, `993/993` tests)
- [x] `packages/api`: `tsc --noEmit` + `vitest run` (`38/38` files, `293/293` tests)
- [x] `packages/local-engine`: `tsc --noEmit` + `vitest run` (`85/85` files, `565/565` tests)
- [x] `packages/ui`: `tsc --noEmit` + `vitest run` (`215` passed | `1` skipped of `216` files, `2695` passed | `2` skipped of `2697` tests)
- [x] `backend`: `tsc --noEmit` + `vitest run --exclude '**/*.pg.test.ts'` (`428/428` files, `5468/5468` tests)
- [x] `apps/desktop`: `npx jest` (`37/37` suites, `328/328` tests)
- [x] `packages/app-shell` & `apps/web` `tsc --noEmit`: exit `0`
- [x] `node scripts/audit-unwired-routes.mjs`, matrix generators, ESLint (`0` errors), `git diff --check` (`0`)
- [x] `docs/architecture/V61-ACCEPTANCE-RESULTS.md` written
- [ ] `*.pg.test.ts`: `BLOCKED` (`embedded-postgres` `initdb.exe` missing on Windows host); live SQL migrations: `PENDING HUMAN CONFIRMATION`
