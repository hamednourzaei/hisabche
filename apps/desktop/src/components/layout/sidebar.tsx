// ============================================
// Sidebar — the canonical web sidebar, mounted in Electron.
//
// This was a 350-line private reimplementation: it read the same navigation
// contract, but drew its own rows, its own active state, its own «بیشتر»
// group and its own collapse behaviour. Two renderings of one menu, drifting
// apart every time either side was touched.
//
// `DashboardSidebar` is entirely prop-driven — its only Next dependency is
// `next-intl`, which this app already shims — so desktop mounts the same
// component the browser renders. What stays here is the platform wiring:
// react-router for navigation and `DESKTOP_ROUTES` for which destinations this
// build actually serves.
// ============================================

import React, { useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslations } from 'next-intl'
import { DashboardSidebar } from '@hisabche/ui'
import { MORE_GROUPS, MORE_ICON, PRIMARY_ITEMS } from '@hisabche/ui/menu'

/**
 * Destinations this build serves.
 *
 * The navigation contract describes the whole product; desktop has not built
 * every screen yet. Filtering here rather than trimming the contract keeps one
 * document describing every platform, and stops the sidebar offering a route
 * the router would bounce to the dashboard.
 */
const DESKTOP_ROUTES = new Set([
  '/dashboard',
  '/invoices/new',
  '/invoices',
  '/warehouse',
  '/purchasing',
  '/accounting',
  '/customers',
  '/settings',
  '/activities',
  '/sync-center',
])

export function Sidebar() {
  // Labels are resolved here exactly as the web dashboard layout resolves them —
  // the canonical sidebar takes rendered strings, not keys.
  const t = useTranslations()
  const navigate = useNavigate()
  const location = useLocation()

  const primaryItems = useMemo(
    () =>
      PRIMARY_ITEMS.filter((item) => DESKTOP_ROUTES.has(item.path)).map((item) => ({
        id: item.id,
        icon: item.icon,
        label: t(item.labelKey),
        path: item.path,
      })),
    [t],
  )

  const moreGroups = useMemo(
    () =>
      MORE_GROUPS.map((group) => ({
        id: group.id,
        icon: group.icon,
        label: t(group.labelKey),
        items: group.items
          .filter((item) => DESKTOP_ROUTES.has(item.path))
          .map((item) => ({
            id: item.id,
            icon: item.icon,
            label: t(item.labelKey),
            path: item.path,
          })),
      })).filter((group) => group.items.length > 0),
    [t],
  )

  // `/` is the dashboard route on desktop; the contract calls it `/dashboard`.
  const activePath = location.pathname === '/' ? '/dashboard' : location.pathname

  // ⚠️ THE SIDEBAR WANTS A PATH, NOT AN ID.
  //
  // This used to resolve the matching nav entry and pass `match.id`, but
  // `DashboardSidebar` feeds `activeNav` straight into `isPathActive(activeNav,
  // item.path)` — so it was comparing `'today'` against `'/dashboard'`, which
  // never matches. The desktop sidebar has had NO active item on any page,
  // silently, because a string was a string and nothing failed.
  //
  // The lookup itself was doing the same prefix comparison the sidebar already
  // does, so it is gone rather than corrected.
  const activeNav = activePath

  // SPA navigation — never a renderer reload.
  const handleNavigate = useCallback(
    (_id: string, path: string) => navigate(path === '/dashboard' ? '/' : path),
    [navigate],
  )

  return (
    <DashboardSidebar
      primaryItems={primaryItems}
      moreGroups={moreGroups}
      moreIcon={MORE_ICON}
      activeNav={activeNav}
      onNavigate={handleNavigate}
    />
  )
}
