// ============================================
// robots.txt must not block a page the sitemap lists (BUG-085, 3 Oct 2026).
//
// The disallow list is written with a leading star for the locale. In robots.txt a star
// matches ANY characters, slashes included, so the rule for the dashboard's
// invoices route also matched /fa/docs/invoices — and customers, accounting,
// wallet, permissions, assistant, developers: 21 documentation pages that the
// sitemap submits and robots.txt forbade («Submitted URL blocked by
// robots.txt» in Search Console), plus any blog article whose slug begins with
// one of those words.
//
// The other robots guards read the SOURCE for a rule's spelling. This one
// evaluates the rules that are actually EMITTED, the way a crawler matches
// them, against real public paths.
// ============================================

import { describe, expect, it } from 'vitest'

import robots from '../../../../apps/web/app/robots'
import { DOCS_ARTICLES } from '../lib/docs/docs-content'

const rules = robots().rules
const first = Array.isArray(rules) ? rules[0]! : rules
const disallow = ([] as string[]).concat(first.disallow ?? [])

/** Google's matching: a rule is a prefix; a star is any run of characters; a dollar anchors the end. */
function blocks(rule: string, path: string): boolean {
  const pattern = rule
    .split('*')
    .map((part) => part.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\$$/, '$'))
    .join('.*')
  return new RegExp(`^${pattern}`).test(path)
}
const blockedBy = (path: string) => disallow.filter((rule) => blocks(rule, path))

const LOCALES = ['fa', 'af', 'en']

describe('what robots.txt emits', () => {
  it('has rules, and none of them starts with a bare locale wildcard', () => {
    expect(disallow.length).toBeGreaterThan(100)
    expect(disallow.filter((rule) => rule.startsWith('/*/'))).toEqual([])
  })

  it('the three crawler groups get the same rules', () => {
    const groups = Array.isArray(rules) ? rules : [rules]
    for (const group of groups) expect(group.disallow).toEqual(first.disallow)
  })
})

describe('public pages stay crawlable', () => {
  const publicPaths = [
    '',
    '/about',
    '/contact',
    '/blog',
    // A blog article may be named after anything the dashboard has a route for.
    '/blog/accounting-software-guide',
    '/blog/invoices-for-shops',
    '/blog/customers-debt',
    '/blog/settings',
    '/blog/category/accounting',
    '/blog/tag/warehouse',
    '/features/invoicing',
    '/features/inventory',
    '/legal/privacy',
    // The marketplace: a seller or a listing may be called «wallet» or «orders».
    '/market',
    '/market/wallet-shop',
    '/market/some-shop/customers-gift',
    ...DOCS_ARTICLES.map((article) => `/docs/${article.slug}`),
  ]

  it.each(LOCALES)('%s: no public path is disallowed', (locale) => {
    const offenders = publicPaths
      .map((path) => `/${locale}${path}`)
      .flatMap((path) => blockedBy(path).map((rule) => `${path} ← ${rule}`))
    expect(offenders).toEqual([])
  })
})

describe('the app and token pages stay blocked', () => {
  it.each(LOCALES)('%s', (locale) => {
    for (const path of [
      '/dashboard',
      '/invoices',
      '/invoices/new',
      '/customers/123',
      '/wallet',
      '/market-seller',
      '/marketplace',
      '/developers',
      '/public-invoice/abc',
      '/portal/abc',
      '/oauth/authorize',
    ]) {
      expect(blockedBy(`/${locale}${path}`), `/${locale}${path}`).not.toEqual([])
    }
    expect(blockedBy('/api/products')).not.toEqual([])
  })
})
