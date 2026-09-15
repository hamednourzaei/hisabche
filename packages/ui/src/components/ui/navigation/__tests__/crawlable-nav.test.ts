// ============================================
// Regression guard: the public marketing chrome must emit real links.
//
// Google Search Console reported "Internal links: 0" for hisabche.com. One
// direct cause was that `top-nav.tsx` — the site header, normally the single
// strongest internal-linking surface on a site — emitted ZERO anchors: the
// logo was `<button onClick>`, every section item was a `<button>` driving
// scroll state, and the CTA was a `<button onClick={router.push}>`. Nothing in
// the header existed in the link graph, and the header was unusable with
// JavaScript disabled or with a middle-click.
//
// These assertions are deliberately made against the SOURCE rather than a
// render: TopNav needs the navigation context, the auth store and a next-intl
// provider to render, and a test that mounts all three would be asserting on
// the harness as much as on the markup. What regressed here was a coding
// choice ("use a button for navigation"), and that is exactly what source
// inspection catches.
//
// Verified separately against the real server-rendered HTML of the production
// standalone build; this test is the cheap guard that keeps it from silently
// coming back.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Comments are stripped before the structural assertions run. The files
 * document what they replaced ("the logo *was* a `<button onClick>`"), so a
 * naive scan would match the prose describing the bug and never see the fix.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const read = (...parts: string[]) =>
  stripComments(readFileSync(join(__dirname, '..', '..', ...parts), 'utf8'))

const topNav = read('navigation', 'top-nav.tsx')
// The footer markup lives in the hook-free view; site-footer.tsx only wraps it.
const siteFooter = read('landing', 'site-footer-view.tsx')
const featuresScene = read('landing', 'features-scene.tsx')

describe('top-nav is crawlable', () => {
  it('renders the logo as a link, not a button', () => {
    // The logo is the canonical "home" internal link on every page that has a
    // header. As a <button> it contributed nothing to the link graph.
    expect(topNav).toMatch(/<Link\s+href=\{routePrefix \|\| '\/'\}/)
  })

  it('renders section navigation as anchors carrying the fragment', () => {
    // An <a href="#features"> still scrolls — the onClick only suppresses the
    // fragment push so the smooth-scroll animation is not interrupted. So the
    // one-page UX is unchanged while the link becomes real.
    expect(topNav).toMatch(/href=\{`#\$\{id\}`\}/)
  })

  it('points the CTA at the locale-prefixed signup route as a link', () => {
    expect(topNav).toMatch(/<Link\s+(?:prefetch=\{false\}\s+)?href=\{`\$\{routePrefix\}\/signup`\}/)
  })

  it('has no <button> used purely for navigation in the landing header', () => {
    // Two genuine actions may be buttons, and nothing else: the dashboard
    // variant's sign-out, and the phone menu's drawer trigger (it opens a
    // panel; every destination inside the drawer is still an <a> / <Link>).
    const buttons = [...topNav.matchAll(/<button\b/g)]
    expect(buttons).toHaveLength(2)
    expect(topNav).toMatch(/onClick=\{onLogout\}/)
    expect(topNav).toContain('aria-haspopup="dialog"')
  })

  it('derives the locale from segments this app actually serves', () => {
    // The old helper matched /^\/(fa-IR|fa-AF|en)/. The real route segments are
    // fa | af | en (apps/web/app/[lang]/i18n-config.ts), so every Persian and
    // Dari page fell through to a hardcoded default and any locale-derived href
    // would have been wrong.
    expect(topNav).not.toMatch(/fa-IR/)
    expect(topNav).toMatch(/useLocale\(\)/)
  })
})

describe('internal links keep their locale segment', () => {
  // proxy.ts runs with `localePrefix: 'always'`. A bare "/about" is a 307 whose
  // target is chosen by Accept-Language, so it both costs a redirect hop and
  // can send the reader to a different language than the page they were on.
  const chrome: Array<[string, string]> = [
    ['top-nav', topNav],
    ['site-footer', siteFooter],
    ['features-scene', featuresScene],
  ]

  for (const [name, source] of chrome) {
    it(`${name} builds route hrefs from a locale prefix`, () => {
      expect(source).toMatch(/localePrefix/)
    })

    it(`${name} has no unprefixed literal route href`, () => {
      // Catches href="/about", href="/signup", href="/features/offline" — the
      // shape that reintroduces the redirect hop.
      const literals = [...source.matchAll(/href=["']\/(?!\/)[a-z][^"']*["']/g)].map((m) => m[0])
      expect(literals).toEqual([])
    })
  }
})

describe('landing page links to its feature pages in content', () => {
  it('links the two feature cards that have a dedicated indexable page', () => {
    // Before this, the footer was the ONLY inbound link to either feature page
    // anywhere on the site — no in-content link, so no topical context around
    // the link and nothing tying the page to the section it belongs to.
    expect(featuresScene).toMatch(/'\/features\/customer-debt'/)
    expect(featuresScene).toMatch(/'\/features\/offline'/)
  })

  it('uses descriptive anchor text rather than "learn more"', () => {
    // The anchor is the strongest relevance signal a link carries; a generic
    // one wastes it. Labels come from the message catalogue, so fa / af / en
    // each get market-correct wording (قرض / گدام for Dari, not بدهی / انبار).
    expect(featuresScene).toMatch(/landing\.footerLink\.customerDebt/)
    expect(featuresScene).toMatch(/landing\.footerLink\.offline/)
    expect(featuresScene).not.toMatch(/learnMore|clickHere/i)
  })
})

describe('site-footer section anchors are resolvable from every page', () => {
  it('prefixes in-page section anchors with the landing path', () => {
    // #features / #pricing / #security / #faq are sections of the LANDING page,
    // but this footer renders on all 45 public pages. A bare "#features" is a
    // dead anchor on /about and every /legal/* page. Emitting "/{locale}#features"
    // is a real link from those pages and still an in-page scroll on the
    // landing page, where the path already matches.
    expect(siteFooter).toMatch(
      /if \(href\.startsWith\('#'\)\) return `\$\{prefix \|\| '\/'\}\$\{href\}`/,
    )
  })
})
