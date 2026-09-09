// ============================================
// Root providers — TanStack Query tuned for a desktop client.
// ============================================

import React, { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@hisabche/ui'
import { bindActiveWorkspace } from '@hisabche/store'

// Publish the active workspace into @hisabche/api, which scopes every realtime
// subscription to one business. At module scope rather than in an effect:
// React runs child effects before parent ones, so an effect here would fire
// after the realtime hooks had already looked for a workspace.
if (typeof window !== 'undefined') {
  bindActiveWorkspace()
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 30,
        retry: 2,
        // The window is long-lived; refetching on focus keeps a left-open
        // dashboard from going stale.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: { retry: 0 },
    },
  })
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient)
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
