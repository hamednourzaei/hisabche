"use client"

import type { ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuthStore } from "@hisabche/store"
import { LayoutDashboard, Package, FileText, Settings, BookOpen } from "lucide-react"
import { useEffect, useRef } from "react"
import dynamic from "next/dynamic"

const DashboardHeader = dynamic(
  () => import("@hisabche/ui").then((m) => m.DashboardHeader),
  { ssr: false }
)

const DashboardSidebar = dynamic(
  () => import("@hisabche/ui").then((m) => m.DashboardSidebar),
  { ssr: false }
)

const BottomNav = dynamic(
  () => import("@hisabche/ui").then((m) => m.BottomNav),
  { ssr: false }
)

const CommandPalette = dynamic(
  () => import("@hisabche/ui").then((m) => m.CommandPalette),
  { ssr: false }
)

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
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, hasHydrated } = useAuthStore()
  const redirected = useRef(false)

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !redirected.current) {
      redirected.current = true
      router.replace("/login")
    }
  }, [hasHydrated, isAuthenticated, router])

  if (!hasHydrated) return <LoadingScreen />
  if (!isAuthenticated) return null

  return (
    <div className="hisab-root flex min-h-screen">
      <CommandPalette />
      <DashboardSidebar
        items={navItems}
        activeNav={pathname}
        onNavigate={(_id, path) => router.push(path)}
      />
      <div className="flex min-h-screen flex-1 flex-col">
        <DashboardHeader
          lastSyncedAt={Date.now()}
          isOnline={true}
          isSyncing={false}
          pendingCount={0}
          currentLang="fa"
          onLogout={() => {
            useAuthStore.getState().logout()
            router.push("/login")
          }}
        />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:pb-4">
          {children}
        </main>
        <BottomNav
          items={navItems}
          activeNav={pathname}
          onNavigate={(_id, path) => router.push(path)}
        />
      </div>
    </div>
  )
}