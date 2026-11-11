import type { ReactNode } from 'react'
import {
  CAPABILITIES,
  GENERIC_TERMINOLOGY,
  resolveTerminologyProfile,
  type CapabilityKey,
  type CapabilityStatus,
  type OperationalDna,
  type TerminologyProfile,
} from '@hisabche/validation'
import { isNavLocked } from '@hisabche/ui-contract'

export type DashboardComponentId =
  | 'sales'
  | 'receivables'
  | 'inventory'
  | 'cash'
  | 'ai-insights'
  | 'low-stock'
  | 'recent-transactions'

export type StartScreenRole =
  | 'owner'
  | 'branch_manager'
  | 'cashier'
  | 'storekeeper'
  | 'salon_reception'
  | 'stylist'
  | 'exchange_dealer'
  | 'repair_technician'
  | 'accountant'

export interface RoleWidgetItem {
  readonly id: string
  readonly labelKey: string
  readonly destination: string
  readonly requiredCapability: string | null
}

export interface RoleStartScreenResolution {
  readonly role: StartScreenRole
  readonly widgets: readonly RoleWidgetItem[]
  readonly partOrder: readonly string[]
  readonly setupGaps: readonly string[]
  readonly terminology: TerminologyProfile
}

export interface DashboardComponent {
  id: DashboardComponentId
  page: string
  section: string
  label: string
  labelKey: string
  defaultVisibility: boolean
  required: boolean
  permission?: string
  dependencies?: string[]
  mobileSupport: 'full' | 'partial' | 'none'
  desktopSupport: 'full' | 'partial' | 'none'
  order: number
  minWidth: number
  /** Render function returns ReactNode for the widget */
  render: (ctx: { workspaceId: string; onCustomize: () => void }) => ReactNode
}

// Registry of all dashboard components (W1/W4: neutral keys, no retail-assumed labels)
export const DashboardRegistry: DashboardComponent[] = [
  {
    id: 'sales',
    page: 'dashboard',
    section: 'overview',
    label: 'فروش و عملیات',
    labelKey: 'dashboard.cards.operations',
    defaultVisibility: true,
    required: true,
    order: 1,
    minWidth: 300,
    desktopSupport: 'full',
    mobileSupport: 'full',
    render: () => null,
  },
  {
    id: 'receivables',
    page: 'dashboard',
    section: 'overview',
    label: 'دریافتنی‌ها',
    labelKey: 'dashboard.cards.receivables',
    defaultVisibility: true,
    required: true,
    order: 2,
    minWidth: 300,
    desktopSupport: 'full',
    mobileSupport: 'full',
    render: () => null,
  },
  {
    id: 'inventory',
    page: 'dashboard',
    section: 'overview',
    label: 'موجودی',
    labelKey: 'dashboard.cards.inventory',
    defaultVisibility: true,
    required: true,
    order: 3,
    minWidth: 300,
    desktopSupport: 'full',
    mobileSupport: 'full',
    render: () => null,
  },
  {
    id: 'cash',
    page: 'dashboard',
    section: 'overview',
    label: 'صندوق',
    labelKey: 'dashboard.cards.cash',
    defaultVisibility: true,
    required: true,
    order: 4,
    minWidth: 300,
    desktopSupport: 'full',
    mobileSupport: 'full',
    render: () => null,
  },
  {
    id: 'ai-insights',
    page: 'dashboard',
    section: 'ai',
    label: 'پیشنهادهای هوشمند',
    labelKey: 'pageLook.dashboard.insights',
    defaultVisibility: false,
    required: false,
    permission: 'report.operational.read',
    order: 5,
    minWidth: 300,
    desktopSupport: 'full',
    mobileSupport: 'partial',
    render: () => null,
  },
  {
    id: 'low-stock',
    page: 'dashboard',
    section: 'alerts',
    label: 'کالاهای کم موجودی',
    labelKey: 'dashboard.cards.lowStock',
    defaultVisibility: false,
    required: false,
    permission: 'inventory.read',
    order: 6,
    minWidth: 300,
    desktopSupport: 'full',
    mobileSupport: 'full',
    render: () => null,
  },
  {
    id: 'recent-transactions',
    page: 'dashboard',
    section: 'overview',
    label: 'تراکنش‌های اخیر',
    labelKey: 'pageLook.dashboard.activities',
    defaultVisibility: true,
    required: false,
    order: 7,
    minWidth: 300,
    desktopSupport: 'full',
    mobileSupport: 'full',
    render: () => null,
  },
]

const ROLE_WIDGETS: Readonly<Record<StartScreenRole, readonly RoleWidgetItem[]>> = {
  owner: [
    {
      id: 'today-kpis',
      labelKey: 'dashboard.roles.ownerKpis',
      destination: '/accounting?tab=reports',
      requiredCapability: 'report.financial.read',
    },
    {
      id: 'work-queue',
      labelKey: 'dashboard.roles.workQueue',
      destination: '/approvals',
      requiredCapability: null,
    },
  ],
  branch_manager: [
    {
      id: 'branch-ops',
      labelKey: 'dashboard.roles.branchOps',
      destination: '/invoices',
      requiredCapability: 'invoice.read',
    },
    {
      id: 'branch-stock',
      labelKey: 'dashboard.roles.branchStock',
      destination: '/warehouse',
      requiredCapability: 'inventory.read',
    },
  ],
  cashier: [
    {
      id: 'new-doc',
      labelKey: 'dashboard.roles.newDocument',
      destination: '/invoices/new',
      requiredCapability: 'invoice.create',
    },
    {
      id: 'open-till',
      labelKey: 'dashboard.roles.openTill',
      destination: '/till',
      requiredCapability: 'payment.read',
    },
    {
      id: 'today-receipts',
      labelKey: 'dashboard.roles.todayReceipts',
      destination: '/invoices',
      requiredCapability: 'invoice.read',
    },
  ],
  storekeeper: [
    {
      id: 'warehouses',
      labelKey: 'dashboard.roles.warehouses',
      destination: '/warehouse',
      requiredCapability: 'inventory.read',
    },
    {
      id: 'transfers',
      labelKey: 'dashboard.roles.transfers',
      destination: '/warehouse?view=transfers',
      requiredCapability: 'inventory.read',
    },
    {
      id: 'holds',
      labelKey: 'dashboard.roles.holds',
      destination: '/warehouse?view=holds',
      requiredCapability: 'inventory.read',
    },
  ],
  salon_reception: [
    {
      id: 'salon-calendar',
      labelKey: 'dashboard.roles.salonCalendar',
      destination: '/customers?tab=sessions',
      requiredCapability: 'invoice.read',
    },
    {
      id: 'salon-checkin',
      labelKey: 'dashboard.roles.salonCheckIn',
      destination: '/customers?tab=sessions',
      requiredCapability: 'invoice.create',
    },
    {
      id: 'client-history',
      labelKey: 'dashboard.roles.clientHistory',
      destination: '/customers',
      requiredCapability: 'customer.read',
    },
    {
      id: 'deposits',
      labelKey: 'dashboard.roles.deposits',
      destination: '/invoices',
      requiredCapability: 'payment.read',
    },
  ],
  stylist: [
    {
      id: 'my-sessions',
      labelKey: 'dashboard.roles.mySessions',
      destination: '/customers?tab=sessions',
      requiredCapability: 'invoice.read',
    },
    {
      id: 'my-commission',
      labelKey: 'dashboard.roles.myCommission',
      destination: '/customers?tab=sessions&view=commission',
      requiredCapability: 'payroll.read',
    },
  ],
  exchange_dealer: [
    {
      id: 'fx-rates',
      labelKey: 'dashboard.roles.fxRates',
      destination: '/till?tab=exchange&view=rates',
      requiredCapability: 'payment.read',
    },
    {
      id: 'fx-positions',
      labelKey: 'dashboard.roles.fxPositions',
      destination: '/till?tab=exchange&view=positions',
      requiredCapability: 'payment.read',
    },
    {
      id: 'fx-remittances',
      labelKey: 'dashboard.roles.fxRemittances',
      destination: '/till?tab=exchange&view=remittances',
      requiredCapability: 'payment.read',
    },
    {
      id: 'fx-trades',
      labelKey: 'dashboard.roles.fxTrades',
      destination: '/till?tab=exchange&view=trades',
      requiredCapability: 'payment.record',
    },
  ],
  repair_technician: [
    {
      id: 'repair-assigned',
      labelKey: 'dashboard.roles.repairAssigned',
      destination: '/customers?tab=sessions&view=repairs',
      requiredCapability: 'invoice.read',
    },
    {
      id: 'repair-parts',
      labelKey: 'dashboard.roles.repairParts',
      destination: '/warehouse?view=holds',
      requiredCapability: 'inventory.read',
    },
  ],
  accountant: [
    {
      id: 'ledger',
      labelKey: 'dashboard.roles.ledger',
      destination: '/accounting',
      requiredCapability: 'ledger.read',
    },
    {
      id: 'reports',
      labelKey: 'dashboard.roles.financialReports',
      destination: '/accounting?tab=reports',
      requiredCapability: 'report.financial.read',
    },
  ],
}

/**
 * Resolves role start screen widgets and widget order purely from:
 *   1) server-granted permissions & module locks (NEVER inferred from role label)
 *   2) workspace Operational DNA (UNRESOLVED returns neutral setup-gap prompts, never retail)
 */
export function resolveRoleStartScreen(input: {
  role: StartScreenRole
  dna: OperationalDna | null | undefined
  tradeKey?: string | null | undefined
  can: (capability: string) => boolean
  blockedModules?: readonly string[]
}): RoleStartScreenResolution {
  const blocked = input.blockedModules ?? []
  const setupGaps: string[] = []
  if (!input.dna || input.dna.offering.includes('UNRESOLVED')) {
    setupGaps.push('OFFERING_UNRESOLVED')
  }
  if (!input.dna || input.dna.inventory.includes('UNRESOLVED')) {
    setupGaps.push('INVENTORY_UNRESOLVED')
  }
  if (!input.dna || input.dna.workforce.includes('UNRESOLVED')) {
    setupGaps.push('WORKFORCE_UNRESOLVED')
  }

  const widgets = (ROLE_WIDGETS[input.role] ?? ROLE_WIDGETS.owner).filter((widget) => {
    const basePath = `/${(widget.destination.split('?')[0] ?? '').split('/').filter(Boolean)[0] ?? ''}`
    if (isNavLocked(basePath, blocked)) return false
    if (widget.requiredCapability && !input.can(widget.requiredCapability)) return false
    // Inventory widgets require non-NONE & non-UNRESOLVED inventory when DNA exists
    if (
      input.dna &&
      (widget.id === 'warehouses' || widget.id === 'transfers' || widget.id === 'holds') &&
      (input.dna.inventory.includes('NONE') || input.dna.inventory.includes('UNRESOLVED'))
    ) {
      return false
    }
    return true
  })

  const partOrder =
    input.dna?.presentation?.dashboard?.partOrder &&
    input.dna.presentation.dashboard.partOrder.length > 0
      ? input.dna.presentation.dashboard.partOrder
      : ['kpis', 'workQueue', 'chart', 'insights', 'activities', 'manufacturing']

  const terminology = input.dna
    ? resolveTerminologyProfile(input.dna, input.tradeKey)
    : GENERIC_TERMINOLOGY

  return {
    role: input.role,
    widgets,
    partOrder,
    setupGaps,
    terminology,
  }
}

export function resolveDashboardComponentLabel(
  component: DashboardComponent,
  dna: OperationalDna | null | undefined,
  t: (key: string, fallback?: string) => string,
  tradeKey?: string | null,
): string {
  const terminology = dna ? resolveTerminologyProfile(dna, tradeKey) : GENERIC_TERMINOLOGY
  if (component.id === 'sales') {
    return t(terminology.transactionLabelKey, t(component.labelKey, component.label))
  }
  if (component.id === 'inventory') {
    return t(terminology.inventoryLabelKey, t(component.labelKey, component.label))
  }
  return t(component.labelKey, component.label)
}

// Helper to get visible components with user preferences applied
export function getVisibleComponents(
  userPreferences: { hiddenIds: Set<string>; reorderedIds: string[] } | null,
  authorization: { can: (permission: string) => boolean },
): DashboardComponent[] {
  const hidden = userPreferences?.hiddenIds ?? new Set()
  const order = userPreferences?.reorderedIds.length ? userPreferences.reorderedIds : null

  return DashboardRegistry.filter((comp) => {
    if (comp.required && hidden.has(comp.id)) return false
    if (hidden.has(comp.id)) return false
    if (comp.permission && !authorization.can(comp.permission)) return false
    return true
  }).sort((a, b) => {
    if (!order) return a.order - b.order
    const aIdx = order.indexOf(a.id)
    const bIdx = order.indexOf(b.id)
    if (aIdx === -1 && bIdx === -1) return a.order - b.order
    if (aIdx === -1) return 1
    if (bIdx === -1) return -1
    return aIdx - bIdx
  })
}

// ─── V60 Slice 12: Owner Command Center Alerts ───────────────────────────────

export type CommandAlertId =
  | 'cash_forecast'
  | 'late_payers'
  | 'stock_out_risk'
  | 'capacity_utilization'
  | 'projects_over_budget'
  | 'contracts_due'
  | 'procurement_mismatches'
  | 'open_quality_failures'

export interface CommandCenterAlertSpec {
  readonly id: CommandAlertId
  readonly reasonCode: string
  readonly labelKey: string
  readonly capability: CapabilityKey
  readonly requiredPermission: string
  readonly figureGroup: 'sales' | 'customers' | 'stock' | 'stockValue' | null
  readonly href: string
  /** Monetary alerts are stripped whenever dashboard visibility hides their group. */
  readonly exposesMoney: boolean
}

export const COMMAND_CENTER_ALERTS: readonly CommandCenterAlertSpec[] = [
  {
    id: 'cash_forecast',
    reasonCode: 'CASH_FORECAST_RISK',
    labelKey: 'dashboard.commandCenter.cashForecast',
    capability: 'owner_forecast',
    requiredPermission: 'report.financial.read',
    figureGroup: 'sales',
    href: '/warehouse?view=cash',
    exposesMoney: true,
  },
  {
    id: 'late_payers',
    reasonCode: 'LATE_PAYERS_DELAY',
    labelKey: 'dashboard.commandCenter.latePayers',
    capability: 'owner_forecast',
    requiredPermission: 'customer.read',
    figureGroup: 'customers',
    href: '/customers',
    exposesMoney: true,
  },
  {
    id: 'stock_out_risk',
    reasonCode: 'STOCK_OUT_RISK',
    labelKey: 'dashboard.commandCenter.stockOutRisk',
    capability: 'procurement_planning',
    requiredPermission: 'inventory.read',
    figureGroup: 'stock',
    href: '/warehouse?view=reorder',
    exposesMoney: false,
  },
  {
    id: 'capacity_utilization',
    reasonCode: 'CAPACITY_UTILIZATION',
    labelKey: 'dashboard.commandCenter.capacityUtilization',
    capability: 'resource_capacity',
    requiredPermission: 'invoice.read',
    figureGroup: null,
    href: '/customers?tab=sessions',
    exposesMoney: false,
  },
  {
    id: 'projects_over_budget',
    reasonCode: 'PROJECTS_OVER_BUDGET',
    labelKey: 'dashboard.commandCenter.projectsOverBudget',
    capability: 'project_costing',
    requiredPermission: 'report.operational.read',
    figureGroup: 'sales',
    href: '/timesheets',
    exposesMoney: true,
  },
  {
    id: 'contracts_due',
    reasonCode: 'CONTRACTS_DUE',
    labelKey: 'dashboard.commandCenter.contractsDue',
    capability: 'contracts_recurring',
    requiredPermission: 'invoice.read',
    figureGroup: 'sales',
    href: '/customers',
    exposesMoney: true,
  },
  {
    id: 'procurement_mismatches',
    reasonCode: 'PROCUREMENT_MATCH_MISMATCH',
    labelKey: 'dashboard.commandCenter.procurementMismatches',
    capability: 'three_way_match',
    requiredPermission: 'purchase.read',
    figureGroup: 'stock',
    href: '/warehouse?view=reorder',
    exposesMoney: true,
  },
  {
    id: 'open_quality_failures',
    reasonCode: 'OPEN_QUALITY_FAILURES',
    labelKey: 'dashboard.commandCenter.openQualityFailures',
    capability: 'quality_inspection',
    requiredPermission: 'inventory.read',
    figureGroup: 'stock',
    href: '/warehouse',
    exposesMoney: false,
  },
]

export interface CommandCenterMetricValue {
  readonly status: 'ok' | 'unknown' | 'insufficient_data'
  readonly primaryNumber: number | null
  readonly unit?: string | undefined
}

export interface ResolvedCommandCenterAlert extends CommandCenterAlertSpec {
  readonly metric: CommandCenterMetricValue
}

/**
 * Only returns alerts whose:
 *   1. backing capability status is strictly `'available'`
 *   2. user role holds `requiredPermission`
 *   3. `figureGroup` is NOT hidden in `hiddenFigureGroups`
 *   4. destination nav path is NOT blocked
 */
export function resolveCommandCenterAlerts(input: {
  readonly can: (permission: string) => boolean
  readonly hiddenFigureGroups?: readonly string[]
  readonly blockedModules?: readonly string[]
  readonly statusOverrides?: Partial<Record<CapabilityKey, CapabilityStatus>>
  readonly metrics?: Partial<Record<CommandAlertId, CommandCenterMetricValue>>
}): ResolvedCommandCenterAlert[] {
  const hiddenGroups = new Set(input.hiddenFigureGroups ?? [])
  const blocked = input.blockedModules ?? []

  return COMMAND_CENTER_ALERTS.filter((alert) => {
    const capStatus =
      input.statusOverrides?.[alert.capability] ?? CAPABILITIES[alert.capability].status
    if (capStatus !== 'available') return false
    if (!input.can(alert.requiredPermission)) return false
    if (alert.figureGroup && hiddenGroups.has(alert.figureGroup)) return false
    const basePath = `/${(alert.href.split('?')[0] ?? '').split('/').filter(Boolean)[0] ?? ''}`
    if (isNavLocked(basePath, blocked)) return false
    return true
  }).map((alert) => ({
    ...alert,
    metric: input.metrics?.[alert.id] ?? { status: 'unknown', primaryNumber: null },
  }))
}
