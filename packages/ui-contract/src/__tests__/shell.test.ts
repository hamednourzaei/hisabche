// ============================================
// The global frame.
// ============================================

import { describe, expect, it } from 'vitest'

import { NAV_CONTRACT } from '../navigation'
import { breadcrumbsFor, localizePath } from '../shell'

const LOCALES = ['fa', 'af', 'en']

describe('breadcrumbs are derived from the contract', () => {
  it('gives the root a single, unlinked crumb', () => {
    const crumbs = breadcrumbsFor('/dashboard', LOCALES)
    expect(crumbs).toHaveLength(1)
    expect(crumbs[0]?.path).toBeUndefined()
  })

  it('reads the same trail on web and desktop', () => {
    // Web serves `/fa/invoices`, desktop serves `/invoices`. A trail that
    // differed between them would be two trails to maintain.
    expect(breadcrumbsFor('/fa/invoices', LOCALES)).toEqual(breadcrumbsFor('/invoices', LOCALES))
  })

  it('strips fa, the DEFAULT locale — the bug that shipped', () => {
    // The old breadcrumb stripped af and en but not fa. Persian is the locale
    // nearly everybody uses, so on almost every page the trail read
    // `home > fa > budgets` — a language code rendered as a place.
    const crumbs = breadcrumbsFor('/fa/till', LOCALES)
    expect(crumbs.map((c) => c.segment)).not.toContain('fa')
    expect(crumbs).toHaveLength(2)
  })

  it('carries the raw segment so a renderer can fall back without re-splitting', () => {
    const crumbs = breadcrumbsFor('/fa/invoices/9f1c2d3e', LOCALES)
    expect(crumbs.at(-1)?.segment).toBe('9f1c2d3e')
  })

  it('does not mistake a real segment for a locale', () => {
    // `/till` must not lose its segment just because it sits where a locale
    // would.
    const crumbs = breadcrumbsFor('/till', LOCALES)
    expect(crumbs).toHaveLength(2)
    expect(crumbs[1]?.labelKey).toBe(NAV_CONTRACT.find((item) => item.path === '/till')?.labelKey)
    expect(crumbs[1]?.labelKey).toMatch(/^nav\./)
  })

  it('never links the last crumb — you are already there', () => {
    const crumbs = breadcrumbsFor('/fa/till', LOCALES)
    expect(crumbs.at(-1)?.path).toBeUndefined()
    expect(crumbs[0]?.path).toBe('/dashboard')
  })

  it('takes its labels from NAV_CONTRACT, so a rename cannot drift', () => {
    const till = NAV_CONTRACT.find((item) => item.id === 'till')
    expect(till?.labelKey).toEqual(expect.any(String))
    expect(breadcrumbsFor('/till', LOCALES).at(-1)?.labelKey).toBe(till?.labelKey)
  })

  it('keeps an unknown segment rather than dropping it', () => {
    // A detail page under an unrecognised route is still one level deeper,
    // and a trail that silently omits it lies about where you are.
    const crumbs = breadcrumbsFor('/fa/something-else', LOCALES)
    expect(crumbs).toHaveLength(2)
    expect(crumbs[1]?.labelKey).toBe('')
  })

  it('uses i18n keys throughout, never text', () => {
    for (const crumb of breadcrumbsFor('/fa/till', LOCALES)) {
      if (crumb.labelKey !== '') expect(crumb.labelKey).toMatch(/^nav\./)
    }
  })
})

describe('localizePath — one route, the host decides the prefix', () => {
  it('web: the language segment goes in front', () => {
    expect(localizePath('/invoices/42', 'fa')).toBe('/fa/invoices/42')
    expect(localizePath('/customers', 'af')).toBe('/af/customers')
  })

  it('⚠️ desktop and mobile: no language is known, so none is invented', () => {
    // The approvals screen used to fall back to 'fa' here and sent Windows
    // users to /fa/…, which the desktop router does not have.
    expect(localizePath('/invoices/42', undefined)).toBe('/invoices/42')
    expect(localizePath('/invoices/42', null)).toBe('/invoices/42')
    expect(localizePath('/invoices/42', '')).toBe('/invoices/42')
  })

  it('never prefixes twice', () => {
    expect(localizePath('/fa/invoices', 'fa')).toBe('/fa/invoices')
    expect(localizePath('/fa', 'fa')).toBe('/fa')
    // …but a route that merely starts with the same letters is still a route.
    expect(localizePath('/faq', 'fa')).toBe('/fa/faq')
  })

  it('leaves relative and absolute URLs alone', () => {
    expect(localizePath('?tab=products', 'fa')).toBe('?tab=products')
    expect(localizePath('https://hisabche.com/x', 'fa')).toBe('https://hisabche.com/x')
  })
})
