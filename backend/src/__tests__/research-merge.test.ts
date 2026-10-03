// ============================================
// Capability: research merge (Phase 2).
// Service: services/blog/research.service.ts
//
// ⚠️ THIS FILE GUARDS THE DECISION, NOT THE HTTP CALL.
//
// The owner's instruction was: search all three locales, classify the results,
// collect the sources WITHOUT duplication. The deduplication is the part that can
// go wrong silently — three locales searching `fa` and `af` will find the same
// Persian pages, and a brief citing one government page three times LOOKS
// better sourced than it is. That is the failure §8 of the specification exists to
// prevent, and it produces no error anywhere.
//
// So the tests below are almost entirely about the merge, and the HTTP layer is
// stubbed rather than exercised. A test that mocks Tavily proves the plumbing; a
// test on `mergeSources` proves the rule.
// ============================================

import { describe, expect, it } from 'vitest'

import { mergeSources, normaliseSourceUrl, researchRunKey } from '../services/blog/research.service'

const result = (url: string, title = 'T') => ({ url, title })

describe('research — one page is one source, however many locales find it', () => {
  it('merges the same URL found by fa and af into ONE row', () => {
    // ⚠️ THE core of the decision. `fa` and `af` are close enough that a
    // three-locale search returns the same Persian pages repeatedly, and three
    // rows for one URL is a brief that appears well researched and is not.
    const sources = mergeSources({
      fa: [result('https://example.gov.af/tax')],
      af: [result('https://example.gov.af/tax')],
      en: [result('https://example.gov.af/tax')],
    })

    expect(sources).toHaveLength(1)
    expect(sources[0]?.locales.sort()).toEqual(['af', 'en', 'fa'])
  })

  it('keeps the three genuinely different pages', () => {
    const sources = mergeSources({
      fa: [result('https://a.gov.af/1'), result('https://b.gov.af/2')],
      af: [result('https://a.gov.af/1')],
      en: [result('https://c.gov.af/3')],
    })

    expect(sources).toHaveLength(3)
  })

  it('a repeat across locales is EVIDENCE, not a duplicate row', () => {
    // ⚠️ `locales` is kept because finding a page from two markets is a weak
    // relevance signal, and it costs nothing to record.
    const sources = mergeSources({
      fa: [result('https://example.gov.af/x')],
      en: [result('https://example.gov.af/x')],
    })

    expect(sources[0]?.locales).toHaveLength(2)
  })
})

describe('research — URL normalisation is conservative on purpose', () => {
  it('collapses the spellings of one page', () => {
    const base = normaliseSourceUrl('https://example.gov.af/tax/')
    expect(normaliseSourceUrl('http://example.gov.af/tax')).toBe(base)
    expect(normaliseSourceUrl('https://www.example.gov.af/tax')).toBe(base)
  })

  it('strips tracking parameters but KEEPS a real query', () => {
    // ⚠️ `?id=5` and `?id=6` are two different pages. Dropping the query
    // entirely — which an aggressive normaliser does — merges them, and a
    // research tool that cites the wrong page is worse than one that cites it
    // twice.
    expect(normaliseSourceUrl('https://x.gov.af/a?id=5')).not.toBe(
      normaliseSourceUrl('https://x.gov.af/a?id=6'),
    )
    expect(normaliseSourceUrl('https://x.gov.af/a?utm_source=g&id=5')).toBe(
      normaliseSourceUrl('https://x.gov.af/a?id=5'),
    )
  })

  it('does not merge two paths on the same host', () => {
    expect(normaliseSourceUrl('https://x.gov.af/a')).not.toBe(
      normaliseSourceUrl('https://x.gov.af/b'),
    )
  })
})

describe('research — a source is classified, not ranked', () => {
  it('a government or academic domain is PRIMARY by nature', () => {
    // ⚠️ By NATURE, not by search rank. A government page does not become
    // secondary because a search engine placed it lower — that is how a tax rule
    // ends up cited as a blog post's opinion.
    const sources = mergeSources({
      fa: [
        result('https://mof.gov.af/tax'),
        result('https://university.edu.af/paper'),
        result('https://news-site.com/article'),
      ],
    })

    const byDomain = Object.fromEntries(sources.map((s) => [s.domain, s.sourceType]))
    expect(byDomain['mof.gov.af']).toBe('primary')
    expect(byDomain['university.edu.af']).toBe('primary')
    expect(byDomain['news-site.com']).toBe('secondary')
  })

  it('a competitor page is recorded as a COMPETITOR, not hidden', () => {
    // ⚠️ §7 forbids copying, not researching. Erasing the fact that a page
    // informed an idea makes the pipeline's inputs invisible rather than
    // governed — and the originality gate then has nothing to check against.
    const sources = mergeSources({
      en: [result('https://www.odoo.com/blog/invoicing-guide')],
    })

    expect(sources[0]?.sourceType).toBe('competitor')
  })

  it('authority is null until judged, never zero', () => {
    // ⚠️ Zero reads as "worthless". Null reads as "not yet judged", which is
    // what an unreviewed primary source actually is.
    const [source] = mergeSources({ fa: [result('https://mof.gov.af/x')] })
    expect(source?.authorityScore).toBeNull()
  })
})

describe('research — the run key is derived, so a retry is not a second bill', () => {
  it('the same request twice produces the same key', () => {
    // ⚠️ A RANDOM key would make every retry a new run and a second Tavily
    // charge. The key is what makes `UNIQUE (run_key)` do the work the
    // specification asks for at §30.
    const a = researchRunKey('ws-1', 'مدیریت بدهی مشتریان')
    const b = researchRunKey('ws-1', 'مدیریت بدهی مشتریان')
    expect(a).toBe(b)
  })

  it('topic case and surrounding space do not create a new run', () => {
    expect(researchRunKey('ws-1', '  Debt Management ')).toBe(
      researchRunKey('ws-1', 'debt management'),
    )
  })

  it('a different workspace is a different run', () => {
    expect(researchRunKey('ws-1', 'x')).not.toBe(researchRunKey('ws-2', 'x'))
  })

  it('a different topic is a different run', () => {
    expect(researchRunKey('ws-1', 'a')).not.toBe(researchRunKey('ws-1', 'b'))
  })
})
