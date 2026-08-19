// apps/web/app/[lang]/providers.tsx
'use client'

import React, { Suspense, lazy, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@hisabche/ui'

/* ═══════════════════════════════════════════════════════════════════════════
   Providers v2 — Memoized · Optimized
   ✅ useMemo for queryClient · lazy with ssr: false
   ═══════════════════════════════════════════════════════════════════════════ */

// ✅ Lazy load HeavyProviders with ssr: false
const HeavyProviders = lazy(() =>
  import('./heavy-providers').then((m) => ({ default: m.HeavyProviders })),
)

// ✅ QueryClient با useMemo (برای جلوگیری از بازتعریف)
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
