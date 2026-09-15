// packages/ui/src/components/ui/landing/landing-client-sections.tsx
'use client'

// The only landing sections that need to run in the browser: the FAQ accordion
// (open/closed state) and the footer (the year is read after mount). They take a
// `t` function, which cannot cross from a server component — so these thin
// wrappers build it here, from the client message provider.
import { useCallback } from 'react'
import { useTranslations } from 'next-intl'

import FaqScene from './faq-scene'
import SiteFooter from './site-footer'

function useSafeT() {
  const t = useTranslations()
  return useCallback(
    (key: string, fallback?: string) => {
      const result = t(key as Parameters<typeof t>[0])
      return result && result !== key ? result : (fallback ?? key)
    },
    [t],
  )
}

export function LandingFaq() {
  return <FaqScene t={useSafeT()} />
}

export function LandingFooter({ localePrefix }: { localePrefix: string }) {
  return <SiteFooter t={useSafeT()} localePrefix={localePrefix} />
}
