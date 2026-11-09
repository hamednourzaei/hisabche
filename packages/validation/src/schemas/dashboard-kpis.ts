// ============================================
// The dashboard's own KPI choice (owner request, 9 Nov 2026).
//
// The dashboard draws its fixed cards plus up to FOUR the person picks from
// figures that already exist on other pages — no new KPI is invented here.
// The choice is the person's, per workspace, and lives in the database
// (user-dashboard-kpis-01): «the backend is only a step».
//
// One list for the server (it refuses an id that is not here) and the client
// (the picker and the card that draws each one).
// ============================================

import { z } from 'zod'

export const MAX_CUSTOM_DASHBOARD_KPIS = 4

export const DASHBOARD_KPI_CATEGORIES = [
  'sales',
  'purchases',
  'advances',
  'people',
  'stock',
] as const
export type DashboardKpiCategory = (typeof DASHBOARD_KPI_CATEGORIES)[number]

export const DASHBOARD_KPIS = [
  { id: 'sales.total', category: 'sales' },
  { id: 'sales.pending', category: 'sales' },
  { id: 'sales.paid', category: 'sales' },
  { id: 'sales.count', category: 'sales' },
  { id: 'purchases.total', category: 'purchases' },
  { id: 'purchases.pending', category: 'purchases' },
  { id: 'purchases.count', category: 'purchases' },
  { id: 'advances.preSaleRemaining', category: 'advances' },
  { id: 'advances.prePurchaseRemaining', category: 'advances' },
  { id: 'customers.count', category: 'people' },
  { id: 'products.count', category: 'stock' },
] as const satisfies readonly { id: string; category: DashboardKpiCategory }[]

export type DashboardKpiId = (typeof DASHBOARD_KPIS)[number]['id']

export const DASHBOARD_KPI_IDS = DASHBOARD_KPIS.map((kpi) => kpi.id) as [
  DashboardKpiId,
  ...DashboardKpiId[],
]

export const dashboardKpiChoiceSchema = z
  .object({
    kpis: z
      .array(z.enum(DASHBOARD_KPI_IDS))
      .max(MAX_CUSTOM_DASHBOARD_KPIS)
      .refine((ids) => new Set(ids).size === ids.length, { message: 'DASHBOARD_KPI_DUPLICATE' }),
  })
  .strict()

export type DashboardKpiChoiceInput = z.infer<typeof dashboardKpiChoiceSchema>
