# UNIVERSAL CAPABILITY MATRIX — Engineering Completeness

> Generated from the audit data by the generator described in UNIVERSAL-CAPABILITY-GAP-AUDIT.md §29. Engineering completeness ONLY — NOT a market, product, company or quality score.
> Source of every cell: the evidence column and the audit's Passes B–M (HEAD at the time of the audit is recorded in AUDIT-BASELINE.md).

## Scoring formula (fixed BEFORE scoring)

13 dimensions: Dom (domain rules), Dat (data / schema), Api, Aut (authorization), Acc (accounting effect), Inv (inventory effect), Off (offline), Syn (sync), UI (UI contract), I18 (i18n), Tst (tests), Mig (migration / VERIFY), Doc (documentation).

Cell values: **P** proven = 1 · **H** partial = 0.5 · **X** missing = 0 · **U** unverified = 0 (kept in the denominator) · **B** blocked external = 0 (kept in the denominator) · **N** not applicable = excluded from the denominator.

Capability score = Σ cell values ÷ (number of non-N cells) × 100.
(A) Unweighted coverage = mean of capability scores. (B) Demand-weighted = Σ(score × demand) ÷ Σ demand, demand = number of the 50 archetypes whose required list contains the capability (INDUSTRY-CAPABILITY-MATRIX.md). (C) Financial-integrity subscore = the same score restricted to Dom, Dat, Aut, Acc, Inv, Off, Syn, Tst, Mig, averaged over all capabilities.

## Result

| Measure                                  | Value          |
| ---------------------------------------- | -------------- |
| Capabilities audited                     | 34             |
| (A) Unweighted engineering coverage      | **70.1 / 100** |
| (B) Demand-weighted engineering coverage | **86.2 / 100** |
| (C) Financial-integrity subscore         | **67.2 / 100** |

Recompute: (A) = 2385.0 ÷ 34; (B) = 35953.8 ÷ 417; (C) = 2286.3 ÷ 34.

## Matrix

| Capability                                                         | Impl        | Verif              | Arch           | Flags                      | Dom | Dat | Api | Aut | Acc | Inv | Off | Syn | UI  | I18 | Tst | Mig | Doc | Score          | Fin   | Demand |
| ------------------------------------------------------------------ | ----------- | ------------------ | -------------- | -------------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | -------------- | ----- | ------ |
| LEDGER — Ledger / journal posting / period lock                    | IMPLEMENTED | PARTIALLY_VERIFIED | CORRECT        | —                          | P   | P   | P   | P   | P   | N   | H   | P   | P   | P   | P   | P   | P   | 11.5/12 = 95.8 | 93.8  | 50     |
| PAYMENT — Payment / settlement / allocation / till                 | IMPLEMENTED | PARTIALLY_VERIFIED | CORRECT        | NEEDS_OWNER_DECISION(OD-4) | P   | P   | P   | P   | P   | N   | H   | P   | P   | P   | P   | P   | P   | 11.5/12 = 95.8 | 93.8  | 50     |
| INVOICE — Invoice (sale / purchase / tax / FX)                     | IMPLEMENTED | PARTIALLY_VERIFIED | CORRECT        | NEEDS_OWNER_DECISION(OD-3) | P   | P   | P   | P   | P   | P   | H   | P   | P   | P   | P   | P   | P   | 12.5/13 = 96.2 | 94.4  | 50     |
| RETURNS — Sales / purchase return, refund, scrap                   | IMPLEMENTED | PARTIALLY_VERIFIED | CORRECT        | —                          | P   | P   | P   | P   | P   | P   | H   | P   | P   | P   | P   | H   | P   | 12/13 = 92.3   | 88.9  | 9      |
| INV_QTY — Inventory quantity / warehouse / shelf / transfer        | IMPLEMENTED | PARTIALLY_VERIFIED | CORRECT        | —                          | P   | P   | P   | P   | P   | P   | P   | P   | P   | P   | P   | P   | P   | 13/13 = 100.0  | 100.0 | 31     |
| COSTING — Cost layers / FIFO / AVCO / void receipt                 | IMPLEMENTED | PARTIALLY_VERIFIED | CORRECT        | BLOCKED_EXTERNAL           | P   | P   | P   | P   | P   | P   | H   | H   | P   | P   | H   | P   | P   | 11.5/13 = 88.5 | 83.3  | 28     |
| PKG_SERVICE — Package credit / service delivery / deferred revenue | IMPLEMENTED | PARTIALLY_VERIFIED | CORRECT        | BLOCKED_EXTERNAL           | P   | P   | P   | P   | P   | N   | H   | H   | P   | P   | H   | P   | P   | 10.5/12 = 87.5 | 81.3  | 9      |
| PROFIT — Profit / ledger-based reporting                           | IMPLEMENTED | PARTIALLY_VERIFIED | CORRECT        | —                          | H   | P   | P   | P   | P   | P   | P   | P   | P   | P   | P   | P   | P   | 12.5/13 = 96.2 | 94.4  | 1      |
| FX — Multi-currency (books currency, frozen rate)                  | IMPLEMENTED | PARTIALLY_VERIFIED | CORRECT        | —                          | P   | P   | P   | P   | P   | P   | H   | P   | P   | P   | P   | H   | P   | 12/13 = 92.3   | 88.9  | 5      |
| AUTHZ — Capability / role / scope / entitlement                    | PARTIAL     | PARTIALLY_VERIFIED | NEEDS_REFACTOR | NEEDS_OWNER_DECISION       | H   | P   | P   | P   | N   | N   | P   | P   | P   | P   | H   | P   | P   | 10/11 = 90.9   | 85.7  | 1      |
| OFFLINE_SYNC — Local DB / outbox / sync / conflicts                | IMPLEMENTED | PARTIALLY_VERIFIED | CORRECT        | BLOCKED_EXTERNAL           | P   | P   | P   | P   | N   | N   | P   | P   | P   | P   | H   | P   | P   | 10.5/11 = 95.5 | 92.9  | 50     |
| PARTY_CRM — Customer / supplier / 360 / portal                     | IMPLEMENTED | PARTIALLY_VERIFIED | CORRECT        | —                          | P   | P   | P   | H   | P   | N   | H   | P   | P   | P   | P   | P   | P   | 11/12 = 91.7   | 87.5  | 50     |
| HR_PAYROLL — Employees / payroll / attendance / leave              | IMPLEMENTED | PARTIALLY_VERIFIED | CORRECT        | —                          | P   | P   | P   | P   | P   | N   | H   | P   | P   | P   | P   | H   | P   | 11/12 = 91.7   | 87.5  | 2      |
| MANUFACTURING — BOM / production / cost                            | PARTIAL     | PARTIALLY_VERIFIED | CORRECT        | —                          | P   | P   | P   | P   | X   | P   | X   | N   | P   | P   | P   | P   | P   | 10/12 = 83.3   | 75.0  | 4      |
| PROJECTS — Projects / tasks / members / time entries               | PARTIAL     | UNVERIFIED         | NEEDS_REFACTOR | —                          | H   | P   | P   | H   | N   | N   | X   | N   | P   | P   | H   | P   | H   | 7/10 = 70.0    | 58.3  | 7      |
| WORKFLOW — Approval / workflow / rules                             | IMPLEMENTED | PARTIALLY_VERIFIED | CORRECT        | —                          | P   | P   | P   | P   | N   | N   | X   | N   | P   | P   | P   | P   | P   | 9/10 = 90.0    | 83.3  | 0      |
| DEV_PLATFORM — API keys / webhooks / MCP / OAuth                   | IMPLEMENTED | PARTIALLY_VERIFIED | CORRECT        | —                          | P   | P   | P   | P   | N   | N   | N   | N   | P   | P   | P   | P   | P   | 9/9 = 100.0    | 100.0 | 0      |
| REPORTING — Reports / budgets / dashboards                         | IMPLEMENTED | PARTIALLY_VERIFIED | CORRECT        | —                          | P   | P   | P   | P   | P   | N   | H   | P   | P   | P   | P   | P   | P   | 11.5/12 = 95.8 | 93.8  | 1      |
| VARIANTS — Product variants                                        | PARTIAL     | PARTIALLY_VERIFIED | NEEDS_REFACTOR | CONTRADICTED_PRIOR_CLAIM   | H   | H   | P   | U   | N   | H   | P   | U   | H   | U   | H   | H   | H   | 5.5/12 = 45.8  | 43.8  | 4      |
| SERIAL_LOT — Serial / lot / batch / expiry / FEFO                  | PARTIAL     | PARTIALLY_VERIFIED | DUPLICATED     | CONTRADICTED_PRIOR_CLAIM   | H   | P   | P   | U   | N   | H   | X   | U   | H   | U   | H   | P   | H   | 5.5/12 = 45.8  | 43.8  | 7      |
| WARRANTY — Warranty (policy / period)                              | PARTIAL     | PARTIALLY_VERIFIED | CORRECT        | —                          | H   | H   | H   | U   | X   | N   | P   | U   | H   | U   | H   | H   | H   | 4.5/12 = 37.5  | 37.5  | 6      |
| AUTO_VEHICLE — Fitment / VIN / vehicle unit / core charge          | PARTIAL     | PARTIALLY_VERIFIED | DUPLICATED     | CONTRADICTED_PRIOR_CLAIM   | H   | H   | H   | U   | X   | X   | H   | U   | H   | U   | H   | H   | H   | 4/13 = 30.8    | 27.8  | 2      |
| MEASURE_AREA — Measurement / area / roll / dual UOM                | PARTIAL     | PARTIALLY_VERIFIED | DUPLICATED     | —                          | H   | H   | X   | N   | N   | X   | H   | U   | H   | H   | H   | X   | H   | 3.5/11 = 31.8  | 28.6  | 5      |
| PACK_BARCODE — Package-level barcode                               | IMPLEMENTED | PARTIALLY_VERIFIED | DUPLICATED     | —                          | P   | P   | P   | P   | N   | N   | P   | P   | P   | P   | P   | P   | P   | 11/11 = 100.0  | 100.0 | 6      |
| CREDIT_CONTROL — Credit limit enforcement                          | PARTIAL     | PARTIALLY_VERIFIED | WRONG_LAYER    | —                          | H   | P   | H   | P   | N   | N   | X   | X   | P   | P   | P   | P   | P   | 8/11 = 72.7    | 64.3  | 4      |
| ORDER_DEPOSIT — Pre-invoice deposit order                          | PARTIAL     | PARTIALLY_VERIFIED | NEEDS_REFACTOR | —                          | H   | H   | H   | U   | X   | X   | P   | U   | U   | U   | H   | H   | H   | 4/13 = 30.8    | 33.3  | 3      |
| DELIVERY — Delivery / courier / freight / COD                      | PARTIAL     | PARTIALLY_VERIFIED | NEEDS_REFACTOR | —                          | H   | H   | H   | U   | X   | U   | X   | N   | U   | U   | H   | H   | H   | 3/12 = 25.0    | 25.0  | 9      |
| PASSENGER — Passenger transport (seat / fare / manifest)           | PARTIAL     | UNVERIFIED         | NEEDS_REFACTOR | —                          | X   | H   | H   | U   | X   | N   | X   | N   | U   | U   | H   | H   | H   | 2.5/11 = 22.7  | 21.4  | 1      |
| APPOINTMENT — Appointment / service scheduling                     | PARTIAL     | PARTIALLY_VERIFIED | DUPLICATED     | —                          | H   | H   | H   | U   | X   | N   | X   | N   | U   | U   | H   | H   | H   | 3/11 = 27.3    | 28.6  | 8      |
| TIME_MATERIAL — Time + material billing                            | IMPLEMENTED | PARTIALLY_VERIFIED | CORRECT        | —                          | P   | P   | P   | U   | P   | H   | X   | N   | P   | P   | P   | P   | H   | 9/12 = 75.0    | 68.8  | 8      |
| MTO_WIP — Made-to-order / WIP accounting                           | PARTIAL     | PARTIALLY_VERIFIED | CORRECT        | —                          | H   | P   | P   | P   | X   | P   | X   | N   | P   | P   | P   | P   | P   | 9.5/12 = 79.2  | 68.8  | 2      |
| AGRI_LIVESTOCK — Agriculture / livestock                           | PARTIAL     | UNVERIFIED         | NEEDS_REFACTOR | —                          | X   | H   | H   | U   | X   | X   | X   | N   | U   | U   | H   | H   | H   | 2.5/12 = 20.8  | 18.8  | 2      |
| PRECIOUS_METAL — Gold / silver (purity, making, wastage, trade-in) | PARTIAL     | PARTIALLY_VERIFIED | DUPLICATED     | CONTRADICTED_PRIOR_CLAIM   | H   | H   | H   | U   | X   | X   | P   | U   | U   | U   | H   | H   | H   | 4/13 = 30.8    | 33.3  | 2      |
| COMPOSITION — Profile → capability → UI composition                | PARTIAL     | PARTIALLY_VERIFIED | NEEDS_REFACTOR | —                          | H   | H   | X   | X   | N   | N   | P   | N   | H   | H   | P   | N   | P   | 5/9 = 55.6     | 60.0  | 0      |

## Evidence per capability

| Capability     | Evidence (file:line where a single line is meaningful)                                                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LEDGER         | backend/src/services/accounting/accounting.service.ts:395 assertPeriodOpen; packages/local-engine/src/routes/local-ledger.ts:40 periodLockDecision. Branch lock is not pulled to the device (Off=H).           |
| PAYMENT        | packages/local-engine/src/routes/payments.ts:bookingRateOf; payment-allocation-parity.test.ts                                                                                                                  |
| INVOICE        | backend/src/services/invoice.service.ts; packages/local-engine/src/routes/invoices.ts                                                                                                                          |
| RETURNS        | docs/invoice-return-05-core-migration.sql; packages/validation/src/schemas/universal-core/returns-document.domain.ts                                                                                           |
| INV_QTY        | backend/src/services/inventory/; packages/local-engine/src/routes/transfers.ts                                                                                                                                 |
| COSTING        | backend/src/services/inventory-costing/; docs/inventory-void-receipt-01-migration.sql (owner VERIFY 7/7)                                                                                                       |
| PKG_SERVICE    | docs/m5-forward-fix-01-migration.sql; packages/validation/src/schemas/universal-core/package-grant-allocation.domain.ts                                                                                        |
| PROFIT         | backend/src/services/accounting/accounting.repository.ts profitLedgerTotals; per-product attribution is scoped                                                                                                 |
| FX             | backend/src/services/base-currency.ts; docs/invoice-exchange-rate-01-migration.sql (CLAUDE.md: waiting for run)                                                                                                |
| AUTHZ          | backend/src/services/authorization/authorization.domain.ts; bundle routes reuse invoice.read/invoice.create (transport.routes.ts:16-17, agriculture.routes.ts:15-16, metal-rates.routes.ts)                    |
| OFFLINE_SYNC   | packages/validation/src/schemas/offline-endpoint-matrix.ts: 507 endpoints = 187 available, 305 online_required, 15 not_supported                                                                               |
| PARTY_CRM      | backend/src/services/customer-profile/; backend/src/services/crm/; backend/src/services/customer-portal/                                                                                                       |
| HR_PAYROLL     | backend/src/services/payroll/; backend/src/services/human-resources.service.ts; attendance migrations waiting (CLAUDE.md)                                                                                      |
| MANUFACTURING  | backend/src/services/manufacturing/; offline-endpoint-matrix.ts:119,195,196 online_required; posts no ledger entry                                                                                             |
| PROJECTS       | backend/src/services/project.service.ts; backend/src/routes/project.routes.ts (manager gate added 2 Nov)                                                                                                       |
| WORKFLOW       | backend/src/services/workflow/; backend/src/services/rules/                                                                                                                                                    |
| DEV_PLATFORM   | backend/src/services/developer/; backend/src/services/mcp/                                                                                                                                                     |
| REPORTING      | backend/src/services/reporting/; backend/src/services/budgeting/                                                                                                                                               |
| VARIANTS       | docs/universal-core-migration.sql:25; backend/src/services/product/variant.service.ts:17; no variant_id on any invoice line or stock row (0 non-test hits); resolveVariantPrice orphan (variants.domain.ts:40) |
| SERIAL_LOT     | backend/src/services/traceability/traceability.service.ts:279,423; invoice.service.ts:2134 releases but no sale binds; serial-batch.domain.ts:37,103 orphan                                                    |
| WARRANTY       | docs/universal-core-migration.sql:74; backend/src/routes/warranty.routes.ts; warranty.domain.ts calculateWarrantyEndDate has consumers; no claim/repair entity                                                 |
| AUTO_VEHICLE   | docs/universal-core-migration.sql:48,61; vehicles.domain.ts:58,66 and auto-parts.domain.ts:60 orphan                                                                                                           |
| MEASURE_AREA   | packages/validation/src/schemas/measurement.domain.ts; area-dimension.domain.ts:69 and roll-batch.domain.ts:41 orphan; no route, no table                                                                      |
| PACK_BARCODE   | docs/product-barcodes-migration.sql:14 (product_barcodes.unit); pack-barcode.domain.ts:28 is an unused second rule                                                                                             |
| CREDIT_CONTROL | packages/ui/src/components/ui/invoice-builder/use-customer-terms.ts:45 evaluates in the browser; the server shows a warning and never refuses                                                                  |
| ORDER_DEPOSIT  | backend/src/routes/order-deposit.routes.ts; backend/src/services/orders/orders.service.ts:10 «Nothing here writes an invoice, a movement or a journal»; no payment/ledger row; no UI consumer                  |
| DELIVERY       | backend/src/routes/transport.routes.ts (14 handlers, 2 capabilities); specialized-extensions.domain.ts:42 orphan; offline-endpoint-matrix.ts:281 online_required                                               |
| PASSENGER      | docs/universal-core-migration.sql:185 passenger_tickets only                                                                                                                                                   |
| APPOINTMENT    | docs/universal-core-migration.sql:120; docs/appointment-conflict-01-migration.sql; hasAppointmentConflict orphan (specialized-extensions.domain.ts:135); offline-endpoint-matrix.ts:97 online_required         |
| TIME_MATERIAL  | backend/src/services/timesheets/billing.domain.ts; backend/src/services/invoice.service.ts:2144 time_entries.invoice_id                                                                                        |
| MTO_WIP        | manufacturing exists; no link from a sales order or deposit to a production order; no WIP posting                                                                                                              |
| AGRI_LIVESTOCK | docs/universal-core-migration.sql:135,148 (crop cycle, livestock GROUP); backend/src/routes/agriculture.routes.ts; calculateCropYieldSummary orphan                                                            |
| PRECIOUS_METAL | docs/universal-core-migration.sql:39 metal_rates; gold-jewellery.domain.ts:50,58,94 orphan; business-capabilities.ts marks gold_purity and making_charges available                                            |
| COMPOSITION    | packages/validation/src/schemas/industry-profiles.ts:490 resolveBusinessProfile; business-capabilities.ts: 13 keys (8 available, 5 planned); consumers in packages/ui only                                     |

## Counts

Implementation: {"IMPLEMENTED":17,"PARTIAL":17,"MISSING":0}
Verification: {"VERIFIED":0,"PARTIALLY_VERIFIED":31,"UNVERIFIED":3,"BLOCKED_EXTERNAL":0}
Architecture: {"CORRECT":19,"WRONG_LAYER":1,"DUPLICATED":6,"NEEDS_REFACTOR":8,"MISSING":0}
Flags: NEEDS_OWNER_DECISION 3 · BLOCKED_EXTERNAL 3 · CONTRADICTED_PRIOR_CLAIM 4

**Reading note.** Verification is never VERIFIED for a capability whose concurrency/RLS tests need real PostgreSQL, which cannot start on the audit machine (BLOCKED_EXTERNAL). Cells marked U are capabilities whose implementation exists but whose authorization, sync or UI contract was not traced in this audit; they are scored 0 on purpose.
