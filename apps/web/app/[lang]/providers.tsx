// apps/web/app/[lang]/providers.tsx
'use client'

import React, { Suspense, lazy, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// Subpath, not the '@hisabche/ui' barrel: this file is in the root layout, and the
// barrel dragged the whole dashboard (1.6 MB) into every public page's JS.
import { ToastProvider } from '@hisabche/ui/toast-provider'
import { bindActiveWorkspace } from '@hisabche/store'
import { createNotificationMutationCache } from '@hisabche/api'

// Publish the active workspace into @hisabche/api, which scopes every realtime
// subscription to one business. Without it, realtime resolves no workspace and
// subscribes to nothing — a safe failure (missed wake-ups, not a cross-tenant
// subscription), but the app would silently lose live updates.
//
// At module scope, not in an effect: React runs child effects BEFORE parent
// ones, so a `useEffect` here would fire after the realtime hooks below it had
// already looked for a workspace. Binding on import happens before the first
// render, and the store rehydrates from localStorage synchronously, so a
// returning user is bound with their real workspace from the very first pass.
if (typeof window !== 'undefined') {
  bindActiveWorkspace()
}

/* ═══════════════════════════════════════════════════════════════════════════
   Providers v2 — Memoized · Optimized
   ✅ useMemo for queryClient · lazy with ssr: false
   ═══════════════════════════════════════════════════════════════════════════ */

// ✅ Lazy load HeavyProviders with ssr: false
const HeavyProviders = lazy(() =>
  import('./heavy-providers').then((m) => ({ default: m.HeavyProviders })),
)

// ✅ QueryClient با useMemo (برای جلوگیری از بازتعریف)
/**
 * ⚠️ The cache needs the client, and the client needs the cache. Declared
 * first, read lazily through the getter — a direct reference here would be a
 * TDZ error at module load (راهنمای سشن §۸، تله‌ی TDZ).
 */
let queryClientRef: QueryClient | null = null

const queryClient = new QueryClient({
  // Every successful write refreshes the notification badge, so the person who
  // just issued an invoice sees the count change without reloading the page.
  // Realtime remains the path for changes made by somebody else.
  mutationCache: createNotificationMutationCache(() => queryClientRef),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      // As long as the device cache may be shown (PERSISTED_CACHE_MAX_AGE_MS, a
      // week): with the default five minutes, a screen left for six came back
      // as a skeleton, and a screen not visited this session was dropped from
      // the device on the next save. Written as a number so this file does not
      // import the persister libraries into every public page.
      gcTime: 1000 * 60 * 60 * 24 * 7,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
})

queryClientRef = queryClient

export function Providers({ children }: { children: React.ReactNode }) {
  // ✅ استفاده از useMemo برای queryClient (اگر در future نیاز به re-init داشت)
  const client = useMemo(() => queryClient, [])

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        {/* `children` renders directly, NOT through HeavyProviders.
            HeavyProviders is lazy()-imported; routing the page through it made
            React suspend the entire tree during SSR and serve an empty
            <body> on every public page — no <h1>, no copy, no internal links,
            only an RSC payload. It provides no context and every initializer
            inside it is effect-only, so it works just as well as a sibling. */}
        {children}
        <Suspense fallback={null}>
          <HeavyProviders />
        </Suspense>
      </ToastProvider>
    </QueryClientProvider>
  )
}
