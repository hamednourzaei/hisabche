'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore, useOnboardingStore } from '@hisabche/store'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, hasHydrated, user } = useAuthStore()
  const localCompleted = useOnboardingStore((s) => s.isCompleted)

  // The server is the authority; the local flag is only a fallback.
  //
  // This used to read the zustand flag alone, which lives in localStorage — so
  // clearing site data, or signing in from a second browser, replayed the whole
  // wizard to someone who had already finished it and issued dozens of invoices.
  //
  // `undefined` means the cached user predates the field (or /auth/me has not
  // answered yet). In that case fall back to the local flag rather than assuming
  // "not completed", which would be the same bug in a new place.
  const serverCompleted = user?.onboardingCompleted
  const onboardingCompleted = serverCompleted ?? localCompleted

  useEffect(() => {
    if (!hasHydrated) return
    if (!isAuthenticated) return

    if (!onboardingCompleted) {
      router.replace('/onboarding')
    } else {
      router.replace('/dashboard')
    }
  }, [hasHydrated, isAuthenticated, onboardingCompleted, router])

  return <>{children}</>
}
