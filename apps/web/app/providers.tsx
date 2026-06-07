"use client"

import React, { useEffect, Suspense, lazy } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { I18nextProvider } from "react-i18next"
import i18n from "@hisabche/i18n"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
})

// ✅ Heavy providers — lazy load after LCP
const HeavyProviders = lazy(() =>
  import("./heavy-providers").then((m) => ({ default: m.HeavyProviders }))
)

// ✅ I18n lazy boundary - فقط برای صفحاتی که نیاز دارند
const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [isReady, setIsReady] = React.useState(false)

  useEffect(() => {
    // Load i18n after LCP with requestIdleCallback
    const loadI18n = () => {
      import("@hisabche/i18n").then(() => setIsReady(true))
    }

    if ("requestIdleCallback" in window) {
      requestIdleCallback(loadI18n, { timeout: 2000 })
    } else {
      setTimeout(loadI18n, 100)
    }
  }, [])

  if (!isReady) {
    // Show fallback without i18n
    return <>{children}</>
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<>{children}</>}>
        <I18nProvider>
          <HeavyProviders>
            {children}
          </HeavyProviders>
        </I18nProvider>
      </Suspense>
    </QueryClientProvider>
  )
}