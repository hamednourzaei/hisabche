// ============================================
// Cross-platform navigation parity.
//
// The destinations come from `@hisabche/ui-contract`, which web and desktop
// also render. These tests pin the two things that can silently break when that
// contract changes: mobile offering a destination it has no screen for (a dead
// link), and mobile serving a route under a name that no longer matches the
// path web uses (a deep link that works on one platform only).
// ============================================

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { NAV_CONTRACT, type NavId } from '@hisabche/ui-contract'

import { hrefFor, isImplemented, MORE_GROUPS, MORE_PRIMARY, TAB_ITEMS, tabRouteName } from '../nav'

const APP_DIR = join(__dirname, '..', '..', '..', '..', 'app')

/** Does expo-router serve `path`? Mirrors its file-route conventions. */
function hasRoute(path: string, inTabs: boolean): boolean {
  const segment = path.replace(/^\//, '')
  const base = inTabs ? join(APP_DIR, '(tabs)') : APP_DIR

  return existsSync(join(base, `${segment}.tsx`)) || existsSync(join(base, segment, 'index.tsx'))
}

describe('mobile navigation adapter', () => {
  it('offers only destinations that have a screen', () => {
    const offered = [...MORE_PRIMARY, ...MORE_GROUPS.flatMap((g) => g.items), ...TAB_ITEMS]

    for (const item of offered) {
      expect(isImplemented(item.id)).toBe(true)
    }
  })

  it('serves every offered destination as a real route file', () => {
    for (const item of TAB_ITEMS) {
      expect(hasRoute(item.path, true)).toBe(true)
    }

    for (const item of [...MORE_PRIMARY, ...MORE_GROUPS.flatMap((g) => g.items)]) {
      expect(hasRoute(item.path, false)).toBe(true)
    }
  })

  it('names tab route files after the contract path', () => {
    for (const item of TAB_ITEMS) {
      expect(tabRouteName(item)).toBe(item.path.slice(1))
    }
  })

  it('prefixes tab destinations with the group and leaves the rest verbatim', () => {
    // Pushing to a tab from outside the group needs the group name; pushing to a
    // plain screen must not gain one, or expo-router will not match it.
    expect(hrefFor('/invoices')).toBe('/(tabs)/invoices')
    expect(hrefFor('/purchasing')).toBe('/purchasing')
  })

  it('surfaces every implemented destination somewhere', () => {
    const offered = new Set(
      [...TAB_ITEMS, ...MORE_PRIMARY, ...MORE_GROUPS.flatMap((g) => g.items)].map((i) => i.id),
    )

    for (const item of NAV_CONTRACT) {
      if (isImplemented(item.id)) expect(offered.has(item.id)).toBe(true)
    }
  })
})

// ============================================
// Screen titles must agree with the menu entry that opened them.
//
// The audit found three destinations with two names each: «موجودی» in the menu
// opened a screen headed «انبار», «خریدارها» opened «مشتریان», «پول و سود»
// opened «حسابداری». Each screen had titled itself from mobile-only copy
// instead of the navigation contract.
// ============================================

import { existsSync as fileExists, readFileSync } from 'node:fs'

/** Screen file per destination, for the destinations mobile serves as a page. */
const SCREEN_FILES: Partial<Record<NavId, string>> = {
  'get-paid': 'sales/screens/invoices-screen.tsx',
  stock: 'inventory/screens/products-screen.tsx',
  buy: 'purchasing/screens/purchasing-screen.tsx',
  money: 'accounting/screens/accounting-screen.tsx',
  buyers: 'crm/screens/customers-screen.tsx',
}

const FEATURES_DIR = join(__dirname, '..', '..', '..', 'features')

describe('screen headers come from the navigation contract', () => {
  it.each(Object.entries(SCREEN_FILES))('%s titles itself from the contract', (_id, relative) => {
    const path = join(FEATURES_DIR, relative as string)
    expect(fileExists(path)).toBe(true)

    const source = readFileSync(path, 'utf8')

    expect(source).toContain('NavScreenHeader')
    // A hand-written title is what drifted; the contract header takes an id.
    expect(source).not.toMatch(/<ScreenHeader\s+title=\{t\(/)
  })
})
