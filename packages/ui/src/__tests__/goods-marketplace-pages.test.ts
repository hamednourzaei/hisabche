// ============================================
// The goods marketplace on the web (3 Oct 2026) — infrastructure, OFF by default.
//
// What must stay true, read from the source of the three public pages, the
// sitemap and the seller screen:
//
//   - CLOSED IS 404 + NOINDEX. Off, a missing seller and a missing listing all
//     call notFound() and answer noindex metadata — never an empty page that
//     looks like «no products» and gets indexed.
//   - the sitemap lists market URLs only when the API says `enabled`;
//   - every public page states canonical + hreflang (fa, fa-AF, en) + OG +
//     Twitter through the one helper, and emits JSON-LD;
//   - it is a showcase: no text in any language claims online ordering,
//     payment, a cart or delivery (landing-claims rule);
//   - the seller screen says «not enabled yet» while off, and offers no form;
//   - the public route cannot be reached from the dashboard route group, and
//     the seller's dashboard route is disallowed for crawlers.
// ============================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..', '..')
const WEB = join(ROOT, 'apps', 'web')
const MARKET = join(WEB, 'app', '[lang]', 'market')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (...parts: string[]) => strip(readFileSync(join(...parts), 'utf8'))
// For files whose STRINGS hold a slash-star (robots.ts disallows '/STAR/dashboard'):
// the block-comment stripper reads those as comment openers and eats the code
// between them. Here only whole-line comments are removed.
const COMMENT_LINE = new RegExp('^\\s*(//|/\\*\\*|\\*)')
const readLines = (...parts: string[]) =>
  readFileSync(join(...parts), 'utf8')
    .split('\n')
    .filter((line) => !COMMENT_LINE.test(line))
    .join('\n')

const PAGES = {
  index: read(MARKET, 'page.tsx'),
  seller: read(MARKET, '[seller]', 'page.tsx'),
  listing: read(MARKET, '[seller]', '[listing]', 'page.tsx'),
}
const shared = read(MARKET, 'market-shared.tsx')

describe('closed is 404 + noindex', () => {
  it.each(Object.entries(PAGES))('%s page', (_name, src) => {
    expect(src).toContain('notFound()')
    expect(src).toContain('return CLOSED_METADATA')
    // Server components: no client island, no hydration.
    expect(src).not.toContain("'use client'")
  })

  it('the closed metadata is noindex, nofollow', () => {
    expect(shared).toContain(
      'export const CLOSED_METADATA: Metadata = { robots: { index: false, follow: false } }',
    )
  })

  it('the API client turns 404 and 503 into «closed» and throws on anything else', () => {
    const api = read(WEB, 'lib', 'market-api.ts')
    expect(api).toContain(
      "if (response.status === 404 || response.status === 503) return { kind: 'closed' }",
    )
    expect(api).toContain('throw new MarketUnavailableError')
  })
})

describe('SEO of an open page', () => {
  it('one helper states canonical, hreflang for the three languages, OG and Twitter', () => {
    expect(shared).toContain('canonical: localePath(input.locale, input.path)')
    expect(shared).toContain('languages: languageAlternates(input.path)')
    expect(shared).toContain('openGraph:')
    expect(shared).toContain('twitter:')
    for (const src of Object.values(PAGES)) expect(src).toContain('marketMetadata({')
  })

  it('JSON-LD: BreadcrumbList everywhere, Store on the seller, Product + Offer on the listing', () => {
    for (const src of Object.values(PAGES)) expect(src).toContain('breadcrumb(locale, [')
    expect(PAGES.seller).toContain('sellerSchema(locale, shop)')
    expect(PAGES.listing).toContain("'@type': 'Product'")
    expect(PAGES.listing).toContain("'@type': 'Offer'")
    expect(shared).toContain("'@type': 'Store'")
    expect(shared).toContain("'@type': 'BreadcrumbList'")
  })

  it('the Offer price is text moved by digits, and toman is stated as rial × 10', () => {
    expect(shared).toContain(
      "if (currency === 'IRT') return { price: String(minor * 10), priceCurrency: 'IRR' }",
    )
    expect(shared).toContain('minorToDecimal(minor, FRACTION_DIGITS[currency])')
  })

  it('the layout provides the namespaces the page chrome reads (BUG-079)', () => {
    expect(read(MARKET, 'layout.tsx')).toContain(
      "namespaces={[...CORE_NAMESPACES, 'blog', 'market']}",
    )
  })
})

describe('the sitemap lists the marketplace only while it is on', () => {
  const sitemap = readLines(WEB, 'app', 'sitemap.ts')

  it('market entries are added, gated on `enabled`', () => {
    expect(sitemap).toContain('entries.push(...(await marketEntries()))')
    expect(sitemap).toContain("if (result.kind !== 'ok' || !result.data.enabled) return []")
  })

  it('`/market` is not in the static route list — it would be a 404 while off', () => {
    const routes = sitemap.slice(
      sitemap.indexOf('const routes = ['),
      sitemap.indexOf('const LAST_MODIFIED'),
    )
    expect(routes).not.toContain('/market')
  })
})

describe('the seller screen', () => {
  const seller = read(
    ROOT,
    'packages',
    'ui',
    'src',
    'components',
    'ui',
    'market',
    'market-seller-container.tsx',
  )

  it('says «not enabled yet» while off, before any form', () => {
    const off = seller.indexOf("title={t('market.notEnabled')}")
    const form = seller.indexOf('<ProfilePanel')
    expect(off).toBeGreaterThan(-1)
    expect(off).toBeLessThan(form)
    expect(seller).toContain('seller.data && !seller.data.enabled')
  })

  it('the price is typed by the seller, parsed as text — never the product price', () => {
    expect(seller).toContain('walletAmountToMinor(price, currency)')
    expect(seller).toContain('sellPrice: 0')
    expect(seller).not.toMatch(/setPrice\([^)]*sellPrice/)
  })

  it('the dashboard route exists, is noindex, and is disallowed in robots', () => {
    const page = join(WEB, 'app', '[lang]', '(dashboard)', 'market-seller', 'page.tsx')
    expect(existsSync(page)).toBe(true)
    expect(read(page)).toContain('robots: { index: false, follow: false }')
    expect(readLines(WEB, 'app', 'robots.ts')).toContain("'/*/market-seller'")
    // The PUBLIC marketplace must stay crawlable.
    expect(readLines(WEB, 'app', 'robots.ts')).not.toContain("'/*/market',")
  })
})

describe('a showcase, not a shop — in every language', () => {
  const CLAIMS = [
    /خرید آنلاین/,
    /پرداخت آنلاین/,
    /سبد خرید/,
    /افزودن به سبد/,
    /ارسال رایگان/,
    /ثبت سفارش/,
    /buy now/i,
    /add to cart/i,
    /checkout/i,
    /online payment/i,
    /free shipping/i,
    /place (an |your )?order/i,
  ]

  it.each(['fa', 'af', 'en'])('%s: no market text claims ordering, payment or delivery', (lang) => {
    const bundle = JSON.parse(
      readFileSync(join(ROOT, 'packages', 'i18n', 'messages', lang, 'common.json'), 'utf8'),
    ) as { market: unknown; nav: Record<string, string> }
    const texts: string[] = [bundle.nav.market_seller!, bundle.nav.market_seller_description!]
    const walk = (node: unknown) => {
      if (typeof node === 'string') texts.push(node)
      else if (node && typeof node === 'object') Object.values(node).forEach(walk)
    }
    walk(bundle.market)
    expect(texts.length).toBeGreaterThan(80)
    const offenders = texts.filter((text) => CLAIMS.some((claim) => claim.test(text)))
    expect(offenders).toEqual([])
  })

  it('the listing page tells the buyer to contact the seller', () => {
    expect(PAGES.listing).toContain("t('market.public.howToBuy')")
  })
})
