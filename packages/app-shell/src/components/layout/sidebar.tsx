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
import { BottomNav, DashboardSidebar } from '@hisabche/ui'
import { MORE_GROUPS, MORE_ICON, PRIMARY_ITEMS } from '@hisabche/ui/menu'

import { useUiStore } from '@/shared/stores/ui.store'

/**
 * Destinations this build serves.
 *
 * The navigation contract describes the whole product; desktop has not always
 * built every screen. Filtering here rather than trimming the contract keeps
 * one document describing every platform, and stops the sidebar offering a
 * route the router would bounce to the dashboard.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ THIS LIST HELD TEN PATHS WHILE THE ROUTER SERVED ALL THIRTY-ONE.
 *
 * It was written when desktop really did have a handful of screens, and the
 * screens kept being added to `app.tsx` without anyone coming back here. So
 * twenty destinations that WORK — approvals, the till, banking, budgets,
 * payroll, manufacturing, governance, every workspace view — were simply
 * absent from the desktop menu. The only way to reach them was to type the
 * hash URL.
 *
 * Nothing failed. A menu that is missing entries looks exactly like a menu.
 *
 * `desktop-routes.test.ts` now reads the router and fails when the two
 * disagree in either direction: a path listed here that is not routed, and a
 * routed destination that is not listed.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const DESKTOP_ROUTES = new Set([
  // ─── daily ───
  '/dashboard',
  '/invoices',
  '/warehouse',
  '/accounting',
  '/till',
  // ─── people ───
  '/customers',
  '/tasks',
  '/team-and-payroll',
  // ─── work ───
  '/approvals',
  '/expiry',
  '/budgets',
  '/timesheets',
  '/assets',
  '/bank',
  '/accounting-workspace',
  '/sales-workspace',
  '/inventory-workspace',
  '/people-workspace',
  '/manufacturing',
  '/purchasing',
  '/workflow-templates',
  // ─── system ───
  '/settings',
  '/activities',
  '/sync-center',
  '/conflicts',
  '/data-and-sync',
  '/data-migration',
  '/billing',
  '/governance',
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

  // ⚠️ THE STORE ALREADY HELD `sidebarCollapsed`, PERSISTED, AND NOTHING READ
  // IT. The desktop sidebar had no collapse control at all, so the flag was
  // written by nobody and obeyed by nobody — it survived only because a
  // persisted boolean that is never read costs nothing and fails nothing. The
  // toggle now lives in the header, matching web.
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const expand = useCallback(() => useUiStore.getState().setSidebarCollapsed(false), [])

  const openSettings = useCallback(() => navigate('/settings'), [navigate])

  // SPA navigation — never a renderer reload.
  const handleNavigate = useCallback(
    (_id: string, path: string) => navigate(path === '/dashboard' ? '/' : path),
    [navigate],
  )

  // ⚠️ THE PHONE HAD NO NAVIGATION AT ALL. `DashboardSidebar` is desktop-width
  // only (`lg:`), and the web layout pairs it with `BottomNav` for narrow
  // screens — this shell rendered the sidebar alone, so on mobile every page
  // was a dead end. Same items, same handler; it stands down during the
  // invoice builder exactly as web's does, because the builder owns the bottom
  // of the screen there.
  const isFullscreenWorkflow = /^\/invoices\/new(\/|$)/.test(location.pathname)

  return (
    <>
      <DashboardSidebar
        primaryItems={primaryItems}
        moreGroups={moreGroups}
        moreIcon={MORE_ICON}
        activeNav={activeNav}
        onNavigate={handleNavigate}
        collapsed={collapsed}
        onExpand={expand}
        onOpenSettings={openSettings}
      />
      {/* Published so a sticky in-page action bar can sit above the nav, as on web. */}
      <style>{`:root{--bottom-nav-h:${isFullscreenWorkflow ? '0px' : 'calc(4.5rem + env(safe-area-inset-bottom,0px))'}}`}</style>
      {isFullscreenWorkflow ? null : (
        <BottomNav
          primaryItems={primaryItems}
          moreGroups={moreGroups}
          moreIcon={MORE_ICON}
          activeNav={activeNav}
          onNavigate={handleNavigate}
        />
      )}
    </>
  )
}
