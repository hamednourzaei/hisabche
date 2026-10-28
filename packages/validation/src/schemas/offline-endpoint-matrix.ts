// ============================================
// packages/validation/src/schemas/offline-endpoint-matrix.ts
//
// The OFFLINE ENDPOINT MATRIX — every endpoint the client calls, with the one
// feature it belongs to and the one status it has when the product runs offline.
//
// ⚠️ ONE PRODUCT, ONE REGISTRY, TWO EXECUTION MODES
//
// Offline is not a smaller Hisabche; it is the same product with an execution
// mode. The feature registry (feature-registry.ts) says WHICH feature an action
// is and WHO may use it; this file says WHETHER THE DEVICE CAN RUN IT, per
// endpoint, and nothing else decides that:
//
//   · the local engine answers an endpoint  ⇔  its row here is `available`
//   · the UI asks `featureOfflineAvailability` / `endpointAvailability`
//     (through `checkActionAvailability`) — it never writes `if (offline)`
//   · a client call that has no row fails the build (api: offline-matrix guard)
//
// ⚠️ THREE STATUSES, NO FOURTH
//
//   available        the local engine really runs it (route + persistence + test)
//   online_required  part of the product, not run on the device: the UI still
//                    shows it and says «needs the online edition» on use
//   not_supported    not an in-app capability the device can have; the reason is
//                    recorded in NOT_SUPPORTED_REASONS — nothing is faked
//
// A row moves from `online_required` to `available` in the SAME change that
// registers its local route (a guard fails when the two disagree).
// ============================================

import { featureDefinition, type FeatureKey } from './feature-registry'

export type OfflineAvailability = 'available' | 'online_required' | 'not_supported'

export type EndpointRow = readonly [feature: FeatureKey, status: OfflineAvailability]

/**
 * METHOD + normalised path → [feature, status]. A path segment that is an id or
 * any interpolated value is `:x`.
 */
export const OFFLINE_ENDPOINT_MATRIX: Readonly<Record<string, EndpointRow>> = {
  'DELETE /attendance-devices/:x': ['hr.attendance_devices', 'online_required'],
  'DELETE /finance/currency/units/:x': ['settings.custom_units', 'online_required'],
  'DELETE /attendance-links/:x': ['hr.attendance_links', 'online_required'],
  'DELETE /attendance-links/phone/:x': ['hr.attendance_links', 'online_required'],
  'DELETE /automations/:x': ['automation.rules', 'online_required'],
  'DELETE /customer-portal-links/:x': ['customer.portal_link', 'online_required'],
  'DELETE /customers/:x': ['customer.delete', 'online_required'],
  // The device deletes a warehouse too (routes/warehouses.ts) with the same «still holds stock» refusal.
  'DELETE /warehouses/:x': ['warehouse.upsert', 'available'],
  'DELETE /customers/:x/documents/:x': ['customer.documents', 'online_required'],
  'DELETE /developer/apps/:x': ['developer.keys', 'online_required'],
  'DELETE /developer/apps/:x/screenshots/:x': ['developer.keys', 'online_required'],
  'DELETE /developer/keys/:x': ['developer.keys', 'online_required'],
  'DELETE /developer/webhooks/:x': ['developer.keys', 'online_required'],
  'DELETE /employees/:x': ['employee.upsert', 'available'],
  'DELETE /invoices/:x': ['invoice.delete', 'available'],
  'DELETE /invoices/:x/installments': ['invoice.installment', 'available'],
  'DELETE /market/listings/:x': ['marketplace.apps', 'online_required'],
  'DELETE /marketplace/apps/:x/review': ['marketplace.apps', 'online_required'],
  'DELETE /permissions/roles/:x': ['governance.permission_matrix', 'online_required'],
  'DELETE /pos/sessions/:x': ['till.open_close', 'available'],
  'DELETE /products/:x': ['product.upsert', 'available'],
  'DELETE /products/:x/barcodes/:x': ['product.barcode', 'online_required'],
  'DELETE /products/:x/images/:x': ['product.images', 'online_required'],
  'DELETE /projects/:x': ['project.manage', 'online_required'],
  'DELETE /roles/:x': ['governance.permission_matrix', 'online_required'],
  'DELETE /saved-views/:x': ['saved.views', 'online_required'],
  'DELETE /tasks/:x': ['project.manage', 'online_required'],
  'DELETE /workspaces/:x/invites/:x': ['team.members', 'online_required'],
  'DELETE /workspaces/:x/members/:x': ['team.members', 'online_required'],
  'GET /accounting/accounts': ['accounting.chart', 'available'],
  'GET /accounting/balance-sheet': ['accounting.reports', 'available'],
  'GET /accounting/evidence/invoices/:x': ['accounting.evidence', 'available'],
  'GET /accounting/evidence/products/:x': ['accounting.evidence', 'available'],
  'GET /accounting/general-ledger': ['accounting.general_ledger', 'available'],
  'GET /accounting/income-statement': ['accounting.reports', 'available'],
  'GET /accounting/journal': ['accounting.journal', 'available'],
  'GET /accounting/profit-report/by-currency': ['accounting.profit_report', 'available'],
  'GET /accounting/trial-balance': ['accounting.trial_balance', 'available'],
  'GET /agriculture/crops': ['trade.agriculture', 'online_required'],
  'GET /ai-requests': ['ai.assistant', 'online_required'],
  'GET /ai/config': ['ai.assistant', 'online_required'],
  'GET /ai/insights': ['dashboard.ai_insight', 'available'],
  'GET /ai/pipeline/settings': ['ai.assistant', 'online_required'],
  'GET /ai/quota': ['ai.assistant', 'online_required'],
  'GET /analysis/benchmark': ['analysis.benchmark', 'online_required'],
  'GET /analysis/break-even': ['analysis.reports', 'available'],
  'GET /analysis/cohorts': ['analysis.reports', 'available'],
  'GET /analysis/collections': ['analysis.reports', 'available'],
  'GET /analysis/customers/:x/risk': ['customer.risk', 'available'],
  'GET /analysis/suppliers': ['analysis.reports', 'available'],
  'GET /analysis/working-capital': ['analysis.reports', 'available'],
  'GET /analytics/dashboard': ['dashboard.kpi', 'available'],
  'GET /analytics/sales': ['dashboard.sales_chart', 'available'],
  'GET /api/public/cms/globals/:x': ['blog.public', 'not_supported'],
  'GET /appointments': ['trade.appointments', 'online_required'],
  'GET /attendance-devices': ['hr.attendance_devices', 'online_required'],
  'GET /attendance-devices/:x/identities': ['hr.attendance_devices', 'online_required'],
  'GET /attendance-devices/:x/unmatched': ['hr.attendance_devices', 'online_required'],
  'GET /attendance-devices/held': ['hr.attendance_devices', 'online_required'],
  'GET /attendance-links': ['hr.attendance_links', 'online_required'],
  'GET /attendance-sheet': ['hr.attendance', 'available'],
  'GET /attendance-submissions': ['hr.attendance_links', 'online_required'],
  'GET /audit/logs': ['audit.trail', 'online_required'],
  'GET /audit/verify': ['audit.trail', 'online_required'],
  'GET /audit/workspace': ['audit.trail', 'online_required'],
  'GET /audit/workspace/:x/:x': ['audit.trail', 'online_required'],
  'GET /auth/me': ['settings.workspace_profile', 'available'],
  'GET /automations': ['automation.rules', 'online_required'],
  'GET /automations/:x/runs': ['automation.rules', 'online_required'],
  'GET /billing/plans': ['billing.portal', 'online_required'],
  'GET /billing/subscription': ['billing.portal', 'online_required'],
  'GET /billing/trial-status': ['billing.portal', 'online_required'],
  'GET /billing/upgrade-requests': ['billing.portal', 'online_required'],
  'GET /billing/usage': ['billing.portal', 'online_required'],
  'GET /blog/posts/:x/comments': ['blog.public', 'not_supported'],
  'GET /blog/posts/:x/me': ['blog.public', 'not_supported'],
  'GET /boms': ['manufacturing.bom', 'online_required'],
  'GET /branches': ['branch.manage', 'available'],
  'GET /branches/tree': ['branch.manage', 'available'],
  'GET /campaigns': ['customer.outreach', 'online_required'],
  'GET /campaigns/:x': ['customer.outreach', 'online_required'],
  'GET /campaigns/:x/preview': ['customer.outreach', 'online_required'],
  'GET /compensation': ['hr.payroll', 'available'],
  'GET /conflicts': ['sync.conflicts', 'online_required'],
  'GET /conflicts/:x': ['sync.conflicts', 'online_required'],
  'GET /crm/customers/:x': ['customer.crm', 'online_required'],
  'GET /currencies': ['settings.currency_catalogue', 'online_required'],
  'GET /custom-fields/:x/:x/values': ['custom.fields', 'online_required'],
  'GET /custom-reports': ['custom.reports', 'online_required'],
  'GET /custom-reports/:x/run': ['custom.reports', 'online_required'],
  'GET /custom-reports/catalog': ['custom.reports', 'online_required'],
  'GET /customers': ['customer.list', 'available'],
  'GET /customers/:x': ['customer.detail', 'available'],
  'GET /customers/:x/accounting': ['customer.accounting', 'available'],
  'GET /customers/:x/documents': ['customer.documents', 'online_required'],
  'GET /customers/:x/documents/:x/url': ['customer.documents', 'online_required'],
  'GET /customers/:x/insights': ['customer.crm', 'online_required'],
  'GET /customers/:x/portal-links': ['customer.portal_link', 'online_required'],
  'GET /customers/:x/profile': ['customer.terms', 'online_required'],
  'GET /cycle-counts': ['stockcount.create', 'online_required'],
  'GET /cycle-counts/:x': ['stockcount.list', 'online_required'],
  'GET /deliveries/courier': ['trade.courier', 'online_required'],
  'GET /deliveries/notes': ['trade.delivery_notes', 'online_required'],
  'GET /developer/apps': ['developer.keys', 'online_required'],
  'GET /developer/apps/:x/screenshots': ['developer.keys', 'online_required'],
  'GET /developer/apps/:x/stats': ['developer.keys', 'online_required'],
  'GET /developer/apps/:x/versions': ['developer.keys', 'online_required'],
  'GET /developer/catalog': ['developer.keys', 'online_required'],
  'GET /developer/installed-apps': ['developer.keys', 'online_required'],
  'GET /developer/installed-apps/:x/update': ['developer.keys', 'online_required'],
  'GET /developer/keys': ['developer.keys', 'online_required'],
  'GET /developer/keys/:x/usage': ['developer.keys', 'online_required'],
  'GET /developer/publisher': ['developer.keys', 'online_required'],
  'GET /developer/sandbox': ['developer.keys', 'online_required'],
  'GET /developer/storefront-keys': ['developer.keys', 'online_required'],
  'GET /developer/webhooks': ['developer.keys', 'online_required'],
  'GET /developer/webhooks/:x/deliveries': ['developer.keys', 'online_required'],
  'GET /employees': ['employee.list', 'available'],
  'GET /employees/:x': ['employee.upsert', 'available'],
  'GET /finance/assets': ['asset.fixed', 'online_required'],
  'GET /finance/assets/:x/schedule': ['asset.fixed', 'online_required'],
  'GET /finance/bank/statements': ['bank.import', 'online_required'],
  'GET /finance/bank/statements/:x/categories': ['bank.import', 'online_required'],
  'GET /finance/bank/statements/:x/reconciliation': ['bank.import', 'online_required'],
  'GET /finance/bank/statements/:x/suggestions': ['bank.import', 'online_required'],
  'GET /finance/currency/base': ['settings.currencies', 'available'],
  'GET /finance/currency/rates': ['settings.currencies', 'available'],
  'GET /finance/currency/units': ['settings.currencies', 'available'],
  'GET /financing/facilities': ['accounting.financing', 'online_required'],
  'GET /financing/holdings': ['accounting.financing', 'online_required'],
  'GET /governance/member-blocks': ['governance.permission_matrix', 'online_required'],
  'GET /governance/my-capabilities': ['settings.workspace_profile', 'available'],
  'GET /governance/sod': ['governance.permission_matrix', 'online_required'],
  'GET /governance/sod/overrides': ['governance.permission_matrix', 'online_required'],
  'GET /intelligence/cash-forecast': ['ai.cashflow_forecast', 'online_required'],
  'GET /intelligence/duplicates/:x': ['customer.crm', 'online_required'],
  'GET /intelligence/stale-opportunities': ['customer.crm', 'online_required'],
  'GET /interactions': ['customer.crm', 'online_required'],
  'GET /interactions/subjects': ['customer.crm', 'online_required'],
  'GET /inventory/dead-stock': ['inventory.insights', 'available'],
  'GET /inventory/reorder-suggestions': ['inventory.insights', 'available'],
  'GET /inventory/settings': ['inventory.costing_method', 'available'],
  'GET /inventory/unvalued': ['accounting.unvalued_stock', 'available'],
  'GET /invoices': ['invoice.list', 'available'],
  'GET /invoices/:x': ['invoice.detail', 'available'],
  'GET /invoices/:x/installments': ['invoice.installment', 'available'],
  'GET /invoices/:x/late-fees': ['invoice.late_fee', 'available'],
  'GET /invoices/:x/pdf': ['invoice.print', 'online_required'],
  'GET /invoices/:x/related': ['invoice.related', 'available'],
  'GET /invoices/:x/returns': ['invoice.returns', 'online_required'],
  'GET /late-fees/policy': ['invoice.late_fee', 'available'],
  'GET /leaves': ['hr.leaves', 'available'],
  'GET /manufacturing/definitions/:x': ['manufacturing.definition', 'online_required'],
  'GET /manufacturing/report': ['manufacturing.report', 'online_required'],
  'GET /manufacturing/runs': ['manufacturing.runs', 'online_required'],
  'GET /manufacturing/runs/:x': ['manufacturing.runs', 'online_required'],
  'GET /market/seller': ['marketplace.apps', 'online_required'],
  'GET /marketplace/apps': ['marketplace.apps', 'online_required'],
  'GET /marketplace/apps/:x': ['marketplace.apps', 'online_required'],
  'GET /metal-rates/latest': ['trade.metal_rates', 'available'],
  'GET /migrations': ['data.migration', 'online_required'],
  'GET /migrations/:x': ['data.migration', 'online_required'],
  'GET /notes': ['notes.entity', 'online_required'],
  'GET /oauth/authorize': ['developer.keys', 'online_required'],
  'GET /operations/batches': ['expiry.batches', 'online_required'],
  'GET /operations/budgets': ['budget.manage', 'available'],
  'GET /operations/budgets/:x/revisions': ['budget.manage', 'available'],
  'GET /operations/budgets/report': ['budget.manage', 'available'],
  'GET /operations/budgets/variance': ['budget.manage', 'available'],
  'GET /operations/expiry': ['expiry.batches', 'online_required'],
  'GET /operations/lot-trail/:x/:x': ['expiry.batches', 'online_required'],
  'GET /operations/serials': ['expiry.batches', 'online_required'],
  'GET /operations/timesheets/:x': ['timesheet.manage', 'online_required'],
  'GET /operations/timesheets/:x/billing-preview': ['timesheet.manage', 'online_required'],
  'GET /operations/timesheets/:x/profitability': ['timesheet.manage', 'online_required'],
  'GET /opportunities': ['customer.crm', 'online_required'],
  'GET /orders/:x/deposits': ['order.deposits', 'available'],
  'GET /payments': ['payment.record', 'available'],
  'GET /payments/activity/:x/:x': ['customer.accounting', 'available'],
  'GET /payments/return-effects/customers': ['customer.return_effects', 'online_required'],
  'GET /payments/ledger/:x/:x': ['customer.accounting', 'available'],
  'GET /payments/open-invoices/:x/:x': ['customer.accounting', 'available'],
  'GET /payments/summary/:x/:x': ['customer.accounting', 'available'],
  'GET /payrolls': ['hr.payroll', 'available'],
  'GET /payrolls/summary': ['hr.payroll', 'available'],
  'GET /permissions': ['governance.permission_matrix', 'online_required'],
  'GET /permissions/matrix': ['governance.permission_matrix', 'online_required'],
  'GET /permissions/roles/:x/members': ['governance.permission_matrix', 'online_required'],
  'GET /pos/cash-flow': ['till.ledger', 'available'],
  'GET /pos/sessions/:x': ['till.session', 'available'],
  'GET /pos/sessions/:x/ledger': ['till.ledger', 'available'],
  'GET /pos/sessions/abandoned': ['till.session', 'available'],
  'GET /pos/sessions/current': ['till.session', 'available'],
  'GET /pos/sessions/history': ['till.shift_history', 'available'],
  'GET /pos/sessions/labels': ['till.labels', 'available'],
  'GET /pos/sessions/open': ['till.session', 'available'],
  'GET /price-lists': ['pricing.price_lists', 'available'],
  'GET /price-lists/:x': ['pricing.price_lists', 'available'],
  'GET /price-lists/for-customer/:x': ['pricing.price_lists', 'available'],
  'GET /products': ['product.list', 'available'],
  'GET /products/:x': ['product.detail', 'available'],
  'GET /products/:x/barcodes': ['product.barcode', 'online_required'],
  'GET /products/:x/fitments': ['product.fitments', 'available'],
  'GET /products/:x/images': ['product.images', 'online_required'],
  'GET /products/:x/stock-history': ['stock.history', 'online_required'],
  'GET /products/:x/storage-locations': ['stock.storage_locations', 'available'],
  'GET /products/:x/units': ['unit.conversion', 'online_required'],
  'GET /products/:x/variants': ['product.variants', 'available'],
  'GET /products/:x/warehouse-breakdown': ['warehouse.detail', 'available'],
  'GET /products/by-barcode/:x': ['product.barcode_lookup', 'online_required'],
  'GET /products/categories': ['product.list', 'available'],
  'GET /projects': ['project.manage', 'online_required'],
  'GET /projects/:x': ['project.manage', 'online_required'],
  'GET /projects/:x/tasks': ['project.manage', 'online_required'],
  'GET /promotions': ['pricing.promotions', 'available'],
  'GET /public/feedback/:x': ['blog.public', 'not_supported'],
  'GET /purchase-orders': ['purchase.orders', 'available'],
  'GET /purchase-orders/:x': ['purchase.orders', 'available'],
  'GET /referrals': ['referral.program', 'online_required'],
  'GET /report-dashboards': ['custom.reports', 'online_required'],
  'GET /roles': ['governance.permission_matrix', 'online_required'],
  'GET /rules': ['automation.rules', 'online_required'],
  'GET /saved-views': ['saved.views', 'online_required'],
  'GET /shift-assignments': ['hr.shifts', 'available'],
  'GET /shifts': ['hr.shifts', 'available'],
  'GET /storefront/settings': ['storefront.public', 'online_required'],
  'GET /suppliers': ['purchase.orders', 'available'],
  'GET /sync/overview': ['sync.overview', 'online_required'],
  'GET /tax/return': ['accounting.tax_return', 'online_required'],
  'GET /transactions': ['accounting.legacy_transactions', 'online_required'],
  'GET /transactions/ledger': ['accounting.legacy_transactions', 'online_required'],
  'GET /transport/trips': ['trade.freight', 'online_required'],
  'GET /units': ['unit.manage', 'available'],
  'GET /v1/activities': ['activity.feed', 'available'],
  'GET /v1/activities/counts': ['activity.feed', 'available'],
  'GET /v1/activities/entity/:x/:x': ['activity.entity_timeline', 'online_required'],
  'GET /v1/activities/entity/:x/:x/summary': ['activity.entity_timeline', 'online_required'],
  'GET /v1/activities/unread-count': ['activity.feed', 'available'],
  'GET /v1/entities/:x/:x/activities': ['activity.entity_timeline', 'online_required'],
  'GET /v1/notifications': ['activity.feed', 'available'],
  'GET /v1/notifications/unread-count': ['activity.feed', 'available'],
  'GET /v1/workflows': ['approvals.workflows', 'online_required'],
  'GET /v1/workflows/:x': ['approvals.workflows', 'online_required'],
  'GET /v1/workflows/:x/escalation': ['approvals.workflows', 'online_required'],
  'GET /v1/workflows/instances': ['approvals.workflows', 'online_required'],
  'GET /v1/workflows/instances/:x': ['approvals.workflows', 'online_required'],
  'GET /vehicles': ['trade.vehicles', 'available'],
  'GET /wallet': ['billing.portal', 'online_required'],
  'GET /wallet/topups': ['billing.portal', 'online_required'],
  'GET /wallet/transactions': ['billing.portal', 'online_required'],
  'GET /warehouses/:x/detail': ['warehouse.upsert', 'available'],
  'GET /warehouses/:x/map': ['warehouse.upsert', 'available'],
  'GET /warehouses/overview': ['warehouse.upsert', 'available'],
  'GET /warehouses/placement': ['warehouse.upsert', 'available'],
  'GET /warranties': ['trade.warranties', 'available'],
  'GET /work-orders': ['manufacturing.work_orders', 'online_required'],
  'GET /workplace/time-zone': ['settings.time_zone', 'online_required'],
  'GET /workspaces': ['settings.workspace_profile', 'available'],
  'GET /workspaces/:x/invites': ['team.members', 'online_required'],
  'GET /workspaces/:x/members': ['settings.workspace_profile', 'available'],
  'GET /workspaces/backup': ['data.backup', 'available'],
  'PATCH /auth/profile': ['settings.workspace_profile', 'available'],
  'PATCH /automations/:x': ['automation.rules', 'online_required'],
  'PATCH /custom-fields/definitions/:x/active': ['custom.fields', 'online_required'],
  'PATCH /custom-reports/:x/retire': ['custom.reports', 'online_required'],
  'PATCH /customers/:x': ['customer.upsert', 'available'],
  'PATCH /customers/:x/terms': ['customer.terms', 'online_required'],
  'PATCH /developer/apps/:x': ['developer.keys', 'online_required'],
  'PATCH /developer/webhooks/:x': ['developer.keys', 'online_required'],
  'PATCH /employees/:x': ['employee.upsert', 'available'],
  'PATCH /financing/facilities/:x/active': ['accounting.financing', 'online_required'],
  'PATCH /financing/holdings/:x': ['accounting.financing', 'online_required'],
  'PATCH /interactions/:x/customer-outcome': ['customer.crm', 'online_required'],
  'PATCH /interactions/:x/status': ['customer.crm', 'online_required'],
  'PATCH /invoices/:x': ['invoice.edit', 'online_required'],
  'PATCH /leaves/:x': ['hr.leaves', 'available'],
  'PATCH /operations/batches/:x': ['expiry.batches', 'online_required'],
  'PATCH /opportunities/:x': ['customer.crm', 'online_required'],
  'PATCH /payrolls/:x': ['hr.payroll', 'available'],
  'PATCH /permissions/roles/:x': ['governance.permission_matrix', 'online_required'],
  'PATCH /pos/sessions/:x/label': ['till.labels', 'available'],
  'PATCH /price-lists/:x/active': ['pricing.price_lists', 'available'],
  'PATCH /products/:x': ['product.upsert', 'available'],
  'PATCH /products/:x/images/:x': ['product.images', 'online_required'],
  'PATCH /projects/:x': ['project.manage', 'online_required'],
  'PATCH /promotions/:x/active': ['pricing.promotions', 'available'],
  'PATCH /report-dashboards/:x/retire': ['custom.reports', 'online_required'],
  'PATCH /saved-views/:x': ['saved.views', 'online_required'],
  'PATCH /shifts/:x/active': ['hr.shifts', 'available'],
  'PATCH /storage-locations/:x': ['stock.storage_locations', 'available'],
  'PATCH /tasks/:x': ['project.manage', 'online_required'],
  'PATCH /v1/activities/mark-all-read': ['activity.feed', 'available'],
  'PATCH /v1/activities/mark-read': ['activity.feed', 'available'],
  'PATCH /v1/notifications/mark-all-read': ['activity.feed', 'available'],
  'PATCH /v1/notifications/mark-read': ['activity.feed', 'available'],
  'PATCH /warehouses/:x': ['warehouse.upsert', 'available'],
  'PATCH /workspaces/:x': ['settings.workspace_profile', 'available'],
  'PATCH /workspaces/:x/members/role': ['team.members', 'online_required'],
  'PATCH /workspaces/:x/members/suspension': ['team.members', 'online_required'],
  'POST /accounting/accounts': ['accounting.chart', 'available'],
  'POST /accounting/journal': ['accounting.journal', 'available'],
  'POST /accounting/month-end': ['accounting.period_close', 'online_required'],
  'POST /agriculture/crops': ['trade.agriculture', 'online_required'],
  'POST /ai-requests/:x/approve': ['ai.assistant', 'online_required'],
  'POST /ai-requests/:x/reject': ['ai.assistant', 'online_required'],
  'POST /ai/ask': ['ai.assistant', 'online_required'],
  'POST /ai/pipeline/runs': ['ai.assistant', 'online_required'],
  'POST /ai/pipeline/runs/:x/answers': ['ai.assistant', 'online_required'],
  'POST /ai/pipeline/runs/:x/cancel': ['ai.assistant', 'online_required'],
  'POST /ai/translate': ['ai.assistant', 'online_required'],
  'POST /appointments': ['trade.appointments', 'online_required'],
  'POST /attendance-devices': ['hr.attendance_devices', 'online_required'],
  'POST /attendance-devices/:x/key': ['hr.attendance_devices', 'online_required'],
  'POST /attendance-devices/held/accept': ['hr.attendance_devices', 'online_required'],
  'POST /attendance-links': ['hr.attendance_links', 'online_required'],
  'POST /attendance-submissions/:x/decision': ['hr.attendance_links', 'online_required'],
  'POST /auth/login': ['auth.cloud_session', 'not_supported'],
  'POST /auth/logout': ['auth.cloud_session', 'not_supported'],
  'POST /auth/refresh': ['auth.cloud_session', 'not_supported'],
  'POST /auth/signup': ['auth.cloud_session', 'not_supported'],
  'POST /auth/validate': ['auth.cloud_session', 'not_supported'],
  'POST /automations/:x/run': ['automation.rules', 'online_required'],
  'POST /automations/month-end': ['accounting.period_close', 'online_required'],
  'POST /automations/recurring-invoice': ['invoice.recurring', 'online_required'],
  'POST /billing/cancel': ['billing.portal', 'online_required'],
  'POST /billing/upgrade': ['billing.portal', 'online_required'],
  'POST /billing/upgrade-requests/:x/cancel': ['billing.portal', 'online_required'],
  'POST /blog/posts/:x/comments': ['blog.public', 'not_supported'],
  'POST /blog/posts/:x/view': ['blog.public', 'not_supported'],
  'POST /branches': ['branch.manage', 'available'],
  'POST /campaigns': ['customer.outreach', 'online_required'],
  'POST /campaigns/:x/cancel': ['customer.outreach', 'online_required'],
  'POST /campaigns/:x/launch': ['customer.outreach', 'online_required'],
  'POST /conflicts/:x/resolve': ['sync.conflicts', 'online_required'],
  'POST /custom-fields/:x': ['custom.fields', 'online_required'],
  'POST /custom-reports': ['custom.reports', 'online_required'],
  'POST /customers': ['customer.upsert', 'available'],
  'POST /customers/:x/documents': ['customer.documents', 'online_required'],
  'POST /customers/:x/portal-links': ['customer.portal_link', 'online_required'],
  'POST /cycle-counts': ['stockcount.create', 'online_required'],
  'POST /cycle-counts/:x/cancel': ['stockcount.cancel', 'online_required'],
  'POST /cycle-counts/:x/complete': ['stockcount.complete', 'online_required'],
  'POST /cycle-counts/:x/lines': ['stockcount.record_line', 'online_required'],
  'POST /deliveries/courier': ['trade.courier', 'online_required'],
  'POST /deliveries/courier/:x/progress-cod': ['trade.courier', 'online_required'],
  'POST /deliveries/notes': ['trade.delivery_notes', 'online_required'],
  'POST /developer/apps': ['developer.keys', 'online_required'],
  'POST /developer/apps/:x/images': ['developer.keys', 'online_required'],
  'POST /developer/apps/:x/rotate-secret': ['developer.keys', 'online_required'],
  'POST /developer/apps/:x/screenshots': ['developer.keys', 'online_required'],
  'POST /developer/apps/:x/versions': ['developer.keys', 'online_required'],
  'POST /developer/apps/:x/webhook-secret': ['developer.keys', 'online_required'],
  'POST /developer/deliveries/:x/retry': ['developer.keys', 'online_required'],
  'POST /developer/installed-apps/:x/uninstall': ['developer.keys', 'online_required'],
  'POST /developer/installed-apps/:x/update': ['developer.keys', 'online_required'],
  'POST /developer/keys': ['developer.keys', 'online_required'],
  'POST /developer/sandbox': ['developer.keys', 'online_required'],
  'POST /developer/sandbox/reset': ['developer.keys', 'online_required'],
  'POST /developer/storefront-keys': ['developer.keys', 'online_required'],
  'POST /developer/webhooks': ['developer.keys', 'online_required'],
  'POST /developer/webhooks/:x/replay': ['developer.keys', 'online_required'],
  'POST /developer/webhooks/:x/rotate-secret': ['developer.keys', 'online_required'],
  'POST /developer/webhooks/:x/test': ['developer.keys', 'online_required'],
  'POST /employees': ['employee.upsert', 'available'],
  'POST /finance/assets': ['asset.fixed', 'online_required'],
  'POST /finance/assets/:x/dispose': ['asset.fixed', 'online_required'],
  'POST /finance/assets/depreciation/run': ['asset.fixed', 'online_required'],
  'POST /finance/bank/lines/:x/unmatch': ['bank.import', 'online_required'],
  'POST /finance/bank/reconcile': ['bank.import', 'online_required'],
  'POST /finance/bank/statements': ['bank.import', 'online_required'],
  'POST /financing/facilities': ['accounting.financing', 'online_required'],
  'POST /financing/holdings': ['accounting.financing', 'online_required'],
  'POST /ingest/confirm': ['ocr.receipt', 'online_required'],
  'POST /ingest/read': ['ocr.receipt', 'online_required'],
  'POST /interactions': ['customer.crm', 'online_required'],
  'POST /inventory/reorder-suggestions/draft-po': ['purchase.orders', 'available'],
  'POST /inventory/unvalued/value': ['accounting.unvalued_stock', 'available'],
  'POST /invoices': ['invoice.create', 'available'],
  'POST /invoices/:x/cost': ['accounting.unvalued_stock', 'available'],
  'POST /invoices/:x/late-fees': ['invoice.late_fee', 'available'],
  'POST /invoices/:x/post-to-ledger': ['accounting.post_to_ledger', 'online_required'],
  'POST /invoices/:x/returns': ['invoice.returns', 'online_required'],
  'POST /invoices/post-unposted': ['accounting.post_to_ledger', 'online_required'],
  'POST /leaves': ['hr.leaves', 'available'],
  'POST /manufacturing/produce': ['manufacturing.produce', 'online_required'],
  'POST /market/listings': ['marketplace.apps', 'online_required'],
  'POST /marketplace/apps/:x/report': ['marketplace.apps', 'online_required'],
  'POST /metal-rates': ['trade.metal_rates', 'available'],
  'POST /migrations': ['data.migration', 'online_required'],
  'POST /migrations/:x/cancel': ['data.migration', 'online_required'],
  'POST /migrations/:x/commit': ['data.migration', 'online_required'],
  'POST /migrations/:x/dry-run': ['data.migration', 'online_required'],
  'POST /migrations/inspect': ['data.migration', 'available'],
  'POST /notes': ['notes.entity', 'online_required'],
  'POST /oauth/authorize': ['developer.keys', 'online_required'],
  'POST /operations/batches': ['expiry.batches', 'online_required'],
  'POST /operations/budgets/:x/approve': ['budget.manage', 'available'],
  'POST /operations/budgets/:x/archive': ['budget.manage', 'available'],
  'POST /operations/budgets/:x/revise': ['budget.manage', 'available'],
  'POST /operations/budgets/:x/submit': ['budget.manage', 'available'],
  'POST /operations/budgets/check': ['budget.manage', 'available'],
  'POST /operations/serials': ['expiry.batches', 'online_required'],
  'POST /operations/timesheets': ['timesheet.manage', 'online_required'],
  'POST /opportunities': ['customer.crm', 'online_required'],
  'POST /orders/:x/deposits': ['order.deposits', 'available'],
  'POST /payments': ['payment.record', 'available'],
  'POST /payments/:x/cancel': ['payment.cancel', 'available'],
  'POST /payrolls': ['hr.payroll', 'available'],
  'POST /permissions/profiles/assign': ['governance.permission_matrix', 'online_required'],
  'POST /permissions/roles': ['governance.permission_matrix', 'online_required'],
  'POST /pos/opening-capital': ['till.opening_capital', 'available'],
  'POST /pos/orders/:x/void': ['till.order', 'available'],
  'POST /pos/sessions': ['till.open_close', 'available'],
  'POST /pos/sessions/:x/bank-transfer': ['till.cash_movement', 'available'],
  'POST /pos/sessions/:x/cash': ['till.cash_movement', 'available'],
  'POST /pos/sessions/:x/close': ['till.open_close', 'available'],
  'POST /pos/sessions/:x/orders': ['till.order', 'available'],
  'POST /pos/sessions/:x/resume': ['till.suspend', 'available'],
  'POST /pos/sessions/:x/suspend': ['till.suspend', 'available'],
  'POST /price-lists': ['pricing.price_lists', 'available'],
  'POST /products': ['product.upsert', 'available'],
  'POST /products/:x/barcodes': ['product.barcode', 'online_required'],
  'POST /products/:x/fitments': ['product.fitments', 'available'],
  'POST /products/:x/images': ['product.images', 'online_required'],
  'POST /products/:x/variants': ['product.variants', 'available'],
  'POST /projects': ['project.manage', 'online_required'],
  'POST /projects/:x/tasks': ['project.manage', 'online_required'],
  'POST /promotions': ['pricing.promotions', 'available'],
  'POST /public/feedback/:x/answer': ['blog.public', 'not_supported'],
  'POST /public/feedback/:x/unsubscribe': ['blog.public', 'not_supported'],
  'POST /purchase-orders': ['purchase.orders', 'available'],
  'POST /purchase-orders/:x/receive': ['purchase.orders', 'available'],
  'POST /report-dashboards': ['custom.reports', 'online_required'],
  'POST /roles': ['governance.permission_matrix', 'online_required'],
  'POST /rules': ['automation.rules', 'online_required'],
  'POST /saved-views': ['saved.views', 'online_required'],
  'POST /shift-assignments': ['hr.shifts', 'available'],
  'POST /shift-assignments/:x/cancel': ['hr.shifts', 'available'],
  'POST /shifts': ['hr.shifts', 'available'],
  'POST /stock-transfers': ['stock.transfer', 'available'],
  'POST /storage-locations/:x/place': ['stock.placement', 'available'],
  'POST /transactions': ['accounting.legacy_transactions', 'online_required'],
  'POST /transport/trips': ['trade.freight', 'online_required'],
  'POST /units': ['unit.conversion', 'online_required'],
  'POST /v1/workflows': ['approvals.workflows', 'online_required'],
  'POST /v1/workflows/instances': ['approvals.workflows', 'online_required'],
  'POST /v1/workflows/instances/:x/action': ['approvals.workflows', 'online_required'],
  'POST /vehicles': ['trade.vehicles', 'available'],
  'POST /wallet/pay-upgrade': ['billing.portal', 'online_required'],
  'POST /wallet/topups': ['billing.portal', 'online_required'],
  'POST /wallet/topups/:x/cancel': ['billing.portal', 'online_required'],
  'POST /warehouses': ['warehouse.upsert', 'available'],
  'POST /warehouses/:x/assign': ['stock.assign_unassigned', 'online_required'],
  'POST /warehouses/:x/locations': ['stock.storage_locations', 'available'],
  'POST /warranties': ['trade.warranties', 'available'],
  'POST /work-orders': ['manufacturing.work_orders', 'online_required'],
  'POST /workspaces': ['settings.workspace_profile', 'available'],
  'POST /workspaces/:x/invites': ['team.members', 'online_required'],
  'POST /workspaces/:x/leave': ['team.members', 'online_required'],
  'POST /workspaces/:x/members/direct': ['team.members', 'online_required'],
  'PUT /ai/config': ['ai.assistant', 'online_required'],
  'PUT /ai/pipeline/settings': ['ai.assistant', 'online_required'],
  'PUT /ai/quota/:x': ['ai.assistant', 'online_required'],
  'PUT /attendance-devices/:x/identities': ['hr.attendance_devices', 'online_required'],
  'PUT /attendance-sheet': ['hr.attendance', 'available'],
  'PUT /blog/posts/:x/rating': ['blog.public', 'not_supported'],
  'PUT /blog/posts/:x/reaction': ['blog.public', 'not_supported'],
  'PUT /custom-fields/:x/:x/values': ['custom.fields', 'online_required'],
  'PUT /developer/publisher': ['developer.keys', 'online_required'],
  'PUT /finance/currency/base': ['settings.currencies', 'available'],
  'PUT /finance/currency/rates': ['settings.currencies', 'available'],
  'PUT /finance/currency/units': ['settings.custom_units', 'online_required'],
  'PUT /governance/member-blocks/:x': ['governance.permission_matrix', 'online_required'],
  'PUT /governance/sod': ['governance.permission_matrix', 'online_required'],
  'PUT /inventory/settings': ['inventory.costing_method', 'available'],
  'PUT /invoices/:x/installments': ['invoice.installment', 'available'],
  'PUT /late-fees/policy': ['invoice.late_fee', 'available'],
  'PUT /manufacturing/definitions': ['manufacturing.definition', 'online_required'],
  'PUT /market/listings/:x': ['marketplace.apps', 'online_required'],
  'PUT /market/seller': ['marketplace.apps', 'online_required'],
  'PUT /marketplace/apps/:x/review': ['marketplace.apps', 'online_required'],
  'PUT /migrations/:x/mapping': ['data.migration', 'online_required'],
  'PUT /operations/budgets/:x': ['budget.manage', 'available'],
  'PUT /operations/timesheets/config': ['timesheet.manage', 'online_required'],
  'PUT /permissions/matrix/cell': ['governance.permission_matrix', 'online_required'],
  'PUT /price-lists/:x/items': ['pricing.price_lists', 'available'],
  'PUT /price-lists/customers/:x': ['pricing.price_lists', 'available'],
  'PUT /products/:x/images/order': ['product.images', 'online_required'],
  'PUT /products/:x/units': ['unit.conversion', 'online_required'],
  'PUT /storage-locations/:x/auto-shelf': ['stock.auto_shelf', 'online_required'],
  'PUT /storefront/settings': ['storefront.public', 'online_required'],
  'PUT /v1/workflows/:x/escalation': ['approvals.workflows', 'online_required'],
  'PUT /workplace/branches/:x/time-zone': ['settings.time_zone', 'online_required'],
  'PUT /workplace/time-zone': ['settings.time_zone', 'online_required'],
}

/**
 * Why a `not_supported` feature is not an offline capability. A feature without
 * a reason here may not be `not_supported`.
 */
export const NOT_SUPPORTED_REASONS: Readonly<Partial<Record<FeatureKey, string>>> = {
  'auth.cloud_session':
    'The offline edition signs in with its licence, never with a cloud account.',
  'blog.public': 'A page of the public website; the installed app has no such screen.',
}

const ID_SEGMENT = new RegExp(
  '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9]+)$',
  'i',
)

/** METHOD + path, ids replaced by `:x`, query and trailing slash dropped. */
export function normalizeEndpoint(method: string, path: string): string {
  const clean = (path.split('?')[0] ?? '').replace(new RegExp('/+$'), '')
  const segments = clean
    .split('/')
    .map((segment) => (ID_SEGMENT.test(segment) ? ':x' : segment))
    .join('/')
  return `${method.toUpperCase()} ${segments.length === 0 ? '/' : segments}`
}

interface Compiled {
  key: string
  verb: string
  segments: readonly string[]
  literals: number
  row: EndpointRow
}

let compiled: readonly Compiled[] | null = null

function compile(): readonly Compiled[] {
  if (compiled) return compiled
  compiled = Object.entries(OFFLINE_ENDPOINT_MATRIX).map(([key, row]) => {
    const space = key.indexOf(' ')
    const segments = key.slice(space + 1).split('/')
    return {
      key,
      verb: key.slice(0, space),
      segments,
      literals: segments.filter((segment) => segment !== ':x').length,
      row,
    }
  })
  return compiled
}

export interface EndpointVerdict {
  key: string
  feature: FeatureKey
  status: OfflineAvailability
}

/**
 * The verdict for a concrete request, or `null` for a path the matrix does not
 * know. A literal segment beats `:x` (so `/products/categories` is not
 * `/products/:x`).
 */
export function endpointAvailability(method: string, path: string): EndpointVerdict | null {
  const segments = normalizeEndpoint(method, path).split(' ')[1]!.split('/')
  const verb = method.toUpperCase()
  let best: Compiled | null = null
  for (const candidate of compile()) {
    if (candidate.verb !== verb || candidate.segments.length !== segments.length) continue
    const matches = candidate.segments.every(
      (part, index) => part === ':x' || part === segments[index],
    )
    if (matches && (!best || candidate.literals > best.literals)) best = candidate
  }
  return best ? { key: best.key, feature: best.row[0], status: best.row[1] } : null
}

/** Every matrix key of one feature. */
export function endpointsOfFeature(feature: FeatureKey): string[] {
  return Object.entries(OFFLINE_ENDPOINT_MATRIX)
    .filter(([, row]) => row[0] === feature)
    .map(([key]) => key)
}

/**
 * Whether the device can run a whole feature: every endpoint of it is
 * `available`. A feature none of whose endpoints the client calls (a purely
 * local one, e.g. the sync queue) follows its registry row.
 */
export function featureOfflineAvailability(feature: FeatureKey): OfflineAvailability {
  const rows = Object.values(OFFLINE_ENDPOINT_MATRIX).filter((row) => row[0] === feature)
  if (rows.length === 0) {
    return featureDefinition(feature).execution === 'server' ? 'online_required' : 'available'
  }
  if (rows.every((row) => row[1] === 'available')) return 'available'
  if (rows.every((row) => row[1] === 'not_supported')) return 'not_supported'
  return 'online_required'
}

/** Every feature the matrix names, for the guards. */
export const MATRIX_FEATURES: readonly FeatureKey[] = [
  ...new Set(Object.values(OFFLINE_ENDPOINT_MATRIX).map((row) => row[0])),
]
