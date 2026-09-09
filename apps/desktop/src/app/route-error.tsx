// ============================================
// The route error boundary for every desktop screen.
//
// ---------------------------------------------------------------------------
// WHY THIS IS `errorElement` AND NOT ANOTHER <ErrorBoundary>
//
// react-router already catches everything thrown while rendering a route, in a
// lazy chunk, or out of a loader/action, and hands it to the nearest
// `errorElement`. Wrapping the routes in a second React boundary would race
// that mechanism: the router would win for route errors, the boundary for the
// rest, and the user would meet two different error screens depending on which
// one caught. So the router's own convention is used, and the SCREEN it renders
// is the shared one from `@hisabche/ui` — the same fallback web shows.
//
// ---------------------------------------------------------------------------
// WHERE THE WAY OUT LEADS
//
// Signed in → the dashboard, which is `/` here. Signed out → the landing
// screen, which on desktop is `/login`: a packaged Electron app has no
// marketing landing page, and `RequireAuth` sends an unauthenticated user
// there anyway. The DECISION (dashboard vs landing) is made inside the shared
// boundary from the one auth store; this file only knows the addresses.
// ============================================

import { useEffect } from 'react'
import { useNavigate, useRouteError } from 'react-router-dom'
import { ErrorFallbackView, type EscapeDestination } from '@hisabche/ui'

export function RouteErrorBoundary() {
  const error = useRouteError()
  const navigate = useNavigate()

  // ⚠️ NOT SWALLOWED. The router hands the error here and nowhere else, so if
  // this screen does not print it, nothing does — and an error screen with no
  // cause behind it is worse than the crash it replaced.
  useEffect(() => {
    console.error('[RouteErrorBoundary] route render failed:', error)
  }, [error])

  const asError =
    error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error')

  return (
    <ErrorFallbackView
      // `errorElement` has no "reset": the router does not re-run the failed
      // render on request. Re-entering the route is the honest retry, and the
      // escape button below is the one that actually leads somewhere.
      onReset={() => navigate(0)}
      onReload={() => navigate(0)}
      error={asError}
      exhausted={false}
      onNavigateHome={(destination: EscapeDestination) =>
        navigate(destination === 'dashboard' ? '/' : '/login', { replace: true })
      }
    />
  )
}
