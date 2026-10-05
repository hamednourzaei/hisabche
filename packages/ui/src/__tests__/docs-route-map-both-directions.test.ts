// ============================================
// `ROUTE_DOCS_MAP` is checked in BOTH directions.
//
// ---------------------------------------------------------------------------
// ⚠️ THE HALF THAT WAS NEVER CHECKED
//
// The existing guard verified that every docs slug in the map is a real
// article. Nothing verified the other side: that every PRODUCT ROUTE in the map
// is a real route.
//
// Five were not. Four of them (`invoice-detail`, `products`, `payments`,
// `pos`) were inert — a key that matches no path simply never fires the «؟».
// The fifth was live: `branches` was the only route mapped to the `branches`
// article, so `docs-client` inverted the map, built «باز کردن در برنامه» as
// `/fa/branches`, and that link 404ed on the public site. Branch management is
// a TAB on `/team-and-payroll`, not a route of its own.
//
// The failure is invisible from either end on its own. From the app side a
// dead key does nothing; from the docs side the button looks perfectly normal
// until it is clicked. Only relating the two tables finds it.
// ============================================

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ROUTE_DOCS_MAP } from '../components/ui/docs/docs-help-link'
import { DOCS_ARTICLES } from '../lib/docs/docs-content'

const DASHBOARD = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'apps',
  'web',
  'app',
  '[lang]',
  '(dashboard)',
)

/** Does this product route render a page? */
function routeExists(route: string): boolean {
  // A route may be nested (`a/b`), and the segment folder must hold a page.
  // A key may name one section of a page (`a?tab=b`): the page must exist.
  const page = route.split('?')[0] ?? ''
  return existsSync(join(DASHBOARD, ...page.split('/'), 'page.tsx'))
}

/** What `docs-client` builds: the FIRST product route mapped to each slug. */
function appLinkPerArticle(): Map<string, string> {
  const first = new Map<string, string>()
  for (const [route, slug] of Object.entries(ROUTE_DOCS_MAP)) {
    if (!first.has(slug)) first.set(slug, route)
  }
  return first
}

describe('the map is anchored at both ends', () => {
  it('found the dashboard route group', () => {
    // A moved directory would make every assertion below vacuous.
    expect(existsSync(DASHBOARD), DASHBOARD).toBe(true)
  })

  it('has a plausible number of entries', () => {
    expect(Object.keys(ROUTE_DOCS_MAP).length).toBeGreaterThan(15)
  })

  it('⚠️ every product route in the map is a real route', () => {
    const dead = Object.keys(ROUTE_DOCS_MAP).filter((route) => !routeExists(route))

    expect(
      dead,
      'these keys name routes that do not exist — the «؟» never fires for them, and one of them can become an article\'s "open in app" link',
    ).toEqual([])
  })

  it('every docs slug in the map is a real article', () => {
    // The direction that was already covered. Kept here so both live together
    // and neither can be dropped without the other being noticed.
    const slugs = new Set(DOCS_ARTICLES.map((article) => article.slug))
    const unknown = [...new Set(Object.values(ROUTE_DOCS_MAP))].filter((slug) => !slugs.has(slug))

    expect(unknown, 'these map to articles that do not exist').toEqual([])
  })

  it('⚠️ every article\'s "open in app" link points at a route that exists', () => {
    // This is the one that was actually broken in production. It is not the
    // same assertion as «every key is real»: the inversion picks ONE route per
    // article, so a single dead key can be the one chosen.
    const broken = [...appLinkPerArticle().entries()]
      .filter(([, route]) => !routeExists(route))
      .map(([slug, route]) => `/docs/${slug} → /${route}`)

    expect(broken, 'these «باز کردن در برنامه» buttons lead to a 404').toEqual([])
  })

  it('branches resolves to the screen that actually holds them', () => {
    // Named explicitly: this is the entry that was wrong, and «there is no
    // /branches route» is the kind of fact that gets forgotten and re-added.
    expect(appLinkPerArticle().get('branches')).toBe('team-and-payroll')
  })
})
