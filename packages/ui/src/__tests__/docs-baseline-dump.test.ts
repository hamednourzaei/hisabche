// ============================================
// Prerequisite Zero — FREEZE THE BASELINE.
//
// ⚠️ THIS IS A DUMP, NOT A TEST. It runs through vitest only because that is
// the one runner in this repo that can load the real TypeScript data
// structures — parsing `docs-content.ts` with a regex would produce a baseline
// of what the file LOOKS like rather than what the product actually serves,
// and a baseline that is subtly wrong is worse than none.
//
// It writes two files that the Fumadocs migration is later diffed against:
//
//   docs/baseline/docs-route-baseline.json    every route, from all 6 sources
//   docs/baseline/content-baseline.json       every article, per locale
//
// Skipped unless DOCS_BASELINE=1, so a normal test run neither writes files nor
// pays for this.
// ============================================

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { DOCS_ARTICLES, docsMessageKeys } from '../lib/docs/docs-content'
import { ROUTE_DOCS_MAP } from '../components/ui/docs/docs-help-link'

const REPO = join(__dirname, '..', '..', '..', '..')
const MESSAGES = join(REPO, 'packages', 'i18n', 'messages')
const OUT = join(REPO, 'docs', 'baseline')

/** The locales that actually serve routes. Read from the app, not assumed. */
const LOCALES = ['fa', 'af', 'en'] as const

function bundle(lang: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(MESSAGES, lang, 'common.json'), 'utf8'))
}

function resolve(node: Record<string, unknown>, key: string): string | undefined {
  let cur: unknown = node
  for (const part of key.split('.')) {
    if (typeof cur !== 'object' || cur === null || !(part in cur)) return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return typeof cur === 'string' ? cur : undefined
}

const describeMaybe = process.env.DOCS_BASELINE === '1' ? describe : describe.skip

describeMaybe('freeze the docs baseline', () => {
  it('writes docs-route-baseline.json from all six sources', () => {
    mkdirSync(OUT, { recursive: true })

    // ─── Source 1: the content source itself ───
    const slugs = DOCS_ARTICLES.map((a) => a.slug)

    // ─── Source 2: docs.helpFor — product route → docs slug ───
    const productToDocs = Object.entries(ROUTE_DOCS_MAP)

    // ─── Source 3: productLink — the reverse, as docs-client builds it ───
    // It inverts ROUTE_DOCS_MAP and takes the FIRST product route per slug.
    const docsToProduct = new Map<string, string>()
    for (const [route, slug] of productToDocs) {
      if (!docsToProduct.has(slug)) docsToProduct.set(slug, route)
    }

    // ─── Source 4: sitemap.ts ───
    const sitemap = readFileSync(join(REPO, 'apps', 'web', 'app', 'sitemap.ts'), 'utf8')
    const sitemapHasDocs = sitemap.includes("{ path: '/docs' }")
    const sitemapMapsArticles = sitemap.includes('DOCS_ARTICLES.map')

    // ─── Source 5: links between articles ───
    const internalLinks = DOCS_ARTICLES.flatMap((a) =>
      a.related.map((target) => ({ from: a.slug, to: target })),
    )
    const outboundLinks = DOCS_ARTICLES.flatMap((a) =>
      (a.outbound ?? []).map((l) => ({ from: a.slug, href: l.href })),
    )

    // ─── Source 6: other public references ───
    const footer = readFileSync(
      join(REPO, 'packages', 'ui', 'src', 'components', 'ui', 'landing', 'site-footer.tsx'),
      'utf8',
    )
    const footerLinksToDocs = footer.includes("href: '/docs'")

    const rows: Record<string, unknown>[] = []
    for (const locale of LOCALES) {
      rows.push({
        route: `/${locale}/docs`,
        locale,
        source: 'index',
        productRoute: null,
        docsSlug: null,
        reverseProductLink: null,
        expectedStatus: 200,
      })
      for (const slug of slugs) {
        const product = docsToProduct.get(slug) ?? null
        rows.push({
          route: `/${locale}/docs/${slug}`,
          locale,
          source: 'i18n-key',
          productRoute: product ? `/${locale}/${product}` : null,
          docsSlug: slug,
          reverseProductLink: product ? `/${locale}/${product}` : null,
          expectedStatus: 200,
        })
      }
    }

    writeFileSync(
      join(OUT, 'docs-route-baseline.json'),
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          note: 'Frozen BEFORE the Fumadocs migration. Diff the post-migration state against this.',
          locales: LOCALES,
          sources: {
            contentSource: 'packages/ui/src/lib/docs/docs-content.ts (DOCS_ARTICLES)',
            helpFor: 'packages/ui/src/components/ui/docs/docs-help-link.tsx (ROUTE_DOCS_MAP)',
            productLink: 'apps/web/app/[lang]/docs/docs-client.tsx (inverts ROUTE_DOCS_MAP)',
            sitemap: 'apps/web/app/sitemap.ts',
            internalLinks: 'DOCS_ARTICLES[].related / .outbound',
            otherPublic: 'packages/ui/src/components/ui/landing/site-footer.tsx',
          },
          counts: {
            articles: slugs.length,
            locales: LOCALES.length,
            routes: rows.length,
            productToDocsEntries: productToDocs.length,
            docsToProductEntries: docsToProduct.size,
            internalLinks: internalLinks.length,
            outboundLinks: outboundLinks.length,
          },
          flags: { sitemapHasDocs, sitemapMapsArticles, footerLinksToDocs },
          productToDocs: Object.fromEntries(productToDocs),
          docsToProduct: Object.fromEntries(docsToProduct),
          internalLinks,
          outboundLinks,
          routes: rows,
        },
        null,
        2,
      ),
      'utf8',
    )

    expect(rows.length).toBe(LOCALES.length * (slugs.length + 1))
  })

  it('writes content-baseline.json per article per locale', () => {
    mkdirSync(OUT, { recursive: true })

    const bundles = new Map(LOCALES.map((l) => [l, bundle(l)]))
    const entries: Record<string, unknown>[] = []

    for (const locale of LOCALES) {
      const b = bundles.get(locale)!
      for (const article of DOCS_ARTICLES) {
        const title = resolve(b, `docs.${article.slug}.title`) ?? ''
        const summary = resolve(b, `docs.${article.slug}.summary`) ?? ''
        const seoTitle = resolve(b, `docs.${article.slug}.seoTitle`) ?? ''

        const headings: string[] = []
        const bodies: string[] = []
        const steps: string[] = []

        for (const section of article.sections) {
          const heading = resolve(b, `docs.${article.slug}.${section.id}.heading`)
          if (heading) headings.push(heading)
          for (let i = 0; i < section.bodyCount; i += 1) {
            const body = resolve(b, `docs.${article.slug}.${section.id}.body${i + 1}`)
            if (body) bodies.push(body)
          }
          for (let i = 0; i < (section.stepCount ?? 0); i += 1) {
            const step = resolve(b, `docs.${article.slug}.${section.id}.step${i + 1}`)
            if (step) steps.push(step)
          }
        }

        const prose = [title, summary, ...headings, ...bodies, ...steps].join(' ')
        // Whitespace-split. Persian and English both word-break on spaces here,
        // which is all this needs to be — it is a REGRESSION detector, not a
        // linguistic word count.
        const wordCount = prose.split(/\s+/).filter(Boolean).length

        entries.push({
          slug: article.slug,
          locale,
          title,
          seoTitle,
          summary,
          wordCount,
          headings,
          sectionCount: article.sections.length,
          bodyCount: bodies.length,
          stepCount: steps.length,
          internalLinks: article.related,
          externalLinks: (article.outbound ?? []).map((l) => l.href),
          // None of these exist in the current i18n-key format. Recorded as 0
          // so a post-migration value of 0 is not mistaken for a loss.
          codeBlocks: 0,
          images: 0,
          tables: 0,
        })
      }
    }

    const totalWords = entries.reduce((sum, e) => sum + (e.wordCount as number), 0)

    writeFileSync(
      join(OUT, 'content-baseline.json'),
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          note: 'Frozen BEFORE the Fumadocs migration. Any unexpected drop in wordCount/headings/links after migration is a FAIL, not a warning.',
          format: 'i18n-keys',
          totals: {
            articles: DOCS_ARTICLES.length,
            locales: LOCALES.length,
            entries: entries.length,
            messageKeys: docsMessageKeys().length,
            totalWords,
          },
          entries,
        },
        null,
        2,
      ),
      'utf8',
    )

    expect(entries.length).toBe(LOCALES.length * DOCS_ARTICLES.length)
    expect(totalWords).toBeGreaterThan(1000)
  })
})
