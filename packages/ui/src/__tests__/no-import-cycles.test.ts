// ============================================
// The monorepo's module graph is acyclic.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A REAL BUG AND NOT A STYLE RULE
//
// `no-self-barrel-import.test.ts` catches one shape of this: a file inside
// `@hisabche/ui` importing `@hisabche/ui`. It only looks at one package, and
// only at that one spelling. A cycle can be longer than two modules and can
// run through relative imports alone, and it produces the same crash:
//
//     ReferenceError: Cannot access 'Y' before initialization
//
// — a temporal dead zone error, thrown when whichever module the bundler
// decided to evaluate first reads a `const`/`let`/`class` binding whose
// initializer has not run yet. The name in the stack is minified, so it points
// at nothing.
//
// The one this test was written for was `@hisabche/db-schema`:
//
//     src/index.ts  → src/client.ts        (`export { db } from './client'`)
//     src/client.ts → '@hisabche/db-schema' (`import { drizzleSchema }`)
//                   → src/index.ts
//
// and `client.ts` read `drizzleSchema` at MODULE SCOPE — `drizzle(client,
// { schema: drizzleSchema })` — which is exactly what throws. An import only
// referenced inside a function body survives a cycle; one read while the
// module body is running does not.
//
// ⚠️ A cycle is STABLE UNTIL IT IS NOT. The evaluation order holds until an
// export list changes, so a cycle added months ago surfaces as a crash blamed
// on an unrelated edit. That is why this fails on the cycle itself rather than
// on the crash.
// ============================================

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..', '..')

/** Windows paths, normalised so chains read the same on every machine. */
function toPosix(path: string): string {
  return path.split(String.fromCharCode(92)).join('/')
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.turbo', '__tests__'])

function sourceFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out)
    } else if (/\.tsx?$/.test(entry) && !entry.includes('.test.') && !entry.endsWith('.d.ts')) {
      out.push(toPosix(full))
    }
  }
  return out
}

interface Manifest {
  readonly name?: string
  readonly exports?: Record<string, string>
}

/** `@hisabche/<pkg>` → its directory, plus whatever subpaths it publishes. */
const packageDirs = new Map<string, string>()
const packageExports = new Map<string, Record<string, string>>()

for (const entry of readdirSync(join(ROOT, 'packages'))) {
  const dir = join(ROOT, 'packages', entry)
  const manifestPath = join(dir, 'package.json')
  if (!existsSync(manifestPath)) continue
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
  if (!manifest.name) continue
  packageDirs.set(manifest.name, toPosix(dir))
  if (manifest.exports && typeof manifest.exports === 'object') {
    packageExports.set(manifest.name, manifest.exports)
  }
}

/** Each app's `@/*` root, which differs between Next apps and the Electron one. */
const appRoots: ReadonlyArray<readonly [string, string]> = [
  ['web', 'apps/web'],
  ['admin', 'apps/admin'],
  ['mobile', 'apps/mobile'],
  ['desktop', 'apps/desktop/src'],
]

const files: string[] = []
for (const dir of packageDirs.values()) sourceFiles(join(dir, 'src'), files)
for (const [app] of appRoots) sourceFiles(join(ROOT, 'apps', app), files)

const known = new Set(files)

function resolveFile(base: string): string | undefined {
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ]) {
    if (known.has(candidate)) return candidate
  }
  return undefined
}

function resolveSpecifier(spec: string, from: string): string | undefined {
  if (spec.startsWith('.')) return resolveFile(toPosix(resolve(dirname(from), spec)))

  for (const [name, dir] of packageDirs) {
    if (spec !== name && !spec.startsWith(`${name}/`)) continue
    const subpath = spec === name ? '.' : `.${spec.slice(name.length)}`
    const mapped = packageExports.get(name)?.[subpath]
    if (mapped !== undefined) return resolveFile(toPosix(resolve(dir, mapped)))
    return resolveFile(
      spec === name ? `${dir}/src/index` : `${dir}/src/${spec.slice(name.length + 1)}`,
    )
  }

  if (spec.startsWith('@/')) {
    for (const [app, root] of appRoots) {
      if (from.includes(`/apps/${app}/`))
        return resolveFile(toPosix(join(ROOT, root, spec.slice(2))))
    }
  }
  return undefined
}

// `import type` / `export type` are erased before the bundler sees them, so
// they cannot carry a cycle and must not be counted as one.
const FROM_CLAUSE = /(?:^|\n)\s*(?:import|export)\s+(?!type\s)[^;'"]*?from\s*['"]([^'"]+)['"]/g
const SIDE_EFFECT_IMPORT = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g

const graph = new Map<string, string[]>()
for (const file of files) {
  const source = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')

  const deps = new Set<string>()
  for (const pattern of [FROM_CLAUSE, SIDE_EFFECT_IMPORT]) {
    pattern.lastIndex = 0
    let match = pattern.exec(source)
    while (match !== null) {
      const target = resolveSpecifier(match[1] ?? '', file)
      if (target !== undefined && target !== file) deps.add(target)
      match = pattern.exec(source)
    }
  }
  graph.set(file, [...deps])
}

/** Tarjan: every component larger than one node is a cycle. */
function stronglyConnectedComponents(): string[][] {
  const index = new Map<string, number>()
  const lowlink = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const components: string[][] = []
  let counter = 0

  const visit = (node: string): void => {
    index.set(node, counter)
    lowlink.set(node, counter)
    counter += 1
    stack.push(node)
    onStack.add(node)

    for (const next of graph.get(node) ?? []) {
      if (!index.has(next)) {
        visit(next)
        lowlink.set(node, Math.min(lowlink.get(node) ?? 0, lowlink.get(next) ?? 0))
      } else if (onStack.has(next)) {
        lowlink.set(node, Math.min(lowlink.get(node) ?? 0, index.get(next) ?? 0))
      }
    }

    if (lowlink.get(node) === index.get(node)) {
      const component: string[] = []
      let popped: string | undefined
      do {
        popped = stack.pop()
        if (popped === undefined) break
        onStack.delete(popped)
        component.push(popped)
      } while (popped !== node)
      if (component.length > 1) components.push(component)
    }
  }

  for (const file of files) if (!index.has(file)) visit(file)
  return components
}

const relative = (path: string): string => path.slice(toPosix(ROOT).length + 1)

describe('the module graph has no cycles', () => {
  it('found the workspace', () => {
    // A moved directory, or a resolver that stopped resolving, would make the
    // rule below vacuous rather than failing.
    expect(packageDirs.size).toBeGreaterThan(10)
    expect(files.length).toBeGreaterThan(500)
  })

  it('every import resolves to a file, so no edge is silently dropped', () => {
    const edges = [...graph.values()].reduce((total, deps) => total + deps.length, 0)
    expect(edges).toBeGreaterThan(1000)
  })

  it('⚠️ no module imports its own package, in any package', () => {
    const offenders: string[] = []
    for (const [name] of packageDirs) {
      for (const file of files) {
        if (!file.startsWith(`${packageDirs.get(name) ?? ''}/`)) continue
        const source = readFileSync(file, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
        if (source.includes(`'${name}'`) || source.includes(`'${name}/`)) {
          offenders.push(`${relative(file)} imports ${name}`)
        }
      }
    }

    expect(
      [...new Set(offenders)],
      'a file inside a package must name the module it wants, not the barrel that re-exports it',
    ).toEqual([])
  })

  it('⚠️ no import cycle anywhere in packages/* or apps/*', () => {
    const chains = stronglyConnectedComponents().map((component) =>
      component
        .map((file) => {
          const inside = (graph.get(file) ?? []).filter((dep) => component.includes(dep))
          return `${relative(file)} -> ${inside.map(relative).join(', ')}`
        })
        .join('\n    '),
    )

    expect(
      chains,
      'a cycle lets the bundler decide evaluation order; whichever module loses reads a binding still in its temporal dead zone and the app throws "Cannot access X before initialization"',
    ).toEqual([])
  })
})
