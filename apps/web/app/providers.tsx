"use client"

import React, { useEffect } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { I18nextProvider } from "react-i18next"
import i18n, { syncLanguageFromStorage } from "@hisabche/i18n"
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

// ═══════════════════════════════════════════
// ADAPTIVE UI ENGINE
// ═══════════════════════════════════════════
function AdaptiveUIInitializer() {
  useEffect(() => {
    const root = document.documentElement

    // ─── Performance Detection ───
    const cores = navigator.hardwareConcurrency ?? 4
    const isLowPerf = cores <= 4
    root.dataset.perf = isLowPerf ? "low" : "high"
    root.style.setProperty("--motion-scale", isLowPerf ? "0.5" : "1")
    root.style.setProperty("--shadow-intensity", isLowPerf ? "0.6" : "1")
    root.style.setProperty("--glass-blur-scale", isLowPerf ? "0.5" : "1")

    // ─── Idle Detection ───
    let idleTimer: ReturnType<typeof setTimeout>
    const resetIdle = () => {
      document.body.classList.remove("idle")
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => document.body.classList.add("idle"), 3000)
    }
    window.addEventListener("mousemove", resetIdle, { passive: true })
    window.addEventListener("touchstart", resetIdle, { passive: true })
    window.addEventListener("keydown", resetIdle, { passive: true })
    window.addEventListener("scroll", resetIdle, { passive: true })
    resetIdle()

    // ─── Intersection Observer for offscreen gating ───
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ;(entry.target as HTMLElement).dataset.offscreen = entry.isIntersecting ? "false" : "true"
        }
      },
      { threshold: 0 }
    )
    const targets = document.querySelectorAll(".section, .glass-card, .cinematic-bg, .lazy-paint")
    targets.forEach((el) => observer.observe(el))

    return () => {
      window.removeEventListener("mousemove", resetIdle)
      window.removeEventListener("touchstart", resetIdle)
      window.removeEventListener("keydown", resetIdle)
      window.removeEventListener("scroll", resetIdle)
      clearTimeout(idleTimer)
      observer.disconnect()
    }
  }, [])

  return null
}

// ═══════════════════════════════════════════

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
      document.documentElement.style.setProperty("--motion-scale", "0.2")
      document.documentElement.style.setProperty("--shadow-intensity", "0.3")
      document.documentElement.style.setProperty("--glass-blur-scale", "0.2")
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
    } catch { /* ignore */ }
  }, [user])
  return <>{children}</>
}

function LanguageInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    syncLanguageFromStorage()
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
        <AdaptiveUIInitializer />
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