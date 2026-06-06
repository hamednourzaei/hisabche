"use client"

import React, { useEffect, Suspense } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { I18nextProvider } from "react-i18next"
import i18n from "@hisabche/i18n"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
})

// ✅ Heavy providers — lazy load
const HeavyProviders = React.lazy(() =>
  import("./heavy-providers").then((m) => ({ default: m.HeavyProviders }))
)

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <Suspense fallback={null}>
          <HeavyProviders>
            {children}
          </HeavyProviders>
        </Suspense>
      </I18nextProvider>
    </QueryClientProvider>
  )
}