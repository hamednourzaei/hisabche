// ============================================
// ⚠️ EVERY PAGE THE PRODUCT HAS, ON EVERY MACHINE IT RUNS ON.
//
// One shared UI only means one product if that UI routes to every page. An
// audit found four that web had and nothing else did — `/assistant`,
// `/operations`, `/stock-count`, `/domain/:id` — so Windows and Android were
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

const router = readFileSync(routerFile, 'utf8')
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
    for (const route of ['/assistant', '/operations', '/stock-count', '/domain/:param']) {
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

describe('a route that names a domain hands it to the screen', () => {
  // `/accounting-workspace` and its siblings have no `:domain` segment. They
  // rendered the page that reads one, got `''`, and the container draws nothing
  // for an unknown domain — four blank workspaces on Windows and Android while
  // web, which passes each page its domain, worked.
  const domains = ['accounting', 'sales', 'inventory', 'people']

  it.each(domains)('⚠️ /%s-workspace passes its own domain', (domain) => {
    const route = new RegExp(
      `path:\\s*'${domain}-workspace',\\s*element:\\s*<DomainWorkspacePage\\s+domain="${domain}"`,
    )
    expect(router).toMatch(route)
  })

  it('the list above is every workspace route the shell has', () => {
    const inRouter = [...router.matchAll(/path:\s*'(\w+)-workspace'/g)].map((m) => m[1]).sort()
    expect(inRouter).toEqual([...domains].sort())
  })
})
