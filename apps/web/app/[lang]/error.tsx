'use client'

/* ═══════════════════════════════════════════════════════════════════════════
   The route error boundary for EVERY page under `/[lang]`.
   ───────────────────────────────────────────────────────────────────────────
   ⚠️ ONE FILE, NOT ONE PER ROUTE.

   App Router walks UP from the segment that threw to the nearest `error.tsx`,
   so this single file catches the landing page, the auth pages, the public
   invoice and task pages and every screen in the `(dashboard)` group —
   including a failed action, because an action that throws during a render or
   a transition surfaces here. Adding a copy per route group would give four
   error screens to keep in step for no extra coverage. `global-error.tsx`
   still exists for the one case this cannot catch: the root layout itself
   failing, when there is no provider tree left to render into.

   ⚠️ THE ERROR IS STILL REPORTED. A boundary that hides the cause is worse
   than the crash — Sentry gets the exception and the console gets the digest,
   which is the only handle on a minified production stack.

   ⚠️ THE LOCALE IS CARRIED. Web routes are `localePrefix: 'always'`, so the
   way out must be `/fa/dashboard`, never `/dashboard`. Dropping the prefix
   would answer a Persian user's crash by switching their language.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { ErrorFallbackView, type EscapeDestination } from '@hisabche/ui'

import { localePath, resolveLocale } from './i18n-config'

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const params = useParams<{ lang?: string | string[] }>()

  // `useParams` can hand back an array for a catch-all segment, and the value
  // reaches this file straight from the URL — so it goes through the SAME
  // narrowing every other locale-aware route uses rather than being pasted
  // into a path. An unrecognised value falls back to the default locale
  // instead of building `/<anything>/dashboard`.
  const raw = Array.isArray(params?.lang) ? params.lang[0] : params?.lang
  const lang = resolveLocale(raw ?? '')

  useEffect(() => {
    Sentry.captureException(error)
    console.error('[error.tsx] uncaught error on', lang, error?.digest ?? '', error)
  }, [error, lang])

  // `replace`, not `push`: the broken URL should not stay one Back press away.
  const goHome = (destination: EscapeDestination) => {
    router.replace(localePath(lang, destination === 'dashboard' ? '/dashboard' : ''))
  }

  return (
    <ErrorFallbackView
      onReset={reset}
      onReload={() => window.location.reload()}
      error={error}
      exhausted={false}
      onNavigateHome={goHome}
    />
  )
}
