import type { LucideIcon } from 'lucide-react'
import { Building2, CreditCard, LayoutDashboard, ScrollText, Users } from 'lucide-react'

/**
 * The admin navigation — five destinations, each backed by an endpoint that
 * exists today.
 *
 * DELIBERATELY ABSENT: tickets, reports, settings. There is no
 * `/api/admin/tickets`, no reporting endpoint and no platform-settings
 * endpoint. A nav item whose page can only 404 is worse than no nav item: it
 * tells an operator a capability exists and then wastes their time. When those
 * endpoints land, add the entry here and nowhere else.
 *
 * `titleKey` doubles as the header's page title, so a route can never show a
 * name in the sidebar and a different one in the header.
 */
export interface AdminNavItem {
  id: string
  /** Locale-less path; the locale prefix is added at render time. */
  path: string
  icon: LucideIcon
  /** i18n key, resolved with the root `useTranslations()`. */
  titleKey: string
  /** i18n key for the one-line description under the page title. */
  descriptionKey: string
  /** Endpoint this screen reads, for the reader of this file. */
  endpoint: string
}

export const ADMIN_NAV: readonly AdminNavItem[] = [
  {
    id: 'dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    titleKey: 'admin.dashboard.title',
    descriptionKey: 'admin.dashboard.description',
    endpoint: 'GET /admin/metrics',
  },
  {
    id: 'workspaces',
    path: '/workspaces',
    icon: Building2,
    titleKey: 'admin.workspaces.title',
    descriptionKey: 'admin.workspaces.description',
    endpoint: 'GET /admin/workspaces',
  },
  {
    id: 'users',
    path: '/users',
    icon: Users,
    titleKey: 'admin.users.title',
    descriptionKey: 'admin.users.description',
    endpoint: 'GET /admin/users-search',
  },
  {
    id: 'subscriptions',
    path: '/subscriptions',
    icon: CreditCard,
    titleKey: 'admin.subscriptions.title',
    descriptionKey: 'admin.subscriptions.description',
    endpoint: 'GET /admin/subscriptions',
  },
  {
    id: 'auditLogs',
    path: '/audit-logs',
    icon: ScrollText,
    titleKey: 'admin.auditLogs.title',
    descriptionKey: 'admin.auditLogs.description',
    endpoint: 'GET /admin/audit-logs',
  },
] as const

/** The locale segment of an admin pathname, defaulting to Persian. */
export function localeOf(pathname: string): string {
  const first = pathname.split('/').filter(Boolean)[0]
  return first === 'en' || first === 'af' ? first : 'fa'
}

/** The path with its locale prefix stripped, e.g. `/fa/workspaces` → `/workspaces`. */
export function routeOf(pathname: string): string {
  return pathname.replace(/^\/(fa|af|en)(?=\/|$)/, '') || '/'
}

export function activeNavItem(pathname: string): AdminNavItem | undefined {
  const route = routeOf(pathname)
  return ADMIN_NAV.find((item) => route === item.path || route.startsWith(`${item.path}/`))
}
