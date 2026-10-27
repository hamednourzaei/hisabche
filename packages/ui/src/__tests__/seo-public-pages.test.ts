// ============================================
// Public SEO pages — guards for the defects found by the real-HTTP crawl
// (25 Oct 2026, docs/SEO/AUDIT.md).
//
// These are not style assertions. Each one corresponds to an observed failure:
//   1. /blog and /market answered 500 because a server-side fetch was handed a
//      relative URL (`Failed to parse URL from /api/...`).
//   2. The landing page emitted Organization/WebSite twice (layout + page) and
//      FAQPage twice (page + the visible FAQ component).
//   3. The docs BreadcrumbList pointed its middle item at `/docs`, which is a
//      308 redirect, not a 200 canonical page.
//   4. Public header links to /login and /signup did not carry rel="nofollow".
// ============================================

import fs from 'node:fs'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

const WEB = path.resolve(__dirname, '../../../../apps/web')

function read(rel: string): string {
  return fs.readFileSync(path.join(WEB, rel), 'utf8')
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\s+/g, ' ')
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.NEXT_PUBLIC_API_URL
  delete process.env.BLOG_API_URL
  delete process.env.MARKET_API_URL
})

describe('server-side API fetchers', () => {
  it('never hand fetch a relative URL, even when NEXT_PUBLIC_API_URL is relative', async () => {
    process.env.NEXT_PUBLIC_API_URL = '/api'
    delete process.env.BLOG_API_URL
    delete process.env.MARKET_API_URL

    const requested: string[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      requested.push(String(input))
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    })

    vi.resetModules()
    const blog = await import('../../../../apps/web/lib/blog-api')
    await blog.fetchBlogList({ locale: 'fa', page: 1 })

    vi.resetModules()
    const market = await import('../../../../apps/web/lib/market-api')
    await market.fetchMarketListings({})

    expect(requested.length).toBeGreaterThanOrEqual(2)
    for (const url of requested) {
      expect(() => new URL(url), `${url} must be absolute`).not.toThrow()
    }
  })
})

describe('landing JSON-LD', () => {
  it('does not repeat Organization/WebSite/FAQPage already emitted elsewhere', () => {
    const source = stripComments(read('app/[lang]/page.tsx'))
    expect(source).not.toContain("'@type': 'Organization'")
    expect(source).not.toContain("'@type': 'WebSite'")
    expect(source).not.toContain("'@type': 'FAQPage'")
    // The product node is still there.
    expect(source).toContain("'@type': 'SoftwareApplication'")
  })
})

describe('docs breadcrumb', () => {
  it('does not point a breadcrumb item at the /docs redirect', () => {
    const source = stripComments(read('app/[lang]/docs/[slug]/page.tsx'))
    expect(source).not.toContain("localeUrl(locale, '/docs')")
    expect(source).toContain('BreadcrumbList')
  })
})

describe('sitemap output', () => {
  it('lists only absolute, public, unique URLs and never the /docs redirect', async () => {
    // Blog and market closed → they must not appear; static routes + guides must.
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }))
    vi.resetModules()
    const { default: sitemap } = await import('../../../../apps/web/app/sitemap')
    const entries = await sitemap()
    const urls = entries.map((entry: { url: string }) => entry.url)

    expect(urls.length).toBeGreaterThan(100)
    for (const url of urls) {
      expect(() => new URL(url), `${url} must be absolute`).not.toThrow()
      expect(url.startsWith('https://hisabche.com/')).toBe(true)
      expect(url).not.toContain('?')
      expect(url).not.toMatch(/\/(login|signup|dashboard|docs)$/)
    }
    expect(new Set(urls).size).toBe(urls.length)
    expect(urls.some((url: string) => url.includes('/market'))).toBe(false)
  }, 30_000)
})

describe('public → private links', () => {
  it('login and signup links from a public header are nofollow', () => {
    const source = stripComments(
      fs.readFileSync(
        path.resolve(__dirname, '../components/ui/navigation/public-auth-actions.tsx'),
        'utf8',
      ),
    )
    const tags = [...source.matchAll(/<Link\b[^>]*>/g)].map((m) => m[0])
    const login = tags.find((tag) => tag.includes('/login'))
    const signup = tags.find((tag) => tag.includes('/signup'))
    expect(login, 'login link must exist').toBeTruthy()
    expect(signup, 'signup link must exist').toBeTruthy()
    expect(login).toContain('rel="nofollow"')
    expect(signup).toContain('rel="nofollow"')
  }, 120_000) // imports the whole sitemap graph; 32 s under a full-suite load
})

// ── The measured link graph ─────────────────────────────────────────────────
//
// `docs/SEO/internal-link-report.json` is the output of the crawl described in
// docs/SEO/INTERNAL-LINKING-BEFORE.md: 180 pages of the production build,
// parsed from the raw server HTML with JavaScript disabled. Guarding the
// artifact means a future page that is orphaned, linked through a redirect or
// linked with a generic anchor fails here even though it is not visible in a
// single component's source.
describe('internal link graph (raw server HTML)', () => {
  const reportPath = path.resolve(__dirname, '../../../../docs/SEO/internal-link-report.json')
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
    metrics: {
      totalPagesFetched: number
      totalLinks: number
      brokenLinks: number
      linksThroughRedirect: number
      linksToNonCanonical: number
      genericAnchorLinks: number
      orphanImportantPages: string[]
    }
    pages: Array<{
      finalUrl: string
      indexable: boolean
      inbound: number
      depth: number
    }>
    edges: Array<{ from: string; to: string; anchor: string }>
  }

  const pathOf = (url: string) => new URL(url).pathname

  it('describes the real server HTML, not a handful of URLs', () => {
    expect(report.metrics.totalPagesFetched).toBeGreaterThanOrEqual(150)
    expect(report.metrics.totalLinks).toBeGreaterThanOrEqual(2000)
  })

  it('has no broken, redirected, non-canonical or generic-anchor links', () => {
    expect(report.metrics.brokenLinks).toBe(0)
    expect(report.metrics.linksThroughRedirect).toBe(0)
    expect(report.metrics.linksToNonCanonical).toBe(0)
    expect(report.metrics.genericAnchorLinks).toBe(0)
    expect(report.metrics.orphanImportantPages).toEqual([])
  })

  it('never links to `/` or across locales without a reason', () => {
    for (const edge of report.edges) {
      const from = pathOf(edge.from)
      const to = pathOf(edge.to)
      expect(to, `${edge.from} → ${edge.to}`).not.toBe('/')
      const locale = from.split('/')[1] ?? ''
      if (['fa', 'af', 'en'].includes(locale)) {
        expect(to.startsWith(`/${locale}/`) || to === `/${locale}`, to).toBe(true)
      }
    }
  })

  it('keeps every Tier 1/2 page within depth 2 and at least 3 inbound links', () => {
    const tier12 = report.pages.filter((page) => {
      const route = pathOf(page.finalUrl)
      return (
        /^\/(fa|af|en)$/.test(route) ||
        /\/(features|blog)\//.test(route) ||
        /\/(about|contact)$/.test(route)
      )
    })
    expect(tier12.length).toBeGreaterThanOrEqual(25)
    for (const page of tier12) {
      expect(page.depth, `${page.finalUrl} depth`).toBeLessThanOrEqual(2)
      expect(page.inbound, `${page.finalUrl} inbound`).toBeGreaterThanOrEqual(3)
    }
  })

  it('gives every indexable page at least one inbound link', () => {
    const indexable = report.pages.filter((page) => page.indexable && page.inbound !== undefined)
    const orphans = indexable.filter((page) => page.inbound === 0)
    expect(orphans.map((page) => page.finalUrl)).toEqual([])
  })
})
