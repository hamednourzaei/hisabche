// ============================================
// The DYNAMIC_SERVER_USAGE trap, made un-reintroducible.
//
// ---------------------------------------------------------------------------
// WHAT HAPPENED, TWICE
//
// A page under `app/[lang]/` reads its text through next-intl's
// `getMessages()`, which resolves the locale from the REQUEST. Adding
// `generateStaticParams` to such a page opts it into STATIC prerendering — and
// during a prerender there is no request, so Next throws:
//
//     digest: 'DYNAMIC_SERVER_USAGE'
//
// …and EVERY url under that route returns 500 in production.
//
// ⚠️ THE BUILD STILL SUCCEEDS AND DEV STILL SERVES THE PAGE. That is why this
// reaches production: `next build` prints no error, `next dev` renders fine,
// and the failure appears only on a real prerendered request.
//
// It happened first on `app/[lang]/features/[slug]/page.tsx`, was diagnosed,
// and the reason was written into a comment there. It was then reintroduced on
// `app/[lang]/docs/[slug]/page.tsx`, because a comment in one file does not
// stop the same mistake in another.
//
// A test does.
//
// ---------------------------------------------------------------------------
// ⚠️ THIS IS NOT "STATIC RENDERING IS BANNED"
//
// The supported route is next-intl's `setRequestLocale()` together with a
// `generateStaticParams` that returns `lang` AS WELL AS `slug`. If that is
// ever adopted, this test should be updated to require BOTH — not deleted.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const APP = join(__dirname, '..', '..', '..', '..', 'apps', 'web', 'app')

function pages(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      pages(full, out)
    } else if (entry === 'page.tsx' || entry === 'layout.tsx' || entry === 'route.ts') {
      out.push(full)
    }
  }
  return out
}

/** Comments stripped — this rule is discussed in comments in several files. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

const files = pages(APP)

describe('no page mixes request-time locale with static prerendering', () => {
  it('found the app router pages to check', () => {
    // A path change that emptied this list would make the rule vacuous.
    expect(files.length).toBeGreaterThan(20)
  })

  it('⚠️ no page has BOTH generateStaticParams and getMessages', () => {
    const offenders: string[] = []

    for (const file of files) {
      const source = code(file)
      const isStatic = /export\s+(?:async\s+)?function\s+generateStaticParams/.test(source)
      if (!isStatic) continue

      // The request-time APIs that make a prerender impossible.
      const readsRequest =
        /\bgetMessages\s*\(/.test(source) ||
        /\bgetTranslations\s*\(/.test(source) ||
        /\bheaders\s*\(\s*\)/.test(source) ||
        /\bcookies\s*\(\s*\)/.test(source)

      // `setRequestLocale` is the supported way to have both. If a page adopts
      // it, it is allowed — that is the documented escape, not a loophole.
      const optedIn = /\bsetRequestLocale\s*\(/.test(source)

      if (readsRequest && !optedIn) {
        offenders.push(file.slice(APP.length + 1).replace(/\\/g, '/'))
      }
    }

    expect(
      offenders,
      'these prerender at build time but read the request — every URL 500s with DYNAMIC_SERVER_USAGE',
    ).toEqual([])
  })

  it('the two pages this has already bitten stay dynamic', () => {
    // Named explicitly: both were written with generateStaticParams, both
    // 500ed in production, and the second one was written after the first was
    // fixed. Naming them means a re-introduction fails with the history
    // attached rather than as an anonymous rule violation.
    for (const rel of ['[lang]/features/[slug]/page.tsx', '[lang]/docs/[slug]/page.tsx']) {
      const source = code(join(APP, ...rel.split('/')))
      expect(source, `${rel} must not prerender`).not.toMatch(
        /export\s+(?:async\s+)?function\s+generateStaticParams/,
      )
    }
  })
})
