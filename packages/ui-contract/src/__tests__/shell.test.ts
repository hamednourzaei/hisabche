// ============================================
// The global frame, and the domain hubs inside it.
// ============================================

import { describe, expect, it } from 'vitest'

import { NAV_CONTRACT, type NavId } from '../navigation'
import {
  DOMAINS,
  DOMAIN_SPECS,
  breadcrumbsFor,
  domainDestinations,
  domainFor,
  domainOf,
} from '../shell'

const LOCALES = ['fa', 'af', 'en']
const ALL_NAV = NAV_CONTRACT.map((item) => item.id)

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
    const crumbs = breadcrumbsFor('/fa/budgets', LOCALES)
    expect(crumbs.map((c) => c.segment)).not.toContain('fa')
    expect(crumbs).toHaveLength(2)
  })

  it('carries the raw segment so a renderer can fall back without re-splitting', () => {
    const crumbs = breadcrumbsFor('/fa/invoices/9f1c2d3e', LOCALES)
    expect(crumbs.at(-1)?.segment).toBe('9f1c2d3e')
  })

  it('does not mistake a real segment for a locale', () => {
    // `/bank` must not lose its segment just because it sits where a locale
    // would.
    const crumbs = breadcrumbsFor('/bank', LOCALES)
    expect(crumbs).toHaveLength(2)
    expect(crumbs[1]?.labelKey).toBe('nav.bank')
  })

  it('never links the last crumb — you are already there', () => {
    const crumbs = breadcrumbsFor('/fa/budgets', LOCALES)
    expect(crumbs.at(-1)?.path).toBeUndefined()
    expect(crumbs[0]?.path).toBe('/dashboard')
  })

  it('takes its labels from NAV_CONTRACT, so a rename cannot drift', () => {
    const budgets = NAV_CONTRACT.find((item) => item.id === 'budgets')
    expect(breadcrumbsFor('/budgets', LOCALES).at(-1)?.labelKey).toBe(budgets?.labelKey)
  })

  it('keeps an unknown segment rather than dropping it', () => {
    // A detail page under an unrecognised route is still one level deeper,
    // and a trail that silently omits it lies about where you are.
    const crumbs = breadcrumbsFor('/fa/something-else', LOCALES)
    expect(crumbs).toHaveLength(2)
    expect(crumbs[1]?.labelKey).toBe('')
  })

  it('uses i18n keys throughout, never text', () => {
    for (const crumb of breadcrumbsFor('/fa/bank', LOCALES)) {
      if (crumb.labelKey !== '') expect(crumb.labelKey).toMatch(/^nav\./)
    }
  })
})

describe('domain workspaces', () => {
  it('covers every declared domain exactly once', () => {
    expect(DOMAIN_SPECS.map((domain) => domain.id).sort()).toEqual([...DOMAINS].sort())
  })

  it('advertises only destinations that exist', () => {
    // A domain hub linking to a deleted page is worse than no hub.
    for (const domain of DOMAIN_SPECS) {
      for (const nav of domain.destinations) {
        expect(ALL_NAV, `${domain.id} -> ${nav}`).toContain(nav)
      }
    }
  })

  it('draws its primary actions from its own destinations', () => {
    for (const domain of DOMAIN_SPECS) {
      for (const action of domain.primaryActions) {
        expect(domain.destinations).toContain(action)
      }
    }
  })

  it('never files one destination under two domains', () => {
    const seen = new Set<NavId>()
    for (const domain of DOMAIN_SPECS) {
      for (const nav of domain.destinations) {
        expect(seen.has(nav), `${nav} is in two domains`).toBe(false)
        seen.add(nav)
      }
    }
  })

  it('leaves system destinations out of every domain', () => {
    // "Import customers" under Sales is where nobody would look for it.
    expect(domainOf('data-migration')).toBeNull()
    expect(domainOf('sync')).toBeNull()
    expect(domainOf('settings')).toBeNull()
  })

  it('finds the domain of a business destination', () => {
    expect(domainOf('bank')).toBe('accounting')
    expect(domainOf('till')).toBe('sales')
  })

  it('throws on an unknown domain rather than returning something empty', () => {
    // An empty hub would render as a domain with no pages, which reads as a
    // broken product rather than as a programming error.
    expect(() => domainFor('nonsense' as never)).toThrow()
  })
})

describe('what a domain offers this actor', () => {
  it('hides destinations they are not authorized for', () => {
    const visible = domainDestinations('accounting', ['bank', 'budgets'])
    expect(visible).toEqual(['bank', 'budgets'])
  })

  it('keeps the declared order rather than the caller order', () => {
    // So the same domain reads the same way for everyone who can see the same
    // pages.
    const visible = domainDestinations('accounting', ['budgets', 'bank', 'money'])
    expect(visible).toEqual(['money', 'bank', 'budgets'])
  })

  it('returns nothing when the actor may reach nothing', () => {
    expect(domainDestinations('accounting', [])).toEqual([])
  })
})
