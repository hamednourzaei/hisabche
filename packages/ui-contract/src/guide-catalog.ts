// ============================================
// packages/ui-contract/src/guide-catalog.ts
// Interactive Guide Content & Route Catalog
//
// The guide is ONE card mounted by the layout; the page decides where it
// belongs. A section that carries `data-guide="<sectionId>"` is the place the
// card stands beside — above it when there is room, below it otherwise. A
// route that marks nothing falls back to `<routeId>-page`, and then to the
// page's own `<main>`.
//
// Every id here is a real element on that screen: a card pointing at a section
// that is not rendered is worse than no card at all.
//
// Rewritten 10 Nov 2026 (owner: «guide ها کلی آیتم کم داره»): every page in
// the tour, each item a person meets there. Step ids that existed are kept —
// the server remembers which ones a person has seen.
//
// ⚠️ ONLY WHAT THIS PERSON HAS (owner, 15 Nov 2026): «هر کاربری که صنف را
// انتخاب می‌کند، راهنما نباید به هسته‌ای اشاره کند که لازمش نیست — وگرنه "قدم
// بعدی" به هیچ صفحه‌ای نمی‌رود». So a step names the hub TAB / switch VIEW it
// teaches (the guide opens it through the address, `?tab=` / `?view=`, and
// skips the step when this person's screen does not offer it), the DNA MODULES
// it belongs to (a salon is not taught repair slips), and the tour only goes to
// a page that is in this person's menu (`nextGuideRoute(…, isReachable)`).
// ============================================

export interface GuideStepDefinition {
  id: string
  routeId: string
  order: number
  /** Element the card sits beside: `[data-guide="<sectionId>"]`. */
  sectionId: string
  titleKey: string
  descriptionKey: string
  /** The hub tab (`?tab=`) this step teaches; the guide opens it, or skips the step when it is not offered. */
  tab?: string | undefined
  /** The section switch (`?view=`) inside that tab, with the same rule. */
  view?: string | undefined
  /**
   * Taught only to a business whose Operational DNA resolves one of these
   * modules (`resolveDnaCapabilities().activeModules`). Unresolved DNA hides
   * nothing — the same rule as the menu suggestion.
   */
  modules?: readonly string[] | undefined
  /** The public article (and its section) that teaches this part in depth. */
  docs?: { slug: string; section?: string | undefined } | undefined
}

/** The attribute a screen marks a section with so the guide can find it. */
export const GUIDE_SECTION_ATTRIBUTE = 'data-guide'
/** On every hub tab button: its id (`HubTabs`). */
export const GUIDE_TAB_ATTRIBUTE = 'data-guide-tab'
/** On every section switch option: its value (`SegmentedControl`, `PageHub`). */
export const GUIDE_VIEW_ATTRIBUTE = 'data-guide-view'
/** Beside a tab / view marker: present when it is the one on screen. */
export const GUIDE_ACTIVE_ATTRIBUTE = 'data-guide-active'

/**
 * Bumped when a step's MEANING changes (it then gets a new id) or steps move
 * between pages. Seen-records of ids that no longer exist are simply ignored —
 * they never count toward a page being done.
 */
export const GUIDE_CATALOG_VERSION = 2

/** Where a step's card goes when its own section is not on screen. */
export function guidePageAnchor(routeId: string): string {
  return `${routeId}-page`
}

/**
 * The catalog key of a pathname: `/fa/warehouse` → `warehouse`, a record's own
 * page `/fa/warehouse/123` → `warehouse-detail`, a builder `/invoices/new` →
 * `invoices-new`. The detail page of a product is not the warehouse list: its
 * panels (units, waste, serials) exist only there.
 */
export function guideRouteOf(pathname: string): string {
  const segments = pathname
    .split('?')[0]!
    .split('/')
    .filter(Boolean)
    .filter((segment, index) => !(index === 0 && /^(fa|af|en)$/.test(segment)))
  const first = segments[0] ?? 'dashboard'
  const second = segments[1]
  if (!second) return first
  return second === 'new' ? `${first}-new` : `${first}-detail`
}

type StepInput = Omit<GuideStepDefinition, 'routeId' | 'order'>

/** A route's steps, numbered in the order written. */
function steps(routeId: string, list: readonly StepInput[]): GuideStepDefinition[] {
  return list.map((step, index) => ({ ...step, routeId, order: index + 1 }))
}

const SERVICE_MODULES = ['services', 'appointments', 'package_credits', 'attendance'] as const

export const GUIDE_CATALOG: Record<string, GuideStepDefinition[]> = {
  dashboard: steps('dashboard', [
    {
      id: 'dashboard-overview',
      sectionId: 'dashboard-overview',
      titleKey: 'guide.dashboard.overview.title',
      descriptionKey: 'guide.dashboard.overview.desc',
      docs: { slug: 'dashboard-overview', section: 'cards' },
    },
    {
      id: 'dashboard-kpis',
      sectionId: 'dashboard-kpis',
      titleKey: 'guide.dashboard.kpis.title',
      descriptionKey: 'guide.dashboard.kpis.desc',
      docs: { slug: 'dashboard-overview', section: 'cards' },
    },
    {
      id: 'dashboard-custom-kpis',
      sectionId: 'dashboard-kpis',
      titleKey: 'guide.dashboard.custom.title',
      descriptionKey: 'guide.dashboard.custom.desc',
      docs: { slug: 'dashboard-overview', section: 'custom' },
    },
    {
      id: 'dashboard-sales-chart',
      sectionId: 'dashboard-chart',
      titleKey: 'guide.dashboard.chart.title',
      descriptionKey: 'guide.dashboard.chart.desc',
    },
    {
      id: 'dashboard-warnings',
      sectionId: 'dashboard-kpis',
      titleKey: 'guide.dashboard.warnings.title',
      descriptionKey: 'guide.dashboard.warnings.desc',
      docs: { slug: 'dashboard-overview', section: 'warnings' },
    },
  ]),
  invoices: steps('invoices', [
    {
      id: 'invoices-list',
      tab: 'invoices',
      sectionId: guidePageAnchor('invoices'),
      titleKey: 'guide.invoices.list.title',
      descriptionKey: 'guide.invoices.list.desc',
      docs: { slug: 'invoices', section: 'kinds' },
    },
    {
      id: 'invoices-create-btn',
      tab: 'invoices',
      sectionId: 'invoices-create',
      titleKey: 'guide.invoices.new.title',
      descriptionKey: 'guide.invoices.new.desc',
      docs: { slug: 'invoices', section: 'kinds' },
    },
    {
      id: 'invoices-drafts',
      tab: 'invoices',
      sectionId: 'invoices-drafts',
      titleKey: 'guide.invoices.drafts.title',
      descriptionKey: 'guide.invoices.drafts.desc',
      docs: { slug: 'returns-and-advances', section: 'drafts' },
    },
    {
      id: 'invoices-filters',
      tab: 'invoices',
      sectionId: 'invoices-filters',
      titleKey: 'guide.invoices.filters.title',
      descriptionKey: 'guide.invoices.filters.desc',
      docs: { slug: 'invoices', section: 'columns' },
    },
    {
      id: 'invoices-returns',
      tab: 'invoices',
      sectionId: guidePageAnchor('invoices'),
      titleKey: 'guide.invoices.returns.title',
      descriptionKey: 'guide.invoices.returns.desc',
      docs: { slug: 'returns-and-advances', section: 'returns' },
    },
    {
      id: 'invoices-orders',
      tab: 'orders',
      sectionId: guidePageAnchor('invoices'),
      titleKey: 'guide.invoices.orders.title',
      descriptionKey: 'guide.invoices.orders.desc',
    },
    {
      id: 'invoices-pricing',
      tab: 'pricing',
      sectionId: guidePageAnchor('invoices'),
      titleKey: 'guide.invoices.pricing.title',
      descriptionKey: 'guide.invoices.pricing.desc',
      docs: { slug: 'promotions', section: 'what' },
    },
  ]),
  warehouse: steps('warehouse', [
    {
      id: 'warehouse-stock',
      tab: 'stock',
      view: 'warehouses',
      sectionId: guidePageAnchor('warehouse'),
      titleKey: 'guide.warehouse.stock.title',
      descriptionKey: 'guide.warehouse.stock.desc',
      docs: { slug: 'inventory', section: 'source' },
    },
    {
      id: 'warehouse-costing',
      tab: 'stock',
      view: 'warehouses',
      sectionId: guidePageAnchor('warehouse'),
      titleKey: 'guide.warehouse.costing.title',
      descriptionKey: 'guide.warehouse.costing.desc',
      docs: { slug: 'inventory', section: 'source' },
    },
    {
      id: 'warehouse-products',
      tab: 'stock',
      view: 'products',
      sectionId: guidePageAnchor('warehouse'),
      titleKey: 'guide.warehouse.products.title',
      descriptionKey: 'guide.warehouse.products.desc',
      docs: { slug: 'inventory', section: 'units' },
    },
    {
      id: 'warehouse-shelves',
      tab: 'stock',
      view: 'shelfMap',
      sectionId: guidePageAnchor('warehouse'),
      titleKey: 'guide.warehouse.shelves.title',
      descriptionKey: 'guide.warehouse.shelves.desc',
      docs: { slug: 'warehouse-locations', section: 'shelves' },
    },
    {
      id: 'warehouse-transfer',
      tab: 'stock',
      view: 'transfers',
      sectionId: guidePageAnchor('warehouse'),
      titleKey: 'guide.warehouse.transfer.title',
      descriptionKey: 'guide.warehouse.transfer.desc',
      docs: { slug: 'warehouse-locations', section: 'transfer' },
    },
    {
      id: 'warehouse-holds',
      tab: 'stock',
      view: 'holds',
      sectionId: guidePageAnchor('warehouse'),
      titleKey: 'guide.warehouse.holds.title',
      descriptionKey: 'guide.warehouse.holds.desc',
    },
    {
      id: 'warehouse-reorder',
      tab: 'stock',
      view: 'reorder',
      sectionId: guidePageAnchor('warehouse'),
      titleKey: 'guide.warehouse.reorder.title',
      descriptionKey: 'guide.warehouse.reorder.desc',
      docs: { slug: 'inventory', section: 'insights' },
    },
    {
      id: 'warehouse-dead-stock',
      tab: 'stock',
      view: 'deadStock',
      sectionId: guidePageAnchor('warehouse'),
      titleKey: 'guide.warehouse.deadStock.title',
      descriptionKey: 'guide.warehouse.deadStock.desc',
      docs: { slug: 'inventory', section: 'insights' },
    },
    {
      id: 'warehouse-rfqs',
      tab: 'stock',
      view: 'rfqs',
      sectionId: guidePageAnchor('warehouse'),
      titleKey: 'guide.warehouse.rfqs.title',
      descriptionKey: 'guide.warehouse.rfqs.desc',
    },
    {
      id: 'warehouse-consignments',
      tab: 'stock',
      view: 'consignments',
      sectionId: guidePageAnchor('warehouse'),
      titleKey: 'guide.warehouse.consignments.title',
      descriptionKey: 'guide.warehouse.consignments.desc',
    },
    {
      id: 'warehouse-expiry',
      tab: 'expiry',
      sectionId: guidePageAnchor('warehouse'),
      titleKey: 'guide.warehouse.expiry.title',
      descriptionKey: 'guide.warehouse.expiry.desc',
    },
  ]),
  // A product's own page (`/warehouse/<id>`): the panels below exist only there.
  'warehouse-detail': steps('warehouse-detail', [
    {
      id: 'warehouse-units',
      sectionId: 'product-units',
      titleKey: 'guide.warehouse.units.title',
      descriptionKey: 'guide.warehouse.units.desc',
      docs: { slug: 'units-and-weighed-goods', section: 'packs' },
    },
    {
      id: 'warehouse-waste',
      sectionId: 'product-waste',
      titleKey: 'guide.warehouse.waste.title',
      descriptionKey: 'guide.warehouse.waste.desc',
      docs: { slug: 'stock-count-and-waste', section: 'waste' },
    },
    {
      id: 'warehouse-serials',
      sectionId: 'product-serials',
      titleKey: 'guide.warehouse.serials.title',
      descriptionKey: 'guide.warehouse.serials.desc',
      docs: { slug: 'serial-numbers-and-variants', section: 'serials' },
    },
  ]),
  accounting: steps('accounting', [
    {
      id: 'accounting-accounts',
      tab: 'books',
      view: 'accounts',
      sectionId: guidePageAnchor('accounting'),
      titleKey: 'guide.accounting.accounts.title',
      descriptionKey: 'guide.accounting.accounts.desc',
      docs: { slug: 'accounting', section: 'automatic' },
    },
    {
      id: 'accounting-journal',
      tab: 'books',
      view: 'journal',
      sectionId: guidePageAnchor('accounting'),
      titleKey: 'guide.accounting.journal.title',
      descriptionKey: 'guide.accounting.journal.desc',
      docs: { slug: 'accounting', section: 'automatic' },
    },
    {
      id: 'accounting-month-end',
      tab: 'books',
      view: 'monthEnd',
      sectionId: guidePageAnchor('accounting'),
      titleKey: 'guide.accounting.monthEnd.title',
      descriptionKey: 'guide.accounting.monthEnd.desc',
      docs: { slug: 'accounting', section: 'closing' },
    },
    {
      id: 'accounting-treasury',
      tab: 'treasury',
      view: 'bank',
      sectionId: guidePageAnchor('accounting'),
      titleKey: 'guide.accounting.treasury.title',
      descriptionKey: 'guide.accounting.treasury.desc',
    },
    {
      id: 'accounting-cheques',
      tab: 'treasury',
      view: 'cheques',
      sectionId: guidePageAnchor('accounting'),
      titleKey: 'guide.accounting.cheques.title',
      descriptionKey: 'guide.accounting.cheques.desc',
    },
    {
      id: 'accounting-assets',
      tab: 'treasury',
      view: 'assets',
      sectionId: guidePageAnchor('accounting'),
      titleKey: 'guide.accounting.assets.title',
      descriptionKey: 'guide.accounting.assets.desc',
    },
    {
      id: 'accounting-financing',
      tab: 'treasury',
      view: 'financing',
      sectionId: guidePageAnchor('accounting'),
      titleKey: 'guide.accounting.financing.title',
      descriptionKey: 'guide.accounting.financing.desc',
    },
    {
      id: 'accounting-trial-balance',
      tab: 'reports',
      view: 'trialBalance',
      sectionId: guidePageAnchor('accounting'),
      titleKey: 'guide.accounting.trial.title',
      descriptionKey: 'guide.accounting.trial.desc',
    },
    {
      id: 'accounting-reports',
      tab: 'reports',
      view: 'incomeStatement',
      sectionId: guidePageAnchor('accounting'),
      titleKey: 'guide.accounting.reports.title',
      descriptionKey: 'guide.accounting.reports.desc',
    },
    {
      id: 'accounting-budgets',
      tab: 'reports',
      view: 'budgets',
      sectionId: guidePageAnchor('accounting'),
      titleKey: 'guide.accounting.budgets.title',
      descriptionKey: 'guide.accounting.budgets.desc',
    },
  ]),
  customers: steps('customers', [
    {
      id: 'customers-overview',
      tab: 'customers',
      sectionId: guidePageAnchor('customers'),
      titleKey: 'guide.customers.overview.title',
      descriptionKey: 'guide.customers.overview.desc',
      docs: { slug: 'customers', section: 'balance' },
    },
    {
      id: 'customers-ledger',
      tab: 'customers',
      sectionId: guidePageAnchor('customers'),
      titleKey: 'guide.customers.ledger.title',
      descriptionKey: 'guide.customers.ledger.desc',
      docs: { slug: 'customers', section: 'overdue' },
    },
    {
      id: 'customers-sessions',
      tab: 'sessions',
      view: 'sessions',
      modules: SERVICE_MODULES,
      sectionId: guidePageAnchor('customers'),
      titleKey: 'guide.customers.sessions.title',
      descriptionKey: 'guide.customers.sessions.desc',
      docs: { slug: 'service-delivery', section: 'what' },
    },
    {
      id: 'customers-repairs',
      tab: 'sessions',
      view: 'repairs',
      modules: ['job_tickets'],
      sectionId: 'repair-tickets',
      titleKey: 'guide.customers.repairs.title',
      descriptionKey: 'guide.customers.repairs.desc',
      docs: { slug: 'repairs-and-warranty', section: 'slip' },
    },
    {
      id: 'customers-salon-setup',
      tab: 'sessions',
      view: 'salonSetup',
      modules: ['services', 'appointments'],
      sectionId: 'salon-setup',
      titleKey: 'guide.customers.salonSetup.title',
      descriptionKey: 'guide.customers.salonSetup.desc',
      docs: { slug: 'salon-chairs-and-commission', section: 'resources' },
    },
    {
      id: 'customers-commission',
      tab: 'sessions',
      view: 'commission',
      modules: ['services', 'appointments', 'job_tickets'],
      sectionId: 'commission',
      titleKey: 'guide.customers.commission.title',
      descriptionKey: 'guide.customers.commission.desc',
      docs: { slug: 'salon-chairs-and-commission', section: 'commission' },
    },
    {
      id: 'customers-follow-up',
      tab: 'outreach',
      view: 'followUp',
      sectionId: guidePageAnchor('customers'),
      titleKey: 'guide.customers.followUp.title',
      descriptionKey: 'guide.customers.followUp.desc',
    },
    {
      id: 'customers-campaigns',
      tab: 'outreach',
      view: 'campaigns',
      sectionId: guidePageAnchor('customers'),
      titleKey: 'guide.customers.campaigns.title',
      descriptionKey: 'guide.customers.campaigns.desc',
      docs: { slug: 'campaigns', section: 'what' },
    },
    {
      id: 'customers-stale',
      tab: 'outreach',
      view: 'stale',
      sectionId: guidePageAnchor('customers'),
      titleKey: 'guide.customers.stale.title',
      descriptionKey: 'guide.customers.stale.desc',
    },
    {
      id: 'customers-rfm',
      tab: 'outreach',
      view: 'rfm',
      sectionId: guidePageAnchor('customers'),
      titleKey: 'guide.customers.rfm.title',
      descriptionKey: 'guide.customers.rfm.desc',
    },
  ]),
  till: steps('till', [
    {
      id: 'till-open',
      tab: 'till',
      sectionId: guidePageAnchor('till'),
      titleKey: 'guide.till.open.title',
      descriptionKey: 'guide.till.open.desc',
      docs: { slug: 'pos', section: 'shift' },
    },
    {
      id: 'till-cash',
      tab: 'till',
      sectionId: guidePageAnchor('till'),
      titleKey: 'guide.till.cash.title',
      descriptionKey: 'guide.till.cash.desc',
      docs: { slug: 'pos', section: 'cash' },
    },
    {
      id: 'till-close',
      tab: 'till',
      sectionId: guidePageAnchor('till'),
      titleKey: 'guide.till.close.title',
      descriptionKey: 'guide.till.close.desc',
      docs: { slug: 'pos', section: 'closing' },
    },
    {
      id: 'till-stale',
      tab: 'till',
      sectionId: guidePageAnchor('till'),
      titleKey: 'guide.till.stale.title',
      descriptionKey: 'guide.till.stale.desc',
    },
    {
      id: 'till-exchange',
      tab: 'exchange',
      sectionId: 'exchange',
      titleKey: 'guide.till.exchange.title',
      descriptionKey: 'guide.till.exchange.desc',
      docs: { slug: 'currency-exchange', section: 'trades' },
    },
  ]),
  'stock-count': steps('stock-count', [
    {
      id: 'stock-count-start',
      sectionId: guidePageAnchor('stock-count'),
      titleKey: 'guide.stockCount.start.title',
      descriptionKey: 'guide.stockCount.start.desc',
      docs: { slug: 'stock-count-and-waste', section: 'count' },
    },
    {
      id: 'stock-count-enter',
      sectionId: guidePageAnchor('stock-count'),
      titleKey: 'guide.stockCount.enter.title',
      descriptionKey: 'guide.stockCount.enter.desc',
      docs: { slug: 'stock-count-and-waste', section: 'count' },
    },
    {
      id: 'stock-count-complete',
      sectionId: guidePageAnchor('stock-count'),
      titleKey: 'guide.stockCount.complete.title',
      descriptionKey: 'guide.stockCount.complete.desc',
      docs: { slug: 'stock-count-and-waste', section: 'history' },
    },
  ]),
  'team-and-payroll': steps('team-and-payroll', [
    {
      id: 'team-employees',
      tab: 'team',
      view: 'employees',
      sectionId: guidePageAnchor('team-and-payroll'),
      titleKey: 'guide.teamAndPayroll.employees.title',
      descriptionKey: 'guide.teamAndPayroll.employees.desc',
      docs: { slug: 'branches', section: 'staff' },
    },
    {
      id: 'team-payroll',
      tab: 'team',
      view: 'employees',
      sectionId: guidePageAnchor('team-and-payroll'),
      titleKey: 'guide.teamAndPayroll.payroll.title',
      descriptionKey: 'guide.teamAndPayroll.payroll.desc',
    },
    {
      id: 'team-branches',
      tab: 'team',
      view: 'branches',
      sectionId: guidePageAnchor('team-and-payroll'),
      titleKey: 'guide.teamAndPayroll.branches.title',
      descriptionKey: 'guide.teamAndPayroll.branches.desc',
      docs: { slug: 'branches', section: 'branches' },
    },
    {
      id: 'team-org-chart',
      tab: 'team',
      view: 'orgChart',
      sectionId: guidePageAnchor('team-and-payroll'),
      titleKey: 'guide.teamAndPayroll.orgChart.title',
      descriptionKey: 'guide.teamAndPayroll.orgChart.desc',
    },
    {
      id: 'team-sellers',
      tab: 'team',
      view: 'sellers',
      sectionId: guidePageAnchor('team-and-payroll'),
      titleKey: 'guide.teamAndPayroll.sellers.title',
      descriptionKey: 'guide.teamAndPayroll.sellers.desc',
    },
    {
      id: 'team-leave',
      tab: 'pay',
      view: 'attendance',
      sectionId: guidePageAnchor('team-and-payroll'),
      titleKey: 'guide.teamAndPayroll.leave.title',
      descriptionKey: 'guide.teamAndPayroll.leave.desc',
      docs: { slug: 'attendance', section: 'sheet' },
    },
    {
      id: 'team-timesheets',
      tab: 'pay',
      view: 'timesheets',
      sectionId: guidePageAnchor('team-and-payroll'),
      titleKey: 'guide.teamAndPayroll.timesheets.title',
      descriptionKey: 'guide.teamAndPayroll.timesheets.desc',
    },
    {
      id: 'team-expenses',
      tab: 'pay',
      view: 'expenses',
      sectionId: guidePageAnchor('team-and-payroll'),
      titleKey: 'guide.teamAndPayroll.expenses.title',
      descriptionKey: 'guide.teamAndPayroll.expenses.desc',
    },
  ]),
  analysis: steps('analysis', [
    {
      id: 'analysis-overview',
      sectionId: guidePageAnchor('analysis'),
      titleKey: 'guide.analysis.overview.title',
      descriptionKey: 'guide.analysis.overview.desc',
      docs: { slug: 'business-analysis', section: 'collections' },
    },
    {
      id: 'analysis-break-even',
      sectionId: guidePageAnchor('analysis'),
      titleKey: 'guide.analysis.breakEven.title',
      descriptionKey: 'guide.analysis.breakEven.desc',
      docs: { slug: 'business-analysis', section: 'breakEven' },
    },
  ]),
  'data-and-sync': steps('data-and-sync', [
    {
      id: 'data-status',
      view: 'status',
      sectionId: guidePageAnchor('data-and-sync'),
      titleKey: 'guide.dataAndSync.status.title',
      descriptionKey: 'guide.dataAndSync.status.desc',
      docs: { slug: 'offline', section: 'devices' },
    },
    {
      id: 'data-conflicts',
      view: 'conflicts',
      sectionId: guidePageAnchor('data-and-sync'),
      titleKey: 'guide.dataAndSync.conflicts.title',
      descriptionKey: 'guide.dataAndSync.conflicts.desc',
    },
    {
      id: 'data-import',
      view: 'migration',
      sectionId: guidePageAnchor('data-and-sync'),
      titleKey: 'guide.dataAndSync.import.title',
      descriptionKey: 'guide.dataAndSync.import.desc',
      docs: { slug: 'data-and-backup', section: 'csv' },
    },
    {
      id: 'data-snapshots',
      view: 'snapshots',
      sectionId: guidePageAnchor('data-and-sync'),
      titleKey: 'guide.dataAndSync.snapshots.title',
      descriptionKey: 'guide.dataAndSync.snapshots.desc',
    },
  ]),
  settings: steps('settings', [
    {
      id: 'settings-business',
      tab: 'general',
      sectionId: guidePageAnchor('settings'),
      titleKey: 'guide.settings.business.title',
      descriptionKey: 'guide.settings.business.desc',
    },
    {
      id: 'settings-pages',
      tab: 'general',
      sectionId: guidePageAnchor('settings'),
      titleKey: 'guide.settings.pages.title',
      descriptionKey: 'guide.settings.pages.desc',
    },
    {
      id: 'settings-integrations',
      tab: 'integrations',
      view: 'developers',
      sectionId: guidePageAnchor('settings'),
      titleKey: 'guide.settings.integrations.title',
      descriptionKey: 'guide.settings.integrations.desc',
      docs: { slug: 'developers', section: 'keys' },
    },
    {
      id: 'settings-marketplace',
      tab: 'integrations',
      view: 'marketplace',
      sectionId: guidePageAnchor('settings'),
      titleKey: 'guide.settings.marketplace.title',
      descriptionKey: 'guide.settings.marketplace.desc',
    },
  ]),
  manufacturing: steps('manufacturing', [
    {
      id: 'manufacturing-formula',
      sectionId: guidePageAnchor('manufacturing'),
      titleKey: 'guide.manufacturing.formula.title',
      descriptionKey: 'guide.manufacturing.formula.desc',
      docs: { slug: 'manufacturing', section: 'make' },
    },
    {
      id: 'manufacturing-produce',
      sectionId: guidePageAnchor('manufacturing'),
      titleKey: 'guide.manufacturing.produce.title',
      descriptionKey: 'guide.manufacturing.produce.desc',
      docs: { slug: 'manufacturing', section: 'stock' },
    },
  ]),
  assistant: steps('assistant', [
    {
      id: 'assistant-ask',
      sectionId: guidePageAnchor('assistant'),
      titleKey: 'guide.assistant.ask.title',
      descriptionKey: 'guide.assistant.ask.desc',
      docs: { slug: 'assistant', section: 'what' },
    },
    {
      id: 'assistant-modes',
      sectionId: guidePageAnchor('assistant'),
      titleKey: 'guide.assistant.modes.title',
      descriptionKey: 'guide.assistant.modes.desc',
      docs: { slug: 'assistant', section: 'limits' },
    },
  ]),
  billing: steps('billing', [
    {
      id: 'billing-plans',
      tab: 'plan',
      sectionId: guidePageAnchor('billing'),
      titleKey: 'guide.billing.plans.title',
      descriptionKey: 'guide.billing.plans.desc',
    },
    {
      id: 'billing-wallet',
      tab: 'money',
      view: 'wallet',
      sectionId: guidePageAnchor('billing'),
      titleKey: 'guide.billing.wallet.title',
      descriptionKey: 'guide.billing.wallet.desc',
      docs: { slug: 'wallet', section: 'what' },
    },
    {
      id: 'billing-referrals',
      tab: 'money',
      view: 'referrals',
      sectionId: guidePageAnchor('billing'),
      titleKey: 'guide.billing.referrals.title',
      descriptionKey: 'guide.billing.referrals.desc',
    },
  ]),
}

/**
 * The order the pages are taught in — the sidebar's order. When a page's guide
 * ends, the card offers the next page that still has something unseen, so the
 * guide leads somewhere instead of just stopping (owner request, 8 Nov 2026).
 *
 * `menuPath` is the menu entry whose presence decides whether the page is
 * this person's at all: `/stock-count` has no menu entry of its own and goes
 * with the warehouse.
 */
export const GUIDE_TOUR: readonly {
  routeId: string
  path: string
  labelKey: string
  menuPath: string
}[] = [
  { routeId: 'dashboard', path: '/dashboard', labelKey: 'nav.today', menuPath: '/dashboard' },
  { routeId: 'invoices', path: '/invoices', labelKey: 'nav.getPaid', menuPath: '/invoices' },
  { routeId: 'warehouse', path: '/warehouse', labelKey: 'nav.stock', menuPath: '/warehouse' },
  { routeId: 'till', path: '/till', labelKey: 'nav.till', menuPath: '/till' },
  { routeId: 'accounting', path: '/accounting', labelKey: 'nav.money', menuPath: '/accounting' },
  { routeId: 'customers', path: '/customers', labelKey: 'nav.buyers', menuPath: '/customers' },
  {
    routeId: 'stock-count',
    path: '/stock-count',
    labelKey: 'cycleCount.title',
    menuPath: '/warehouse',
  },
  {
    routeId: 'team-and-payroll',
    path: '/team-and-payroll',
    labelKey: 'nav.teamPayroll',
    menuPath: '/team-and-payroll',
  },
  { routeId: 'analysis', path: '/analysis', labelKey: 'nav.analysis', menuPath: '/analysis' },
  {
    routeId: 'manufacturing',
    path: '/manufacturing',
    labelKey: 'nav.manufacturing',
    menuPath: '/manufacturing',
  },
  { routeId: 'assistant', path: '/assistant', labelKey: 'nav.assistant', menuPath: '/assistant' },
  {
    routeId: 'data-and-sync',
    path: '/data-and-sync',
    labelKey: 'nav.data_and_sync',
    menuPath: '/data-and-sync',
  },
  { routeId: 'settings', path: '/settings', labelKey: 'nav.settings', menuPath: '/settings' },
  { routeId: 'billing', path: '/billing', labelKey: 'nav.billing', menuPath: '/billing' },
]

/** Is this step for this business? `activeModules` null = DNA unresolved: everything is. */
export function guideStepInScope(
  step: GuideStepDefinition,
  activeModules: ReadonlySet<string> | null,
): boolean {
  if (!step.modules || step.modules.length === 0 || activeModules === null) return true
  return step.modules.some((module) => activeModules.has(module))
}

/**
 * The next page (after `currentRouteId`, wrapping round) that this person HAS
 * — `isReachable(menuPath)`: in their menu, not denied, not locked — and that
 * still has an unseen step in scope for this business. `null` when there is
 * none: the card then says «all done» instead of sending the reader to a page
 * their trade does not have (owner, 15 Nov 2026).
 */
export function nextGuideRoute(
  currentRouteId: string,
  isSeen: (stepId: string) => boolean,
  isReachable: (menuPath: string) => boolean = () => true,
  activeModules: ReadonlySet<string> | null = null,
): (typeof GUIDE_TOUR)[number] | null {
  const start = GUIDE_TOUR.findIndex((stop) => stop.routeId === currentRouteId)
  for (let offset = 1; offset <= GUIDE_TOUR.length; offset++) {
    const stop = GUIDE_TOUR[(start + offset + GUIDE_TOUR.length) % GUIDE_TOUR.length]!
    if (stop.routeId === currentRouteId) continue
    if (!isReachable(stop.menuPath)) continue
    const pending = (GUIDE_CATALOG[stop.routeId] ?? []).filter(
      (step) => guideStepInScope(step, activeModules) && !isSeen(step.id),
    )
    if (pending.length > 0) return stop
  }
  return null
}
