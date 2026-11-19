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
  const localStep = useOnboardingStore((s) => s.step)
  const claimForUser = useOnboardingStore((s) => s.claimForUser)
  const resetOnboarding = useOnboardingStore((s) => s.reset)

  const serverCompleted = sharedUser?.onboardingCompleted

  // The wizard's answers belong to one account — see the web's useRedirectGuard.
  useEffect(() => {
    if (!sharedUser?.id) return
    claimForUser(sharedUser.id)
    if (serverCompleted === false && useOnboardingStore.getState().isCompleted) {
      resetOnboarding()
    }
  }, [sharedUser?.id, serverCompleted, claimForUser, resetOnboarding])

  if (!isAuthenticated) return <Navigate to="/login" replace />

  // ONE offline/onboarding decision, shared with the server-side gate's rules:
  // a locally completed business keeps working offline even when no cloud
  // answer is available; an incomplete one resumes at its actual step. A stale
  // «server says false» never takes completed local work away.
  const decision = evaluateOfflineOnboarding({
    localCompletedAt: localCompleted ? 'local' : null,
    localStep,
    // An offline desktop session has no verified cloud activation; the server
    // answer only tells us onboarding finished there, not that sync is active.
    cloudActivated: false,
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
