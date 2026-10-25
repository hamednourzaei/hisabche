import type { LucideIcon } from 'lucide-react'
import {
  CreditCard,
  LayoutDashboard,
  Newspaper,
  Server,
  ShieldCheck,
  Sparkles,
  Users,
  WifiOff,
} from 'lucide-react'

/**
 * The 8 hubs of the Admin Console:
 * 1. داشبورد (Dashboard)
 * 2. مشتریان (Customers)
 * 3. درآمد (Revenue)
 * 4. آفلاین (Offline)
 * 5. محصول (Product)
 * 6. عملیات (Operations)
 * 7. محتوا (Content)
 * 8. امنیت (Security)
 *
 * Each hub consolidates related domains behind `HubTabs` + `?tab=`.
 * Old URLs redirect to their respective hub and tab.
 *
 * The 8 ids and their order are a guard-tested contract
 * (`src/__tests__/hubs-and-redirects.test.ts`). This file may gain metadata,
 * never a ninth hub without the owner's approval.
 */

/** Sidebar grouping. The ids and order above stay untouched. */
export type AdminNavGroup = 'overview' | 'customers' | 'platform' | 'governance'

export interface AdminNavGroupItem {
  id: AdminNavGroup
  labelKey: string
}

export const ADMIN_NAV_GROUPS: readonly AdminNavGroupItem[] = [
  { id: 'overview', labelKey: 'admin.navGroup.overview' },
  { id: 'customers', labelKey: 'admin.navGroup.customers' },
  { id: 'platform', labelKey: 'admin.navGroup.platform' },
  { id: 'governance', labelKey: 'admin.navGroup.governance' },
] as const

export interface AdminNavItem {
  id: string
  /** Locale-less path; the locale prefix is added at render time. */
  path: string
  icon: LucideIcon
  /** i18n key, resolved with the root `useTranslations()`. */
  titleKey: string
  /** i18n key for the one-line description under the page title. */
  descriptionKey: string
  /** Primary endpoint read by this hub. */
  endpoint: string
  /** Sidebar group. */
  group: AdminNavGroup
  /**
   * The tab the command palette opens. Every value is a real tab in the
   * corresponding client (`*_TABS`). The first tab is included on purpose:
   * `useHubTab` accepts an explicit first tab, so the palette needs no
   * special case for it.
   */
  defaultTab: string
}

export const ADMIN_NAV: readonly AdminNavItem[] = [
  {
    id: 'dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    titleKey: 'admin.nav.dashboard',
    descriptionKey: 'admin.nav.dashboardDesc',
    endpoint: 'GET /admin/metrics',
    group: 'overview',
    defaultTab: 'overview',
  },
  {
    id: 'customers',
    path: '/customers',
    icon: Users,
    titleKey: 'admin.nav.customers',
    descriptionKey: 'admin.nav.customersDesc',
    endpoint: 'GET /admin/workspaces',
    group: 'customers',
    defaultTab: 'workspaces',
  },
  {
    id: 'revenue',
    path: '/revenue',
    icon: CreditCard,
    titleKey: 'admin.nav.revenue',
    descriptionKey: 'admin.nav.revenueDesc',
    endpoint: 'GET /admin/subscriptions',
    group: 'customers',
    defaultTab: 'subscriptions',
  },
  {
    id: 'offline',
    path: '/offline',
    icon: WifiOff,
    titleKey: 'admin.nav.offline',
    descriptionKey: 'admin.nav.offlineDesc',
    endpoint: 'GET /admin/offline/licences',
    group: 'platform',
    defaultTab: 'licences',
  },
  {
    id: 'product',
    path: '/product',
    icon: Sparkles,
    titleKey: 'admin.nav.product',
    descriptionKey: 'admin.nav.productDesc',
    endpoint: 'GET /ai/config',
    group: 'platform',
    defaultTab: 'features',
  },
  {
    id: 'operations',
    path: '/operations',
    icon: Server,
    titleKey: 'admin.nav.operations',
    descriptionKey: 'admin.nav.operationsDesc',
    endpoint: 'GET /admin/instances',
    group: 'platform',
    defaultTab: 'health',
  },
  {
    id: 'content',
    path: '/content',
    icon: Newspaper,
    titleKey: 'admin.nav.content',
    descriptionKey: 'admin.nav.contentDesc',
    endpoint: 'GET /admin/blog/posts',
    group: 'governance',
    defaultTab: 'blog',
  },
  {
    id: 'security',
    path: '/security',
    icon: ShieldCheck,
    titleKey: 'admin.nav.security',
    descriptionKey: 'admin.nav.securityDesc',
    endpoint: 'GET /admin/audit-logs',
    group: 'governance',
    defaultTab: 'audit',
  },
] as const

const ROUTE_HUB_MAP: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/customers': 'customers',
  '/workspaces': 'customers',
  '/users': 'customers',
  '/revenue': 'revenue',
  '/subscriptions': 'revenue',
  '/wallet': 'revenue',
  '/offline': 'offline',
  '/product': 'product',
  '/ai': 'product',
  '/oauth-apps': 'product',
  '/market': 'product',
  '/operations': 'operations',
  '/servers': 'operations',
  '/content': 'content',
  '/blog': 'content',
  // CMS pages are reached by URL today; without this entry the header lost its
  // hub title and no rail item was active (HC-NAV-03).
  '/cms': 'content',
  '/security': 'security',
  '/audit-logs': 'security',
}

/** The three locales the console renders. */
export type AdminLocale = 'fa' | 'af' | 'en'

/** The locale segment of an admin pathname, defaulting to Persian. */
export function localeOf(pathname: string): AdminLocale {
  const first = pathname.split('/').filter(Boolean)[0]
  return first === 'en' || first === 'af' ? first : 'fa'
}

/** The path with its locale prefix stripped, e.g. `/fa/workspaces` → `/workspaces`. */
export function routeOf(pathname: string): string {
  return pathname.replace(/^\/(fa|af|en)(?=\/|$)/, '') || '/'
}

export function activeNavItem(pathname: string): AdminNavItem | undefined {
  const route = routeOf(pathname)
  const matchKey = Object.keys(ROUTE_HUB_MAP).find((k) => route === k || route.startsWith(`${k}/`))
  const hubId = matchKey ? ROUTE_HUB_MAP[matchKey] : undefined
  if (hubId) {
    return ADMIN_NAV.find((item) => item.id === hubId)
  }
  return ADMIN_NAV.find((item) => route === item.path || route.startsWith(`${item.path}/`))
}
