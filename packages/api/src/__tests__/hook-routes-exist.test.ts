// ============================================
// Every path a hook calls must be a path the backend actually serves.
//
// ---------------------------------------------------------------------------
// ⚠️ WHY THIS EXISTS
//
// `useExchangeRates` called `GET /currency/rates`. The handler is in
// `finance-ops.routes.ts`, which `backend/src/index.ts` registers with
// `{ prefix: '/api/finance' }` — so the real path is
// `/api/finance/currency/rates` and every call 404ed in production.
//
// It went unnoticed because the failure is INVISIBLE BY CONSTRUCTION: the
// query swallows the error and returns `[]`, and an empty list of exchange
// rates looks exactly like a workspace that has not entered any yet. Nothing
// is red. Types cannot help — both sides are strings.
//
// A prefix is added in one file and the paths are written in another, so there
// is no way for the compiler to relate them. This test is the relation.
// ============================================

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const REPO = join(__dirname, '..', '..', '..', '..')
const HOOKS = join(__dirname, '..', 'hooks')
const ROUTES = join(REPO, 'backend', 'src', 'routes')
const INDEX = join(REPO, 'backend', 'src', 'index.ts')

/** Comments stripped — paths are quoted inside explanatory comments here. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

// ─── What the backend serves ──────────────────────────────────────────────
//
// `server.register(xRoutes, { prefix: '/api/foo' })` → module `x` is mounted
// at `/api/foo`. Read from index.ts rather than assumed, because the prefix is
// exactly the thing that was wrong.

function registeredPrefixes(): Map<string, string> {
  const source = code(INDEX)

  // ⚠️ RESOLVE THROUGH THE IMPORT, NOT THROUGH THE EXPORT NAME.
  //
  // Matching `export const fooRoutes` in each route file misses every module
  // that uses a DEFAULT export — `analytics.routes.ts` does — and those came
  // back as false orphans. The import statement in index.ts names both the
  // binding and the file, which is exactly the pair needed and works for
  // default and named imports alike.
  const fileOf = new Map<string, string>()
  for (const match of source.matchAll(
    /import\s+(?:(\w+)|\{\s*(\w+)[^}]*\})\s+from\s+'\.\/routes\/([\w.-]+)'/g,
  )) {
    const binding = match[1] ?? match[2]
    if (binding) fileOf.set(binding, `${match[3]}.ts`)
  }

  const byFile = new Map<string, string>()

  for (const match of source.matchAll(/register\(\s*(\w+)\s*,\s*\{[^}]*prefix:\s*'([^']+)'/g)) {
    const file = fileOf.get(match[1]!)
    if (file) byFile.set(file, match[2]!)
  }
  // A register with no prefix mounts at the root — those modules write the
  // full `/api/...` path in the handler itself.
  for (const match of source.matchAll(/register\(\s*(\w+)\s*\)/g)) {
    const file = fileOf.get(match[1]!)
    if (file && !byFile.has(file)) byFile.set(file, '')
  }

  return byFile
}

/** Every route the backend declares, as a full path with its prefix applied. */
function backendPaths(): string[] {
  const paths: string[] = []

  for (const [file, prefix] of registeredPrefixes()) {
    const full = join(ROUTES, file)
    if (!existsSync(full)) continue
    const source = code(full)
    for (const match of source.matchAll(/fastify\.(get|post|put|patch|delete)\(\s*'([^']*)'/g)) {
      paths.push(`${prefix}${match[2]}`)
    }
  }
  return paths
}

/** Every path a hook calls, with the client's own `/api` base applied. */
function hookCalls(): { file: string; path: string }[] {
  const calls: { file: string; path: string }[] = []

  for (const entry of readdirSync(HOOKS)) {
    if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) continue
    const source = code(join(HOOKS, entry))
    for (const match of source.matchAll(
      /apiClient\.(?:get|post|put|patch|delete)\(\s*'(\/[^'`]*)'/g,
    )) {
      calls.push({ file: entry, path: match[1]! })
    }
  }
  return calls
}

/** `/customers/:id` matches `/customers/abc`; `/a/:b/c` matches `/a/x/c`. */
function matches(pattern: string, path: string): boolean {
  const p = pattern.split('/').filter(Boolean)
  const q = path.split('/').filter(Boolean)
  if (p.length !== q.length) return false
  return p.every((segment, index) => segment.startsWith(':') || segment === q[index])
}

describe('hook paths resolve to real backend routes', () => {
  it('found the backend and its route modules', () => {
    // A moved directory would make every assertion below vacuous.
    expect(existsSync(INDEX), 'backend/src/index.ts').toBe(true)
    expect(readdirSync(ROUTES).filter((f) => f.endsWith('.ts')).length).toBeGreaterThan(5)
  })

  const served = backendPaths()

  it('read a plausible number of backend routes', () => {
    expect(served.length).toBeGreaterThan(100)
  })

  it('read a plausible number of hook calls', () => {
    expect(hookCalls().length).toBeGreaterThan(50)
  })

  it('⚠️ every hook path is served, prefix included', () => {
    const orphans: string[] = []

    for (const call of hookCalls()) {
      // `apiClient`'s base already ends in `/api` — see `lib/client.ts`.
      const full = `/api${call.path}`
      // Query strings and template segments are not part of the route.
      const withoutQuery = full.split('?')[0]!
      if (!served.some((pattern) => matches(pattern, withoutQuery))) {
        orphans.push(`${call.file}: ${call.path}  →  ${withoutQuery}`)
      }
    }

    expect(
      orphans,
      'these hooks call paths the backend does not serve — they 404 at runtime and most swallow it',
    ).toEqual([])
  })
})
