import type { ReactNode } from 'react'

export type DashboardComponentId =
  | 'sales'
  | 'receivables'
  | 'inventory'
  | 'cash'
  | 'ai-insights'
  | 'low-stock'
  | 'recent-transactions'

export interface DashboardComponent {
  id: DashboardComponentId
  page: string
  section: string
  label: string
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

// Registry of all dashboard components
export const DashboardRegistry: DashboardComponent[] = [
  {
    id: 'sales',
    page: 'dashboard',
    section: 'overview',
    label: 'فروش',
    defaultVisibility: true,
    required: true,
    order: 1,
    minWidth: 300,
    desktopSupport: 'full',
    mobileSupport: 'full',
    render: () => null, // populated by container
  },
  {
    id: 'receivables',
    page: 'dashboard',
    section: 'overview',
    label: 'الزامات خرده فروشی',
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
    label: 'پیش‌بینی هوش مصنوعی',
    defaultVisibility: false,
    required: false,
    permission: 'report.read',
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
    defaultVisibility: false,
    required: false,
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
    defaultVisibility: true,
    required: false,
    order: 7,
    minWidth: 300,
    desktopSupport: 'full',
    mobileSupport: 'full',
    render: () => null,
  },
]

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
