// apps/admin/app/[lang]/providers.tsx
'use client'

import React, { useEffect, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@hisabche/ui'
import { bindActiveWorkspace } from '@hisabche/store'
import { initAdminApiAuth } from '@/lib/admin-api-token'

// Publish the active workspace into @hisabche/api so realtime is scoped.
//
// The admin panel is a SEPARATE security domain and its operator is not a
// member of any customer workspace — so in practice this binds `null` here and
// the panel subscribes to nothing. That is the correct outcome, and binding it
// anyway keeps the three apps identical rather than relying on the admin panel
// happening never to mount a workspace hook.
if (typeof window !== 'undefined') {
  bindActiveWorkspace()
}

/* ═══════════════════════════════════════════════════════════════════════════
   Admin providers.

   The admin panel renders the SAME shared shell as web — DashboardHeader →
   NotificationBell → useNotifications → useRealtime → useQueryClient. Without
   a QueryClientProvider that tree threw "No QueryClient set" on every
   dashboard render. This mirrors apps/web/app/[lang]/providers.tsx: one
   module-scope QueryClient (never re-created per render) plus ToastProvider,
   which shared @hisabche/ui components expect via useToast().

   Web's lazy HeavyProviders is deliberately not copied here — it only holds
   web-specific, effect-only initializers.
   ═══════════════════════════════════════════════════════════════════════════ */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
})

export function Providers({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => queryClient, [])

  // Hand the shared API client the Supabase access token. Without this every
  // `/api/admin/*` request leaves without an Authorization header and the
  // backend rejects it with 401.
  useEffect(() => {
    initAdminApiAuth()
  }, [])

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}
