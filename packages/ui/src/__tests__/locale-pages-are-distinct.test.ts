// ============================================
// ⚠️ TWO LOCALES, ONE TITLE, AND GOOGLE PICKS ONE.
//
// Search Console reported `https://hisabche.com/fa` as
// «Duplicate, Google chose a different canonical than user».
//
// The canonicals were right. The hreflang was right. The redirects were right.
// None of that was the problem: `/fa` and `/af` shipped the SAME `<title>` and
// the same og:title, character for character, in the same script — so Google
// read two URLs serving one page and indexed one of them.
//
// Persian and Dari are close enough that this is easy to do by accident: the
// body copy had been translated (گدام, انترنت, ویب, قرض) and only the two
// strings that reach the title tag had been copied across.
//
// These tests are the difference between «we translated it» and «a search
// engine can tell them apart».
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// The web app's landing metadata, read from where it lives. This guard sits in
// `packages/ui` because that is where the web SEO guards run — `apps/web` has
// no test runner of its own, and a test nobody executes guards nothing.
const source = readFileSync(
  join(__dirname, '..', '..', '..', '..', 'apps/web/app/[lang]/page.tsx'),
  'utf8',
)

/** Pull one string field out of a locale's block in `pageConfig`. */
function field(locale: 'fa' | 'af' | 'en', key: string): string {
  const block = new RegExp(`\\n  ${locale}: \\{([\\s\\S]*?)\\n  \\},`).exec(source)?.[1] ?? ''
  expect(block).not.toBe('')

  // `key: '…'` or `key:\n  '…'`
  const value = new RegExp(`\\b${key}:\\s*\\n?\\s*'([^']+)'`).exec(block)?.[1]
  return value ?? ''
}

describe('each locale is its own page', () => {
  it('⚠️ no two locales share a title', () => {
    const titles = (['fa', 'af', 'en'] as const).map((l) => field(l, 'title'))

    // Guards the guard: an empty match would make every comparison trivially
    // pass while checking nothing.
    for (const title of titles) expect(title.length).toBeGreaterThan(10)

    expect(new Set(titles).size).toBe(titles.length)
  })

  it('⚠️ no two locales share an og:title or a description', () => {
    for (const key of ['ogTitle', 'description', 'ogDescription']) {
      const values = (['fa', 'af', 'en'] as const).map((l) => field(l, key))
      for (const value of values) expect(value.length).toBeGreaterThan(10)
      expect(new Set(values).size).toBe(values.length)
    }
  })

  it('⚠️ the Dari page names its own audience', () => {
    // The whole reason the page exists separately. Without it the two Persian
    // pages compete for the same searches and Google resolves the tie itself.
    expect(field('af', 'title')).toContain('افغانستان')
  })

  it('⚠️ Dari and Persian keyword lists are not the same list', () => {
    const list = (locale: 'fa' | 'af'): string => {
      const block = new RegExp(`\\n  ${locale}: \\{([\\s\\S]*?)\\n  \\},`).exec(source)?.[1] ?? ''
      return /keywords: \[([\s\S]*?)\]/.exec(block)?.[1] ?? ''
    }

    const fa = list('fa')
    const af = list('af')
    expect(fa).not.toBe('')
    expect(af).not.toBe('')
    expect(fa).not.toBe(af)

    // Dari carries the terms its own users search and Persian has no reason to.
    expect(af).toContain('افغانستان')
    expect(af).toContain('گدام')
  })

  it('⚠️ every locale still declares the right og:locale', () => {
    // A correct title with the wrong locale tag tells Facebook and Google the
    // opposite of what the page says.
    expect(field('fa', 'ogLocale')).toBe('fa_IR')
    expect(field('af', 'ogLocale')).toBe('fa_AF')
    expect(field('en', 'ogLocale')).toBe('en_US')
  })
})
