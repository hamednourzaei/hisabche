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
// Mobile renders the desktop shell in a WebView, so it is covered by the
// desktop routes; its block only checks that this is still how it works.
// ============================================

import { existsSync } from 'node:fs'
import { readdirSync, readFileSync } from 'node:fs'
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
  const app = readFileSync(join(ROOT, 'packages', 'app-shell', 'src', 'app', 'app.tsx'), 'utf8')

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
  // Mobile has no router of its own: it renders the SAME app-shell bundle as
  // desktop inside a WebView, so every destination the desktop block above
  // proves is routed is routed on the phone too. What must stay true for that
  // is that the phone keeps loading the shell and grows no second router.
  it('the phone renders the shared shell', () => {
    const host = readFileSync(
      join(ROOT, 'apps', 'mobile', 'src', 'host', 'shell-webview.tsx'),
      'utf8',
    )
    expect(host).toContain("from '../../assets/shell/index.html'")
  })

  it('and has no screens of its own besides the host layout', () => {
    expect(readdirSync(join(ROOT, 'apps', 'mobile', 'app'))).toEqual(['_layout.tsx'])
  })
})
