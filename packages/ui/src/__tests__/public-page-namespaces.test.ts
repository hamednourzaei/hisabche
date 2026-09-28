// ============================================
// A web page outside (dashboard) gets only the message namespaces its layout
// hands it — the root layout ships CORE only. t() THROWS on a missing key, so
// a container reading a namespace its page does not ship crashes the page
// into the error boundary, with every unit test green (BUG-079: the customer
// portal read `portal.*` and had no layout at all).
//
// For each lean public route: follow the container's relative imports, collect
// every message namespace a string in them names, and require the route's
// layout to ship each one.
// ============================================

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../../../..')
const UI = join(ROOT, 'packages/ui/src')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const catalog = JSON.parse(
  readFileSync(join(ROOT, 'packages/i18n/messages/fa/common.json'), 'utf8'),
) as Record<string, unknown>
const NAMESPACES = new Set(Object.keys(catalog))
const CORE = ['app', 'auth', 'error', 'action', 'common']

function resolveImport(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec)
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

/** Every namespace named by a string literal in `entry` and the files it imports relatively. */
function namespacesRead(entry: string): Set<string> {
  const seen = new Set<string>()
  const found = new Set<string>()
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (seen.has(file) || !file.startsWith(UI)) continue
    seen.add(file)
    const source = strip(readFileSync(file, 'utf8'))
    for (const m of source.matchAll(/['`]([a-zA-Z]+)\.[a-zA-Z_$]/g)) {
      if (NAMESPACES.has(m[1] as string)) found.add(m[1] as string)
    }
    for (const m of source.matchAll(/from '(\.{1,2}\/[^']+)'/g)) {
      const next = resolveImport(file, m[1] as string)
      if (next) queue.push(next)
    }
  }
  return found
}

function layoutNamespaces(route: string): Set<string> {
  const layout = strip(readFileSync(join(ROOT, 'apps/web/app/[lang]', route, 'layout.tsx'), 'utf8'))
  const list = /namespaces=\{\[([^\]]*)\]\}/.exec(layout)?.[1] ?? ''
  const named = [...list.matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1] as string)
  return new Set([...(list.includes('...CORE_NAMESPACES') ? CORE : []), ...named])
}

const ROUTES: Array<{ route: string; container: string }> = [
  { route: 'portal', container: 'components/ui/customers/containers/public-portal-container.tsx' },
  { route: 'oauth', container: 'components/ui/developers/containers/oauth-consent-container.tsx' },
]

describe('lean public pages ship every namespace they read', () => {
  it.each(ROUTES)('$route', ({ route, container }) => {
    const needed = namespacesRead(join(UI, container))
    expect(needed.size).toBeGreaterThan(0)
    const shipped = layoutNamespaces(route)
    expect([...needed].filter((ns) => !shipped.has(ns))).toEqual([])
  })
})
