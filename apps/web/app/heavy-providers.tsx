"use client"

import React, { useEffect, lazy, Suspense } from "react"
import { useThemeStore, useAuthStore, useDeviceStore } from "@hisabche/store"
import { syncLanguageFromStorage } from "@hisabche/i18n"

// ✅ Lazy load analytics with idle callback
let analyticsLoaded = false

function loadAnalytics() {
  if (analyticsLoaded) return
  analyticsLoaded = true

  const load = () => {
    import("@hisabche/analytics").then((module) => {
      module.initPostHog?.()
      module.initSentry?.()
    }).catch(() => {})
  }

  if ("requestIdleCallback" in window) {
    requestIdleCallback(load, { timeout: 3000 })
  } else {
    setTimeout(load, 2000)
  }
}

// ✅ Adaptive UI - minimal, no hydration block
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

// ✅ Theme - non-blocking
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

// ✅ Auth - non-blocking
function AuthInitializer({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!user) return

    // Delay analytics identify until after interaction
    const timer = setTimeout(async () => {
      try {
        const analytics = await import("@hisabche/analytics")
        analytics.identifyUser?.(user.id, {
          email: user.email,
          businessName: user.businessName,
        })
        analytics.setUser?.(user.id, user.email)
      } catch {}
    }, 2000)

    return () => clearTimeout(timer)
  }, [user])

  return <>{children}</>
}

// ✅ Language - non-blocking
function LanguageInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Delay language sync
    const timer = setTimeout(() => syncLanguageFromStorage(), 100)
    return () => clearTimeout(timer)
  }, [])
  return <>{children}</>
}

// ✅ Analytics - loaded after LCP
function AnalyticsBootstrap() {
  useEffect(() => {
    loadAnalytics()
  }, [])
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