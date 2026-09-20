// ============================================
// Why clicking a menu item felt slow.
//
// `usePrefetchRoutes` warmed THREE routes, picked by a filter that did not
// mean much — and warmed them at BARE paths (`/invoices`) while every real
// navigation goes to `/fa/invoices`. A prefetch of a URL nobody visits warms
// nothing, so the first click on any menu item paid a full RSC round trip, on
// the sidebar and on the mobile bar alike.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const layout = readFileSync(
  join(__dirname, '../../../../apps/web/app/[lang]/(dashboard)/dashboard-layout.tsx'),
  'utf8',
)
const code = layout.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')

describe('menu destinations are warmed', () => {
  const hook = code.slice(
    code.indexOf('function usePrefetchRoutes'),
    code.indexOf('useRedirectGuard'),
  )

  it('⚠️ prefetches the LOCALE-PREFIXED url, the one that is actually visited', () => {
    expect(hook).toContain('const prefix = `/${locale}`')
    expect(hook).toContain('router.prefetch(path === ')
    // The bare-path call is what made the whole thing a no-op.
    expect(hook).not.toMatch(/router\.prefetch\(item\.path\)/)
  })

  it('warms every destination, not an arbitrary three', () => {
    expect(hook).toContain('[...new Set(NAV_ITEMS.map((item) => item.path))]')
    expect(hook).not.toContain('.slice(0, 3)')
  })

  it('⚠️ waits for an idle moment — a burst on mount slows the FIRST screen', () => {
    expect(hook).toContain('requestIdleCallback')
    // Safari has none; it must still get warmed rather than skipped.
    expect(hook).toContain('window.setTimeout(warmNext')
  })

  it('⚠️ does not re-run on every navigation', () => {
    // Re-warming on each pathname change turns a one-off cost into a
    // per-route one, which is the opposite of the fix.
    const deps = hook.slice(hook.lastIndexOf('}, ['))
    expect(deps).toContain('[router, locale]')
    expect(deps).not.toContain('pathname')
  })

  it('is cancelled on unmount, so a left page stops fetching', () => {
    expect(hook).toContain('cancelled = true')
    expect(hook).toContain('if (cancelled) return')
  })
})
