// ============================================
// packages/validation/src/schemas/feature-packs.ts
//
// V62 Slice 1 — Single pack registry ("Core + Feature Packs, one build").
//
// Derived from `ENGINES` (business-capabilities.ts), `NAV_CONTRACT`, and
// `syncEntitySchema`. Every app-shell route, nav item, sync entity, and engine
// belongs to `core` or exactly one feature pack. All SQLite tables stay in
// `core` (ADR-0002).
// ============================================

import { CAPABILITIES, ENGINES, ENGINE_KEYS, type EngineKey } from './business-capabilities'
import type { CompositionPlan } from './business-problems'
import type { DashboardPartId } from './industry-profiles'
import type { SyncEntity } from './sync-protocol.schema'

export const PACK_IDS = [
  'core',
  'operations',
  'manufacturing',
  'workforce',
  'approvals',
  'intelligence',
  'marketplace',
] as const

export type PackId = (typeof PACK_IDS)[number]

export interface FeaturePackDefinition {
  readonly id: PackId
  readonly labelKey: string
  readonly descriptionKey: string
  /** App-shell route paths owned by this pack. */
  readonly routes: readonly string[]
  /** Navigation contract item ids owned by this pack. */
  readonly navItems: readonly string[]
  /** i18n namespaces primarily used by this pack (core loads shell common). */
  readonly i18nNamespaces: readonly string[]
  /** Sync entities (from syncEntitySchema) synced when this pack is installed. */
  readonly syncEntities: readonly SyncEntity[]
  /** Other packs that must be installed before this pack. */
  readonly dependsOn: readonly PackId[]
  /** Target gzipped JS budget in KB (updated from report.mjs measurements). */
  readonly budgetKb: number
  /** Whether this pack holds the local SQLite schema migrations. */
  readonly holdsLocalSchema: boolean
}

export const FEATURE_PACKS: Readonly<Record<PackId, FeaturePackDefinition>> = {
  core: {
    id: 'core',
    labelKey: 'packs.core.label',
    descriptionKey: 'packs.core.description',
    routes: [
      '/',
      '/dashboard',
      '/login',
      '/invoices',
      '/invoices/new',
      '/invoices/new/preview',
      '/invoices/:id',
      '/warehouse',
      '/warehouse/:id',
      '/customers',
      '/customers/:id',
      '/accounting',
      '/activities',
      '/sync-center',
      '/settings',
      '/developers',
      '/billing',
      '/onboarding',
      '/audit',
      '/till',
      '/data-and-sync',
      '/governance',
      '/public-task/:token',
      '/public-invoice/:token',
      '/portal/:token',
      '/my-attendance/:token',
    ],
    navItems: [
      'today',
      'get-paid',
      'stock',
      'money',
      'buyers',
      'settings',
      'events',
      'till',
      'data-and-sync',
      'billing',
      'governance',
    ],
    i18nNamespaces: [
      'common',
      'nav',
      'dashboard',
      'invoices',
      'warehouse',
      'customers',
      'accounting',
      'settings',
      'sync',
      'onboarding',
      'auth',
      'packs',
    ],
    syncEntities: [
      'invoice',
      'customer',
      'product',
      'transaction',
      'warehouse',
      'branch',
      'exchange_rate',
      'product_stock',
      // V70.2: a variant is a product row's detail — it belongs to the pack
      // that owns the product catalogue, not to a second one.
      'product_variants',
      // Sync entity coverage: cost layers, expiry batches, unit serials, the
      // costing settings and the chart of accounts are all read by the core
      // invoice route. They are pull-only; no pack may write them through sync.
      'cost_layer',
      'stock_batches',
      'stock_serials',
      'inventory_settings',
      'account',
    ],
    dependsOn: [],
    budgetKb: 650,
    holdsLocalSchema: true,
  },
  operations: {
    id: 'operations',
    labelKey: 'packs.operations.label',
    descriptionKey: 'packs.operations.description',
    routes: ['/operations', '/stock-count'],
    navItems: [],
    i18nNamespaces: ['operations', 'inventoryOps', 'stockCount', 'orders', 'purchasing'],
    syncEntities: ['order_deposits', 'order_deposit_applications', 'order_deposit_refunds'],
    dependsOn: ['core'],
    budgetKb: 180,
    holdsLocalSchema: false,
  },
  manufacturing: {
    id: 'manufacturing',
    labelKey: 'packs.manufacturing.label',
    descriptionKey: 'packs.manufacturing.description',
    routes: ['/manufacturing'],
    navItems: ['production'],
    i18nNamespaces: ['manufacturing'],
    syncEntities: [],
    dependsOn: ['core'],
    budgetKb: 140,
    holdsLocalSchema: false,
  },
  workforce: {
    id: 'workforce',
    labelKey: 'packs.workforce.label',
    descriptionKey: 'packs.workforce.description',
    routes: ['/team-and-payroll', '/team-and-payroll/:id'],
    navItems: ['coworkers'],
    i18nNamespaces: [
      'teamAndPayroll',
      'humanResources',
      'payroll',
      'timesheets',
      'serviceDelivery',
    ],
    syncEntities: [
      'time_entry',
      // V70.2 — the Workforce pack owns the three operational tables its
      // screens read: a delivered session, the package credit it consumed and
      // the repair ticket a technician is working on. Pulling them with the
      // pack means a device shows the other practitioner's session and the
      // credit that was spent, instead of offering it a second time.
      'service_delivery_sessions',
      'package_credit_ledger',
      'repair_tickets',
    ],
    dependsOn: ['core'],
    budgetKb: 160,
    holdsLocalSchema: false,
  },
  approvals: {
    id: 'approvals',
    labelKey: 'packs.approvals.label',
    descriptionKey: 'packs.approvals.description',
    routes: ['/approvals'],
    navItems: ['approvals'],
    i18nNamespaces: ['approvals', 'workflow'],
    syncEntities: [],
    dependsOn: ['core'],
    budgetKb: 90,
    holdsLocalSchema: false,
  },
  intelligence: {
    id: 'intelligence',
    labelKey: 'packs.intelligence.label',
    descriptionKey: 'packs.intelligence.description',
    routes: ['/analysis', '/assistant'],
    navItems: ['analysis', 'assistant'],
    i18nNamespaces: ['analysis', 'assistant', 'forecast'],
    syncEntities: [],
    dependsOn: ['core'],
    budgetKb: 220,
    holdsLocalSchema: false,
  },
  marketplace: {
    id: 'marketplace',
    labelKey: 'packs.marketplace.label',
    descriptionKey: 'packs.marketplace.description',
    routes: ['/marketplace', '/market-seller'],
    navItems: ['market-seller'],
    i18nNamespaces: ['marketplace', 'marketSeller'],
    syncEntities: [],
    dependsOn: ['core'],
    budgetKb: 110,
    holdsLocalSchema: false,
  },
}

/** Engines belonging to a given pack, derived directly from ENGINES. */
export function enginesForPack(packId: PackId): readonly EngineKey[] {
  return ENGINE_KEYS.filter((key) => ENGINES[key].pack === packId)
}

/** Resolve transitive pack dependencies including `core`. */
export function resolvePackDependencies(packs: readonly PackId[]): readonly PackId[] {
  const result = new Set<PackId>(['core'])
  const visit = (id: PackId) => {
    if (result.has(id)) return
    for (const dep of FEATURE_PACKS[id].dependsOn) {
      visit(dep)
    }
    result.add(id)
  }
  for (const p of packs) visit(p)
  return PACK_IDS.filter((id) => result.has(id))
}

/**
 * Pure mapping from V60's `CompositionPlan` (`composeBusinessSolution`) to
 * the suggested feature packs for onboarding and workspace settings.
 */
export function packsForPlan(plan: CompositionPlan): readonly PackId[] {
  const chosen = new Set<PackId>(['core'])
  for (const cap of plan.plan.capabilities.capabilities) {
    const engineKey = CAPABILITIES[cap].engine
    if (!engineKey) continue
    chosen.add(ENGINES[engineKey].pack)
  }
  return resolvePackDependencies([...chosen])
}

/** Sync entity types required for the given installed pack set. */
export function syncEntitiesForPacks(packs: readonly PackId[]): readonly SyncEntity[] {
  const resolved = resolvePackDependencies(packs)
  const entities = new Set<SyncEntity>()
  for (const packId of resolved) {
    for (const entity of FEATURE_PACKS[packId].syncEntities) {
      entities.add(entity)
    }
  }
  return [...entities]
}

/** Match an app-shell route pathname to its owning pack (defaults to `core`). */
export function packForRoute(pathname: string): PackId {
  const clean = pathname.split('?')[0]?.split('#')[0] ?? '/'
  const normalized = clean.startsWith('/') ? clean : `/${clean}`
  for (const packId of PACK_IDS) {
    if (packId === 'core') continue
    for (const route of FEATURE_PACKS[packId].routes) {
      const prefix = route.replace(/\/:[^/]+/g, '')
      if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
        return packId
      }
    }
  }
  return 'core'
}

// ─── Industry dashboard parts → the engine (and therefore the pack) behind them ───

/**
 * The engine each SPECIALISED dashboard part is a view of.
 *
 * A part is not a domain of its own: `todaySessions` is the appointments engine
 * read for today, `openRepairTickets` is the repair work-order engine filtered
 * to what is still in the workshop. So the pack a part belongs to follows from
 * the engine — it is never decided by a second list.
 *
 * The six shell parts (`kpis`, `workQueue`, `chart`, `insights`, `activities`,
 * `manufacturing`) are not here: they are the dashboard itself, and they mount
 * for every trade.
 */
export const DASHBOARD_PART_ENGINE = {
  lowStockVariants: 'inventory_catalog',
  todaySessions: 'appointments_resources',
  packageCreditsLow: 'package_credits',
  openRepairTickets: 'work_orders_repair',
} as const satisfies Partial<Record<DashboardPartId, EngineKey>>

/** A dashboard part that is a view of a real engine. */
export type EngineDashboardPart = keyof typeof DASHBOARD_PART_ENGINE

/** The pack that owns a specialised dashboard part. */
export function packForDashboardPart(part: EngineDashboardPart): PackId {
  return ENGINES[DASHBOARD_PART_ENGINE[part]].pack
}
