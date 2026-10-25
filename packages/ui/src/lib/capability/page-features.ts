// ============================================
// packages/ui/src/lib/capability/page-features.ts
//
// Which feature a PAGE (or the tab/section of a hub) is — so the shell can gate
// the whole entry point once, before any request, from the same registry and
// offline endpoint matrix every other gate reads.
//
// ⚠️ NOT A SECOND COPY OF THE MATRIX. This says «this address is that feature»;
// whether the device can run it is `featureOfflineAvailability`, still the
// matrix's. A page that is a mix of features the device runs (the dashboard,
// settings, the invoice list) has no row: its parts gate themselves.
// ============================================

import type { FeatureKey } from '@hisabche/validation'

interface PageFeature {
  /** The page, without the locale. */
  path: string
  /** `?tab=`; absent = any */
  tab?: string
  /** `?view=`; absent = any */
  view?: string
  feature: FeatureKey
}

/** First match wins: the narrowest rule of a page comes first. */
export const PAGE_FEATURES: readonly PageFeature[] = [
  { path: '/stock-count', feature: 'stockcount.list' },
  { path: '/manufacturing', feature: 'manufacturing.bom' },
  { path: '/assistant', feature: 'ai.assistant' },
  { path: '/approvals', feature: 'approvals.workflows' },
  { path: '/billing', feature: 'billing.portal' },
  { path: '/developers', feature: 'developer.keys' },
  { path: '/marketplace', feature: 'marketplace.apps' },
  { path: '/market-seller', feature: 'storefront.public' },
  { path: '/governance', feature: 'governance.permission_matrix' },

  { path: '/accounting', tab: 'books', view: 'monthEnd', feature: 'accounting.period_close' },
  { path: '/accounting', tab: 'treasury', view: 'assets', feature: 'asset.fixed' },
  { path: '/accounting', tab: 'treasury', view: 'financing', feature: 'accounting.financing' },
  { path: '/accounting', tab: 'treasury', feature: 'bank.import' },

  { path: '/warehouse', tab: 'expiry', feature: 'expiry.batches' },
  { path: '/operations', view: 'stale', feature: 'customer.crm' },
]

const LOCALES = new Set(['fa', 'af', 'en'])

/** The feature this address is, or `null` when the page is a mix that gates its own parts. */
export function featureForPage(pathname: string, search: string): FeatureKey | null {
  const parts = (pathname.split('?')[0] ?? '').split('/').filter(Boolean)
  if (parts[0] && LOCALES.has(parts[0])) parts.shift()
  const path = `/${parts[0] ?? ''}`
  const params = new URLSearchParams(search)
  for (const rule of PAGE_FEATURES) {
    if (rule.path !== path) continue
    if (rule.tab !== undefined && params.get('tab') !== rule.tab) continue
    if (rule.view !== undefined && params.get('view') !== rule.view) continue
    return rule.feature
  }
  return null
}
