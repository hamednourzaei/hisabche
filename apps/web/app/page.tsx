// app/page.tsx
"use client"

import { useAuthStore } from "@hisabche/store"
import LoginPage from "./login/page"
import DashboardLayout from "./(dashboard)/layout"
import DashboardHome from "./(dashboard)/page"

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--hisab-background)]">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--hisab-primary)] border-t-transparent" />
    </div>
  )
}
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
export default function RootPage() {
  const { isAuthenticated, hasHydrated, isLoading } = useAuthStore()

  if (!hasHydrated) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <LoginPage />

  return (
    <DashboardLayout>
      <DashboardHome />
    </DashboardLayout>
  )
}