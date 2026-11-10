// ============================================
// packages/ui-contract/src/guide-catalog.ts
// Interactive Guide Content & Route Catalog
//
// The guide is ONE card mounted by the layout; the page decides where it
// belongs. A section that carries `data-guide="<sectionId>"` is the place the
// card stands beside — above it when there is room, below it otherwise. A
// route that marks nothing falls back to `<routeId>-page`, and only a route
// with neither shows the card docked in the corner.
//
// Every id here is a real element on that screen: a card pointing at a section
// that is not rendered is worse than no card at all.
//
// Rewritten 10 Nov 2026 (owner: «guide ها کلی آیتم کم داره»): every page in
// the tour, each item a person meets there. Step ids that existed are kept —
// the server remembers which ones a person has seen.
// ============================================

export interface GuideStepDefinition {
  id: string
  routeId: string
  order: number
  /** Element the card sits beside: `[data-guide="<sectionId>"]`. */
  sectionId: string
  titleKey: string
  descriptionKey: string
}

/** The attribute a screen marks a section with so the guide can find it. */
export const GUIDE_SECTION_ATTRIBUTE = 'data-guide'

/** Where a step's card goes when its own section is not on screen. */
export function guidePageAnchor(routeId: string): string {
  return `${routeId}-page`
}

export const GUIDE_CATALOG: Record<string, GuideStepDefinition[]> = {
  dashboard: [
    {
      id: 'dashboard-overview',
      routeId: 'dashboard',
      order: 1,
      sectionId: 'dashboard-overview',
      titleKey: 'guide.dashboard.overview.title',
      descriptionKey: 'guide.dashboard.overview.desc',
    },
    {
      id: 'dashboard-kpis',
      routeId: 'dashboard',
      order: 2,
      sectionId: 'dashboard-kpis',
      titleKey: 'guide.dashboard.kpis.title',
      descriptionKey: 'guide.dashboard.kpis.desc',
    },
    {
      id: 'dashboard-custom-kpis',
      routeId: 'dashboard',
      order: 3,
      sectionId: 'dashboard-kpis',
      titleKey: 'guide.dashboard.custom.title',
      descriptionKey: 'guide.dashboard.custom.desc',
    },
    {
      id: 'dashboard-sales-chart',
      routeId: 'dashboard',
      order: 4,
      sectionId: 'dashboard-chart',
      titleKey: 'guide.dashboard.chart.title',
      descriptionKey: 'guide.dashboard.chart.desc',
    },
    {
      id: 'dashboard-warnings',
      routeId: 'dashboard',
      order: 5,
      sectionId: 'dashboard-kpis',
      titleKey: 'guide.dashboard.warnings.title',
      descriptionKey: 'guide.dashboard.warnings.desc',
    },
  ],
  invoices: [
    {
      id: 'invoices-list',
      routeId: 'invoices',
      order: 1,
      sectionId: guidePageAnchor('invoices'),
      titleKey: 'guide.invoices.list.title',
      descriptionKey: 'guide.invoices.list.desc',
    },
    {
      id: 'invoices-create-btn',
      routeId: 'invoices',
      order: 2,
      sectionId: 'invoices-create',
      titleKey: 'guide.invoices.new.title',
      descriptionKey: 'guide.invoices.new.desc',
    },
    {
      id: 'invoices-drafts',
      routeId: 'invoices',
      order: 3,
      sectionId: 'invoices-drafts',
      titleKey: 'guide.invoices.drafts.title',
      descriptionKey: 'guide.invoices.drafts.desc',
    },
    {
      id: 'invoices-filters',
      routeId: 'invoices',
      order: 4,
      sectionId: 'invoices-filters',
      titleKey: 'guide.invoices.filters.title',
      descriptionKey: 'guide.invoices.filters.desc',
    },
    {
      id: 'invoices-returns',
      routeId: 'invoices',
      order: 5,
      sectionId: guidePageAnchor('invoices'),
      titleKey: 'guide.invoices.returns.title',
      descriptionKey: 'guide.invoices.returns.desc',
    },
    {
      id: 'invoices-pricing',
      routeId: 'invoices',
      order: 6,
      sectionId: guidePageAnchor('invoices'),
      titleKey: 'guide.invoices.pricing.title',
      descriptionKey: 'guide.invoices.pricing.desc',
    },
  ],
  warehouse: [
    {
      id: 'warehouse-stock',
      routeId: 'warehouse',
      order: 1,
      sectionId: guidePageAnchor('warehouse'),
      titleKey: 'guide.warehouse.stock.title',
      descriptionKey: 'guide.warehouse.stock.desc',
    },
    {
      id: 'warehouse-products',
      routeId: 'warehouse',
      order: 2,
      sectionId: guidePageAnchor('warehouse'),
      titleKey: 'guide.warehouse.products.title',
      descriptionKey: 'guide.warehouse.products.desc',
    },
    {
      id: 'warehouse-shelves',
      routeId: 'warehouse',
      order: 3,
      sectionId: guidePageAnchor('warehouse'),
      titleKey: 'guide.warehouse.shelves.title',
      descriptionKey: 'guide.warehouse.shelves.desc',
    },
    {
      id: 'warehouse-transfer',
      routeId: 'warehouse',
      order: 4,
      sectionId: guidePageAnchor('warehouse'),
      titleKey: 'guide.warehouse.transfer.title',
      descriptionKey: 'guide.warehouse.transfer.desc',
    },
    {
      id: 'warehouse-reorder',
      routeId: 'warehouse',
      order: 5,
      sectionId: guidePageAnchor('warehouse'),
      titleKey: 'guide.warehouse.reorder.title',
      descriptionKey: 'guide.warehouse.reorder.desc',
    },
    {
      id: 'warehouse-expiry',
      routeId: 'warehouse',
      order: 6,
      sectionId: guidePageAnchor('warehouse'),
      titleKey: 'guide.warehouse.expiry.title',
      descriptionKey: 'guide.warehouse.expiry.desc',
    },
    {
      id: 'warehouse-costing',
      routeId: 'warehouse',
      order: 7,
      sectionId: guidePageAnchor('warehouse'),
      titleKey: 'guide.warehouse.costing.title',
      descriptionKey: 'guide.warehouse.costing.desc',
    },
    {
      id: 'warehouse-waste',
      routeId: 'warehouse',
      order: 8,
      sectionId: 'product-waste',
      titleKey: 'guide.warehouse.waste.title',
      descriptionKey: 'guide.warehouse.waste.desc',
    },
    {
      id: 'warehouse-units',
      routeId: 'warehouse',
      order: 9,
      sectionId: 'product-units',
      titleKey: 'guide.warehouse.units.title',
      descriptionKey: 'guide.warehouse.units.desc',
    },
    {
      id: 'warehouse-serials',
      routeId: 'warehouse',
      order: 10,
      sectionId: 'product-serials',
      titleKey: 'guide.warehouse.serials.title',
      descriptionKey: 'guide.warehouse.serials.desc',
    },
  ],
  accounting: [
    {
      id: 'accounting-trial-balance',
      routeId: 'accounting',
      order: 1,
      sectionId: guidePageAnchor('accounting'),
      titleKey: 'guide.accounting.trial.title',
      descriptionKey: 'guide.accounting.trial.desc',
    },
    {
      id: 'accounting-journal',
      routeId: 'accounting',
      order: 2,
      sectionId: guidePageAnchor('accounting'),
      titleKey: 'guide.accounting.journal.title',
      descriptionKey: 'guide.accounting.journal.desc',
    },
    {
      id: 'accounting-reports',
      routeId: 'accounting',
      order: 3,
      sectionId: guidePageAnchor('accounting'),
      titleKey: 'guide.accounting.reports.title',
      descriptionKey: 'guide.accounting.reports.desc',
    },
    {
      id: 'accounting-month-end',
      routeId: 'accounting',
      order: 4,
      sectionId: guidePageAnchor('accounting'),
      titleKey: 'guide.accounting.monthEnd.title',
      descriptionKey: 'guide.accounting.monthEnd.desc',
    },
    {
      id: 'accounting-treasury',
      routeId: 'accounting',
      order: 5,
      sectionId: guidePageAnchor('accounting'),
      titleKey: 'guide.accounting.treasury.title',
      descriptionKey: 'guide.accounting.treasury.desc',
    },
  ],
  customers: [
    {
      id: 'customers-overview',
      routeId: 'customers',
      order: 1,
      sectionId: guidePageAnchor('customers'),
      titleKey: 'guide.customers.overview.title',
      descriptionKey: 'guide.customers.overview.desc',
    },
    {
      id: 'customers-ledger',
      routeId: 'customers',
      order: 2,
      sectionId: guidePageAnchor('customers'),
      titleKey: 'guide.customers.ledger.title',
      descriptionKey: 'guide.customers.ledger.desc',
    },
    {
      id: 'customers-sessions',
      routeId: 'customers',
      order: 3,
      sectionId: guidePageAnchor('customers'),
      titleKey: 'guide.customers.sessions.title',
      descriptionKey: 'guide.customers.sessions.desc',
    },
    {
      id: 'customers-campaigns',
      routeId: 'customers',
      order: 4,
      sectionId: guidePageAnchor('customers'),
      titleKey: 'guide.customers.campaigns.title',
      descriptionKey: 'guide.customers.campaigns.desc',
    },
  ],
  till: [
    {
      id: 'till-open',
      routeId: 'till',
      order: 1,
      sectionId: guidePageAnchor('till'),
      titleKey: 'guide.till.open.title',
      descriptionKey: 'guide.till.open.desc',
    },
    {
      id: 'till-cash',
      routeId: 'till',
      order: 2,
      sectionId: guidePageAnchor('till'),
      titleKey: 'guide.till.cash.title',
      descriptionKey: 'guide.till.cash.desc',
    },
    {
      id: 'till-close',
      routeId: 'till',
      order: 3,
      sectionId: guidePageAnchor('till'),
      titleKey: 'guide.till.close.title',
      descriptionKey: 'guide.till.close.desc',
    },
    {
      id: 'till-stale',
      routeId: 'till',
      order: 4,
      sectionId: guidePageAnchor('till'),
      titleKey: 'guide.till.stale.title',
      descriptionKey: 'guide.till.stale.desc',
    },
  ],
  'stock-count': [
    {
      id: 'stock-count-start',
      routeId: 'stock-count',
      order: 1,
      sectionId: guidePageAnchor('stock-count'),
      titleKey: 'guide.stockCount.start.title',
      descriptionKey: 'guide.stockCount.start.desc',
    },
    {
      id: 'stock-count-enter',
      routeId: 'stock-count',
      order: 2,
      sectionId: guidePageAnchor('stock-count'),
      titleKey: 'guide.stockCount.enter.title',
      descriptionKey: 'guide.stockCount.enter.desc',
    },
    {
      id: 'stock-count-complete',
      routeId: 'stock-count',
      order: 3,
      sectionId: guidePageAnchor('stock-count'),
      titleKey: 'guide.stockCount.complete.title',
      descriptionKey: 'guide.stockCount.complete.desc',
    },
  ],
  'team-and-payroll': [
    {
      id: 'team-employees',
      routeId: 'team-and-payroll',
      order: 1,
      sectionId: guidePageAnchor('team-and-payroll'),
      titleKey: 'guide.teamAndPayroll.employees.title',
      descriptionKey: 'guide.teamAndPayroll.employees.desc',
    },
    {
      id: 'team-payroll',
      routeId: 'team-and-payroll',
      order: 2,
      sectionId: guidePageAnchor('team-and-payroll'),
      titleKey: 'guide.teamAndPayroll.payroll.title',
      descriptionKey: 'guide.teamAndPayroll.payroll.desc',
    },
    {
      id: 'team-leave',
      routeId: 'team-and-payroll',
      order: 3,
      sectionId: guidePageAnchor('team-and-payroll'),
      titleKey: 'guide.teamAndPayroll.leave.title',
      descriptionKey: 'guide.teamAndPayroll.leave.desc',
    },
    {
      id: 'team-branches',
      routeId: 'team-and-payroll',
      order: 4,
      sectionId: guidePageAnchor('team-and-payroll'),
      titleKey: 'guide.teamAndPayroll.branches.title',
      descriptionKey: 'guide.teamAndPayroll.branches.desc',
    },
  ],
  analysis: [
    {
      id: 'analysis-overview',
      routeId: 'analysis',
      order: 1,
      sectionId: guidePageAnchor('analysis'),
      titleKey: 'guide.analysis.overview.title',
      descriptionKey: 'guide.analysis.overview.desc',
    },
    {
      id: 'analysis-break-even',
      routeId: 'analysis',
      order: 2,
      sectionId: guidePageAnchor('analysis'),
      titleKey: 'guide.analysis.breakEven.title',
      descriptionKey: 'guide.analysis.breakEven.desc',
    },
  ],
  'data-and-sync': [
    {
      id: 'data-status',
      routeId: 'data-and-sync',
      order: 1,
      sectionId: guidePageAnchor('data-and-sync'),
      titleKey: 'guide.dataAndSync.status.title',
      descriptionKey: 'guide.dataAndSync.status.desc',
    },
    {
      id: 'data-conflicts',
      routeId: 'data-and-sync',
      order: 2,
      sectionId: guidePageAnchor('data-and-sync'),
      titleKey: 'guide.dataAndSync.conflicts.title',
      descriptionKey: 'guide.dataAndSync.conflicts.desc',
    },
    {
      id: 'data-import',
      routeId: 'data-and-sync',
      order: 3,
      sectionId: guidePageAnchor('data-and-sync'),
      titleKey: 'guide.dataAndSync.import.title',
      descriptionKey: 'guide.dataAndSync.import.desc',
    },
  ],
  settings: [
    {
      id: 'settings-business',
      routeId: 'settings',
      order: 1,
      sectionId: guidePageAnchor('settings'),
      titleKey: 'guide.settings.business.title',
      descriptionKey: 'guide.settings.business.desc',
    },
    {
      id: 'settings-pages',
      routeId: 'settings',
      order: 2,
      sectionId: guidePageAnchor('settings'),
      titleKey: 'guide.settings.pages.title',
      descriptionKey: 'guide.settings.pages.desc',
    },
    {
      id: 'settings-integrations',
      routeId: 'settings',
      order: 3,
      sectionId: guidePageAnchor('settings'),
      titleKey: 'guide.settings.integrations.title',
      descriptionKey: 'guide.settings.integrations.desc',
    },
  ],
  manufacturing: [
    {
      id: 'manufacturing-formula',
      routeId: 'manufacturing',
      order: 1,
      sectionId: guidePageAnchor('manufacturing'),
      titleKey: 'guide.manufacturing.formula.title',
      descriptionKey: 'guide.manufacturing.formula.desc',
    },
    {
      id: 'manufacturing-produce',
      routeId: 'manufacturing',
      order: 2,
      sectionId: guidePageAnchor('manufacturing'),
      titleKey: 'guide.manufacturing.produce.title',
      descriptionKey: 'guide.manufacturing.produce.desc',
    },
  ],
  assistant: [
    {
      id: 'assistant-ask',
      routeId: 'assistant',
      order: 1,
      sectionId: guidePageAnchor('assistant'),
      titleKey: 'guide.assistant.ask.title',
      descriptionKey: 'guide.assistant.ask.desc',
    },
    {
      id: 'assistant-modes',
      routeId: 'assistant',
      order: 2,
      sectionId: guidePageAnchor('assistant'),
      titleKey: 'guide.assistant.modes.title',
      descriptionKey: 'guide.assistant.modes.desc',
    },
  ],
  billing: [
    {
      id: 'billing-plans',
      routeId: 'billing',
      order: 1,
      sectionId: guidePageAnchor('billing'),
      titleKey: 'guide.billing.plans.title',
      descriptionKey: 'guide.billing.plans.desc',
    },
    {
      id: 'billing-wallet',
      routeId: 'billing',
      order: 2,
      sectionId: guidePageAnchor('billing'),
      titleKey: 'guide.billing.wallet.title',
      descriptionKey: 'guide.billing.wallet.desc',
    },
  ],
}

/**
 * The order the pages are taught in — the sidebar's order. When a page's guide
 * ends, the card offers the next page that still has something unseen, so the
 * guide leads somewhere instead of just stopping (owner request, 8 Nov 2026).
 */
export const GUIDE_TOUR: readonly { routeId: string; path: string; labelKey: string }[] = [
  { routeId: 'dashboard', path: '/dashboard', labelKey: 'nav.today' },
  { routeId: 'invoices', path: '/invoices', labelKey: 'nav.getPaid' },
  { routeId: 'warehouse', path: '/warehouse', labelKey: 'nav.stock' },
  { routeId: 'till', path: '/till', labelKey: 'nav.till' },
  { routeId: 'accounting', path: '/accounting', labelKey: 'nav.money' },
  { routeId: 'customers', path: '/customers', labelKey: 'nav.buyers' },
  { routeId: 'stock-count', path: '/stock-count', labelKey: 'cycleCount.title' },
  { routeId: 'team-and-payroll', path: '/team-and-payroll', labelKey: 'nav.teamPayroll' },
  { routeId: 'analysis', path: '/analysis', labelKey: 'nav.analysis' },
  { routeId: 'manufacturing', path: '/manufacturing', labelKey: 'nav.manufacturing' },
  { routeId: 'assistant', path: '/assistant', labelKey: 'nav.assistant' },
  { routeId: 'data-and-sync', path: '/data-and-sync', labelKey: 'nav.data_and_sync' },
  { routeId: 'settings', path: '/settings', labelKey: 'nav.settings' },
  { routeId: 'billing', path: '/billing', labelKey: 'nav.billing' },
]

/**
 * The next page (after `currentRouteId`, wrapping round) that still has an
 * unseen step, or `null` when every page has been read.
 */
export function nextGuideRoute(
  currentRouteId: string,
  isSeen: (stepId: string) => boolean,
): (typeof GUIDE_TOUR)[number] | null {
  const start = GUIDE_TOUR.findIndex((stop) => stop.routeId === currentRouteId)
  for (let offset = 1; offset <= GUIDE_TOUR.length; offset++) {
    const stop = GUIDE_TOUR[(start + offset + GUIDE_TOUR.length) % GUIDE_TOUR.length]!
    if (stop.routeId === currentRouteId) continue
    const steps = GUIDE_CATALOG[stop.routeId] ?? []
    if (steps.some((step) => !isSeen(step.id))) return stop
  }
  return null
}
