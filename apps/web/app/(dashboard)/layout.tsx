"use client"

import type { ReactNode } from "react"
import { redirect, useRouter } from "next/navigation"
import { usePathname } from "next/navigation"
import { useAuthStore } from "@hisabche/store"
import { DashboardHeader, DashboardSidebar, BottomNav } from "@hisabche/ui"
import { LayoutDashboard, Package, FileText, Settings, BookOpen } from "lucide-react"

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--hisab-background)]">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--hisab-primary)] border-t-transparent" />
    </div>
  )
}

const navItems = [
  { id: "dashboard", label: "داشبورد", path: "/", icon: LayoutDashboard },
  { id: "baqidari", label: "باقی‌داری", path: "/baqidari", icon: BookOpen },
  { id: "godam", label: "انبار", path: "/godam", icon: Package },
  { id: "invoices", label: "فاکتورها", path: "/invoices", icon: FileText },
  { id: "settings", label: "تنظیمات", path: "/settings", icon: Settings },
]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, hasHydrated } = useAuthStore()

  if (!hasHydrated) return <LoadingScreen />
  if (!isAuthenticated) redirect("/login")

  return (
    <div className="flex min-h-screen bg-[var(--hisab-background)]">
      {/* Sidebar — desktop */}
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

        {/* BottomNav — mobile */}
        <BottomNav
          items={navItems}
          activeNav={pathname}
          onNavigate={(_id, path) => router.push(path)}
        />
      </div>
    </div>
  )
}