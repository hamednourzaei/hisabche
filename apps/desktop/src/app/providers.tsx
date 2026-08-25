// ============================================
// Root providers — TanStack Query tuned for a desktop client.
// ============================================

import React, { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
