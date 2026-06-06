"use client"

import React, { useEffect } from "react"
import { useThemeStore, useAuthStore, useDeviceStore } from "@hisabche/store"
import { syncLanguageFromStorage } from "@hisabche/i18n"

// analytics lazy
let analytics: any = null
async function loadAnalytics() {
  try {
    analytics = await import("@hisabche/analytics")
    analytics?.initPostHog?.()
    analytics?.initSentry?.()
  } catch {}
}

function AdaptiveUIInitializer() {
  useEffect(() => {
    const root = document.documentElement
    const cores = navigator.hardwareConcurrency ?? 4
    const isLowPerf = cores <= 4
    root.dataset.perf = isLowPerf ? "low" : "high"
    root.style.setProperty("--motion-scale", isLowPerf ? "0.5" : "1")
    root.style.setProperty("--shadow-intensity", isLowPerf ? "0.6" : "1")
    root.style.setProperty("--glass-blur-scale", isLowPerf ? "0.5" : "1")
  }, [])
  return null
}

function ThemeInitializer({ children }: { children: React.ReactNode }) {
  const { mode, setMode } = useThemeStore()
  useEffect(() => {
    setMode(mode)
    document.documentElement.classList.toggle("dark", mode === "dark")
    document.documentElement.classList.toggle("light", mode === "light")
    const { detectDevice, performanceMode, reducedMotion, dataSaver } = useDeviceStore.getState()
    detectDevice()
    if (performanceMode === "lite" || reducedMotion) {
      document.documentElement.classList.add("lite-mode")
      document.documentElement.dataset.perf = "low"
    }
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
    } catch {}
  }, [user])
  return <>{children}</>
}

function LanguageInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => { syncLanguageFromStorage() }, [])
  return <>{children}</>
}

function AnalyticsBootstrap() {
  useEffect(() => { loadAnalytics() }, [])
  return null
}

export function HeavyProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdaptiveUIInitializer />
      <AnalyticsBootstrap />
      <ThemeInitializer>
        <AuthInitializer>
          <LanguageInitializer>
            {children}
          </LanguageInitializer>
        </AuthInitializer>
      </ThemeInitializer>
    </>
  )
}