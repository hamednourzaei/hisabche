"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@hisabche/store"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, hasHydrated } = useAuthStore()
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    if (hasHydrated) {
      if (isAuthenticated) {
        router.replace("/dashboard")
      } else {
        setShowContent(true)
      }
    }
  }, [hasHydrated, isAuthenticated, router])

  // Show loading while checking auth
  if (!showContent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--hisab-background)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--hisab-primary)] border-t-transparent" />
          <span className="text-sm text-[var(--hisab-muted-fg)]">در حال بارگذاری...</span>
        </div>
      </div>
    )
  }

  return <>{children}</>
}