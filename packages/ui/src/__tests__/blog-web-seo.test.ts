// The blog's web rules, each from a real defect elsewhere on this site
// (CLAUDE.md §8, the hisabche-web skill). Source assertions with comments
// stripped, so the prose that explains a rule cannot trip it.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../../../..')
const WEB = join(ROOT, 'apps/web')
const BLOG_APP = join(WEB, 'app/[lang]/blog')
const BLOG_UI = join(__dirname, '../components/ui/blog')

// Line comments FIRST: a path glob in one (`/admin/blog/*`) must not open a
// block comment that swallows the code after it.
const strip = (s: string) =>
  s
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? files(full) : /\.tsx?$/.test(name) ? [full] : []
  })
}
const read = (f: string) => strip(readFileSync(f, 'utf8'))

const appFiles = files(BLOG_APP)
const uiFiles = files(BLOG_UI)
const pages = appFiles.filter((f) => f.endsWith('page.tsx'))

describe('ISR and static rendering', () => {
  const constant = /BLOG_REVALIDATE_SECONDS = (\d+)/.exec(read(join(WEB, 'lib/blog-api.ts')))?.[1]

  it('finds the seven blog pages', () => {
    expect(pages.map((f) => relative(BLOG_APP, f).split(sep).join('/')).sort()).toEqual(
      [
        '[slug]/page.tsx',
        'category/[slug]/page.tsx',
        'category/[slug]/page/[page]/page.tsx',
        'page.tsx',
        'page/[page]/page.tsx',
        'tag/[slug]/page.tsx',
        'tag/[slug]/page/[page]/page.tsx',
      ].sort(),
    )
  })

  it('every page and the sitemap revalidate with a LITERAL equal to BLOG_REVALIDATE_SECONDS', () => {
    // Next reads segment config statically; an imported constant is not a value to it.
    expect(constant).toBe('3600')
    for (const f of [...pages, join(WEB, 'app/sitemap.ts')]) {
      expect(read(f), relative(ROOT, f)).toContain(`export const revalidate = ${constant}`)
    }
  })

  it('every page opts into ISR with generateStaticParams (without it the route renders per request)', () => {
    for (const f of pages) {
      expect(read(f), relative(ROOT, f)).toMatch(/export function generateStaticParams\(\)/)
    }
  })

  it('no <Suspense> and no searchParams — both would make the pages dynamic', () => {
    for (const f of appFiles) {
      const src = read(f)
      expect(src, relative(ROOT, f)).not.toContain('<Suspense')
      expect(src, relative(ROOT, f)).not.toContain('searchParams')
    }
  })
})

describe('crawling', () => {
  it('robots.ts does not disallow the blog', () => {
    const robots = read(join(WEB, 'app/robots.ts'))
    expect(robots).not.toMatch(/['"]\/\*?\/?blog/)
  })

  it('the sitemap lists the API’s articles, and the hub only where one is published', () => {
    const sitemap = read(join(WEB, 'app/sitemap.ts'))
    expect(sitemap).toContain('fetchBlogSitemap()')
    // BUG-086: the hub was a static entry, so with no article published it was
    // submitted while the page itself said noindex («Submitted URL marked
    // noindex»). It is now listed per language that has a published article.
    expect(sitemap).not.toContain("{ path: '/blog' }")
    expect(sitemap).toContain('result.data.posts.some((post) => post.locale === locale)')
    expect(sitemap).toContain("url: localeUrl(locale, '/blog')")
  })

  it('the footer links every public page to the blog hub', () => {
    const footer = read(join(__dirname, '../components/ui/landing/site-footer-view.tsx'))
    expect(footer).toContain("{ key: 'blog', fallback: 'وبلاگ', href: '/blog' }")
  })
})

describe('links', () => {
  it('every internal href in blog components carries the locale', () => {
    for (const f of uiFiles) {
      const src = read(f)
      // A bare '/blog', '/features', … is a 307 chosen by Accept-Language.
      expect(src, relative(ROOT, f)).not.toMatch(
        /href=(?:\{`|["'])\/(?:blog|features|docs|signup|login|dashboard)/,
      )
    }
  })

  it('links into the private app from the article and its island are nofollow', () => {
    const article = read(join(BLOG_UI, 'blog-article-view.tsx'))
    expect(article).toMatch(/href=\{`\$\{prefix\}\/signup`\}\s+prefetch=\{false\}\s+rel="nofollow"/)
    const island = read(join(BLOG_UI, 'blog-post-actions.tsx'))
    const signInLinks = island.match(/<Link[^>]*href=\{signInHref\}[^>]*>/g) ?? []
    expect(signInLinks.length).toBeGreaterThanOrEqual(3)
    for (const link of signInLinks) expect(link).toContain('rel="nofollow"')
  })
})

describe('structured data matches the page', () => {
  const article = read(join(BLOG_APP, '[slug]/page.tsx'))

  it('AggregateRating only with real votes; FAQPage only with rendered questions', () => {
    expect(article).toMatch(
      /post\.stats\.ratingCount > 0 && post\.stats\.ratingAvg !== null\s*\?\s*\{\s*aggregateRating/,
    )
    expect(article).toContain('if (post.faq.length > 0) {')
    // The rendered FAQ comes from the same array.
    expect(read(join(BLOG_UI, 'blog-article-view.tsx'))).toContain('post.faq.map(')
  })

  it('the byline is a real profile name or the organisation — never invented', () => {
    expect(article).toContain("{ '@type': 'Person', name: post.author.name }")
    expect(article).toContain("{ '@id': `${SITE_URL}/#organization` }")
  })
})

describe('i18n — every blog key in all three languages', () => {
  const catalogue = Object.fromEntries(
    ['fa', 'af', 'en'].map((l) => [
      l,
      JSON.parse(
        readFileSync(join(ROOT, 'packages/i18n/messages', l, 'common.json'), 'utf8'),
      ) as Record<string, unknown>,
    ]),
  )
  const has = (obj: unknown, path: string) =>
    typeof path
      .split('.')
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        obj,
      ) === 'string'

  it('keys read with the server translator (apps/web) exist', () => {
    const keys = new Set<string>()
    for (const f of appFiles)
      for (const m of read(f).matchAll(/\bt\('((?:blog|app|auth|landing)\.[\w.]+)'/g))
        keys.add(m[1]!)
    expect(keys.size).toBeGreaterThan(20)
    for (const locale of ['fa', 'af', 'en']) {
      expect(
        [...keys].filter((k) => !has(catalogue[locale], k)),
        locale,
      ).toEqual([])
    }
  })

  it('keys read by the client island (useTranslations("blog")) exist', () => {
    const keys = new Set<string>()
    const island = read(join(BLOG_UI, 'blog-post-actions.tsx'))
    for (const m of island.matchAll(/\bt\('([\w.]+)'/g)) keys.add(`blog.${m[1]}`)
    expect(keys.size).toBeGreaterThan(15)
    for (const locale of ['fa', 'af', 'en']) {
      expect(
        [...keys].filter((k) => !has(catalogue[locale], k)),
        locale,
      ).toEqual([])
    }
  })

  it('the blog layout ships the `blog` namespace to the browser', () => {
    expect(read(join(BLOG_APP, 'layout.tsx'))).toContain(
      "namespaces={[...CORE_NAMESPACES, 'blog']}",
    )
  })

  it('page titles carry no brand (the layout template appends «| حسابچه»)', () => {
    for (const locale of ['fa', 'af', 'en']) {
      const blog = catalogue[locale]!.blog as Record<string, string>
      for (const key of ['metaTitle', 'categoryTitle', 'tagTitle']) {
        expect(blog[key], `${locale} blog.${key}`).not.toMatch(/حسابچه|Hisabche/)
      }
    }
  })
})
