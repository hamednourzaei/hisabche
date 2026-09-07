// ============================================
// packages/ui/src/__tests__/landing-claims.test.ts
//
// T5.3 — the landing page may not claim things nobody measured.
//
// ---------------------------------------------------------------------------
// WHAT WAS ON THE LIVE SITE
//
// The hero carried four metrics — «۳۴۰+ کسب‌وکار فعال», «۱۲,۰۰۰+ تراکنش
// روزانه», «۱۰۰٪ آفلاین کار می‌کند», «۴.۹ رضایت کاربران» — and the testimonial
// section carried eight named people with roles, cities and five-star ratings:
//
//     «احمد رضایی، صاحب سوپرمارکت، کابل»
//
// None of it came from anywhere. There is no reviews table, no rating source,
// no counter of active businesses or daily transactions in this codebase.
//
// It was placeholder copy that shipped. A visitor deciding whether to trust
// their books to this software was shown evidence that does not exist — and
// «۱۰۰٪ uptime» was a promise about availability that nothing monitors.
//
// ---------------------------------------------------------------------------
// WHY A TEST
//
// Placeholder copy is written to be replaced and then never is. This is the
// thing that notices.
//
// It is deliberately narrow: it does not police wording, only two classes of
// claim that cannot be true without a source —
//
//   1. a testimonial attributed to a named person
//   2. a metric about users, ratings or uptime
//
// When real testimonials exist, this test must be UPDATED — with the source
// named — rather than deleted.
// ============================================

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const LANDING = join(__dirname, '..', 'components', 'ui', 'landing')

const sceneFiles = readdirSync(LANDING).filter(
  (name) => name.endsWith('.tsx') && !name.startsWith('use-'),
)

/**
 * Comments stripped.
 *
 * Every one of these files now explains, at length, the claims that were
 * removed — quoting them. A guard that read the prose would report the
 * explanation as the offence. (Lesson 82: this exact trap has caught four
 * guards in this codebase already.)
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

const scenes = sceneFiles.map((name) => ({
  name,
  source: code(readFileSync(join(LANDING, name), 'utf8')),
}))

describe('no fabricated testimonial', () => {
  it.each(scenes.map((s) => [s.name, s.source] as const))(
    '%s does not attribute a quote to a named person',
    (_name, source) => {
      // The shape that was here: an object with `name` and `role` beside a
      // `quote`. Real testimonials will have the same shape — and when they
      // arrive, this test gets updated with where they came from, not removed.
      const hasQuoteWithIdentity =
        /\bquote\s*:/.test(source) && /\bname\s*:/.test(source) && /\brole\s*:/.test(source)

      expect(hasQuoteWithIdentity).toBe(false)
    },
  )

  it('the social scene carries capability statements, not people', () => {
    const social = scenes.find((s) => s.name === 'social-scene.tsx')!.source
    expect(social).toContain('CAPABILITIES')
    expect(social).not.toContain('REVIEWS')
  })
})

describe('no metric nobody measured', () => {
  /**
   * Claims that require a source this product does not have.
   *
   * ⚠️ Matched as WHOLE Persian phrases rather than as numbers. A bare digit
   * check would fire on prices, plan limits and feature counts — all of which
   * are legitimate — and a guard that cries wolf gets muted (lesson 92).
   */
  const UNSOURCED = [
    'کسب‌وکار فعال', // an active-business count — no counter exists
    'تراکنش روزانه', // a daily transaction count — no counter exists
    'رضایت کاربران', // a satisfaction rating — no rating source exists
  ]

  it.each(scenes.map((s) => [s.name, s.source] as const))(
    '%s makes no unsourced claim',
    (_name, source) => {
      for (const claim of UNSOURCED) {
        expect(source, `unsourced claim: ${claim}`).not.toContain(claim)
      }
    },
  )

  it('the hero shows facts about the software instead', () => {
    const hero = scenes.find((s) => s.name === 'cinematic-hero.tsx')!.source
    // Each of these is checkable inside the product rather than counted.
    expect(hero).toContain('landing.factOffline')
    expect(hero).toContain('landing.factLedger')
    expect(hero).not.toContain('landing.statRating')
    expect(hero).not.toContain('landing.statStores')
  })

  it('the trust bar says what it is BUILT for, not who trusts it', () => {
    // The list under it is business TYPES, which is honest. The label around
    // it claimed those businesses use the product, which nothing knows.
    const trust = scenes.find((s) => s.name === 'trust-bar-scene.tsx')!.source
    expect(trust).not.toContain('Trusted by')
    expect(trust).toContain('Built for')
  })
})
