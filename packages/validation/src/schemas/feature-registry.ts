// ============================================
// packages/validation/src/schemas/feature-registry.ts
//
// The feature registry — ONE row per feature of the product.
//
// ⚠️ WHY A REGISTRY
//
// A feature is built once; WHO may use it and WHERE it runs are data. A
// feature that only the cloud may use must not need a change in the offline
// architecture, the local engine, or a `plan ===` branch in the UI — it needs
// one row here, one guard on its route, and one hook at its button.
//
// The rows come from the capability matrix (docs/offline/01-CAPABILITY-MATRIX.md,
// audited 19 Oct 2026) as the entitlement contract recorded them
// (docs/offline/entitlement/00-CONTRACT.md §14.2). The matrix's classes are
// the origin: `L`/`L*` → the local engine can run it, `C` → the cloud runs
// it.
//
// ⚠️ THREE AXES, NEVER MERGED
//
//   role permission → `requireCapability` (authorization.domain) — untouched
//   plan entitlement → THIS file
//   execution mode  → the `execution` column of THIS file
//
// The word «capability» already means ROLE permission in this repository, so
// the plan axis is called feature/entitlement everywhere.
//
// ⚠️ THE PLANS ARE LISTED CHEAPEST-FIRST
//
// `FREE` (0) < `OFFLINE` (12,000,000/yr) < `ONLINE_500` (30,000,000) <
// `ONLINE_1000` (40,000,000) < `ONLINE_1500` (45,000,000) — the prices are
// the owner's (20 Oct 2026), stored in IRR and shown in تومان. The first
// plan in the list that unlocks a feature is therefore the cheapest one, and
// the resolver names it.
// ============================================

/** The owner's five plans. */
export type FeaturePlan = 'FREE' | 'OFFLINE' | 'ONLINE_500' | 'ONLINE_1000' | 'ONLINE_1500'

/** Where a feature can run. */
export type FeatureExecution = 'local' | 'server' | 'hybrid'

/** The edition a plan belongs to: the cloud plans, or the local one. */
export type PlanEdition = 'cloud' | 'local'

/** Every plan, cheapest first. */
export const ALL_PLANS: readonly FeaturePlan[] = [
  'FREE',
  'OFFLINE',
  'ONLINE_500',
  'ONLINE_1000',
  'ONLINE_1500',
]

/** The cloud plans, cheapest first. */
export const ONLINE_PLANS: readonly FeaturePlan[] = ['ONLINE_500', 'ONLINE_1000', 'ONLINE_1500']

/** Which edition a plan belongs to. */
export function planEdition(plan: FeaturePlan): PlanEdition {
  return plan === 'OFFLINE' ? 'local' : 'cloud'
}

export interface FeatureDefinition {
  /**
   * Where the feature runs.
   *
   * - `local` — the local engine runs it (on the device or, for the cloud
   *   plans, the server's own rules).
   * - `server` — it needs the cloud; offline the device refuses it with
   *   `REQUIRES_ONLINE`.
   * - `hybrid` — a local part and a server part, both named below.
   */
  execution: FeatureExecution
  /** The plans that include the feature, cheapest first. */
  plans: readonly FeaturePlan[]
  /** For a hybrid feature: what the local part can do on its own. */
  local?: string
  /** For a hybrid feature: what still needs the server. */
  server?: string
  /**
   * True for the features that must keep working in every state — reading,
   * printing, backup and export. Principle 6: a plan that ends never takes
   * the person's own records with it.
   */
  alwaysAllowed?: boolean
}

const ALL: readonly FeaturePlan[] = ALL_PLANS
const CLOUD: readonly FeaturePlan[] = ['FREE', 'ONLINE_500', 'ONLINE_1000', 'ONLINE_1500']

/**
 * The registry.
 *
 * The rows are the product's features as the capability matrix recorded them.
 * A new feature is ONE row here — not a branch in the UI, not a change in
 * the engine, not a second list of names somewhere else.
 */
export const FEATURE_REGISTRY = {
  // ─── Dashboard ──────────────────────────────────────────────────────────
  'dashboard.kpi': { execution: 'local', plans: ALL },
  'dashboard.sales_chart': { execution: 'local', plans: ALL },
  'dashboard.activity': { execution: 'local', plans: ALL },
  'dashboard.work_queue': {
    execution: 'hybrid',
    plans: ALL,
    local: 'the queue of the local device',
    server: 'the approvals another person must act on',
  },
  'dashboard.ai_insight': { execution: 'local', plans: ALL },
  'dashboard.manufacturing_card': { execution: 'server', plans: CLOUD },
  'dashboard.currency_rates': { execution: 'local', plans: ALL },

  // ─── Invoices ───────────────────────────────────────────────────────────
  'invoice.list': { execution: 'local', plans: ALL },
  'invoice.detail': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'invoice.related': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'invoice.create': { execution: 'local', plans: ALL },
  'invoice.edit': { execution: 'local', plans: ALL },
  'invoice.delete': { execution: 'local', plans: ALL },
  'invoice.number': { execution: 'local', plans: ALL },
  'invoice.print': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'payment.record': { execution: 'local', plans: ALL },
  'payment.cancel': { execution: 'local', plans: ALL },
  'invoice.installment': { execution: 'local', plans: ALL },
  'invoice.late_fee': { execution: 'local', plans: ALL },
  'accounting.post_to_ledger': { execution: 'local', plans: ALL },
  'invoice.recurring': { execution: 'server', plans: CLOUD },
  'invoice.approval': { execution: 'server', plans: CLOUD },

  // ─── Inventory ──────────────────────────────────────────────────────────
  'product.list': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'product.detail': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'product.upsert': { execution: 'local', plans: ALL },
  'product.opening_stock': { execution: 'local', plans: ALL },
  'product.barcode': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'product.barcode_lookup': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'product.images': {
    execution: 'hybrid',
    plans: ALL,
    local: 'the file on the device',
    server: 'the copy in the object storage',
  },
  'unit.manage': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'warehouse.overview': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'warehouse.detail': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'warehouse.upsert': { execution: 'local', plans: ALL },
  // Delete asks the server whether the warehouse still holds stock.
  'warehouse.delete': { execution: 'server', plans: CLOUD },
  'stock.transfer': { execution: 'local', plans: ALL },
  'stock.assign_unassigned': { execution: 'local', plans: ALL },
  'stock.placement': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'stock.storage_locations': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'stock.history': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'stock.batches': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'inventory.costing_method': {
    execution: 'hybrid',
    plans: ALL,
    local: 'reading the method the device uses',
    server: 'changing it (refused once the books have documents)',
  },
  'product.notes': { execution: 'local', plans: ALL, alwaysAllowed: true },
  // ⚠️ «Manufacture from product» (§4.3) and «Produce» (§4.7) are the SAME
  // capability — the matrix lists it under both areas. One row, or a feature
  // with two verdicts.

  // ─── Customers ──────────────────────────────────────────────────────────
  'customer.list': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'customer.detail': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'customer.upsert': { execution: 'local', plans: ALL },
  // Delete asks the server whether the customer has invoices or payments.
  'customer.delete': { execution: 'server', plans: CLOUD },
  'customer.accounting': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'customer.risk': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'customer.crm': { execution: 'local', plans: ALL, alwaysAllowed: true },
  // «پیگیری و کمپین» (the outreach tab of /customers): follow-up tasks, campaigns and
  // stale opportunities. The device has no engine for them, so the offline edition
  // does not OFFER the tab — it is not shown as a page that answers «not available».
  'customer.outreach': { execution: 'server', plans: CLOUD },
  'customer.terms': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'customer.documents': { execution: 'server', plans: CLOUD },
  'customer.portal_link': { execution: 'server', plans: CLOUD },

  // ─── Accounting ─────────────────────────────────────────────────────────
  'accounting.chart': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'accounting.journal': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'accounting.trial_balance': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'accounting.reports': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'accounting.profit_report': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'accounting.general_ledger': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'accounting.evidence': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'accounting.unvalued_stock': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'accounting.financing': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'accounting.period_close': { execution: 'local', plans: ALL },
  'accounting.period_lock': { execution: 'server', plans: CLOUD },

  // ─── Till (POS) ─────────────────────────────────────────────────────────
  'till.session': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'till.open_close': { execution: 'local', plans: ALL },
  'till.cash_movement': { execution: 'local', plans: ALL },
  'till.order': { execution: 'local', plans: ALL },
  'till.opening_capital': { execution: 'local', plans: ALL },
  'till.ledger': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'till.labels': { execution: 'local', plans: ALL },
  'till.suspend': { execution: 'local', plans: ALL },
  'till.shift_history': { execution: 'local', plans: ALL, alwaysAllowed: true },

  // ─── Manufacturing (C in v1 — the owner's 19 Oct 2026 amendment) ─────────
  'manufacturing.bom': { execution: 'server', plans: CLOUD },
  'manufacturing.definition': { execution: 'server', plans: CLOUD },
  'manufacturing.produce': { execution: 'server', plans: CLOUD },
  'manufacturing.runs': { execution: 'server', plans: CLOUD },
  'manufacturing.work_orders': { execution: 'server', plans: CLOUD },
  'manufacturing.report': { execution: 'server', plans: CLOUD },

  // ─── Stock count ────────────────────────────────────────────────────────
  'stockcount.list': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'stockcount.create': { execution: 'local', plans: ALL },
  'stockcount.record_line': { execution: 'local', plans: ALL },
  'stockcount.complete': { execution: 'local', plans: ALL },
  'stockcount.cancel': { execution: 'local', plans: ALL },

  // ─── Team and payroll ───────────────────────────────────────────────────
  'employee.list': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'employee.upsert': { execution: 'local', plans: ALL },
  'hr.attendance': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'hr.shifts': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'hr.leaves': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'hr.payroll': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'governance.permission_matrix': { execution: 'server', plans: CLOUD },
  'hr.attendance_devices': { execution: 'server', plans: CLOUD },
  'hr.attendance_links': { execution: 'server', plans: CLOUD },
  'team.members': { execution: 'server', plans: CLOUD },

  // ─── Settings, onboarding, sync, data ───────────────────────────────────
  'settings.books_currency': { execution: 'local', plans: ALL },
  'settings.time_zone': { execution: 'local', plans: ALL },
  'settings.workspace_profile': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'settings.business_stamp': { execution: 'local', plans: ALL },
  'settings.hardware': { execution: 'local', plans: ALL },
  'settings.currencies': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'data.backup': {
    execution: 'hybrid',
    plans: ALL,
    local: 'the backup the device writes',
    server: 'the cloud snapshot',
    alwaysAllowed: true,
  },
  'sync.queue': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'sync.push_pull': { execution: 'server', plans: CLOUD },
  'sync.overview': { execution: 'server', plans: CLOUD },
  'sync.conflicts': { execution: 'server', plans: CLOUD },
  'data.migration': {
    execution: 'hybrid',
    plans: ALL,
    local: 'the import the device performs',
    server: 'the import the server performs',
  },
  'activity.feed': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'audit.trail': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'approvals.workflows': { execution: 'server', plans: CLOUD },
  'analysis.reports': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'analysis.benchmark': { execution: 'server', plans: CLOUD },

  // ─── The pages that are C by nature ─────────────────────────────────────
  'ai.assistant': { execution: 'server', plans: CLOUD },
  'ai.cashflow_forecast': { execution: 'server', plans: CLOUD },
  'ocr.receipt': { execution: 'server', plans: CLOUD },
  'bank.import': { execution: 'server', plans: CLOUD },
  'developer.keys': { execution: 'server', plans: CLOUD },
  'marketplace.apps': { execution: 'server', plans: CLOUD },
  'storefront.public': { execution: 'server', plans: CLOUD },
  'billing.portal': { execution: 'server', plans: CLOUD },

  // ─── Added by the endpoint matrix (offline-endpoint-matrix.ts) ──────────
  // Every endpoint the client calls belongs to a feature. These are the
  // features that had no row; the cloud-only ones are listed for what they are.
  'branch.manage': { execution: 'local', plans: ALL },
  'auth.cloud_session': { execution: 'server', plans: CLOUD },
  'blog.public': { execution: 'server', plans: CLOUD },
  'automation.rules': { execution: 'server', plans: CLOUD },
  'asset.fixed': { execution: 'server', plans: CLOUD },
  'budget.manage': { execution: 'local', plans: ALL },
  'custom.fields': { execution: 'server', plans: CLOUD },
  'custom.reports': { execution: 'server', plans: CLOUD },
  'expiry.batches': { execution: 'server', plans: CLOUD },
  'notes.entity': { execution: 'server', plans: CLOUD },
  'pricing.price_lists': { execution: 'local', plans: ALL },
  'pricing.promotions': { execution: 'local', plans: ALL },
  'project.manage': { execution: 'server', plans: CLOUD },
  'purchase.orders': { execution: 'local', plans: ALL },
  'referral.program': { execution: 'server', plans: CLOUD },
  'saved.views': { execution: 'server', plans: CLOUD },
  'timesheet.manage': { execution: 'server', plans: CLOUD },
  'activity.entity_timeline': { execution: 'server', plans: CLOUD },
  'settings.currency_catalogue': { execution: 'server', plans: CLOUD },
  'settings.custom_units': { execution: 'server', plans: CLOUD },
  'stock.auto_shelf': { execution: 'server', plans: CLOUD },
  'unit.conversion': { execution: 'server', plans: CLOUD },
  'accounting.tax_return': { execution: 'server', plans: CLOUD },
  'accounting.legacy_transactions': { execution: 'server', plans: CLOUD },
  'inventory.insights': { execution: 'local', plans: ALL, alwaysAllowed: true },
  'product.variants': { execution: 'local', plans: ALL },
  'trade.metal_rates': { execution: 'local', plans: ALL },
  'product.fitments': { execution: 'local', plans: ALL },
  'trade.vehicles': { execution: 'local', plans: ALL },
  'trade.warranties': { execution: 'local', plans: ALL },
  'invoice.returns': { execution: 'local', plans: ALL },
  'order.deposits': { execution: 'local', plans: ALL },
  'trade.appointments': { execution: 'server', plans: CLOUD },
  'trade.agriculture': { execution: 'server', plans: CLOUD },
  'trade.freight': { execution: 'server', plans: CLOUD },
  'trade.courier': { execution: 'server', plans: CLOUD },
  'trade.delivery_notes': { execution: 'server', plans: CLOUD },
} as const satisfies Record<string, FeatureDefinition>

/** The key of a feature in the registry. */
export type FeatureKey = keyof typeof FEATURE_REGISTRY

/** Every feature key, in the registry's order. */
export const FEATURE_KEYS = Object.keys(FEATURE_REGISTRY) as FeatureKey[]

/**
 * Is this string a feature key?
 *
 * The guard that keeps a typo from silently unlocking everything.
 */
export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FEATURE_REGISTRY, value)
}

/** The row of a feature. */
export function featureDefinition(feature: FeatureKey): FeatureDefinition {
  return FEATURE_REGISTRY[feature]
}

/**
 * The cheapest plan that includes the feature, or null when no plan does.
 *
 * The rows are listed cheapest-first, so this is the first match.
 */
export function cheapestPlanFor(feature: FeatureKey): FeaturePlan | null {
  return FEATURE_REGISTRY[feature].plans[0] ?? null
}

/**
 * The cheapest plan of the given edition that includes the feature.
 *
 * A feature that belongs to the other edition only (an offline-only feature
 * while the workspace is in the cloud) is `null` here — and that is what
 * separates `REQUIRES_UPGRADE` from `NOT_ENTITLED`.
 */
export function cheapestPlanForEdition(
  feature: FeatureKey,
  edition: PlanEdition,
): FeaturePlan | null {
  return FEATURE_REGISTRY[feature].plans.find((plan) => planEdition(plan) === edition) ?? null
}
