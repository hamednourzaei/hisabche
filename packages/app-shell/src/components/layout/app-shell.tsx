// ============================================
// App shell — sidebar + toolbar + routed content.
//
// Visual parity with canonical Web layout:
//   packages/ui/src/components/ui/dashboard-sidebar.tsx
//   packages/ui/src/components/ui/dashboard-header.tsx
//
// Desktop-specific: Electron drag regions, keyboard shortcuts, route outlet.
// ============================================

import { Suspense, useCallback } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslations } from 'next-intl'

import {
  RouteProgress,
  SandboxNotice,
  SubscriptionLockDialog,
  SubscriptionLockNotice,
  isRouteAllowedWhenExpired,
  useSubscriptionLocked,
} from '@hisabche/ui'

import { CommandPalette } from '@/components/layout/command-palette'
import { Sidebar } from '@/components/layout/sidebar'
import { Toolbar } from '@/components/layout/toolbar'
import { Skeleton } from '@/components/ui/primitives'
import { useShortcuts } from '@/shared/hooks/use-shortcuts'
import { useUiStore } from '@/shared/stores/ui.store'
import { useBackgroundSync, useWorkspaceCache } from '@/features/sync/use-sync'
import { useWorkspaceStore } from '@hisabche/store'

function RouteFallback() {
  return (
    <div className="flex flex-col gap-2 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function AppShell() {
  const t = useTranslations()
  const navigate = useNavigate()
  const location = useLocation()

  // Same gate as web's dashboard layout: expired → only dashboard, invoices
  // (view) and billing render; the server refuses writes either way.
  const routeLocked = useSubscriptionLocked() && !isRouteAllowedWhenExpired(location.pathname)

  // ⚠️ NEITHER OF THESE WAS EVER MOUNTED. Both hooks were written with the sync
  // engine and nothing called them, so the device database was never filled
  // from the server (offline, the invoice list said "no invoices") and an
  // invoice issued offline sat in the queue until someone pressed "sync" by
  // hand. Signed in is when both must run.
  const workspaceId = useWorkspaceStore((s) => s.workspaceId)
  useWorkspaceCache(workspaceId)
  useBackgroundSync(workspaceId)

  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen)
  const requestSearchFocus = useUiStore((s) => s.requestSearchFocus)

  // Matches web's primary «فاکتور جدید» affordance: the two-stage builder.
  // `/quick-invoice` is suspended — its route still resolves so existing
  // shortcuts and deep links do not break, but nothing points at it.
  const onNewInvoice = useCallback(() => navigate('/invoices/new'), [navigate])

  useShortcuts({
    newInvoice: onNewInvoice,
    search: requestSearchFocus,
    commandPalette: () => setPaletteOpen(true),
    close: () => setPaletteOpen(false),
  })

  return (
    <div className="flex h-full w-full bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))]">
      {/* Same navigation feedback web gives — desktop's lazy routes have the
          same gap between the click and the chunk arriving. */}
      <RouteProgress pathname={location.pathname} />

      {/* Sidebar — matches canonical DashboardSidebar */}
      <Sidebar />

      {/* Main content area — matches canonical layout */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header — matches canonical DashboardHeader */}
        <Toolbar title={t('nav.dashboard' as never)} />

        {/* Routed page content */}
        {/* `overflow-y-auto`, not `overflow-hidden`: the shell is a fixed-height
            window, so hiding overflow here left long pages unscrollable. Padding
            matches web's main (`p-4`) — without it content sat flush against
            the sidebar and the window edge. */}
        {/* `pb-20 lg:pb-4` — as web: on narrow screens the floating BottomNav
            covers the last 5rem, so the page must be able to scroll past it. */}
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 pb-20 lg:pb-4">
          <SandboxNotice />
          <Suspense fallback={<RouteFallback />}>
            {routeLocked ? <SubscriptionLockNotice hashRouter /> : <Outlet />}
          </Suspense>
        </main>
      </div>

      {/* Command palette — global Cmd+K overlay */}
      <CommandPalette />

      <SubscriptionLockDialog hashRouter />
    </div>
  )
}
