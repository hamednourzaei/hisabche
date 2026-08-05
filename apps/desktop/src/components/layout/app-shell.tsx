// ============================================
// App shell — sidebar + toolbar + routed content.
// Owns the global shortcuts so every page inherits them.
// ============================================

import React, { Suspense, useCallback } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation('desktop')
  const navigate = useNavigate()

  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen)
  const requestSearchFocus = useUiStore((s) => s.requestSearchFocus)

  const onNewInvoice = useCallback(() => navigate('/sales/new'), [navigate])

  useShortcuts({
    newInvoice: onNewInvoice,
    search: requestSearchFocus,
    commandPalette: () => setPaletteOpen(true),
    close: () => setPaletteOpen(false),
  })

  return (
    <div className="flex h-full w-full bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))]">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar title={t('nav.dashboard')} />

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <CommandPalette />
    </div>
  )
}
