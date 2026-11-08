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
      id: 'dashboard-sales-chart',
      routeId: 'dashboard',
      order: 3,
      sectionId: 'dashboard-chart',
      titleKey: 'guide.dashboard.chart.title',
      descriptionKey: 'guide.dashboard.chart.desc',
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
      id: 'invoices-filters',
      routeId: 'invoices',
      order: 3,
      sectionId: 'invoices-filters',
      titleKey: 'guide.invoices.filters.title',
      descriptionKey: 'guide.invoices.filters.desc',
    },
  ],
  customers: [
    {
      id: 'customers-overview',
      routeId: 'customers',
      order: 1,
      sectionId: 'customers-page',
      titleKey: 'guide.customers.overview.title',
      descriptionKey: 'guide.customers.overview.desc',
    },
    {
      id: 'customers-ledger',
      routeId: 'customers',
      order: 2,
      sectionId: 'customers-page',
      titleKey: 'guide.customers.ledger.title',
      descriptionKey: 'guide.customers.ledger.desc',
    },
  ],
  warehouse: [
    {
      id: 'warehouse-stock',
      routeId: 'warehouse',
      order: 1,
      sectionId: 'warehouse-page',
      titleKey: 'guide.warehouse.stock.title',
      descriptionKey: 'guide.warehouse.stock.desc',
    },
    {
      id: 'warehouse-costing',
      routeId: 'warehouse',
      order: 2,
      sectionId: 'warehouse-page',
      titleKey: 'guide.warehouse.costing.title',
      descriptionKey: 'guide.warehouse.costing.desc',
    },
  ],
  accounting: [
    {
      id: 'accounting-trial-balance',
      routeId: 'accounting',
      order: 1,
      sectionId: 'accounting-page',
      titleKey: 'guide.accounting.trial.title',
      descriptionKey: 'guide.accounting.trial.desc',
    },
    {
      id: 'accounting-journal',
      routeId: 'accounting',
      order: 2,
      sectionId: 'accounting-page',
      titleKey: 'guide.accounting.journal.title',
      descriptionKey: 'guide.accounting.journal.desc',
    },
  ],
  billing: [
    {
      id: 'billing-plans',
      routeId: 'billing',
      order: 1,
      sectionId: 'billing-page',
      titleKey: 'guide.billing.plans.title',
      descriptionKey: 'guide.billing.plans.desc',
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
  { routeId: 'accounting', path: '/accounting', labelKey: 'nav.money' },
  { routeId: 'customers', path: '/customers', labelKey: 'nav.buyers' },
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
