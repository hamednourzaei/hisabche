// ============================================
// Search Console, 18 Oct 2026 (Coverage drilldown exports):
//   · «Not found (404)» — https://hisabche.com/en/en/
//   · «Page with redirect» / «Crawled – currently not indexed» — the root
//
// Cause 1: the home page passed an ALREADY-prefixed path (`/en/`) to
// `languageAlternates`, which prefixes again: its hreflang declared /fa/en/,
// /af/en/ and /en/en/ as its translations — three 404s on every home page.
// Its canonical was `/en/`, which 308-redirects to `/en`.
// Cause 2: next-intl's middleware also sent a `Link:` hreflang header with
// x-default = the root (a 307) and «af» against the page's «fa-AF».
// ============================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { languageAlternates, localeUrl } from '../../../../apps/web/app/[lang]/i18n-config'

const web = (path: string) =>
  readFileSync(resolve(__dirname, '../../../../apps/web', path), 'utf8').replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    '',
  )

describe('the home page declares its real translations', () => {
  it('languageAlternates() for the home page is the bare locales — never a doubled one', () => {
    const map = languageAlternates()
    expect(Object.values(map).sort()).toEqual(['/af', '/en', '/fa', '/fa'])
    for (const href of Object.values(map)) expect(href).not.toMatch(/^\/(fa|af|en)\/(fa|af|en)\b/)
    expect(localeUrl('en')).not.toMatch(/\/$/)
  })

  it('the home page metadata uses them, and a canonical that does not redirect', () => {
    const page = web('app/[lang]/page.tsx')
    expect(page).toContain('languages: languageAlternates(),')
    expect(page).toContain('canonical: localeUrl(locale),')
    expect(page).not.toContain("localeUrl(locale, '/')")
    expect(page).not.toMatch(/languageAlternates\(localePath\(/)
  })

  it('the middleware sends no second, conflicting hreflang header', () => {
    expect(web('proxy.ts')).toContain('alternateLinks: false')
  })
})
