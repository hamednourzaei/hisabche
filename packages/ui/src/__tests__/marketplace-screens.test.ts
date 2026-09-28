// ============================================
// The marketplace on screen: every value the server can send has words in
// three languages (t() throws otherwise), the screen lives on web AND
// desktop, the admin's words exist, and the price is read from minor units.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  API_KEY_SCOPES,
  APP_CATEGORIES,
  APP_HEALTH_LEVELS,
  APP_PRICE_INTERVALS,
  APP_REPORT_REASONS,
  APP_RISK_FLAGS,
  APP_VERSION_STATUSES,
  OAUTH_ERROR_CODES,
} from '@hisabche/validation'

import { appPriceLabel } from '../lib/oauth-labels'

const ROOT = join(__dirname, '../../../..')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (p: string) => strip(readFileSync(join(ROOT, p), 'utf8'))
const catalog = (lang: string) =>
  JSON.parse(
    readFileSync(join(ROOT, 'packages/i18n/messages', lang, 'common.json'), 'utf8'),
  ) as Record<string, unknown>
const lookup = (tree: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], tree)

const ADMIN = 'apps/admin/app/[lang]/(admin)/oauth-apps/oauth-apps-client.tsx'
const MARKET = 'packages/ui/src/components/ui/marketplace/marketplace-view.tsx'

describe('words for every value the server sends', () => {
  it.each(['fa', 'af', 'en'])('%s', (lang) => {
    const m = catalog(lang)
    const missing: string[] = []
    const need = (key: string) => {
      if (typeof lookup(m, key) !== 'string') missing.push(key)
    }
    for (const v of APP_CATEGORIES) need(`oauth.category.${v}`)
    for (const v of APP_VERSION_STATUSES) need(`oauth.versionStatus.${v}`)
    for (const v of APP_HEALTH_LEVELS) need(`oauth.health.${v}`)
    for (const v of APP_RISK_FLAGS) need(`oauth.risk.${v}`)
    for (const v of APP_PRICE_INTERVALS) need(`oauth.pricing.per.${v}`)
    for (const v of APP_REPORT_REASONS) need(`marketplace.reason.${v}`)
    for (const v of OAUTH_ERROR_CODES) need(`oauth.error.${v}`)
    for (const v of API_KEY_SCOPES) need(`developer.scope.${v.replace(':', '_')}`)
    for (const v of ['open', 'resolved', 'dismissed']) need(`admin.oauthApps.reportStatus.${v}`)
    for (const v of ['versions', 'apps', 'publishers', 'reports', 'reviews'])
      need(`admin.oauthApps.tabs.${v}`)
    // Every literal key the admin page and the marketplace screen use.
    for (const file of [ADMIN, MARKET]) {
      for (const k of read(file).matchAll(/t\('([a-zA-Z]+\.[a-zA-Z_.]+)'/g)) need(k[1] as string)
    }
    expect(missing).toEqual([])
  })

  it('no key is left over from the removed marketplace-in-a-panel', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const oauth = catalog(lang).oauth as Record<string, unknown>
      expect(Object.keys(oauth)).not.toContain('marketplaceTitle')
      expect(Object.keys(oauth.error as object)).not.toContain('APP_LOCKED')
    }
  })
})

describe('where it lives', () => {
  it('web and desktop both route to the one shared container; crawlers are kept out', () => {
    expect(read('apps/web/app/[lang]/(dashboard)/marketplace/page.tsx')).toContain(
      '<MarketplaceContainer initialApp=',
    )
    expect(read('packages/app-shell/src/app/app.tsx')).toContain(
      "{ path: 'marketplace', element: <MarketplacePage /> }",
    )
    expect(read('packages/app-shell/src/features/marketplace/marketplace-page.tsx')).toContain(
      '<MarketplaceContainer initialApp=',
    )
    expect(readFileSync(join(ROOT, 'apps/web/app/robots.ts'), 'utf8')).toContain("'/*/marketplace'")
  })

  it('the developer screen links to it instead of drawing a second marketplace', () => {
    const panel = read('packages/ui/src/components/ui/developers/oauth-apps-panel.tsx')
    expect(panel).toContain('href={props.marketplaceHref}')
    expect(panel).not.toContain('useMarketplaceApps')
    expect(panel).not.toContain('props.marketplace.map')
  })
})

describe('what a listing shows comes from the server', () => {
  const view = read(MARKET)

  it('permissions are the server’s disclosure, read/write as the server marked them', () => {
    expect(view).toContain('d.disclosure.scopes.map(')
    expect(view).toContain("s.access === 'write'")
    expect(view).toContain('d.disclosure.events')
  })

  it('«no reviews» and «no version» are said, not drawn as zero stars', () => {
    expect(view).toContain('d.rating.reviews === 0 ?')
    expect(view).toContain("t('marketplace.noReviews')")
    expect(view).toContain("t('marketplace.noVersionYet')")
  })

  it('install goes to the publisher’s site in a new tab, never opening this app to it', () => {
    expect(view).toMatch(
      /href=\{d\.installUrl\}\s*target="_blank"\s*rel="noopener noreferrer nofollow"/,
    )
  })
})

describe('money', () => {
  const t = (k: string) => k

  it('a price is formatted from minor units with the currency’s own decimals', () => {
    // AFN is written without minor units here (FRACTION_DIGITS 0); USD has two.
    const afn = appPriceLabel(
      t,
      { model: 'paid', priceMinor: 500, currency: 'AFN', interval: 'month' },
      'en',
    )
    expect(afn).toMatch(/^500 /)
    expect(afn).toContain('oauth.pricing.per.month')
    const usd = appPriceLabel(
      t,
      { model: 'paid', priceMinor: 1999, currency: 'USD', interval: 'year' },
      'en',
    )
    expect(usd).toMatch(/^19\.99 /)
    expect(appPriceLabel(t, { model: 'free' }, 'en')).toBe('oauth.pricing.free')
  })

  it('the publisher’s price field is parsed exactly, never through a float', () => {
    const panel = read('packages/ui/src/components/ui/developers/app-manage-panel.tsx')
    expect(panel).toContain('parseAmountMinor(price, fractionDigits(currency as KnownCurrency))')
    expect(panel).not.toMatch(/parseFloat|Number\(price\)/)
  })
})
