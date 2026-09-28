// ============================================
// The `@hisabche/ui` barrel is imported by SERVER modules too (sitemap.ts,
// public pages). A module it re-exports that pulls in `@hisabche/api` — whose
// barrel carries React hooks — without `'use client'` becomes part of the
// server graph, and `next build` fails: «You're importing a module that
// depends on useEffect into a React Server Component module».
//
// 28 Sep 2026: wallet-format.ts (plain helpers, no directive) did exactly
// that and broke the Vercel build. tsc and every test stayed green.
// ============================================

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')

function resolveModule(from: string, spec: string): string | null {
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

/** Value (not type-only) re-exports of a barrel, as file paths. */
function valueExports(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  const out: string[] = []
  for (const m of src.matchAll(/export\s+(type\s+)?(?:\{[^}]*\}|\*)\s+from\s+'(\.[^']+)'/g)) {
    if (m[1]) continue
    const path = resolveModule(file, m[2]!)
    if (path) out.push(path)
  }
  return out
}

const importsApiValues = (src: string) =>
  /^import\s+(?!type\b)[^;]*from\s+'@hisabche\/api'/m.test(src)

// Comments may come first; the directive must be the first statement.
const isClient = (src: string) =>
  /^['"]use client['"]/.test(src.replace(/^(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/, ''))

describe('modules the ui barrel re-exports are safe in a server graph', () => {
  const files = valueExports(join(SRC, 'index.ts'))

  it('found the barrel', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it("every re-exported module that imports @hisabche/api is 'use client'", () => {
    const offenders = files.filter((file) => {
      const src = readFileSync(file, 'utf8')
      return importsApiValues(src) && !isClient(src)
    })
    expect(offenders.map((f) => f.slice(SRC.length))).toEqual([])
  })
})
