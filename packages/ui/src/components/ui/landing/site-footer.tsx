// packages/ui/src/components/ui/landing/site-footer.tsx
'use client'

// Client wrapper for pages that are client trees (features, legal, contact,
// docs). The year is read after mount (useNow): those pages are cached, so the
// served HTML can carry last year while the browser computes this one — React
// error #418 would throw the subtree away. The server landing renders
// SiteFooterView directly instead.
import { useNow } from '../../../hooks/use-now'
import SiteFooterView from './site-footer-view'

export interface SiteFooterProps {
  t: (key: string, fallback?: string) => string
  localePrefix?: string
}

export default function SiteFooter({ t, localePrefix }: SiteFooterProps) {
  const now = useNow()
  const year = now === null ? null : new Date(now).getFullYear()
  return <SiteFooterView t={t} localePrefix={localePrefix} year={year} />
}
