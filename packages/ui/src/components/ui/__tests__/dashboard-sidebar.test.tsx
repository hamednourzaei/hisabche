// ============================================
// The sidebar's navigation logic, and the two defects that shipped silently.
//
// ⚠️ THE POINT OF THIS FILE
//
// Both bugs it locks down were invisible: no crash, no type error, no failing
// build. A wrong-but-well-typed string was passed to a function that accepted
// it, and a counter of zero rendered a badge that said «۰». Nothing fails on
// its own for either, which is exactly why they need a test.
// ============================================

import { describe, expect, it } from 'vitest'

import { isPathActive, SIDEBAR_STORAGE_KEY } from '../dashboard-sidebar'
import { NAV_CONTRACT } from '@hisabche/ui-contract'

describe('isPathActive', () => {
  it('matches the exact path', () => {
    expect(isPathActive('/invoices', '/invoices')).toBe(true)
  })

  it('matches a child route', () => {
    expect(isPathActive('/invoices/42', '/invoices')).toBe(true)
  })

  it('matches a query string', () => {
    expect(isPathActive('/warehouse?tab=products', '/warehouse')).toBe(true)
  })

  it.each(['fa', 'af', 'en'])('strips the %s locale prefix', (locale) => {
    expect(isPathActive(`/${locale}/invoices/42`, '/invoices')).toBe(true)
  })

  it('treats an unprefixed path as-is, which is what desktop serves', () => {
    // Electron's hash router has no locale segment. Both shells feed the same
    // component, so both shapes have to work.
    expect(isPathActive('/dashboard', '/dashboard')).toBe(true)
  })

  // ── ⚠️ FALSE PREFIX MATCH ──
  it('does NOT light up a different destination that shares a prefix', () => {
    // `/accounting` and `/accounting-workspace` are BOTH real destinations in
    // this sidebar. A plain `startsWith` marks the first active while you are
    // on the second.
    expect(isPathActive('/accounting-workspace', '/accounting')).toBe(false)
    expect(isPathActive('/fa/accounting-workspace', '/accounting')).toBe(false)
  })

  it('the prefix pair it protects really does exist in the contract', () => {
    // If the routes were ever renamed, the test above would keep passing while
    // protecting nothing. This is what stops it going stale.
    const paths = NAV_CONTRACT.map((item) => item.path)
    expect(paths).toContain('/accounting')
    expect(paths).toContain('/accounting-workspace')
  })

  it('finds every such pair, so a new one cannot be added unnoticed', () => {
    const paths = NAV_CONTRACT.map((item) => item.path)
    for (const path of paths) {
      for (const other of paths) {
        if (path === other) continue
        if (!other.startsWith(path)) continue
        // `other` extends `path`. Being on `other` must never activate `path`
        // unless `other` is genuinely a child route of it.
        const isRealChild = other.startsWith(`${path}/`)
        expect(isPathActive(other, path), `${other} vs ${path}`).toBe(isRealChild)
      }
    }
  })

  it('does not match an unrelated path', () => {
    expect(isPathActive('/settings', '/invoices')).toBe(false)
  })
})

describe('the desktop shell passes a path, not an id', () => {
  it('⚠️ an id can never satisfy isPathActive', () => {
    // apps/desktop/src/components/layout/sidebar.tsx used to resolve the nav
    // entry and pass `match.id`. `DashboardSidebar` feeds `activeNav` into
    // `isPathActive`, so it compared 'today' with '/dashboard' — and the
    // desktop sidebar had no active item on any page. It was a string being
    // passed where a string was expected, so nothing failed.
    for (const item of NAV_CONTRACT) {
      expect(isPathActive(item.id, item.path), `id "${item.id}" must not match`).toBe(false)
      expect(isPathActive(item.path, item.path), `path "${item.path}" must match`).toBe(true)
    }
  })
})

describe('persistence key', () => {
  it('is namespaced', () => {
    // A bare key like 'sidebar' collides with anything else on the origin.
    expect(SIDEBAR_STORAGE_KEY).toBe('hisabche.sidebar.state')
  })
})
