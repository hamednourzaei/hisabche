// ============================================
// ⚠️ EVERY PAGE THE PRODUCT HAS, ON EVERY MACHINE IT RUNS ON.
//
// One shared UI only means one product if that UI routes to every page. An
// audit found three that web had and nothing else did — `/assistant`,
// `/operations`, `/stock-count` — so Windows and Android were
// quietly missing features their users had been told about.
//
// Nothing else catches it: each app compiles, each test suite is green, and a
// missing route only shows as a person tapping a menu item that goes nowhere.
// ============================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = join(__dirname, '..', '..', '..', '..', '..')
const webDashboard = join(repoRoot, 'apps/web/app/[lang]/(dashboard)')
const routerFile = join(__dirname, '..', 'app.tsx')

/** Every URL the web app serves inside the signed-in product. */
function webPages(dir: string, prefix = ''): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      // `(group)` folders add no URL segment.
      const segment = entry.startsWith('(') && entry.endsWith(')') ? '' : `/${entry}`
      out.push(...webPages(full, prefix + segment))
    } else if (entry === 'page.tsx') {
      out.push(prefix || '/')
    }
  }
  return out
}

/** `[id]` and `:id` are the same route wearing two frameworks' clothes. */
const canonical = (route: string): string =>
  '/' +
  route
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\[[^\]]+\]/g, ':param')
    .replace(/:[A-Za-z_]+/g, ':param')

// One line per route however the formatter wrapped it: a long `<Navigate>` is
// broken over four lines, and a guard matching the one-line form went red on
// routes that were there.
const router = readFileSync(routerFile, 'utf8').split(/\s+/).join(' ').split(', }').join(' }')
const shellRoutes = new Set(
  [...router.matchAll(/path:\s*'([^']+)'/g)].map((match) => canonical(match[1] ?? '')),
)

const webRoutes = [...new Set(webPages(webDashboard).map(canonical))].sort()

describe('the shared UI routes to every page the product has', () => {
  it('⚠️ has no page that only web can open', () => {
    // A redirect counts: the point is that the URL resolves to something, not
    // that every app draws its own copy of the screen.
    const missing = webRoutes.filter((route) => !shellRoutes.has(route))
    expect(missing).toEqual([])
  })

  it('⚠️ covers the pages the audit found missing, by name', () => {
    // Named so a future refactor that drops one of them fails loudly rather
    // than quietly shrinking the product on two platforms.
    for (const route of ['/assistant', '/operations', '/stock-count']) {
      expect(shellRoutes.has(route)).toBe(true)
    }
  })

  it('⚠️ the web app really is the wider surface — this test is worth running', () => {
    // Guards the guard: if the crawl ever returns nothing (a moved folder, a
    // renamed group), `missing` would be empty and the test would pass while
    // checking nothing at all (راهنمای سشن §۷٫۳).
    expect(webRoutes.length).toBeGreaterThan(30)
    expect(shellRoutes.size).toBeGreaterThan(30)
  })
})

describe('an address that was only a redirect still leads somewhere — on every platform', () => {
  // Every page that became a tab or a section of another page keeps its
  // address: the web redirects it in next.config.js and the shell has a route
  // for each. The two lists must be the same list: an address that redirects
  // on the web and 404s on Windows is the bug this file exists for.
  const config = readFileSync(join(repoRoot, 'apps', 'web', 'next.config.js'), 'utf8')
  const block = config.slice(config.indexOf('const moved = ['), config.indexOf('return moved.map('))
  const moved = [...block.matchAll(/\['([\w\-/:]+)', '([\w\-/:?=&]+)'\],/g)].map(
    (match) => [match[1] as string, match[2] as string] as const,
  )

  it('the web declares them, and this test can see them', () => {
    expect(moved).toHaveLength(25)
    expect(moved).toContainEqual(['product-list', 'warehouse?tab=products'])
  })

  it.each(moved)('/%s goes to /%s in the shell too', (from, to) => {
    // The employee page carries its id through a small component; every
    // other address is a plain <Navigate>.
    if (from === 'human-resources/:id') {
      expect(router).toContain(
        "{ path: 'human-resources/:id', element: <LegacyEmployeeRedirect /> }",
      )
      return
    }
    expect(router).toContain(`{ path: '${from}', element: <Navigate to="/${to}" replace /> }`)
  })

  it('none of them is a page any more', () => {
    for (const [from] of moved) {
      const first = '/' + from.split('/')[0]
      expect(webRoutes.some((route) => route === first || route.startsWith(first + '/'))).toBe(
        false,
      )
    }
  })

  it('every one of them opens a page that exists', () => {
    for (const [, to] of moved) {
      const target = '/' + (to.split('?')[0] ?? '').replace(/:[a-z]+/g, ':param')
      expect(webRoutes).toContain(target)
    }
  })
})
