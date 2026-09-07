// ============================================
// T12 — the public docs must not hand a competitor the implementation.
//
// ---------------------------------------------------------------------------
// THE REQUIREMENT, VERBATIM
//
//   «طوری نباشه که بتونن رقبا الگوریتم ها و نحوه پیاده سازی رو اونجا کپی
//    برداری بکنن این موضوغ خیلی مهمه دقت کن بهش»
//
// The docs are PUBLIC — readable without logging in, and indexable. Every
// sentence in them is a sentence a competitor reads.
//
// The line: say WHAT it does and HOW to use it, never HOW IT IS COMPUTED.
//
//   ✅ «پیشنهاد سفارش بر اساس فروش واقعی شما»
//   ⛔ «avg × leadTime + safety»
//
// ---------------------------------------------------------------------------
// ⚠️ EVERY LANGUAGE IS CHECKED, NOT ONLY PERSIAN
//
// The text lives in the message bundles, so a leak can be introduced in the
// English or Dari file alone — and English is the one a competitor is most
// likely to read fluently. Checking only the language the author happened to
// write in would miss exactly the worst case.
//
// ---------------------------------------------------------------------------
// ⚠️ WHY A TEST AND NOT A STYLE NOTE
//
// Docs get edited casually, usually by whoever is closest to the feature — the
// person who knows the formula and finds it natural to explain. A note in a
// header does not survive that. A failing build does.
//
// There is a second reason, unrelated to competitors: a published formula is a
// PROMISE. Change the model later and the docs are silently wrong, and someone
// has reconciled their books against them.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { DOCS_ARTICLES, DOCS_GROUPS, docsMessageKeys } from '../lib/docs/docs-content'
import { ROUTE_DOCS_MAP, docsSlugForPath } from '../components/ui/docs/docs-help-link'

const MESSAGES = join(__dirname, '..', '..', '..', 'i18n', 'messages')

const languages = readdirSync(MESSAGES).filter((entry) =>
  statSync(join(MESSAGES, entry)).isDirectory(),
)

const bundles = new Map<string, Record<string, unknown>>(
  languages.map((lang) => [
    lang,
    JSON.parse(readFileSync(join(MESSAGES, lang, 'common.json'), 'utf8')) as Record<
      string,
      unknown
    >,
  ]),
)

function resolve(bundle: Record<string, unknown>, key: string): string | undefined {
  let node: unknown = bundle
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : undefined
}

/** Every docs string, in every language, with where it came from. */
const strings: { where: string; text: string }[] = []
for (const [lang, bundle] of bundles) {
  for (const key of docsMessageKeys()) {
    const text = resolve(bundle, key)
    if (text) strings.push({ where: `${lang}:${key}`, text })
  }
}

describe('the docs exist, in every language', () => {
  it('there is more than one language to compare', () => {
    expect(languages.length).toBeGreaterThan(1)
  })

  it('every key resolves in every language', () => {
    // A docs page whose English bundle is missing renders raw key paths — the
    // «نامفهوم» defect class, on the most public page in the product.
    const missing: string[] = []
    for (const [lang, bundle] of bundles) {
      for (const key of docsMessageKeys()) {
        if (!resolve(bundle, key)) missing.push(`${lang}: ${key}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('the corpus is substantial', () => {
    // A guard over an empty corpus passes and proves nothing.
    expect(DOCS_ARTICLES.length).toBeGreaterThanOrEqual(8)
    expect(strings.length).toBeGreaterThan(200)
  })

  it('every group has at least one article', () => {
    const used = new Set(DOCS_ARTICLES.map((article) => article.group))
    for (const group of DOCS_GROUPS) {
      expect(used.has(group), `no article in group ${group}`).toBe(true)
    }
  })

  it('slugs are unique and URL-safe — they become public URLs', () => {
    const slugs = DOCS_ARTICLES.map((article) => article.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(/^[a-z][a-z0-9-]*$/)
  })
})

describe('⛔ no internal name reaches a public page', () => {
  /**
   * Names from the schema and the codebase.
   *
   * Publishing these is worse than publishing a formula: they describe the
   * data model directly, and a competitor can rebuild from them.
   */
  const INTERNAL_NAMES = [
    'stock_movements',
    'cost_layers',
    'payment_allocations',
    'journal_entries',
    'journal_lines',
    'invoice_items',
    'product_units',
    'exchange_rates',
    'ai_query_log',
    'workspace_members',
    'auth_workspace_ids',
    'workspace_id',
    'supabase',
    'postgres',
    'postgrest',
    'row level security',
  ]

  it.each(INTERNAL_NAMES)('never mentions %s', (name) => {
    const offenders = strings
      .filter((entry) => entry.text.toLowerCase().includes(name.toLowerCase()))
      .map((entry) => entry.where)

    expect(offenders, `internal name "${name}" is published`).toEqual([])
  })
})

describe('⛔ no formula or algorithm is published', () => {
  /**
   * Shapes that mean «here is how it is computed».
   *
   * ⚠️ Deliberately about FORM, not vocabulary. Banning the word «average»
   * would ban an honest sentence; banning `x = a × b` bans the thing that is
   * actually copyable.
   */
  const FORMULA_SHAPES: { name: string; pattern: RegExp }[] = [
    { name: 'an equals-sign formula', pattern: /\w\s*=\s*\w+\s*[×*+\-/]/ },
    { name: 'a multiplication of named terms', pattern: /\b\w+\s*[×*]\s*\w+\s*[+\-]/ },
    { name: 'a code fence', pattern: /```/ },
    { name: 'SQL', pattern: /\bSELECT\b[\s\S]*\bFROM\b/i },
    { name: 'a snake_case identifier', pattern: /\b[a-z]+_[a-z]+\b/ },
    {
      name: 'a named costing algorithm',
      pattern: /\b(FIFO|LIFO|weighted average|moving average)\b/i,
    },
  ]

  it.each(FORMULA_SHAPES)('contains no $name', ({ pattern }) => {
    const offenders = strings
      .filter((entry) => pattern.test(entry.text))
      .map((entry) => `${entry.where}: ${entry.text.slice(0, 80)}`)

    expect(offenders).toEqual([])
  })
})

describe('the docs answer the two questions they are for', () => {
  const fa = bundles.get('fa')!
  const en = bundles.get('en')!

  it('the reorder text says WHAT it is based on, not HOW', () => {
    // The owner's own example of the right side of the line.
    expect(resolve(fa, 'docs.inventory.insights.body1')).toContain('فروش واقعی شما')
    expect(resolve(en, 'docs.inventory.insights.body1')).toContain('real sales')
  })

  it('the assistant article states the isolation guarantee', () => {
    // The one implementation fact that MUST be public: someone deciding
    // whether to let an assistant near their books needs to know it cannot
    // reach anyone else's. Saying so reveals nothing copyable.
    expect(resolve(fa, 'docs.assistant.limits.body1')).toContain('هیچ کسب‌وکار دیگری')
    expect(resolve(en, 'docs.assistant.limits.body1')).toContain('no access')
  })

  it('the offline article does not overclaim the web version', () => {
    // The landing page was corrected on exactly this point: the real offline
    // queue is mobile and desktop, and the browser needs a connection. Docs
    // saying otherwise would be the fabricated-claim defect again.
    expect(resolve(fa, 'docs.offline.browser.body1')).toContain('اینترنت نیاز دارد')
    expect(resolve(en, 'docs.offline.browser.body1')).toContain('needs a connection')
  })
})

// ============================================
// T12 — internal linking.
//
// ⚠️ ORPHANS ARE THE CLASSIC DOCS-SEO FAILURE. A set where every article is
// reachable only from the index gives a reader who arrived from a search
// result nowhere to go, and gives a crawler no path between pages. The link
// graph is the difference between eleven pages and one page with ten
// appendices.
// ============================================

describe('the docs are a linked graph, not a fan of orphans', () => {
  it('every article links to at least two others', () => {
    for (const article of DOCS_ARTICLES) {
      expect(
        article.related.length,
        `${article.slug} has too few related links`,
      ).toBeGreaterThanOrEqual(2)
    }
  })

  it('no article links to itself', () => {
    for (const article of DOCS_ARTICLES) {
      expect(article.related, `${article.slug} links to itself`).not.toContain(article.slug)
    }
  })

  it('every related slug is a real article', () => {
    const slugs = new Set(DOCS_ARTICLES.map((article) => article.slug))
    for (const article of DOCS_ARTICLES) {
      for (const slug of article.related) {
        expect(slugs.has(slug), `${article.slug} links to missing "${slug}"`).toBe(true)
      }
    }
  })

  it('⚠️ every article is linked FROM at least one other', () => {
    // The direction that actually matters. An article nobody links to is
    // reachable only from the index — which is exactly the orphan case.
    const linkedTo = new Set(DOCS_ARTICLES.flatMap((article) => article.related))

    const orphans = DOCS_ARTICLES.filter((article) => !linkedTo.has(article.slug)).map(
      (article) => article.slug,
    )

    expect(orphans, 'these are reachable only from the index').toEqual([])
  })

  it('outbound links point at routes that exist', () => {
    // A docs page linking to a 404 is worse than not linking: it wastes the
    // crawl and loses the reader at the moment they were interested.
    const REAL_ROUTES = ['/features/customer-debt', '/features/offline', '/about', '/contact']

    for (const article of DOCS_ARTICLES) {
      for (const link of article.outbound ?? []) {
        expect(REAL_ROUTES, `${article.slug} links to ${link.href}`).toContain(link.href)
      }
    }
  })

  it('every SEO title is set and is longer than the nav label', () => {
    // The nav label is «فاکتور»; the title tag has to carry the query. A
    // seoTitle that equals the title means the key was added and never
    // written.
    for (const [lang, bundle] of bundles) {
      for (const article of DOCS_ARTICLES) {
        const seo = resolve(bundle, `docs.${article.slug}.seoTitle`)
        const title = resolve(bundle, `docs.${article.slug}.title`)
        expect(seo, `${lang}: ${article.slug} has no seoTitle`).toBeDefined()
        expect(seo!.length, `${lang}: ${article.slug} seoTitle is too short`).toBeGreaterThan(
          (title ?? '').length,
        )
      }
    }
  })
})

// ============================================
// The in-app «?» — dashboard → documentation.
//
// ⚠️ CONTEXTUAL DEEP LINKS, NOT A HELP HUB. Each dashboard screen links to
// the article that answers ITS question. A link every page shares to a
// generic `/docs` makes the reader search again on arrival and passes no
// topical signal about any page.
// ============================================

describe('every dashboard route maps to a real article', () => {
  it('the map is populated', () => {
    expect(Object.keys(ROUTE_DOCS_MAP).length).toBeGreaterThan(15)
  })

  it('⚠️ no route points at a missing article', () => {
    // A «?» that 404s is worse than no «?» — the reader spends the click
    // finding out there is no help.
    const slugs = new Set(DOCS_ARTICLES.map((article) => article.slug))
    const broken = Object.entries(ROUTE_DOCS_MAP)
      .filter(([, slug]) => !slugs.has(slug))
      .map(([route, slug]) => `${route} → ${slug}`)

    expect(broken).toEqual([])
  })

  it('resolves a locale-prefixed path', () => {
    expect(docsSlugForPath('/fa/warehouse')).toBe('inventory')
    expect(docsSlugForPath('/en/invoices')).toBe('invoices')
  })

  it('resolves a path with no locale — the desktop shell', () => {
    expect(docsSlugForPath('/warehouse')).toBe('inventory')
  })

  it('ignores trailing segments', () => {
    // `/fa/invoices/abc-123` is still the invoices article.
    expect(docsSlugForPath('/fa/invoices/abc-123')).toBe('invoices')
  })

  it('returns null for a route with no article', () => {
    // No icon at all, rather than one pointing somewhere unrelated.
    expect(docsSlugForPath('/fa/some-unmapped-screen')).toBeNull()
    expect(docsSlugForPath('/')).toBeNull()
  })

  it('the accessible-name key exists in every language', () => {
    // «?» alone is not an accessible name, and «help» on every page is the
    // «click here» of internal linking.
    for (const [lang, bundle] of bundles) {
      expect(resolve(bundle, 'docs.helpFor'), `${lang} docs.helpFor`).toBeDefined()
    }
  })
})
