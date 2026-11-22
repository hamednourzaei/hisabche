// packages/app-shell/src/features/auth/require-auth.tsx
import React, { type ReactNode, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { evaluateOfflineOnboarding } from '@hisabche/validation'

import {
  useAuthStore as useSharedAuthStore,
  useOnboardingStore,
  useWorkspaceStore,
} from '@hisabche/store'

import { useAuthStore } from './auth.store'

/**
 * Route guard. The session is hydrated before render, so this is sync.
 *
 * ⚠️ THE WIZARD IS REACHED HERE TOO.
 *
 * The web's dashboard layout redirects a signed-in person with
 * `onboardingCompleted: false` to `/onboarding`. This shell had no equivalent:
 * a new account on Windows or Android landed on the dashboard having chosen
 * neither an industry nor a books currency, and no path to the wizard except
 * the two menu entries nobody would find.
 *
 * `packages/ui`'s onboarding container runs the same flow on every host, so
 * the redirect is ALL desktop needs — do not build a second one here.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const location = useLocation()
  const sharedUser = useSharedAuthStore((s) => s.user)
  const hasNoWorkspace = useWorkspaceStore((s) => s.hasNoWorkspace)
  const localCompleted = useOnboardingStore((s) => s.isCompleted)
  const localCompletedAt = useOnboardingStore((s) => s.completedAt)
  const localStep = useOnboardingStore((s) => s.step)
  const claimForUser = useOnboardingStore((s) => s.claimForUser)
  const resetOnboarding = useOnboardingStore((s) => s.reset)

  const serverCompleted = sharedUser?.onboardingCompleted

  // The wizard's answers belong to one account — see the web's useRedirectGuard.
  // ⚠️ Only a FRESH ONLINE «false» resets local completion (F-108): offline,
  // the cached user can be stale, and the offline-first rule says a stale
  // server answer must never take locally completed work away.
  useEffect(() => {
    if (!sharedUser?.id) return
    claimForUser(sharedUser.id)
    const online = typeof navigator === 'undefined' || navigator.onLine !== false
    if (online && serverCompleted === false && useOnboardingStore.getState().isCompleted) {
      resetOnboarding()
    }
  }, [sharedUser?.id, serverCompleted, claimForUser, resetOnboarding])

  if (!isAuthenticated) return <Navigate to="/login" replace />

  // ONE offline/onboarding decision, shared with the server-side gate's rules:
  // a locally completed business keeps working offline even when no cloud
  // answer is available; an incomplete one resumes at its actual step.
  // `cloudActivated` is the VERIFIED server answer (F-100) — a positive
  // `onboardingCompleted` from the server is the activation record; the local
  // timestamp is a real instant, not a boolean proxy (F-109).
  const decision = evaluateOfflineOnboarding({
    localCompletedAt: localCompleted ? (localCompletedAt ?? 'local') : null,
    localStep,
    cloudActivated: serverCompleted === true,
    nextRequiredStep: null,
  })
  // Keep the established shell semantics when the SERVER positively says the
  // wizard was never finished (the local flag is then a leftover).
  const notCompleted = serverCompleted === false ? true : !decision.mayUseBusinessOffline

  if (notCompleted || hasNoWorkspace === true) {
    if (location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />
    }
  }

  return <>{children}</>
}
