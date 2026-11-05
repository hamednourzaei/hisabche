// ============================================
// packages/ui-contract/src/guide-catalog.ts
// Interactive Guide Content & Route Catalog
// ============================================

export interface GuideStepDefinition {
  id: string
  routeId: string
  order: number
  targetSelector?: string
  titleKey: string
  descriptionKey: string
}

export const GUIDE_CATALOG: Record<string, GuideStepDefinition[]> = {
  dashboard: [
    {
      id: 'dashboard-overview',
      routeId: 'dashboard',
      order: 1,
      titleKey: 'guide.dashboard.overview.title',
      descriptionKey: 'guide.dashboard.overview.desc',
    },
    {
      id: 'dashboard-kpis',
      routeId: 'dashboard',
      order: 2,
      titleKey: 'guide.dashboard.kpis.title',
      descriptionKey: 'guide.dashboard.kpis.desc',
    },
    {
      id: 'dashboard-sales-chart',
      routeId: 'dashboard',
      order: 3,
      titleKey: 'guide.dashboard.chart.title',
      descriptionKey: 'guide.dashboard.chart.desc',
    },
  ],
  invoices: [
    {
      id: 'invoices-list',
      routeId: 'invoices',
      order: 1,
      titleKey: 'guide.invoices.list.title',
      descriptionKey: 'guide.invoices.list.desc',
    },
    {
      id: 'invoices-create-btn',
      routeId: 'invoices',
      order: 2,
      titleKey: 'guide.invoices.new.title',
      descriptionKey: 'guide.invoices.new.desc',
    },
    {
      id: 'invoices-payments',
      routeId: 'invoices',
      order: 3,
      titleKey: 'guide.invoices.payments.title',
      descriptionKey: 'guide.invoices.payments.desc',
    },
  ],
  customers: [
    {
      id: 'customers-overview',
      routeId: 'customers',
      order: 1,
      titleKey: 'guide.customers.overview.title',
      descriptionKey: 'guide.customers.overview.desc',
    },
    {
      id: 'customers-ledger',
      routeId: 'customers',
      order: 2,
      titleKey: 'guide.customers.ledger.title',
      descriptionKey: 'guide.customers.ledger.desc',
    },
  ],
  warehouse: [
    {
      id: 'warehouse-stock',
      routeId: 'warehouse',
      order: 1,
      titleKey: 'guide.warehouse.stock.title',
      descriptionKey: 'guide.warehouse.stock.desc',
    },
    {
      id: 'warehouse-costing',
      routeId: 'warehouse',
      order: 2,
      titleKey: 'guide.warehouse.costing.title',
      descriptionKey: 'guide.warehouse.costing.desc',
    },
  ],
  accounting: [
    {
      id: 'accounting-trial-balance',
      routeId: 'accounting',
      order: 1,
      titleKey: 'guide.accounting.trial.title',
      descriptionKey: 'guide.accounting.trial.desc',
    },
    {
      id: 'accounting-journal',
      routeId: 'accounting',
      order: 2,
      titleKey: 'guide.accounting.journal.title',
      descriptionKey: 'guide.accounting.journal.desc',
    },
  ],
  billing: [
    {
      id: 'billing-plans',
      routeId: 'billing',
      order: 1,
      titleKey: 'guide.billing.plans.title',
      descriptionKey: 'guide.billing.plans.desc',
    },
  ],
}
