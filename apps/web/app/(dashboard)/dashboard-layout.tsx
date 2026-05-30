"use client"

import type { ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuthStore, useThemeStore } from "@hisabche/store"
import { useTranslation } from "react-i18next"
import { changeLanguage, type SupportedLanguage } from "@hisabche/i18n"
import { DashboardHeader, DashboardSidebar, BottomNav, CommandPalette } from "@hisabche/ui"
import { LayoutDashboard, Package, FileText, Settings, BookOpen } from "lucide-react"
import { useEffect, useRef, useCallback, useMemo } from "react"

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--hisab-primary)] border-t-transparent" />
    </div>
  )
}

const navItems = [
  { id: "dashboard", label: "داشبورد", path: "/dashboard", icon: LayoutDashboard },
  { id: "baqidari", label: "باقی‌داری", path: "/baqidari", icon: BookOpen },
  { id: "godam", label: "انبار", path: "/godam", icon: Package },
  { id: "invoices", label: "فاکتورها", path: "/invoices", icon: FileText },
  { id: "settings", label: "تنظیمات", path: "/settings", icon: Settings },
]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const isDark = useThemeStore((s) => s.isDark)
  const toggle = useThemeStore((s) => s.toggle)
  const redirected = useRef(false)
  const lastSyncedAt = useRef(Date.now())

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !redirected.current) {
      redirected.current = true
      router.replace("/login")
    }
  }, [hasHydrated, isAuthenticated, router])

  const toggleLang = useCallback(() => {
    const nextLang = document.documentElement.lang === "fa-AF" ? "fa-IR" : "fa-AF"
    changeLanguage(nextLang as SupportedLanguage)
  }, [])

  const commands = useMemo(() => [
    { id: "dashboard", label: "داشبورد", description: "نمای کلی کسب‌وکار", icon: "📊", onSelect: () => router.push("/dashboard") },
    { id: "new-invoice", label: "فاکتور جدید", description: "ثبت فاکتور سریع", icon: "🧾", shortcut: "N", onSelect: () => router.push("/quick-invoice") },
    { id: "godam", label: "گدام", description: "مدیریت محصولات", icon: "📦", onSelect: () => router.push("/godam") },
    { id: "invoices", label: "فاکتورها", description: "مشاهده فاکتورها", icon: "📋", onSelect: () => router.push("/invoices") },
    { id: "baqidari", label: "باقی‌داری", description: "مدیریت بدهی‌ها", icon: "📒", onSelect: () => router.push("/baqidari") },
    { id: "customers", label: "مشتری جدید", description: "اضافه کردن مشتری", icon: "👤", onSelect: () => router.push("/baqidari?add=true") },
    { id: "settings", label: "تنظیمات", description: "تنظیمات برنامه", icon: "⚙️", onSelect: () => router.push("/settings") },
    { id: "sync", label: "همگام‌سازی", description: "مرکز همگام‌سازی", icon: "🔄", onSelect: () => router.push("/sync-center") },
  ], [router])

  const handleLogout = useCallback(() => {
    useAuthStore.getState().logout()
    router.push("/login")
  }, [router])

  const handleNavigate = useCallback((_id: string, path: string) => {
    router.push(path)
  }, [router])

  const handleNavigateLogin = useCallback(() => {
    router.push("/login")
  }, [router])

  if (!hasHydrated) return <LoadingScreen />
  if (!isAuthenticated) return null

  return (
    <div className="hisab-root flex min-h-screen">
      <CommandPalette commands={commands} />
      <DashboardSidebar items={navItems} activeNav={pathname} onNavigate={handleNavigate} />
      <div className="flex min-h-screen flex-1 flex-col">
        <DashboardHeader
          variant="dashboard"
          appName={t("app.name")}
          lastSyncedAt={lastSyncedAt.current}
          isOnline={true}
          isSyncing={false}
          pendingCount={0}
          currentLang="fa-AF"
          isDark={isDark}
          signInLabel={t("auth.signIn")}
          signOutLabel={t("auth.signOut")}
          onToggleTheme={toggle}
          onToggleLang={toggleLang}
          onLogout={handleLogout}
          onNavigateLogin={handleNavigateLogin}
        />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:pb-4">{children}</main>
        <BottomNav items={navItems} activeNav={pathname} onNavigate={handleNavigate} />
      </div>
    </div>
  )
}