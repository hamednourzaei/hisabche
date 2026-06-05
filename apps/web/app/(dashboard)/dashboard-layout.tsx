"use client"

import type { ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuthStore, useThemeStore, useOnboardingStore } from "@hisabche/store"
import { useTranslation } from "react-i18next"
import {
  DashboardHeader, DashboardSidebar, BottomNav, CommandPalette,
} from "@hisabche/ui"
import { useEffect, useRef, useCallback, useMemo, useState } from "react"
import { NAV_ITEMS, COMMAND_ITEMS } from "./constants/nav-items"
import "@hisabche/ui/globals.css"

// ✅ خارج از component — هیچ‌وقت re-create نمی‌شه
const NAV_MAPPED = NAV_ITEMS.map((item) => ({
  id: item.id,
  label: item.labelKey,
  path: item.path,
  icon: item.icon,
}))

// ✅ prefetch همه routes در background
function usePrefetchRoutes() {
  const router = useRouter()
  useEffect(() => {
    NAV_ITEMS.forEach((item) => router.prefetch(item.path))
  }, [router])
}

// ❌ LoadingScreen حذف شد (استفاده نمی‌شود)

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const isDark = useThemeStore((s) => s.isDark)
  const toggle = useThemeStore((s) => s.toggle)
  const isOnboardingComplete = useOnboardingStore((s) => s.isCompleted)
  const redirected = useRef(false)
  const lastSyncedAt = useRef(Date.now())

  // ✅ prefetch در background موقع mount
  usePrefetchRoutes()

  // ✅ optimistic active state — فوری بدون انتظار
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null)
  const activeNav = optimisticPath ?? pathname

  // pathname واقعی رسید → optimistic پاک کن
  useEffect(() => {
    setOptimisticPath(null)
  }, [pathname])

  useEffect(() => {
    if (!hasHydrated) return
    if (!isAuthenticated && !redirected.current) {
      redirected.current = true
      router.replace("/login")
      return
    }
    if (isAuthenticated && !isOnboardingComplete) {
      router.replace("/onboarding")
    }
  }, [hasHydrated, isAuthenticated, isOnboardingComplete, router])

  const currentLang = i18n.language || "fa-AF"

  const toggleLang = useCallback(() => {
    const nextLang = i18n.language === "fa-AF" ? "fa-IR" : "fa-AF"
    i18n.changeLanguage(nextLang)
  }, [i18n])

  const commands = useMemo(
    () =>
      COMMAND_ITEMS.map((cmd) => ({
        id: cmd.id,
        label: t(cmd.labelKey),
        description: t(cmd.descriptionKey),
        icon: cmd.icon,
        ...(cmd.shortcut ? { shortcut: cmd.shortcut } : {}),
        onSelect: () => {
          setOptimisticPath(cmd.path)
          router.push(cmd.path)
        },
      })),
    [router, t]
  )

  const handleLogout = useCallback(() => {
    useAuthStore.getState().logout()
    router.replace("/login")
  }, [router])

  // ✅ optimistic navigation — active state فوری با کلیک
  const handleNavigate = useCallback(
    (_id: string, path: string) => {
      setOptimisticPath(path)
      router.push(path)
    },
    [router]
  )

  const handleNavigateLogin = useCallback(() => {
    router.push("/login")
  }, [router])

  if (hasHydrated && !isAuthenticated) {
    return null
  }

  return (
    <div className="hisab-root flex min-h-screen">
      <CommandPalette commands={commands} />
      <DashboardSidebar
        items={NAV_MAPPED}
        activeNav={activeNav}
        onNavigate={handleNavigate}
      />
      <div className="flex min-h-screen flex-1 flex-col">
        <DashboardHeader
          variant="dashboard"
          appName={t("app.name")}
          lastSyncedAt={lastSyncedAt.current}
          isOnline={true}
          isSyncing={false}
          pendingCount={0}
          currentLang={currentLang}
          isDark={isDark}
          signInLabel={t("auth.signIn")}
          signOutLabel={t("auth.signOut")}
          onToggleTheme={toggle}
          onToggleLang={toggleLang}
          onLogout={handleLogout}
          onNavigateLogin={handleNavigateLogin}
        />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:pb-4">
          {children}
        </main>
        <BottomNav
          items={NAV_MAPPED}
          activeNav={activeNav}
          onNavigate={handleNavigate}
        />
      </div>
    </div>
  )
}