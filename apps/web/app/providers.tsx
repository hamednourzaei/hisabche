"use client"

import React, { useEffect } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { I18nextProvider } from "react-i18next"
import i18n, { changeLanguage } from "@hisabche/i18n"
import { useThemeStore, useAuthStore, useDeviceStore } from "@hisabche/store"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let analytics: any = null

async function loadAnalytics() {
  try {
    analytics = await import("@hisabche/analytics")
    analytics?.initPostHog?.()
    analytics?.initSentry?.()
  } catch {
    // analytics not available → ignore
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
})

function ThemeInitializer({ children }: { children: React.ReactNode }) {
  const { mode, setMode } = useThemeStore()
  useEffect(() => {
    setMode(mode)
    const { detectDevice, performanceMode, reducedMotion, dataSaver } = useDeviceStore.getState()
    detectDevice()
    if (performanceMode === "lite" || reducedMotion) document.documentElement.classList.add("lite-mode")
    if (dataSaver) document.documentElement.classList.add("data-saver")
  }, [mode, setMode])
  return <>{children}</>
}

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  useEffect(() => {
    if (!user || !analytics) return
    try {
      analytics.identifyUser?.(user.id, { email: user.email, businessName: user.businessName })
      analytics.setUser?.(user.id, user.email)
    } catch { /* ignore */ }
  }, [user])
  return <>{children}</>
}

function LanguageInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      const storedLang = localStorage.getItem("hisabche-lang")
      if (storedLang) {
        changeLanguage(storedLang as "fa-AF" | "fa-IR")
        document.documentElement.lang = storedLang
        document.documentElement.dir = "rtl"
      }
    } catch { /* ignore */ }
  }, [])
  return <>{children}</>
}

function AnalyticsBootstrap() {
  useEffect(() => { loadAnalytics() }, [])
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <AnalyticsBootstrap />
        <ThemeInitializer>
          <AuthInitializer>
            <LanguageInitializer>{children}</LanguageInitializer>
          </AuthInitializer>
        </ThemeInitializer>
      </I18nextProvider>
    </QueryClientProvider>
  )
}