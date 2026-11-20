# Zero-Code-Gap Inventory (generated)

Baseline: HEAD `f2df3731` · branch `main` · dirty tree preserved.
Generated from the current repository files by a local script; no live database was read.

## 1. Closed code gaps (8)

| ID      | Domain    | Root cause / description                                                     | Test evidence                          | Changed file(s)                                                      |
| ------- | --------- | ---------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| FIX-001 | backend   | POST /workspaces/restore had no server address; client-route-contract failed | client-route-contract.test.ts          | backend/src/routes/workspace.routes.ts                               |
| FIX-002 | backend   | activation gate resolved membership itself (second tenancy resolver)         | constitution-guards.test.ts            | backend/src/services/onboarding/activation-gate.service.ts           |
| FIX-003 | backend   | five new sync entities had no recorded offline position                      | offline-contract.test.ts               | backend/src/**tests**/offline-contract.test.ts                       |
| FIX-004 | backend   | onboarding gate answered 428 before cross-tenant check                       | tenant-isolation-http.test.ts          | backend/src/**tests**/tenant-isolation-http.test.ts                  |
| FIX-005 | backend   | new restore route had no capability guard                                    | write-routes-have-a-capability.test.ts | backend/src/routes/workspace.routes.ts                               |
| FIX-006 | ui        | two generated industry docs were stale                                       | industry-specs-complete.test.ts        | docs/industries/OFFLINE-WORKFLOW-MATRIX.md, CROSS-PLATFORM-MATRIX.md |
| FIX-007 | app-shell | sync-pull mock did not answer snapshots for the five new entities            | apps/desktop jest sync-pull.test.ts    | packages/app-shell/src/features/sync/**tests**/sync-pull.test.ts     |
| FIX-008 | backend   | vi.mock .order missing after tenancy refactor                                | onboarding-activation-gate.test.ts     | backend/src/**tests**/onboarding-activation-gate.test.ts             |

## 2. Offline endpoint inventory (689)

Status counts: online_required=450, available=219, not_supported=20

Classification rule: `available` = ALREADY_VERIFIED_COMPLETE at the endpoint-classification level (runtime browser proof still external); `online_required` = EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED unless the feature names a missing local engine (then CODE_FIX_REQUIRED); `not_supported` = OWNER_BUSINESS_DECISION_REQUIRED.

| ID     | Method + path                                  | Feature                           | Status          | Classification                          |
| ------ | ---------------------------------------------- | --------------------------------- | --------------- | --------------------------------------- |
| EP-001 | DELETE /attendance-devices/:x                  | hr.attendance_devices             | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-002 | DELETE /finance/currency/units/:x              | settings.custom_units             | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-003 | DELETE /attendance-links/:x                    | hr.attendance_links               | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-004 | DELETE /attendance-links/phone/:x              | hr.attendance_links               | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-005 | DELETE /automations/:x                         | automation.rules                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-006 | DELETE /customer-portal-links/:x               | customer.portal_link              | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-007 | DELETE /customers/:x                           | customer.delete                   | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-008 | DELETE /warehouses/:x                          | warehouse.upsert                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-009 | DELETE /customers/:x/documents/:x              | customer.documents                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-010 | DELETE /developer/apps/:x                      | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-011 | DELETE /developer/apps/:x/screenshots/:x       | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-012 | DELETE /developer/keys/:x                      | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-013 | DELETE /developer/webhooks/:x                  | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-014 | DELETE /employees/:x                           | employee.upsert                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-015 | DELETE /invoices/:x                            | invoice.delete                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-016 | DELETE /invoices/:x/installments               | invoice.installment               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-017 | DELETE /market/listings/:x                     | marketplace.apps                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-018 | DELETE /marketplace/apps/:x/review             | marketplace.apps                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-019 | DELETE /operations/batches/:x/recall           | inventory.batch_items             | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-020 | DELETE /permissions/roles/:x                   | governance.permission_matrix      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-021 | DELETE /pos/sessions/:x                        | till.open_close                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-022 | DELETE /products/:x                            | product.upsert                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-023 | DELETE /products/:x/barcodes/:x                | product.barcode                   | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-024 | DELETE /products/:x/images/:x                  | product.images                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-025 | DELETE /projects/:x                            | project.manage                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-026 | DELETE /roles/:x                               | governance.permission_matrix      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-027 | DELETE /saved-views/:x                         | saved.views                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-028 | DELETE /tasks/:x                               | project.manage                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-029 | DELETE /workspaces/:x/invites/:x               | team.members                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-030 | DELETE /workspaces/:x/members/:x               | team.members                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-031 | GET /accounting/accounts                       | accounting.chart                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-032 | GET /accounting/balance-sheet                  | accounting.reports                | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-033 | GET /accounting/evidence/invoices/:x           | accounting.evidence               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-034 | GET /accounting/evidence/products/:x           | accounting.evidence               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-035 | GET /accounting/general-ledger                 | accounting.general_ledger         | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-036 | GET /accounting/income-statement               | accounting.reports                | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-037 | GET /accounting/journal                        | accounting.journal                | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-038 | GET /accounting/profit-report/by-currency      | accounting.profit_report          | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-039 | GET /accounting/profit-report/cost-objects     | accounting.variant_report         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-040 | GET /accounting/profit-report/variants         | accounting.variant_report         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-041 | GET /accounting/trial-balance                  | accounting.trial_balance          | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-042 | GET /agriculture/crops                         | trade.agriculture                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-043 | GET /ai-requests                               | ai.assistant                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-044 | GET /ai/config                                 | ai.assistant                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-045 | GET /ai/insights                               | dashboard.ai_insight              | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-046 | GET /ai/pipeline/settings                      | ai.assistant                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-047 | GET /ai/quota                                  | ai.assistant                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-048 | GET /analysis/benchmark                        | analysis.benchmark                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-049 | GET /analysis/break-even                       | analysis.reports                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-050 | GET /analysis/cohorts                          | analysis.reports                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-051 | GET /analysis/collections                      | analysis.reports                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-052 | GET /analysis/customers/:x/risk                | customer.risk                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-053 | GET /analysis/suppliers                        | analysis.reports                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-054 | GET /analysis/working-capital                  | analysis.reports                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-055 | GET /analytics/dashboard                       | dashboard.kpi                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-056 | GET /analytics/dashboard/low-stock-variants    | dashboard.low_stock_variants      | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-057 | GET /analytics/dashboard/today-sessions        | dashboard.today_sessions          | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-058 | GET /analytics/dashboard/package-credits-low   | dashboard.package_credits_low     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-059 | GET /analytics/dashboard/open-repair-tickets   | dashboard.open_repair_tickets     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-060 | GET /analytics/sales                           | dashboard.sales_chart             | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-061 | GET /api/public/cms/globals/:x                 | blog.public                       | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-062 | GET /appointments                              | trade.appointments                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-063 | GET /attendance-devices                        | hr.attendance_devices             | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-064 | GET /attendance-devices/:x/identities          | hr.attendance_devices             | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-065 | GET /attendance-devices/:x/unmatched           | hr.attendance_devices             | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-066 | GET /attendance-devices/held                   | hr.attendance_devices             | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-067 | GET /attendance-links                          | hr.attendance_links               | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-068 | GET /attendance-sheet                          | hr.attendance                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-069 | GET /attendance-submissions                    | hr.attendance_links               | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-070 | GET /audit/logs                                | audit.trail                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-071 | GET /audit/verify                              | audit.trail                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-072 | GET /audit/workspace                           | audit.trail                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-073 | GET /audit/workspace/:x/:x                     | audit.trail                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-074 | GET /audit/revisions/:x/:x                     | audit.trail                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-075 | GET /auth/me                                   | settings.workspace_profile        | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-076 | GET /automations                               | automation.rules                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-077 | GET /automations/:x/runs                       | automation.rules                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-078 | GET /billing/plans                             | billing.portal                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-079 | GET /billing/subscription                      | billing.portal                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-080 | GET /billing/trial-status                      | billing.portal                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-081 | GET /billing/upgrade-requests                  | billing.portal                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-082 | GET /billing/usage                             | billing.portal                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-083 | GET /blog/posts/:x/comments                    | blog.public                       | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-084 | GET /blog/posts/:x/me                          | blog.public                       | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-085 | GET /boms                                      | manufacturing.bom                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-086 | GET /branches                                  | branch.manage                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-087 | GET /branches/tree                             | branch.manage                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-088 | GET /campaigns                                 | customer.outreach                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-089 | GET /campaigns/:x                              | customer.outreach                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-090 | GET /campaigns/:x/preview                      | customer.outreach                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-091 | GET /compensation                              | hr.payroll                        | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-092 | GET /conflicts                                 | sync.conflicts                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-093 | GET /conflicts/:x                              | sync.conflicts                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-094 | GET /crm/customers/:x                          | customer.crm                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-095 | GET /currencies                                | settings.currency_catalogue       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-096 | GET /custom-fields/:x/:x/values                | custom.fields                     | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-097 | GET /custom-reports                            | custom.reports                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-098 | GET /custom-reports/:x/run                     | custom.reports                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-099 | GET /custom-reports/catalog                    | custom.reports                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-100 | GET /customers                                 | customer.list                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-101 | GET /customers/:x                              | customer.detail                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-102 | GET /customers/:x/accounting                   | customer.accounting               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-103 | GET /customers/:x/deposits                     | order.deposits                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-104 | GET /customers/:x/documents                    | customer.documents                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-105 | GET /customers/:x/documents/:x/url             | customer.documents                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-106 | GET /customers/:x/insights                     | customer.crm                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-107 | GET /customers/:x/portal-links                 | customer.portal_link              | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-108 | GET /customers/:x/profile                      | customer.terms                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-109 | GET /cycle-counts                              | stockcount.create                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-110 | GET /cycle-counts/:x                           | stockcount.list                   | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-111 | GET /deliveries/courier                        | logistics.parcel                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-112 | GET /deliveries/fleet                          | logistics.dispatch                | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-113 | GET /inventory/layers/:x                       | inventory.costing_method          | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-114 | GET /deliveries/notes                          | trade.delivery_notes              | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-115 | GET /developer/apps                            | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-116 | GET /developer/apps/:x/screenshots             | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-117 | GET /developer/apps/:x/stats                   | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-118 | GET /developer/apps/:x/versions                | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-119 | GET /developer/catalog                         | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-120 | GET /developer/installed-apps                  | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-121 | GET /developer/installed-apps/:x/update        | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-122 | GET /developer/keys                            | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-123 | GET /developer/keys/:x/usage                   | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-124 | GET /developer/publisher                       | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-125 | GET /developer/sandbox                         | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-126 | GET /developer/storefront-keys                 | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-127 | GET /developer/webhooks                        | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-128 | GET /developer/webhooks/:x/deliveries          | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-129 | GET /employees                                 | employee.list                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-130 | GET /employees/:x                              | employee.upsert                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-131 | GET /finance/assets                            | asset.fixed                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-132 | GET /finance/assets/:x/schedule                | asset.fixed                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-133 | GET /finance/bank/statements                   | bank.import                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-134 | GET /finance/bank/statements/:x/categories     | bank.import                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-135 | GET /finance/bank/statements/:x/reconciliation | bank.import                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-136 | GET /finance/bank/statements/:x/suggestions    | bank.import                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-137 | GET /finance/currency/base                     | settings.currencies               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-138 | GET /finance/currency/rates                    | settings.currencies               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-139 | GET /finance/currency/units                    | settings.currencies               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-140 | GET /financing/facilities                      | accounting.financing              | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-141 | GET /financing/holdings                        | accounting.financing              | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-142 | GET /governance/member-blocks                  | governance.permission_matrix      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-143 | GET /governance/my-capabilities                | settings.workspace_profile        | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-144 | GET /governance/sod                            | governance.permission_matrix      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-145 | GET /governance/sod/overrides                  | governance.permission_matrix      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-146 | GET /intelligence/cash-forecast                | ai.cashflow_forecast              | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-147 | GET /intelligence/duplicates/:x                | customer.crm                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-148 | GET /intelligence/stale-opportunities          | customer.crm                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-149 | GET /interactions                              | customer.crm                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-150 | GET /interactions/subjects                     | customer.crm                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-151 | GET /inventory/dead-stock                      | inventory.insights                | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-152 | GET /inventory/reorder-suggestions             | inventory.insights                | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-153 | GET /inventory/settings                        | inventory.costing_method          | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-154 | GET /inventory/unvalued                        | accounting.unvalued_stock         | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-155 | GET /invoices                                  | invoice.list                      | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-156 | GET /invoices/:x                               | invoice.detail                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-157 | GET /invoices/:x/installments                  | invoice.installment               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-158 | GET /invoices/:x/late-fees                     | invoice.late_fee                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-159 | GET /invoices/:x/pdf                           | invoice.print                     | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-160 | GET /invoices/:x/related                       | invoice.related                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-161 | GET /invoices/:x/returns                       | invoice.returns                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-162 | GET /late-fees/policy                          | invoice.late_fee                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-163 | GET /leaves                                    | hr.leaves                         | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-164 | GET /leaves/balance                            | hr.leave_policy                   | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-165 | GET /leave-policies                            | hr.leave_policy                   | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-166 | POST /leave-policies                           | hr.leave_policy                   | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-167 | PATCH /leave-policies/:x                       | hr.leave_policy                   | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-168 | POST /leaves/accrue                            | hr.leave_policy                   | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-169 | GET /inventory/reservations                    | inventory.reservations            | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-170 | GET /inventory/reservations/available          | inventory.reservations            | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-171 | POST /inventory/reservations                   | inventory.reservations            | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-172 | POST /inventory/reservations/release           | inventory.reservations            | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-173 | POST /inventory/reservations/settle            | inventory.reservations            | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-174 | POST /storage-locations/move                   | stock.bin_move                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-175 | GET /hr/payrolls/:x/payslip.pdf                | hr.payslip                        | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-176 | GET /manufacturing/definitions/:x              | manufacturing.definition          | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-177 | GET /manufacturing/report                      | manufacturing.report              | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-178 | GET /manufacturing/runs                        | manufacturing.runs                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-179 | GET /manufacturing/runs/:x                     | manufacturing.runs                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-180 | GET /market/seller                             | marketplace.apps                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-181 | GET /marketplace/apps                          | marketplace.apps                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-182 | GET /marketplace/apps/:x                       | marketplace.apps                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-183 | GET /metal-rates/latest                        | trade.metal_rates                 | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-184 | GET /metal-rates                               | trade.gold_ledger                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-185 | GET /gold/operations                           | trade.gold_ledger                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-186 | GET /gold/reconciliations                      | trade.gold_ledger                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-187 | GET /migrations                                | data.migration                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-188 | GET /migrations/:x                             | data.migration                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-189 | GET /notes                                     | notes.entity                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-190 | GET /oauth/authorize                           | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-191 | GET /operations/batches                        | inventory.batch_items             | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-192 | GET /operations/budgets                        | budget.manage                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-193 | GET /operations/budgets/:x/revisions           | budget.manage                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-194 | GET /operations/budgets/report                 | budget.manage                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-195 | GET /operations/budgets/variance               | budget.manage                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-196 | GET /operations/expiry                         | expiry.batches                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-197 | GET /operations/lot-trail/:x/:x                | expiry.batches                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-198 | GET /operations/serials                        | inventory.serial_items            | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-199 | GET /operations/timesheets/:x                  | timesheet.manage                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-200 | GET /operations/timesheets/:x/billing-preview  | timesheet.manage                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-201 | GET /operations/timesheets/:x/profitability    | timesheet.manage                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-202 | GET /opportunities                             | customer.crm                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-203 | GET /orders/:x/deposits                        | order.deposits                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-204 | GET /package-credits/balance                   | operations.service_delivery       | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-205 | GET /package-credits/grants                    | operations.service_delivery       | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-206 | GET /package-credits/ledger                    | operations.service_delivery       | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-207 | GET /payments                                  | payment.record                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-208 | GET /payments/activity/:x/:x                   | customer.accounting               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-209 | GET /payments/return-effects/customers         | customer.return_effects           | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-210 | GET /payments/ledger/:x/:x                     | customer.accounting               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-211 | GET /payments/open-invoices/:x/:x              | customer.accounting               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-212 | GET /payments/summary/:x/:x                    | customer.accounting               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-213 | GET /payments/cheques                          | payments.cheques                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-214 | POST /payments/cheques                         | payments.cheques                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-215 | POST /payments/cheques/:x/transition           | payments.cheques                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-216 | GET /payrolls                                  | hr.payroll                        | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-217 | GET /payrolls/summary                          | hr.payroll                        | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-218 | GET /permissions                               | governance.permission_matrix      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-219 | GET /permissions/matrix                        | governance.permission_matrix      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-220 | GET /permissions/roles/:x/members              | governance.permission_matrix      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-221 | GET /pos/cash-flow                             | till.ledger                       | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-222 | GET /pos/sessions/:x                           | till.session                      | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-223 | GET /pos/sessions/:x/ledger                    | till.ledger                       | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-224 | GET /pos/sessions/abandoned                    | till.session                      | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-225 | GET /pos/sessions/current                      | till.session                      | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-226 | GET /pos/sessions/history                      | till.shift_history                | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-227 | GET /pos/sessions/labels                       | till.labels                       | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-228 | GET /pos/sessions/open                         | till.session                      | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-229 | GET /price-lists                               | pricing.price_lists               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-230 | GET /price-lists/:x                            | pricing.price_lists               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-231 | GET /price-lists/for-customer/:x               | pricing.price_lists               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-232 | GET /products                                  | product.list                      | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-233 | GET /products/:x                               | product.detail                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-234 | GET /products/:x/barcodes                      | product.barcode                   | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-235 | GET /products/:x/fitments                      | product.fitments                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-236 | GET /products/:x/images                        | product.images                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-237 | GET /products/:x/stock-history                 | stock.history                     | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-238 | GET /products/:x/storage-locations             | stock.storage_locations           | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-239 | GET /products/:x/units                         | unit.conversion                   | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-240 | GET /products/:x/variants                      | product.variants                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-241 | GET /products/:x/warehouse-breakdown           | warehouse.detail                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-242 | GET /products/by-barcode/:x                    | product.barcode_lookup            | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-243 | GET /products/categories                       | product.list                      | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-244 | GET /projects                                  | project.manage                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-245 | GET /projects/:x                               | project.manage                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-246 | GET /projects/:x/tasks                         | project.manage                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-247 | GET /promotions                                | pricing.promotions                | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-248 | GET /public/feedback/:x                        | blog.public                       | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-249 | GET /purchase-orders                           | purchase.orders                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-250 | GET /purchase-orders/:x                        | purchase.orders                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-251 | GET /referrals                                 | referral.program                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-252 | GET /report-dashboards                         | custom.reports                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-253 | GET /roles                                     | governance.permission_matrix      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-254 | GET /rules                                     | automation.rules                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-255 | GET /saved-views                               | saved.views                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-256 | GET /service-delivery/sessions                 | operations.service_delivery       | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-257 | GET /shift-assignments                         | hr.shifts                         | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-258 | GET /shifts                                    | hr.shifts                         | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-259 | GET /storefront/settings                       | storefront.public                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-260 | GET /suppliers                                 | purchase.orders                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-261 | GET /sync/overview                             | sync.overview                     | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-262 | GET /tax/return                                | accounting.tax_return             | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-263 | GET /transactions                              | accounting.legacy_transactions    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-264 | GET /transactions/ledger                       | accounting.legacy_transactions    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-265 | GET /transport/trips                           | trade.freight                     | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-266 | GET /units                                     | unit.manage                       | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-267 | GET /v1/activities                             | activity.feed                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-268 | GET /v1/activities/counts                      | activity.feed                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-269 | GET /v1/activities/entity/:x/:x                | activity.entity_timeline          | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-270 | GET /v1/activities/entity/:x/:x/summary        | activity.entity_timeline          | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-271 | GET /v1/activities/unread-count                | activity.feed                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-272 | GET /v1/entities/:x/:x/activities              | activity.entity_timeline          | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-273 | GET /v1/notifications                          | activity.feed                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-274 | GET /v1/notifications/unread-count             | activity.feed                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-275 | GET /v1/workflows                              | approvals.workflows               | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-276 | GET /v1/workflows/:x                           | approvals.workflows               | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-277 | GET /v1/workflows/:x/escalation                | approvals.workflows               | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-278 | GET /v1/workflows/instances                    | approvals.workflows               | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-279 | GET /v1/workflows/instances/:x                 | approvals.workflows               | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-280 | GET /vehicles                                  | trade.vehicles                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-281 | GET /wallet                                    | billing.portal                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-282 | GET /wallet/topups                             | billing.portal                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-283 | GET /wallet/transactions                       | billing.portal                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-284 | GET /warehouses/:x/detail                      | warehouse.upsert                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-285 | GET /warehouses/:x/map                         | warehouse.upsert                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-286 | GET /warehouses/overview                       | warehouse.upsert                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-287 | GET /warehouses/placement                      | warehouse.upsert                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-288 | GET /warranties                                | trade.warranties                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-289 | GET /work-orders                               | manufacturing.work_orders         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-290 | GET /workplace/time-zone                       | settings.time_zone                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-291 | GET /workspaces                                | settings.workspace_profile        | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-292 | GET /workspace/profile                         | settings.workspace_profile        | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-293 | PUT /workspace/profile                         | settings.operational_profile_edit | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-294 | GET /workspace/operational-profile             | settings.workspace_profile        | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-295 | PUT /workspace/operational-profile             | settings.operational_profile_edit | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-296 | PUT /workspace/onboarding-progress             | settings.operational_profile_edit | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-297 | GET /workspaces/:x/invites                     | team.members                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-298 | GET /workspaces/:x/members                     | settings.workspace_profile        | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-299 | GET /workspaces/backup                         | data.backup                       | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-300 | POST /workspaces/restore                       | data.restore                      | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-301 | PATCH /auth/profile                            | settings.workspace_profile        | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-302 | PATCH /automations/:x                          | automation.rules                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-303 | PATCH /custom-fields/definitions/:x/active     | custom.fields                     | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-304 | PATCH /custom-reports/:x/retire                | custom.reports                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-305 | PATCH /customers/:x                            | customer.upsert                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-306 | PATCH /customers/:x/terms                      | customer.terms                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-307 | PATCH /developer/apps/:x                       | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-308 | PATCH /developer/webhooks/:x                   | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-309 | PATCH /employees/:x                            | employee.upsert                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-310 | PATCH /financing/facilities/:x/active          | accounting.financing              | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-311 | PATCH /financing/holdings/:x                   | accounting.financing              | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-312 | PATCH /interactions/:x/customer-outcome        | customer.crm                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-313 | PATCH /interactions/:x/status                  | customer.crm                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-314 | PATCH /invoices/:x                             | invoice.edit                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-315 | PATCH /leaves/:x                               | hr.leaves                         | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-316 | PATCH /operations/batches/:x                   | expiry.batches                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-317 | PATCH /opportunities/:x                        | customer.crm                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-318 | PATCH /payrolls/:x                             | hr.payroll                        | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-319 | PATCH /permissions/roles/:x                    | governance.permission_matrix      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-320 | PATCH /pos/sessions/:x/label                   | till.labels                       | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-321 | PATCH /price-lists/:x/active                   | pricing.price_lists               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-322 | PATCH /products/:x                             | product.upsert                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-323 | POST /products/:x/waste                        | inventory.waste                   | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-324 | GET /products/:x/variants/stock                | inventory.variant_stock           | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-325 | POST /products/:x/variants/matrix              | inventory.variant_stock           | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-326 | POST /products/:x/variants/:x/stock            | inventory.variant_stock           | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-327 | GET /transfer-requests                         | inventory.transfer_requests       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-328 | GET /transfer-requests/:x                      | inventory.transfer_requests       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-329 | POST /transfer-requests                        | inventory.transfer_requests       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-330 | POST /transfer-requests/:x/action              | inventory.transfer_requests       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-331 | GET /operations/serials/holds                  | inventory.serial_holds            | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-332 | POST /operations/serials/:x/hold               | inventory.serial_holds            | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-333 | POST /operations/serials/holds/release-expired | inventory.serial_holds            | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-334 | POST /operations/serials/:x/return             | inventory.serial_returns          | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-335 | GET /repair-tickets                            | operations.repairs                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-336 | GET /repair-tickets/:x                         | operations.repairs                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-337 | POST /repair-tickets                           | operations.repairs                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-338 | POST /repair-tickets/:x/status                 | operations.repairs                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-339 | POST /repair-tickets/:x/quality-check          | operations.repairs                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-340 | POST /repair-tickets/:x/approve                | operations.repairs                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-341 | POST /repair-tickets/:x/parts                  | operations.repairs                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-342 | POST /repair-tickets/:x/parts/:x/consume       | operations.repairs                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-343 | POST /repair-tickets/:x/parts/:x/release       | operations.repairs                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-344 | POST /repair-tickets/:x/bill                   | operations.repairs                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-345 | GET /service-resources                         | operations.salon_setup            | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-346 | POST /service-resources                        | operations.salon_setup            | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-347 | PATCH /service-resources/:x                    | operations.salon_setup            | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-348 | GET /service-catalog                           | operations.salon_setup            | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-349 | PUT /service-catalog/:x                        | operations.salon_setup            | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-350 | GET /departments                               | operations.salon_setup            | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-351 | GET /provider-commissions/rates                | hr.commission                     | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-352 | PUT /provider-commissions/rates                | hr.commission                     | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-353 | GET /provider-commissions/my                   | hr.commission                     | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-354 | GET /provider-commissions                      | hr.commission                     | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-355 | GET /fx/settings                               | finance.currency_exchange         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-356 | PUT /fx/settings                               | finance.currency_exchange         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-357 | GET /fx/rates                                  | finance.currency_exchange         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-358 | POST /fx/rates                                 | finance.currency_exchange         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-359 | GET /fx/trades                                 | finance.currency_exchange         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-360 | POST /fx/trades                                | finance.currency_exchange         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-361 | POST /fx/trades/:x/resolve-review              | finance.currency_exchange         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-362 | POST /fx/trades/:x/void                        | finance.currency_exchange         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-363 | GET /fx/positions                              | finance.currency_exchange         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-364 | GET /fx/remittances                            | finance.currency_exchange         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-365 | GET /fx/remittances/balances                   | finance.currency_exchange         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-366 | GET /fx/remittances/settlements                | finance.currency_exchange         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-367 | POST /fx/remittances                           | finance.currency_exchange         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-368 | POST /fx/remittances/:x/status                 | finance.currency_exchange         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-369 | POST /fx/remittances/settle                    | finance.currency_exchange         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-370 | GET /fx/reconciliations                        | finance.currency_exchange         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-371 | POST /fx/reconciliations                       | finance.currency_exchange         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-372 | PATCH /products/:x/images/:x                   | product.images                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-373 | PATCH /projects/:x                             | project.manage                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-374 | PATCH /promotions/:x/active                    | pricing.promotions                | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-375 | PATCH /report-dashboards/:x/retire             | custom.reports                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-376 | PATCH /saved-views/:x                          | saved.views                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-377 | PATCH /shifts/:x/active                        | hr.shifts                         | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-378 | PATCH /storage-locations/:x                    | stock.storage_locations           | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-379 | PATCH /tasks/:x                                | project.manage                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-380 | PATCH /v1/activities/mark-all-read             | activity.feed                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-381 | PATCH /v1/activities/mark-read                 | activity.feed                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-382 | PATCH /v1/notifications/mark-all-read          | activity.feed                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-383 | PATCH /v1/notifications/mark-read              | activity.feed                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-384 | PATCH /warehouses/:x                           | warehouse.upsert                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-385 | PATCH /workspaces/:x                           | settings.workspace_profile        | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-386 | PATCH /workspaces/:x/members/role              | team.members                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-387 | PATCH /workspaces/:x/members/suspension        | team.members                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-388 | POST /accounting/accounts                      | accounting.chart                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-389 | POST /accounting/journal                       | accounting.journal                | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-390 | POST /accounting/month-end                     | accounting.period_close           | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-391 | POST /agriculture/crops                        | trade.agriculture                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-392 | POST /ai-requests/:x/approve                   | ai.assistant                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-393 | POST /ai-requests/:x/reject                    | ai.assistant                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-394 | POST /ai/ask                                   | ai.assistant                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-395 | POST /ai/pipeline/runs                         | ai.assistant                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-396 | POST /ai/pipeline/runs/:x/answers              | ai.assistant                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-397 | POST /ai/pipeline/runs/:x/cancel               | ai.assistant                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-398 | POST /ai/translate                             | ai.assistant                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-399 | POST /appointments                             | trade.appointments                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-400 | POST /attendance-devices                       | hr.attendance_devices             | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-401 | POST /attendance-devices/:x/key                | hr.attendance_devices             | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-402 | POST /attendance-devices/held/accept           | hr.attendance_devices             | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-403 | POST /attendance-links                         | hr.attendance_links               | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-404 | POST /attendance-submissions/:x/decision       | hr.attendance_links               | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-405 | POST /auth/login                               | auth.cloud_session                | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-406 | POST /auth/logout                              | auth.cloud_session                | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-407 | GET /auth/mfa/status                           | auth.cloud_session                | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-408 | POST /auth/mfa/enroll                          | auth.cloud_session                | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-409 | POST /auth/mfa/verify                          | auth.cloud_session                | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-410 | POST /auth/mfa/recover                         | auth.cloud_session                | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-411 | PUT /auth/mfa/policy                           | auth.cloud_session                | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-412 | POST /auth/refresh                             | auth.cloud_session                | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-413 | POST /auth/signup                              | auth.cloud_session                | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-414 | POST /auth/validate                            | auth.cloud_session                | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-415 | POST /automations/:x/run                       | automation.rules                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-416 | POST /automations/month-end                    | accounting.period_close           | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-417 | POST /automations/recurring-invoice            | invoice.recurring                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-418 | POST /billing/cancel                           | billing.portal                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-419 | POST /billing/orders                           | billing.portal                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-420 | POST /billing/orders/claim                     | billing.portal                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-421 | POST /billing/orders/provision                 | billing.portal                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-422 | POST /billing/upgrade                          | billing.portal                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-423 | POST /billing/upgrade-requests/:x/cancel       | billing.portal                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-424 | POST /blog/posts/:x/comments                   | blog.public                       | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-425 | POST /blog/posts/:x/view                       | blog.public                       | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-426 | POST /branches                                 | branch.manage                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-427 | POST /campaigns                                | customer.outreach                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-428 | POST /campaigns/:x/cancel                      | customer.outreach                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-429 | POST /campaigns/:x/launch                      | customer.outreach                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-430 | POST /conflicts/:x/resolve                     | sync.conflicts                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-431 | POST /custom-fields/:x                         | custom.fields                     | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-432 | POST /custom-reports                           | custom.reports                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-433 | GET /rfqs                                      | purchase.rfq                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-434 | POST /rfqs                                     | purchase.rfq                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-435 | POST /rfqs/:x/quotations                       | purchase.rfq                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-436 | POST /quotations/:x/choose                     | purchase.rfq                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-437 | GET /purchase-contracts/prices                 | purchase.rfq                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-438 | POST /purchase-contracts/prices                | purchase.rfq                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-439 | GET /employees/org-chart                       | hr.org_chart                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-440 | PATCH /employees/:x/reports-to                 | hr.org_chart                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-441 | GET /employees/:x/documents                    | hr.org_chart                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-442 | POST /employees/:x/documents                   | hr.org_chart                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-443 | GET /employees/:x/appraisals                   | hr.org_chart                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-444 | POST /employees/:x/appraisals                  | hr.org_chart                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-445 | GET /warehouses/consignments                   | inventory.consignment             | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-446 | POST /warehouses/consignments                  | inventory.consignment             | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-447 | GET /products/:x/bundle-items                  | product.bundles                   | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-448 | PUT /products/:x/bundle-items                  | product.bundles                   | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-449 | GET /crm/rfm                                   | crm.rfm                           | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-450 | GET /invoices/sales-by-seller                  | sales.by_seller                   | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-451 | GET /snapshots                                 | data.snapshots                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-452 | POST /snapshots                                | data.snapshots                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-453 | GET /snapshots/:x/compare                      | data.snapshots                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-454 | GET /expense-claims                            | hr.expense_claims                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-455 | POST /expense-claims                           | hr.expense_claims                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-456 | POST /expense-claims/:x/approve                | hr.expense_claims                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-457 | POST /expense-claims/:x/reject                 | hr.expense_claims                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-458 | POST /expense-claims/:x/reimburse              | hr.expense_claims                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-459 | POST /customers                                | customer.upsert                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-460 | POST /customers/:x/documents                   | customer.documents                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-461 | POST /customers/:x/portal-links                | customer.portal_link              | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-462 | POST /cycle-counts                             | stockcount.create                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-463 | POST /cycle-counts/:x/cancel                   | stockcount.cancel                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-464 | POST /cycle-counts/:x/complete                 | stockcount.complete               | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-465 | POST /cycle-counts/:x/lines                    | stockcount.record_line            | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-466 | POST /deliveries/courier                       | logistics.parcel                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-467 | POST /deliveries/courier/:x/assign             | logistics.parcel                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-468 | POST /deliveries/courier/:x/close              | logistics.parcel                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-469 | POST /deliveries/fleet                         | logistics.dispatch                | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-470 | POST /deliveries/fleet/:x/service              | logistics.dispatch                | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-471 | POST /deliveries/courier/:x/progress-cod       | trade.courier                     | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-472 | POST /inventory/layers/:x/variant              | inventory.costing_method          | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-473 | POST /deliveries/notes                         | trade.delivery_notes              | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-474 | POST /developer/apps                           | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-475 | POST /developer/apps/:x/images                 | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-476 | POST /developer/apps/:x/rotate-secret          | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-477 | POST /developer/apps/:x/screenshots            | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-478 | POST /developer/apps/:x/versions               | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-479 | POST /developer/apps/:x/webhook-secret         | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-480 | POST /developer/deliveries/:x/retry            | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-481 | POST /developer/installed-apps/:x/uninstall    | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-482 | POST /developer/installed-apps/:x/update       | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-483 | POST /developer/keys                           | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-484 | POST /developer/sandbox                        | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-485 | POST /developer/sandbox/reset                  | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-486 | POST /developer/storefront-keys                | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-487 | POST /developer/webhooks                       | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-488 | POST /developer/webhooks/:x/replay             | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-489 | POST /developer/webhooks/:x/rotate-secret      | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-490 | POST /developer/webhooks/:x/test               | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-491 | POST /employees                                | employee.upsert                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-492 | POST /finance/assets                           | asset.fixed                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-493 | POST /finance/assets/:x/dispose                | asset.fixed                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-494 | POST /finance/assets/depreciation/run          | asset.fixed                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-495 | POST /finance/bank/lines/:x/unmatch            | bank.import                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-496 | POST /finance/bank/reconcile                   | bank.import                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-497 | POST /finance/bank/statements                  | bank.import                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-498 | POST /financing/facilities                     | accounting.financing              | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-499 | POST /financing/holdings                       | accounting.financing              | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-500 | POST /ingest/confirm                           | ocr.receipt                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-501 | POST /ingest/read                              | ocr.receipt                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-502 | POST /interactions                             | customer.crm                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-503 | POST /inventory/reorder-suggestions/draft-po   | purchase.orders                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-504 | POST /inventory/unvalued/value                 | accounting.unvalued_stock         | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-505 | POST /invoices                                 | invoice.create                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-506 | POST /invoices/:x/cost                         | accounting.unvalued_stock         | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-507 | POST /invoices/:x/late-fees                    | invoice.late_fee                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-508 | POST /invoices/:x/post-to-ledger               | accounting.post_to_ledger         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-509 | POST /invoices/:x/returns                      | invoice.returns                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-510 | POST /invoices/:x/exchange                     | invoice.exchange                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-511 | POST /invoices/:x/returns/:x/refunds           | invoice.return_refund             | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-512 | POST /invoices/post-unposted                   | accounting.post_to_ledger         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-513 | POST /leaves                                   | hr.leaves                         | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-514 | POST /manufacturing/produce                    | manufacturing.produce             | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-515 | POST /market/listings                          | marketplace.apps                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-516 | POST /marketplace/apps/:x/report               | marketplace.apps                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-517 | POST /metal-rates                              | trade.metal_rates                 | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-518 | POST /gold/second-hand-purchase                | trade.gold_ledger                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-519 | POST /gold/melt-scrap                          | trade.gold_ledger                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-520 | POST /gold/reconciliations                     | trade.gold_ledger                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-521 | POST /migrations                               | data.migration                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-522 | POST /migrations/:x/cancel                     | data.migration                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-523 | POST /migrations/:x/commit                     | data.migration                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-524 | POST /migrations/:x/dry-run                    | data.migration                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-525 | POST /migrations/inspect                       | data.migration                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-526 | POST /notes                                    | notes.entity                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-527 | POST /oauth/authorize                          | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-528 | POST /operations/batches                       | inventory.batch_items             | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-529 | POST /operations/batches/:x/recall             | inventory.batch_items             | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-530 | POST /operations/budgets/:x/approve            | budget.manage                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-531 | POST /operations/budgets/:x/archive            | budget.manage                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-532 | POST /operations/budgets/:x/revise             | budget.manage                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-533 | POST /operations/budgets/:x/submit             | budget.manage                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-534 | POST /operations/budgets/check                 | budget.manage                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-535 | POST /operations/serials                       | inventory.serial_items            | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-536 | POST /operations/serials/issue                 | inventory.serial_items            | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-537 | POST /operations/timesheets                    | timesheet.manage                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-538 | POST /opportunities                            | customer.crm                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-539 | POST /orders/:x/deposits                       | order.deposits                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-540 | POST /orders/:x/deposits/:x/apply              | order.deposits                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-541 | POST /orders/:x/deposits/:x/refund             | order.deposits                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-542 | POST /orders/:x/deposits/:x/post               | order.deposits                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-543 | GET /advances                                  | order.advances                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-544 | POST /advances                                 | order.advances                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-545 | POST /package-credits/consume                  | operations.service_delivery       | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-546 | POST /package-credits/expire                   | operations.service_delivery       | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-547 | POST /package-credits/grants/:x/suspension     | operations.pkg_suspension         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-548 | POST /package-credits/reverse                  | operations.service_delivery       | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-549 | POST /payments                                 | payment.record                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-550 | POST /payments/:x/cancel                       | payment.cancel                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-551 | POST /payrolls                                 | hr.payroll                        | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-552 | POST /payrolls/:x/book                         | hr.payroll_rebook                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-553 | POST /permissions/profiles/assign              | governance.permission_matrix      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-554 | POST /permissions/roles                        | governance.permission_matrix      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-555 | POST /pos/opening-capital                      | till.opening_capital              | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-556 | POST /pos/orders/:x/void                       | till.order                        | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-557 | POST /pos/sessions                             | till.open_close                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-558 | POST /pos/sessions/:x/bank-transfer            | till.cash_movement                | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-559 | POST /pos/sessions/:x/cash                     | till.cash_movement                | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-560 | POST /pos/sessions/:x/close                    | till.open_close                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-561 | POST /pos/sessions/:x/orders                   | till.order                        | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-562 | POST /pos/sessions/:x/resume                   | till.suspend                      | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-563 | POST /pos/sessions/:x/suspend                  | till.suspend                      | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-564 | POST /price-lists                              | pricing.price_lists               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-565 | POST /products                                 | product.upsert                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-566 | POST /products/:x/barcodes                     | product.barcode                   | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-567 | POST /products/:x/fitments                     | product.fitments                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-568 | POST /products/:x/images                       | product.images                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-569 | POST /products/:x/variants                     | product.variants                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-570 | POST /projects                                 | project.manage                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-571 | POST /projects/:x/tasks                        | project.manage                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-572 | POST /promotions                               | pricing.promotions                | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-573 | POST /public/feedback/:x/answer                | blog.public                       | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-574 | POST /public/feedback/:x/unsubscribe           | blog.public                       | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-575 | POST /purchase-orders                          | purchase.orders                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-576 | POST /purchase-orders/:x/receive               | purchase.orders                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-577 | POST /report-dashboards                        | custom.reports                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-578 | POST /roles                                    | governance.permission_matrix      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-579 | POST /rules                                    | automation.rules                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-580 | POST /saved-views                              | saved.views                       | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-581 | POST /service-delivery/sessions                | operations.service_delivery       | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-582 | POST /service-delivery/sessions/:x/deliver     | operations.service_delivery       | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-583 | POST /service-delivery/sessions/:x/cancel      | operations.service_delivery       | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-584 | POST /service-delivery/sessions/:x/status      | operations.service_delivery       | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-585 | GET /me/guide-progress                         | ui.guide_progress                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-586 | GET /me/dashboard-kpis                         | ui.dashboard_kpis                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-587 | PUT /me/dashboard-kpis                         | ui.dashboard_kpis                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-588 | GET /me/invoice-drafts                         | ui.personal_state                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-589 | PUT /me/invoice-drafts                         | ui.personal_state                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-590 | DELETE /me/invoice-drafts/:x                   | ui.personal_state                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-591 | GET /me/preferences                            | ui.personal_state                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-592 | PUT /me/preferences                            | ui.personal_state                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-593 | POST /me/guide-progress                        | ui.guide_progress                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-594 | POST /shift-assignments                        | hr.shifts                         | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-595 | POST /shift-assignments/:x/cancel              | hr.shifts                         | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-596 | POST /shifts                                   | hr.shifts                         | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-597 | POST /stock-transfers                          | stock.transfer                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-598 | POST /storage-locations/:x/place               | stock.placement                   | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-599 | POST /transactions                             | accounting.legacy_transactions    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-600 | POST /transport/trips                          | trade.freight                     | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-601 | POST /units                                    | unit.conversion                   | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-602 | POST /v1/workflows                             | approvals.workflows               | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-603 | POST /v1/workflows/instances                   | approvals.workflows               | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-604 | POST /v1/workflows/instances/:x/action         | approvals.workflows               | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-605 | POST /vehicles                                 | trade.vehicles                    | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-606 | POST /wallet/pay-upgrade                       | billing.portal                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-607 | POST /wallet/topups                            | billing.portal                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-608 | POST /wallet/topups/:x/cancel                  | billing.portal                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-609 | POST /warehouses                               | warehouse.upsert                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-610 | POST /warehouses/:x/assign                     | stock.assign_unassigned           | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-611 | POST /warehouses/:x/locations                  | stock.storage_locations           | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-612 | POST /warranties                               | trade.warranties                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-613 | POST /work-orders                              | manufacturing.work_orders         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-614 | POST /workspaces                               | settings.workspace_profile        | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-615 | POST /workspaces/:x/invites                    | team.members                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-616 | POST /workspaces/:x/leave                      | team.members                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-617 | POST /workspaces/:x/members/direct             | team.members                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-618 | PUT /ai/config                                 | ai.assistant                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-619 | PUT /ai/pipeline/settings                      | ai.assistant                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-620 | PUT /ai/quota/:x                               | ai.assistant                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-621 | PUT /attendance-devices/:x/identities          | hr.attendance_devices             | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-622 | PUT /attendance-sheet                          | hr.attendance                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-623 | PUT /blog/posts/:x/rating                      | blog.public                       | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-624 | PUT /blog/posts/:x/reaction                    | blog.public                       | not_supported   | OWNER_BUSINESS_DECISION_REQUIRED        |
| EP-625 | PUT /custom-fields/:x/:x/values                | custom.fields                     | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-626 | PUT /developer/publisher                       | developer.keys                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-627 | PUT /finance/currency/base                     | settings.currencies               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-628 | PUT /finance/currency/rates                    | settings.currencies               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-629 | PUT /finance/currency/units                    | settings.custom_units             | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-630 | PUT /governance/member-blocks/:x               | governance.permission_matrix      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-631 | PUT /governance/sod                            | governance.permission_matrix      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-632 | PUT /inventory/settings                        | inventory.costing_method          | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-633 | PUT /invoices/:x/installments                  | invoice.installment               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-634 | PUT /late-fees/policy                          | invoice.late_fee                  | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-635 | PUT /manufacturing/definitions                 | manufacturing.definition          | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-636 | PUT /market/listings/:x                        | marketplace.apps                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-637 | PUT /market/seller                             | marketplace.apps                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-638 | PUT /marketplace/apps/:x/review                | marketplace.apps                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-639 | PUT /migrations/:x/mapping                     | data.migration                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-640 | PUT /operations/budgets/:x                     | budget.manage                     | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-641 | PUT /operations/timesheets/config              | timesheet.manage                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-642 | PUT /permissions/matrix/cell                   | governance.permission_matrix      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-643 | PUT /price-lists/:x/items                      | pricing.price_lists               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-644 | PUT /price-lists/customers/:x                  | pricing.price_lists               | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-645 | PUT /products/:x/images/order                  | product.images                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-646 | PUT /products/:x/units                         | unit.conversion                   | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-647 | PUT /storage-locations/:x/auto-shelf           | stock.auto_shelf                  | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-648 | PUT /storefront/settings                       | storefront.public                 | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-649 | PUT /v1/workflows/:x/escalation                | approvals.workflows               | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-650 | PUT /workplace/branches/:x/time-zone           | settings.time_zone                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-651 | PUT /workplace/time-zone                       | settings.time_zone                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-652 | GET /orders                                    | sales.orders                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-653 | GET /orders/:x                                 | sales.orders                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-654 | POST /orders                                   | sales.orders                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-655 | POST /orders/:x/confirm                        | sales.orders                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-656 | POST /orders/:x/accept-quote                   | sales.orders                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-657 | POST /orders/:x/deliver                        | sales.orders                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-658 | POST /orders/:x/cancel                         | sales.orders                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-659 | POST /orders/:x/fulfill                        | sales.orders                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-660 | POST /orders/:x/invoice                        | sales.orders                      | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-661 | POST /deliveries/courier/:x/settle-cod         | trade.courier                     | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-662 | POST /deliveries/notes/:x/pod                  | trade.delivery_notes              | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-663 | GET /projects/:x/members                       | project.manage                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-664 | POST /projects/:x/members                      | project.manage                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-665 | DELETE /projects/:x/members/:x                 | project.manage                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-666 | GET /projects/:x/time-entries                  | project.manage                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-667 | POST /projects/:x/time-entries                 | project.manage                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-668 | PATCH /time-entries/:x                         | project.manage                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-669 | DELETE /time-entries/:x                        | project.manage                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-670 | POST /projects/:x/bill                         | project.manage                    | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-671 | POST /package-credits/grant                    | operations.package_grants         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-672 | PATCH /work-orders/:x                          | manufacturing.work_orders         | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-673 | GET /resource-bookings                         | operations.resource_bookings      | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-674 | POST /resource-bookings                        | operations.resource_bookings      | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-675 | POST /resource-bookings/:x/release             | operations.resource_bookings      | available       | ALREADY_VERIFIED_COMPLETE               |
| EP-676 | GET /service-resources/:x/slots                | operations.salon_setup            | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-677 | GET /contracts                                 | commerce.contracts                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-678 | POST /contracts                                | commerce.contracts                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-679 | POST /contracts/:x/bill                        | commerce.contracts                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-680 | POST /contracts/:x/terminate                   | commerce.contracts                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-681 | POST /contracts/:x/sla-breach                  | commerce.contracts                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-682 | POST /contracts/:x/lease-return                | commerce.contracts                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-683 | POST /purchase-orders/from-suggestions         | purchase.three_way_match          | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-684 | GET /purchase-orders/:x/three-way-match        | purchase.three_way_match          | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-685 | GET /suppliers/scorecard                       | purchase.three_way_match          | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-686 | GET /quality-events                            | operations.quality                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-687 | POST /quality-events                           | operations.quality                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-688 | GET /warranty-claims                           | operations.quality                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EP-689 | POST /warranty-claims                          | operations.quality                | online_required | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |

## 3. Sync entity path inventory (21)

| ID      | Entity                     | Full path verified locally                                               | Classification                    |
| ------- | -------------------------- | ------------------------------------------------------------------------ | --------------------------------- |
| SYNC-01 | invoice                    | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-02 | customer                   | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-03 | product                    | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-04 | transaction                | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-05 | time_entry                 | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-06 | warehouse                  | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-07 | branch                     | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-08 | exchange_rate              | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-09 | product_stock              | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-10 | order_deposits             | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-11 | order_deposit_applications | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-12 | order_deposit_refunds      | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-13 | product_variants           | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-14 | service_delivery_sessions  | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-15 | package_credit_ledger      | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-16 | repair_tickets             | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-17 | cost_layer                 | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-18 | stock_batches              | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-19 | stock_serials              | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-20 | inventory_settings         | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |
| SYNC-21 | account                    | protocol, server maps, pull columns, device mapper, local schema, guards | ALREADY_VERIFIED_COMPLETE (local) |

## 4. Industry inventory (67)

| ID     | Industry           | Status            | Sellable | Blocker                           | Classification                          |
| ------ | ------------------ | ----------------- | -------- | --------------------------------- | --------------------------------------- |
| IND-01 | retail             | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-02 | wholesale          | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-03 | grocery            | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-04 | bakery             | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-05 | butcher            | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-06 | restaurant         | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-07 | cafe               | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-08 | fruitVegetable     | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-09 | dairy              | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-10 | nuts               | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-11 | spices             | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-12 | jewellery          | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-13 | watches            | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-14 | currencyExchange   | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-15 | clothing           | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-16 | fabric             | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-17 | fabricRoll         | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-18 | shoes              | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-19 | carpet             | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-20 | tailoring          | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-21 | mobilePhones       | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-22 | computers          | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-23 | computerComponents | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-24 | electronics        | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-25 | itServices         | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-26 | hardware           | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-27 | buildingMaterials  | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-28 | paint              | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-29 | timber             | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-30 | glass              | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-31 | construction       | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-32 | manufacturing      | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-33 | autoParts          | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-34 | carDealer          | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-35 | mechanic           | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-36 | fuel               | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-37 | furniture          | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-38 | kitchenware        | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-39 | homeAppliances     | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-40 | stationery         | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-41 | toys               | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-42 | giftShop           | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-43 | pharmacy           | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-44 | cosmetics          | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-45 | clinic             | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-46 | barber             | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-47 | beautySalon        | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-48 | optician           | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-49 | agriculture        | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-50 | livestock          | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-51 | seedsFertilizer    | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-52 | flowers            | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-53 | transport          | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-54 | freightTransport   | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-55 | passengerTransport | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-56 | courier            | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-57 | travelAgency       | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-58 | realEstate         | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-59 | printing           | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-60 | photography        | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-61 | education          | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-62 | laundry            | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-63 | repairs            | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-64 | wedding            | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-65 | security           | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-66 | consulting         | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| IND-67 | other              | WORKFLOW_VERIFIED | false    | POSTGRES_JOURNEY, BROWSER_JOURNEY | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |

## 5. Migration verification gaps (119 without VERIFY, 108 without PG test)

| ID       | Gap                | File                                                       | Classification          |
| -------- | ------------------ | ---------------------------------------------------------- | ----------------------- |
| MIGV-001 | no VERIFY SQL      | accounting-core-migration.sql                              | MIGRATION_CODE_REQUIRED |
| MIGV-002 | no VERIFY SQL      | ai-pipeline-02-one-approval-queue-migration.sql            | MIGRATION_CODE_REQUIRED |
| MIGV-003 | no VERIFY SQL      | attendance-workforce-migration.sql                         | MIGRATION_CODE_REQUIRED |
| MIGV-004 | no VERIFY SQL      | background-jobs-claim-migration.sql                        | MIGRATION_CODE_REQUIRED |
| MIGV-005 | no VERIFY SQL      | base-schema-migration.sql                                  | MIGRATION_CODE_REQUIRED |
| MIGV-006 | no VERIFY SQL      | branch-migration.sql                                       | MIGRATION_CODE_REQUIRED |
| MIGV-007 | no VERIFY SQL      | cms-foundation-migration.sql                               | MIGRATION_CODE_REQUIRED |
| MIGV-008 | no VERIFY SQL      | content-intelligence-01-migration.sql                      | MIGRATION_CODE_REQUIRED |
| MIGV-009 | no VERIFY SQL      | content-intelligence-02-migration.sql                      | MIGRATION_CODE_REQUIRED |
| MIGV-010 | no VERIFY SQL      | content-intelligence-03-migration.sql                      | MIGRATION_CODE_REQUIRED |
| MIGV-011 | no VERIFY SQL      | content-intelligence-04-migration.sql                      | MIGRATION_CODE_REQUIRED |
| MIGV-012 | no VERIFY SQL      | content-intelligence-05-migration.sql                      | MIGRATION_CODE_REQUIRED |
| MIGV-013 | no VERIFY SQL      | customer-360-phase3-migration.sql                          | MIGRATION_CODE_REQUIRED |
| MIGV-014 | no VERIFY SQL      | customer-debt-cancelled-fix-migration.sql                  | MIGRATION_CODE_REQUIRED |
| MIGV-015 | no VERIFY SQL      | data-migration-center-migration.sql                        | MIGRATION_CODE_REQUIRED |
| MIGV-016 | no VERIFY SQL      | data-migration-invoices-01-migration.sql                   | MIGRATION_CODE_REQUIRED |
| MIGV-017 | no VERIFY SQL      | developer-platform-03-commerce-migration.sql               | MIGRATION_CODE_REQUIRED |
| MIGV-018 | no VERIFY SQL      | developer-platform-04-portal-migration.sql                 | MIGRATION_CODE_REQUIRED |
| MIGV-019 | no VERIFY SQL      | developer-platform-05-oauth-migration.sql                  | MIGRATION_CODE_REQUIRED |
| MIGV-020 | no VERIFY SQL      | developer-platform-06-sandbox-migration.sql                | MIGRATION_CODE_REQUIRED |
| MIGV-021 | no VERIFY SQL      | developer-platform-06b-sandbox-access-migration.sql        | MIGRATION_CODE_REQUIRED |
| MIGV-022 | no VERIFY SQL      | developer-platform-07-marketplace-migration.sql            | MIGRATION_CODE_REQUIRED |
| MIGV-023 | no VERIFY SQL      | email-outbox-migration.sql                                 | MIGRATION_CODE_REQUIRED |
| MIGV-024 | no VERIFY SQL      | event-log-claim-migration.sql                              | MIGRATION_CODE_REQUIRED |
| MIGV-025 | no VERIFY SQL      | finance-gaps-migration.sql                                 | MIGRATION_CODE_REQUIRED |
| MIGV-026 | no VERIFY SQL      | function-search-path-migration.sql                         | MIGRATION_CODE_REQUIRED |
| MIGV-027 | no VERIFY SQL      | hardening-migration.sql                                    | MIGRATION_CODE_REQUIRED |
| MIGV-028 | no VERIFY SQL      | inventory-costing-migration.sql                            | MIGRATION_CODE_REQUIRED |
| MIGV-029 | no VERIFY SQL      | invoice-public-share-migration.sql                         | MIGRATION_CODE_REQUIRED |
| MIGV-030 | no VERIFY SQL      | invoice-return-02-purchase-return-accounting-migration.sql | MIGRATION_CODE_REQUIRED |
| MIGV-031 | no VERIFY SQL      | invoice-return-03-repair-migration.sql                     | MIGRATION_CODE_REQUIRED |
| MIGV-032 | no VERIFY SQL      | invoice-return-04-one-per-invoice-migration.sql            | MIGRATION_CODE_REQUIRED |
| MIGV-033 | no VERIFY SQL      | invoice-return-05-core-migration.sql                       | MIGRATION_CODE_REQUIRED |
| MIGV-034 | no VERIFY SQL      | invoice-return-06-scrap-loss-migration.sql                 | MIGRATION_CODE_REQUIRED |
| MIGV-035 | no VERIFY SQL      | invoice-write-document-migration.sql                       | MIGRATION_CODE_REQUIRED |
| MIGV-036 | no VERIFY SQL      | linter-hardening-migration.sql                             | MIGRATION_CODE_REQUIRED |
| MIGV-037 | no VERIFY SQL      | live-reconciliation-migration.sql                          | MIGRATION_CODE_REQUIRED |
| MIGV-038 | no VERIFY SQL      | m5-forward-fix-01-migration.sql                            | MIGRATION_CODE_REQUIRED |
| MIGV-039 | no VERIFY SQL      | mdm-migration.sql                                          | MIGRATION_CODE_REQUIRED |
| MIGV-040 | no VERIFY SQL      | member-module-blocks-migration.sql                         | MIGRATION_CODE_REQUIRED |
| MIGV-041 | no VERIFY SQL      | missing-rpcs-migration.sql                                 | MIGRATION_CODE_REQUIRED |
| MIGV-042 | no VERIFY SQL      | module-auth-session-epoch-migration.sql                    | MIGRATION_CODE_REQUIRED |
| MIGV-043 | no VERIFY SQL      | module-created-at-default-migration.sql                    | MIGRATION_CODE_REQUIRED |
| MIGV-044 | no VERIFY SQL      | module-desktop-update-feed-migration.sql                   | MIGRATION_CODE_REQUIRED |
| MIGV-045 | no VERIFY SQL      | multi-warehouse-migration.sql                              | MIGRATION_CODE_REQUIRED |
| MIGV-046 | no VERIFY SQL      | onboarding-server-state-migration.sql                      | MIGRATION_CODE_REQUIRED |
| MIGV-047 | no VERIFY SQL      | patch-01-currencies-migration.sql                          | MIGRATION_CODE_REQUIRED |
| MIGV-048 | no VERIFY SQL      | patch-02-custom-units-migration.sql                        | MIGRATION_CODE_REQUIRED |
| MIGV-049 | no VERIFY SQL      | patch-03-leaves-gaps-migration.sql                         | MIGRATION_CODE_REQUIRED |
| MIGV-050 | no VERIFY SQL      | payments-ar-ap-migration.sql                               | MIGRATION_CODE_REQUIRED |
| MIGV-051 | no VERIFY SQL      | perf-aggregates-analytics-migration.sql                    | MIGRATION_CODE_REQUIRED |
| MIGV-052 | no VERIFY SQL      | perf-aggregates-ledger-migration.sql                       | MIGRATION_CODE_REQUIRED |
| MIGV-053 | no VERIFY SQL      | personalization-migration.sql                              | MIGRATION_CODE_REQUIRED |
| MIGV-054 | no VERIFY SQL      | phase-a-01-journal-lines-fk-migration.sql                  | MIGRATION_CODE_REQUIRED |
| MIGV-055 | no VERIFY SQL      | phase-a-02-ledger-entries-workspace-migration.sql          | MIGRATION_CODE_REQUIRED |
| MIGV-056 | no VERIFY SQL      | phase-a-03-fk-indexes-migration.sql                        | MIGRATION_CODE_REQUIRED |
| MIGV-057 | no VERIFY SQL      | phase-a-04-missing-primary-keys-migration.sql              | MIGRATION_CODE_REQUIRED |
| MIGV-058 | no VERIFY SQL      | phase-b-01-accounting-source-of-truth-migration.sql        | MIGRATION_CODE_REQUIRED |
| MIGV-059 | no VERIFY SQL      | phase-c-01-inventory-source-of-truth-migration.sql         | MIGRATION_CODE_REQUIRED |
| MIGV-060 | no VERIFY SQL      | phase-d-01-employee-branch-assignments-migration.sql       | MIGRATION_CODE_REQUIRED |
| MIGV-061 | no VERIFY SQL      | phase-e-01-rbac-2.0-migration.sql                          | MIGRATION_CODE_REQUIRED |
| MIGV-062 | no VERIFY SQL      | phase-f-01-receivables-projection-migration.sql            | MIGRATION_CODE_REQUIRED |
| MIGV-063 | no VERIFY SQL      | phase-g-01-branch-manager-migration.sql                    | MIGRATION_CODE_REQUIRED |
| MIGV-064 | no VERIFY SQL      | phase-g-02-permission-profiles-migration.sql               | MIGRATION_CODE_REQUIRED |
| MIGV-065 | no VERIFY SQL      | phase-g-03-audit-branch-migration.sql                      | MIGRATION_CODE_REQUIRED |
| MIGV-066 | no VERIFY SQL      | phase-j-01-branch-period-lock-migration.sql                | MIGRATION_CODE_REQUIRED |
| MIGV-067 | no VERIFY SQL      | phase-j-02-reconciliation-hardening-migration.sql          | MIGRATION_CODE_REQUIRED |
| MIGV-068 | no VERIFY SQL      | phase-j-03-document-status-migration.sql                   | MIGRATION_CODE_REQUIRED |
| MIGV-069 | no VERIFY SQL      | phase-j-04-payroll-ledger-migration.sql                    | MIGRATION_CODE_REQUIRED |
| MIGV-070 | no VERIFY SQL      | phase-k-01-stock-transfers-migration.sql                   | MIGRATION_CODE_REQUIRED |
| MIGV-071 | no VERIFY SQL      | phase-l-01-units-migration.sql                             | MIGRATION_CODE_REQUIRED |
| MIGV-072 | no VERIFY SQL      | phase-l-02-product-units-migration.sql                     | MIGRATION_CODE_REQUIRED |
| MIGV-073 | no VERIFY SQL      | phase-l-03-cycle-counts-migration.sql                      | MIGRATION_CODE_REQUIRED |
| MIGV-074 | no VERIFY SQL      | phase-m-01-shift-handover-migration.sql                    | MIGRATION_CODE_REQUIRED |
| MIGV-075 | no VERIFY SQL      | phase-n-01-reconciliation-memory-migration.sql             | MIGRATION_CODE_REQUIRED |
| MIGV-076 | no VERIFY SQL      | phase-o-01-reporting-layer-migration.sql                   | MIGRATION_CODE_REQUIRED |
| MIGV-077 | no VERIFY SQL      | phase-o-02-catalog-and-query-log-migration.sql             | MIGRATION_CODE_REQUIRED |
| MIGV-078 | no VERIFY SQL      | phase-t11-product-units-rpc-migration.sql                  | MIGRATION_CODE_REQUIRED |
| MIGV-079 | no VERIFY SQL      | phase-t13-ai-provider-migration.sql                        | MIGRATION_CODE_REQUIRED |
| MIGV-080 | no VERIFY SQL      | phase-t2-units-rls-migration.sql                           | MIGRATION_CODE_REQUIRED |
| MIGV-081 | no VERIFY SQL      | phase-t4-manufacturing-fk-migration.sql                    | MIGRATION_CODE_REQUIRED |
| MIGV-082 | no VERIFY SQL      | phase-t4b-bom-notes-migration.sql                          | MIGRATION_CODE_REQUIRED |
| MIGV-083 | no VERIFY SQL      | plan-limits-migration.sql                                  | MIGRATION_CODE_REQUIRED |
| MIGV-084 | no VERIFY SQL      | pos-session-suspend-migration.sql                          | MIGRATION_CODE_REQUIRED |
| MIGV-085 | no VERIFY SQL      | product-barcodes-migration.sql                             | MIGRATION_CODE_REQUIRED |
| MIGV-086 | no VERIFY SQL      | purchase-order-write-migration.sql                         | MIGRATION_CODE_REQUIRED |
| MIGV-087 | no VERIFY SQL      | realtime-data-tables-migration.sql                         | MIGRATION_CODE_REQUIRED |
| MIGV-088 | no VERIFY SQL      | realtime-publication-migration.sql                         | MIGRATION_CODE_REQUIRED |
| MIGV-089 | no VERIFY SQL      | referral-system-migration.sql                              | MIGRATION_CODE_REQUIRED |
| MIGV-090 | no VERIFY SQL      | remaining-policies-migration.sql                           | MIGRATION_CODE_REQUIRED |
| MIGV-091 | no VERIFY SQL      | restore-defaults-migration.sql                             | MIGRATION_CODE_REQUIRED |
| MIGV-092 | no VERIFY SQL      | rls-performance-migration.sql                              | MIGRATION_CODE_REQUIRED |
| MIGV-093 | no VERIFY SQL      | rls-recursion-fix-migration.sql                            | MIGRATION_CODE_REQUIRED |
| MIGV-094 | no VERIFY SQL      | rules-engine-migration.sql                                 | MIGRATION_CODE_REQUIRED |
| MIGV-095 | no VERIFY SQL      | schema-drift-fix-migration.sql                             | MIGRATION_CODE_REQUIRED |
| MIGV-096 | no VERIFY SQL      | security-revoke-definer-rpc-migration.sql                  | MIGRATION_CODE_REQUIRED |
| MIGV-097 | no VERIFY SQL      | service-delivery-02-atomic-migration.sql                   | MIGRATION_CODE_REQUIRED |
| MIGV-098 | no VERIFY SQL      | service-delivery-03-cancellation-reason-migration.sql      | MIGRATION_CODE_REQUIRED |
| MIGV-099 | no VERIFY SQL      | sod-migration.sql                                          | MIGRATION_CODE_REQUIRED |
| MIGV-100 | no VERIFY SQL      | stock-transfer-02-cost-layers-migration.sql                | MIGRATION_CODE_REQUIRED |
| MIGV-101 | no VERIFY SQL      | stock-transfer-idempotency-migration.sql                   | MIGRATION_CODE_REQUIRED |
| MIGV-102 | no VERIFY SQL      | subscription-upgrade-requests-migration.sql                | MIGRATION_CODE_REQUIRED |
| MIGV-103 | no VERIFY SQL      | subscription-workspace-migration.sql                       | MIGRATION_CODE_REQUIRED |
| MIGV-104 | no VERIFY SQL      | sync-conflicts-migration.sql                               | MIGRATION_CODE_REQUIRED |
| MIGV-105 | no VERIFY SQL      | sync-engine-migration.sql                                  | MIGRATION_CODE_REQUIRED |
| MIGV-106 | no VERIFY SQL      | task-assignment-migration.sql                              | MIGRATION_CODE_REQUIRED |
| MIGV-107 | no VERIFY SQL      | task-customer-outcomes-migration.sql                       | MIGRATION_CODE_REQUIRED |
| MIGV-108 | no VERIFY SQL      | tax-engine-migration.sql                                   | MIGRATION_CODE_REQUIRED |
| MIGV-109 | no VERIFY SQL      | tenancy-workspace-migration.sql                            | MIGRATION_CODE_REQUIRED |
| MIGV-110 | no VERIFY SQL      | tenant-isolation-closure-migration.sql                     | MIGRATION_CODE_REQUIRED |
| MIGV-111 | no VERIFY SQL      | tier2-gaps-migration.sql                                   | MIGRATION_CODE_REQUIRED |
| MIGV-112 | no VERIFY SQL      | timesheet-sync-migration.sql                               | MIGRATION_CODE_REQUIRED |
| MIGV-113 | no VERIFY SQL      | traceability-migration.sql                                 | MIGRATION_CODE_REQUIRED |
| MIGV-114 | no VERIFY SQL      | unified-sale-purchase-migration.sql                        | MIGRATION_CODE_REQUIRED |
| MIGV-115 | no VERIFY SQL      | views-and-billing-events-migration.sql                     | MIGRATION_CODE_REQUIRED |
| MIGV-116 | no VERIFY SQL      | workspace-access-rpc-02-custom-role-migration.sql          | MIGRATION_CODE_REQUIRED |
| MIGV-117 | no VERIFY SQL      | workspace-member-fields-migration.sql                      | MIGRATION_CODE_REQUIRED |
| MIGV-118 | no VERIFY SQL      | workspace-members-rls-migration.sql                        | MIGRATION_CODE_REQUIRED |
| MIGV-119 | no VERIFY SQL      | workspace-stamp-migration.sql                              | MIGRATION_CODE_REQUIRED |
| MIGP-001 | no PostgreSQL test | accounts-role-deferred-and-loss-01-migration.sql           | TEST_REQUIRED           |
| MIGP-002 | no PostgreSQL test | advances-02-migration.sql                                  | TEST_REQUIRED           |
| MIGP-003 | no PostgreSQL test | appointment-conflict-01-migration.sql                      | TEST_REQUIRED           |
| MIGP-004 | no PostgreSQL test | attendance-workforce-migration.sql                         | TEST_REQUIRED           |
| MIGP-005 | no PostgreSQL test | budget-currency-migration.sql                              | TEST_REQUIRED           |
| MIGP-006 | no PostgreSQL test | budget-planning-migration.sql                              | TEST_REQUIRED           |
| MIGP-007 | no PostgreSQL test | cms-foundation-migration.sql                               | TEST_REQUIRED           |
| MIGP-008 | no PostgreSQL test | content-intelligence-01-migration.sql                      | TEST_REQUIRED           |
| MIGP-009 | no PostgreSQL test | content-intelligence-02-migration.sql                      | TEST_REQUIRED           |
| MIGP-010 | no PostgreSQL test | content-intelligence-03-migration.sql                      | TEST_REQUIRED           |
| MIGP-011 | no PostgreSQL test | content-intelligence-04-migration.sql                      | TEST_REQUIRED           |
| MIGP-012 | no PostgreSQL test | content-intelligence-05-migration.sql                      | TEST_REQUIRED           |
| MIGP-013 | no PostgreSQL test | custom-units-02-migration.sql                              | TEST_REQUIRED           |
| MIGP-014 | no PostgreSQL test | customer-360-phase3-migration.sql                          | TEST_REQUIRED           |
| MIGP-015 | no PostgreSQL test | customer-debt-cancelled-fix-migration.sql                  | TEST_REQUIRED           |
| MIGP-016 | no PostgreSQL test | data-migration-center-migration.sql                        | TEST_REQUIRED           |
| MIGP-017 | no PostgreSQL test | deferral-schedules-migration.sql                           | TEST_REQUIRED           |
| MIGP-018 | no PostgreSQL test | divergence-alarm-migration.sql                             | TEST_REQUIRED           |
| MIGP-019 | no PostgreSQL test | finance-gaps-migration.sql                                 | TEST_REQUIRED           |
| MIGP-020 | no PostgreSQL test | fresh-install-defaults-01-migration.sql                    | TEST_REQUIRED           |
| MIGP-021 | no PostgreSQL test | function-search-path-migration.sql                         | TEST_REQUIRED           |
| MIGP-022 | no PostgreSQL test | hardening-migration.sql                                    | TEST_REQUIRED           |
| MIGP-023 | no PostgreSQL test | invoice-idempotency-migration.sql                          | TEST_REQUIRED           |
| MIGP-024 | no PostgreSQL test | invoice-public-share-migration.sql                         | TEST_REQUIRED           |
| MIGP-025 | no PostgreSQL test | invoice-return-02-purchase-return-accounting-migration.sql | TEST_REQUIRED           |
| MIGP-026 | no PostgreSQL test | invoice-return-03-repair-migration.sql                     | TEST_REQUIRED           |
| MIGP-027 | no PostgreSQL test | invoice-return-04-one-per-invoice-migration.sql            | TEST_REQUIRED           |
| MIGP-028 | no PostgreSQL test | invoice-return-06-scrap-loss-migration.sql                 | TEST_REQUIRED           |
| MIGP-029 | no PostgreSQL test | landed-costs-migration.sql                                 | TEST_REQUIRED           |
| MIGP-030 | no PostgreSQL test | linter-2026-09-14-migration.sql                            | TEST_REQUIRED           |
| MIGP-031 | no PostgreSQL test | linter-hardening-migration.sql                             | TEST_REQUIRED           |
| MIGP-032 | no PostgreSQL test | live-reconciliation-migration.sql                          | TEST_REQUIRED           |
| MIGP-033 | no PostgreSQL test | mdm-migration.sql                                          | TEST_REQUIRED           |
| MIGP-034 | no PostgreSQL test | member-module-blocks-migration.sql                         | TEST_REQUIRED           |
| MIGP-035 | no PostgreSQL test | missing-rpcs-migration.sql                                 | TEST_REQUIRED           |
| MIGP-036 | no PostgreSQL test | module-auth-session-epoch-migration.sql                    | TEST_REQUIRED           |
| MIGP-037 | no PostgreSQL test | module-created-at-default-migration.sql                    | TEST_REQUIRED           |
| MIGP-038 | no PostgreSQL test | module-desktop-update-feed-migration.sql                   | TEST_REQUIRED           |
| MIGP-039 | no PostgreSQL test | multi-warehouse-migration.sql                              | TEST_REQUIRED           |
| MIGP-040 | no PostgreSQL test | offering-type-01-migration.sql                             | TEST_REQUIRED           |
| MIGP-041 | no PostgreSQL test | offline-idempotency-migration.sql                          | TEST_REQUIRED           |
| MIGP-042 | no PostgreSQL test | onboarding-server-state-migration.sql                      | TEST_REQUIRED           |
| MIGP-043 | no PostgreSQL test | patch-01-currencies-migration.sql                          | TEST_REQUIRED           |
| MIGP-044 | no PostgreSQL test | patch-02-custom-units-migration.sql                        | TEST_REQUIRED           |
| MIGP-045 | no PostgreSQL test | patch-03-leaves-gaps-migration.sql                         | TEST_REQUIRED           |
| MIGP-046 | no PostgreSQL test | payments-ar-ap-migration.sql                               | TEST_REQUIRED           |
| MIGP-047 | no PostgreSQL test | payroll-idempotency-01-migration.sql                       | TEST_REQUIRED           |
| MIGP-048 | no PostgreSQL test | perf-aggregates-ledger-migration.sql                       | TEST_REQUIRED           |
| MIGP-049 | no PostgreSQL test | personalization-migration.sql                              | TEST_REQUIRED           |
| MIGP-050 | no PostgreSQL test | phase-a-01-journal-lines-fk-migration.sql                  | TEST_REQUIRED           |
| MIGP-051 | no PostgreSQL test | phase-a-02-ledger-entries-workspace-migration.sql          | TEST_REQUIRED           |
| MIGP-052 | no PostgreSQL test | phase-a-03-fk-indexes-migration.sql                        | TEST_REQUIRED           |
| MIGP-053 | no PostgreSQL test | phase-a-04-missing-primary-keys-migration.sql              | TEST_REQUIRED           |
| MIGP-054 | no PostgreSQL test | phase-b-01-accounting-source-of-truth-migration.sql        | TEST_REQUIRED           |
| MIGP-055 | no PostgreSQL test | phase-d-01-employee-branch-assignments-migration.sql       | TEST_REQUIRED           |
| MIGP-056 | no PostgreSQL test | phase-e-01-rbac-2.0-migration.sql                          | TEST_REQUIRED           |
| MIGP-057 | no PostgreSQL test | phase-f-01-receivables-projection-migration.sql            | TEST_REQUIRED           |
| MIGP-058 | no PostgreSQL test | phase-g-01-branch-manager-migration.sql                    | TEST_REQUIRED           |
| MIGP-059 | no PostgreSQL test | phase-g-02-permission-profiles-migration.sql               | TEST_REQUIRED           |
| MIGP-060 | no PostgreSQL test | phase-g-03-audit-branch-migration.sql                      | TEST_REQUIRED           |
| MIGP-061 | no PostgreSQL test | phase-j-02-reconciliation-hardening-migration.sql          | TEST_REQUIRED           |
| MIGP-062 | no PostgreSQL test | phase-j-03-document-status-migration.sql                   | TEST_REQUIRED           |
| MIGP-063 | no PostgreSQL test | phase-j-04-payroll-ledger-migration.sql                    | TEST_REQUIRED           |
| MIGP-064 | no PostgreSQL test | phase-k-01-stock-transfers-migration.sql                   | TEST_REQUIRED           |
| MIGP-065 | no PostgreSQL test | phase-l-01-units-migration.sql                             | TEST_REQUIRED           |
| MIGP-066 | no PostgreSQL test | phase-l-02-product-units-migration.sql                     | TEST_REQUIRED           |
| MIGP-067 | no PostgreSQL test | phase-l-03-cycle-counts-migration.sql                      | TEST_REQUIRED           |
| MIGP-068 | no PostgreSQL test | phase-m-01-shift-handover-migration.sql                    | TEST_REQUIRED           |
| MIGP-069 | no PostgreSQL test | phase-n-01-reconciliation-memory-migration.sql             | TEST_REQUIRED           |
| MIGP-070 | no PostgreSQL test | phase-o-01-reporting-layer-migration.sql                   | TEST_REQUIRED           |
| MIGP-071 | no PostgreSQL test | phase-o-02-catalog-and-query-log-migration.sql             | TEST_REQUIRED           |
| MIGP-072 | no PostgreSQL test | phase-t11-product-units-rpc-migration.sql                  | TEST_REQUIRED           |
| MIGP-073 | no PostgreSQL test | phase-t13-ai-provider-migration.sql                        | TEST_REQUIRED           |
| MIGP-074 | no PostgreSQL test | phase-t2-units-rls-migration.sql                           | TEST_REQUIRED           |
| MIGP-075 | no PostgreSQL test | phase-t4-manufacturing-fk-migration.sql                    | TEST_REQUIRED           |
| MIGP-076 | no PostgreSQL test | phase-t4b-bom-notes-migration.sql                          | TEST_REQUIRED           |
| MIGP-077 | no PostgreSQL test | pos-session-suspend-migration.sql                          | TEST_REQUIRED           |
| MIGP-078 | no PostgreSQL test | profit-ledger-totals-01-migration.sql                      | TEST_REQUIRED           |
| MIGP-079 | no PostgreSQL test | provider-commission-01-migration.sql                       | TEST_REQUIRED           |
| MIGP-080 | no PostgreSQL test | realtime-data-tables-migration.sql                         | TEST_REQUIRED           |
| MIGP-081 | no PostgreSQL test | realtime-publication-migration.sql                         | TEST_REQUIRED           |
| MIGP-082 | no PostgreSQL test | referral-system-migration.sql                              | TEST_REQUIRED           |
| MIGP-083 | no PostgreSQL test | remaining-policies-migration.sql                           | TEST_REQUIRED           |
| MIGP-084 | no PostgreSQL test | restore-defaults-migration.sql                             | TEST_REQUIRED           |
| MIGP-085 | no PostgreSQL test | rls-performance-migration.sql                              | TEST_REQUIRED           |
| MIGP-086 | no PostgreSQL test | rls-recursion-fix-migration.sql                            | TEST_REQUIRED           |
| MIGP-087 | no PostgreSQL test | role-timeouts-01-migration.sql                             | TEST_REQUIRED           |
| MIGP-088 | no PostgreSQL test | rules-engine-migration.sql                                 | TEST_REQUIRED           |
| MIGP-089 | no PostgreSQL test | schema-drift-fix-migration.sql                             | TEST_REQUIRED           |
| MIGP-090 | no PostgreSQL test | security-revoke-definer-rpc-migration.sql                  | TEST_REQUIRED           |
| MIGP-091 | no PostgreSQL test | service-delivery-03-cancellation-reason-migration.sql      | TEST_REQUIRED           |
| MIGP-092 | no PostgreSQL test | sod-migration.sql                                          | TEST_REQUIRED           |
| MIGP-093 | no PostgreSQL test | stock-transfer-02-cost-layers-migration.sql                | TEST_REQUIRED           |
| MIGP-094 | no PostgreSQL test | subscription-orders-claim-migration.sql                    | TEST_REQUIRED           |
| MIGP-095 | no PostgreSQL test | subscription-workspace-migration.sql                       | TEST_REQUIRED           |
| MIGP-096 | no PostgreSQL test | task-assignment-migration.sql                              | TEST_REQUIRED           |
| MIGP-097 | no PostgreSQL test | task-customer-outcomes-migration.sql                       | TEST_REQUIRED           |
| MIGP-098 | no PostgreSQL test | tax-engine-migration.sql                                   | TEST_REQUIRED           |
| MIGP-099 | no PostgreSQL test | tenancy-workspace-migration.sql                            | TEST_REQUIRED           |
| MIGP-100 | no PostgreSQL test | tenant-isolation-closure-migration.sql                     | TEST_REQUIRED           |
| MIGP-101 | no PostgreSQL test | tier2-gaps-migration.sql                                   | TEST_REQUIRED           |
| MIGP-102 | no PostgreSQL test | till-bank-transfer-migration.sql                           | TEST_REQUIRED           |
| MIGP-103 | no PostgreSQL test | timesheet-sync-migration.sql                               | TEST_REQUIRED           |
| MIGP-104 | no PostgreSQL test | views-and-billing-events-migration.sql                     | TEST_REQUIRED           |
| MIGP-105 | no PostgreSQL test | workspace-member-fields-migration.sql                      | TEST_REQUIRED           |
| MIGP-106 | no PostgreSQL test | workspace-members-rls-migration.sql                        | TEST_REQUIRED           |
| MIGP-107 | no PostgreSQL test | workspace-role-capabilities-migration.sql                  | TEST_REQUIRED           |
| MIGP-108 | no PostgreSQL test | workspace-stamp-migration.sql                              | TEST_REQUIRED           |

## 6. External / owner items

| EXT-001 | Apply docs/sync-account-tenancy-coverage-migration.sql and run VERIFY | LIVE_SUPABASE_ACTION_REQUIRED |
| EXT-002 | Resolve SeCreateGlobalPrivilege and run --project pg | LOCAL_ENVIRONMENT_BLOCKED |
| EXT-003 | Five owner acceptance experiments on real hardware | PHYSICAL_DEVICE_ACCEPTANCE_REQUIRED |
| EXT-004 | Ten onboarding E2E scenarios in a browser | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EXT-005 | 67-industry acceptance evidence (0 sellable) | EXTERNAL_BROWSER_OR_DEPLOYMENT_REQUIRED |
| EXT-006 | licence pricing / limits / D15 decisions | OWNER_BUSINESS_DECISION_REQUIRED |
| EXT-007 | regulated industry approvals (pharmacy, FX, gold, lending) | REGULATORY_OR_LEGAL_ACCEPTANCE_REQUIRED |
| EXT-008 | LAN runtime is contract-only | OWNER_BUSINESS_DECISION_REQUIRED |

Totals: closed=8, endpoints=689, sync=21, industries=67, migration-gaps=227, external=8, grand-total=1020
