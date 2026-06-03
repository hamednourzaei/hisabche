"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore, useOnboardingStore } from "@hisabche/store"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, hasHydrated } = useAuthStore()
  const onboardingCompleted = useOnboardingStore((s) => s.isCompleted)

  useEffect(() => {
    if (!hasHydrated) return
    if (!isAuthenticated) return
    if (!onboardingCompleted) {
      router.replace("/onboarding")
    } else {
      router.replace("/dashboard")
    }
  }, [hasHydrated, isAuthenticated, onboardingCompleted, router])


  return <>{children}</>
}