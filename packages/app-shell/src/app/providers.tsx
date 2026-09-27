// ============================================
// Root providers — TanStack Query tuned for a desktop client.
// ============================================

import { createNotificationMutationCache, registerOfflineQueue } from '@hisabche/api'
import React, { useEffect, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { registerReceiptPrinterHost, ToastProvider } from '@hisabche/ui'
import { bindActiveWorkspace, useWorkspaceStore } from '@hisabche/store'

import { useAuthStore } from '@/features/auth/auth.store'
import { bridge } from '@/shared/lib/bridge'
import {
  PERSISTED_CACHE_MAX_AGE_MS,
  cacheOwner,
  createPersistedQueryCache,
  createQueryCachePersister,
} from './persisted-query-cache'

// Publish the active workspace into @hisabche/api, which scopes every realtime
// subscription to one business. At module scope rather than in an effect:
// React runs child effects before parent ones, so an effect here would fire
// after the realtime hooks had already looked for a workspace.
if (typeof window !== 'undefined') {
  bindActiveWorkspace()

  // A host with a device database takes a write the network could not — see
  // packages/api/src/lib/offline-queue.ts. `__hisabcheOnline` is what the
  // mobile host reports (its WebView's navigator.onLine never changes).
  const device = bridge()
  if (device) {
    registerOfflineQueue({
      isOffline: () =>
        (window as { __hisabcheOnline?: boolean }).__hisabcheOnline === false ||
        navigator.onLine === false,
      enqueue: (entry) => device.db.enqueue(entry),
      readRows: (table, search) =>
        device.db.query<Record<string, unknown>>({ table, search, limit: 500 }),
      // The scanner asks the device first (instant, and the only answer
      // offline). Two rows = ambiguous, so up to five are read, not one.
      findByBarcode: (barcode) =>
        device.db.query<Record<string, unknown>>({
          table: 'product',
          where: { barcode, is_active: 1 },
          limit: 5,
        }),
    })

    // Receipts print silently to the chosen printer — a host capability the
    // browser build does not have (packages/ui/src/lib/print/printer-host.ts).
    registerReceiptPrinterHost({
      listPrinters: () => device.print.listPrinters(),
      printHtml: ({ html, deviceName, silent, pageWidthMm, copies }) =>
        device.print.html({
          html,
          silent,
          pageWidthMm,
          copies,
          ...(deviceName ? { deviceName } : {}),
        }),
      printEscPos: ({ data, deviceName }) =>
        device.print.escPos({ data, ...(deviceName ? { deviceName } : {}) }),
    })
  }
}

function createQueryClient(): QueryClient {
  // Every successful write refreshes the notification badge, so the person who
  // just issued an invoice sees the count change without reloading.
  let ref: QueryClient | null = null
  const client = new QueryClient({
    mutationCache: createNotificationMutationCache(() => ref),
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2,
        // As long as a saved cache may be shown: a shorter gcTime drops a
        // screen not visited this session from memory, and the next save then
        // drops it from the device too (see persisted-query-cache.ts).
        gcTime: PERSISTED_CACHE_MAX_AGE_MS,
        retry: 2,
        // The window is long-lived; refetching on focus keeps a left-open
        // dashboard from going stale.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: { retry: 0 },
    },
  })
  ref = client
  return client
}

/**
 * Keeps the on-device query cache owned by whoever is signed in, in whichever
 * workspace — see persisted-query-cache.ts for why the owner is the design.
 */
function usePersistedQueryCache(client: QueryClient): void {
  const [cache] = useState(() =>
    createPersistedQueryCache(
      client,
      createQueryCachePersister(typeof window === 'undefined' ? undefined : window.localStorage),
    ),
  )
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const userId = useAuthStore((s) => s.session?.user?.id ?? null)
  const workspaceId = useWorkspaceStore((s) => s.workspaceId)

  useEffect(() => {
    // Before hydration "no user" means "not read yet", not "signed out" —
    // treating it as a sign-out would wipe the cache on every launch.
    if (!isHydrated) return
    void cache.setOwner(cacheOwner(userId, workspaceId))
  }, [cache, isHydrated, userId, workspaceId])
}

/**
 * ⚠️ THE WORKSPACE WAS NEVER LOADED IN THIS SHELL.
 *
 * `fetchWorkspace` had exactly one caller — the workspace settings page — so
 * on Windows, Mac, Android and iOS `workspaceId` stayed null unless someone
 * happened to open that page. Nothing failed: realtime quietly subscribed to
 * nothing (`subscribeToChannel` returns early without a workspace), the sync
 * engine ran with a null workspace, and the device cache had no owner to be
 * saved under. Signed in means loaded now. A failed request keeps what is
 * stored; only the server's own answer changes it (see workspace.slice.ts).
 */
function useLoadWorkspace(): void {
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const userId = useAuthStore((s) => s.session?.user?.id ?? null)
  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace)

  useEffect(() => {
    if (isHydrated && userId) void fetchWorkspace(userId)
  }, [isHydrated, userId, fetchWorkspace])
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient)
  useLoadWorkspace()
  usePersistedQueryCache(client)
  return (
    <QueryClientProvider client={client}>
      {/* ⚠️ THIS WAS MISSING, AND IT CRASHED WHOLE SCREENS.
          `packages/ui` is shared with the web app, where `apps/web/app/[lang]/
          providers.tsx` mounts this. Desktop mounted only the query client, so
          every shared component that calls `useToast` threw

              Error: useToast must be used within ToastProvider

          and React Router's boundary replaced the page with an error. Settings
          was one — `BusinessStampSection` calls it — and any other shared
          component that reports success or failure through a toast was one
          mis-click away from the same thing.

          The two shells render the same components; they need the same
          providers under them. */}
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}
