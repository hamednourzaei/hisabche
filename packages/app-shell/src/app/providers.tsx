// ============================================
// Root providers — TanStack Query tuned for a desktop client.
// ============================================

import { createNotificationMutationCache } from '@hisabche/api'
import React, { useEffect, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@hisabche/ui'
import { bindActiveWorkspace, useWorkspaceStore } from '@hisabche/store'

import { useAuthStore } from '@/features/auth/auth.store'
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

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient)
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
