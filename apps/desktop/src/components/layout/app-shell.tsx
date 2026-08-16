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
import { Outlet, useNavigate } from 'react-router-dom'
import { useTranslations } from 'next-intl'

import { CommandPalette } from '@/components/layout/command-palette'
import { Sidebar } from '@/components/layout/sidebar'
import { Toolbar } from '@/components/layout/toolbar'
import { Skeleton } from '@/components/ui/primitives'
import { useShortcuts } from '@/shared/hooks/use-shortcuts'
import { useUiStore } from '@/shared/stores/ui.store'

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

  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen)
  const requestSearchFocus = useUiStore((s) => s.requestSearchFocus)

  const onNewInvoice = useCallback(() => navigate('/quick-invoice'), [navigate])

  useShortcuts({
    newInvoice: onNewInvoice,
    search: requestSearchFocus,
    commandPalette: () => setPaletteOpen(true),
    close: () => setPaletteOpen(false),
  })

  return (
    <div className="flex h-full w-full bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))]">
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
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Command palette — global Cmd+K overlay */}
      <CommandPalette />
    </div>
  )
}
