'use client'

// ============================================
// Navigation for a shared screen, on whichever host mounts it.
//
// A screen knows the route (`/invoices/42`); only the host knows whether a
// language prefix belongs in front of it. Web mounts screens under `[lang]`, so
// `useParams()` carries it; the desktop/mobile shell has no such segment and
// the shim's `useParams()` simply does not have it. `localizePath` decides from
// that, so the same container navigates correctly on both — which is what lets
// a web `page.tsx` be nothing but metadata and a container, with no
// `onNavigate` wiring of its own.
// ============================================

import { useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { localizePath } from '@hisabche/ui-contract'

/** The current `[lang]` segment, or undefined on a host that has none. */
export function useRouteLang(): string | undefined {
  const params = useParams<{ lang?: string }>()
  return typeof params?.lang === 'string' ? params.lang : undefined
}

/**
 * `router.push` for a route written without a locale (`/invoices/42`).
 * A route that already carries this locale is left alone, so a computed path
 * (a notification's entity link, a contract route) is safe to pass either way.
 */
export function useLocalePush(): (route: string) => void {
  const router = useRouter()
  const lang = useRouteLang()
  return useCallback((route: string) => router.push(localizePath(route, lang)), [router, lang])
}

/** `router.replace`, same rule — for redirects that should not add history. */
export function useLocaleReplace(): (route: string) => void {
  const router = useRouter()
  const lang = useRouteLang()
  return useCallback((route: string) => router.replace(localizePath(route, lang)), [router, lang])
}
