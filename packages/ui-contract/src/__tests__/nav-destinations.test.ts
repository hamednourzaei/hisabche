// ============================================
// Every destination in the contract reaches a real screen — on all three.
//
// ---------------------------------------------------------------------------
// WHY THIS TEST READS THE FILESYSTEM
//
// NAV_CONTRACT is the product's information architecture, and a menu entry
// whose route does not exist is worse than a missing one: the user taps it,
// gets a blank page or a 404, and learns not to trust the menu.
//
// Nothing in TypeScript connects `path: '/till'` to
// `apps/web/app/[lang]/(dashboard)/till/page.tsx`. The link is a string and a
// directory name, so a test that only reads types cannot see the break. This
// one looks for the files.
//
// Mobile is judged against its OWN list rather than the whole contract: it is
// deliberately behind, and `IMPLEMENTED` in `apps/mobile/.../nav.ts` is the
// honest statement of how far. What is checked is that the list does not lie —
// every id it claims has a route file.
// ============================================

import { existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { NAV_CONTRACT } from '../navigation'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

/** Contract paths are single-segment today; `/a/b` would need a nested dir. */
const segment = (path: string) => path.replace(/^\//, '')

describe('web routes', () => {
  it.each(NAV_CONTRACT.map((item) => [item.id, item.path] as const))(
    '%s has a page at %s',
    (_id, path) => {
      const page = join(
        ROOT,
        'apps',
        'web',
        'app',
        '[lang]',
        '(dashboard)',
        segment(path),
        'page.tsx',
      )

      expect(existsSync(page), `missing ${page}`).toBe(true)
    },
  )
})

describe('desktop routes', () => {
  const app = readFileSync(join(ROOT, 'apps', 'desktop', 'src', 'app', 'app.tsx'), 'utf8')

  it.each(NAV_CONTRACT.map((item) => [item.id, item.path] as const))(
    '%s is routed at %s',
    (_id, path) => {
      // Desktop mirrors the web paths exactly — that is what lets one
      // container serve both without a per-platform branch.
      const routed = app.includes(`path: '${segment(path)}'`) || app.includes(`path: '${path}'`)

      expect(routed, `desktop router has no route for ${path}`).toBe(true)
    },
  )
})

describe('mobile routes', () => {
  const nav = readFileSync(
    join(ROOT, 'apps', 'mobile', 'src', 'shared', 'navigation', 'nav.ts'),
    'utf8',
  )

  const implemented = (() => {
    const block = /const IMPLEMENTED[^=]*=\s*new Set<NavId>\(\[([\s\S]*?)\]\)/.exec(nav)
    if (!block) throw new Error('could not read IMPLEMENTED from mobile nav.ts')

    return [...block[1]!.matchAll(/'([\w-]+)'/g)].map((match) => match[1]!)
  })()

  it('claims at least one destination', () => {
    expect(implemented.length).toBeGreaterThan(0)
  })

  it.each(implemented)('%s has a screen', (id) => {
    const item = NAV_CONTRACT.find((entry) => entry.id === id)

    // A few NavIds are deliberately NOT navigation destinations — `buy`
    // (/purchasing) is reached from the stock screen rather than the menu, and
    // says so at navigation.ts:112. Mobile may still have a screen for one;
    // what this test can check is only what the contract describes.
    if (!item) return

    // Expo Router serves a destination three ways: `<seg>.tsx`, a directory
    // with `index.tsx`, or either of those inside the `(tabs)` group.
    const route = join(ROOT, 'apps', 'mobile', 'app', `${segment(item!.path)}.tsx`)
    const routeIndex = join(ROOT, 'apps', 'mobile', 'app', segment(item!.path), 'index.tsx')
    const tabRoute = join(ROOT, 'apps', 'mobile', 'app', '(tabs)', `${segment(item!.path)}.tsx`)
    const tabIndex = join(ROOT, 'apps', 'mobile', 'app', '(tabs)', segment(item!.path), 'index.tsx')

    expect(
      existsSync(route) || existsSync(routeIndex) || existsSync(tabRoute) || existsSync(tabIndex),
      `${id} is listed as implemented but has no route file`,
    ).toBe(true)
  })
})
