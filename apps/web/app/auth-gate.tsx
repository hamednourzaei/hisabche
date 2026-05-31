"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore, useOnboardingStore } from "@hisabche/store"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, hasHydrated } = useAuthStore()
const onboardingCompleted = useOnboardingStore((s) => s.isCompleted)
console.log("🔍 onboardingCompleted:", onboardingCompleted)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (hasHydrated) {
      if (isAuthenticated) {
        if (!onboardingCompleted) {
          router.replace("/onboarding")
        } else {
          router.replace("/dashboard")
        }
      } else {
        setReady(true)
      }
    }
  }, [hasHydrated, isAuthenticated, onboardingCompleted, router])

  if (!ready) {
    return (
      <div className="hisab-root flex items-center justify-center">
        <div className="glass-card flex flex-col items-center gap-4 px-8 py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--hisab-primary)] border-t-transparent" />
          <span className="text-sm text-[var(--hisab-muted-fg)]">
            در حال بارگذاری...
          </span>
        </div>
      </div>
    )
  }

  return <>{children}</>
}