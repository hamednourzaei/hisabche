import type { LucideIcon } from 'lucide-react'
import {
  AppWindow,
  Building2,
  CreditCard,
  LayoutDashboard,
  Newspaper,
  ScrollText,
  Server,
  Sparkles,
  Users,
} from 'lucide-react'

/**
 * The admin navigation — every destination backed by an endpoint that
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
    // Added in T13, when `GET/PUT /ai/config` landed. The rule in this file is
    // that an entry appears only once its endpoint exists — see above.
    id: 'ai',
    path: '/ai',
    icon: Sparkles,
    titleKey: 'admin.ai.title',
    descriptionKey: 'admin.ai.description',
    endpoint: 'GET /ai/config',
  },
  {
    // Added with the blog (26 Sep 2026): every /admin/blog/* route exists in
    // backend/src/routes/blog.routes.ts, behind platformAdminGuard.
    id: 'blog',
    path: '/blog',
    icon: Newspaper,
    titleKey: 'admin.blog.title',
    descriptionKey: 'admin.blog.description',
    endpoint: 'GET /admin/blog/posts',
  },
  {
    // Added with OAuth apps (developer platform 05): both /admin/oauth-apps
    // routes exist in backend/src/routes/oauth.routes.ts, behind platformAdminGuard.
    id: 'oauthApps',
    path: '/oauth-apps',
    icon: AppWindow,
    titleKey: 'admin.oauthApps.title',
    descriptionKey: 'admin.oauthApps.description',
    endpoint: 'GET /admin/oauth-apps',
  },
  {
    id: 'servers',
    path: '/servers',
    icon: Server,
    titleKey: 'admin.servers.title',
    descriptionKey: 'admin.servers.description',
    endpoint: 'GET /admin/instances',
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
