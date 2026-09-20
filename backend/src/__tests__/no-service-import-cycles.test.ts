// ============================================
// No import cycle between a service and a Core.
//
// ⚠️ THE BUG THIS PREVENTS, IN FULL.
//
// `billing.service` credits a referral when a plan activates, so it imports
// the Referral Core. The Referral Core needed a plan's price, so it imported
// `billing.service` back. Node resolves a cycle by handing the second importer
// a PARTIALLY INITIALISED module: `referralService` was `undefined` while
// `billing.service`'s body ran, and `GET /api/referrals` answered 500 on the
// live site.
//
// ⚠️ EVERY UNIT TEST PASSED THROUGH IT. The tests import the leaves directly
// (`referral.domain`, `plan-pricing`) and never close the loop, so a green
// suite proved nothing about module initialisation order. That is why this
// guard walks the import graph instead of exercising behaviour.
//
// The fix, and the rule: shared CONSTANTS live in a module that imports
// nothing (`services/plan-pricing.ts`). A module with no imports cannot be
// part of a cycle.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const SERVICES = join(__dirname, '..', 'services')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return entry.endsWith('.ts') && !entry.endsWith('.d.ts') ? [full] : []
  })
}

/**
 * Relative, RUNTIME imports only.
 *
 * ⚠️ `import type` IS ERASED BY THE COMPILER, so a type-only edge cannot
 * cause a runtime cycle — `analytics.service` and its aggregates reference each
 * other's types on purpose and are not a defect. Counting them would make this
 * guard cry wolf, and a guard nobody believes gets deleted.
 */
function importsOf(file: string): string[] {
  const src = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

  const specifiers = [...src.matchAll(/\bimport\s+(type\s+)?([\s\S]*?)from\s+'(\.[^']+)'/g)]
    // `import type { X } from` — erased, so not a runtime edge.
    .filter((match) => !match[1])
    // `import { type X, type Y }` — every named binding is a type, so this one
    // is erased too. A single value binding makes it real.
    .filter((match) => {
      const bindings = (match[2] ?? '').trim()
      if (!bindings.startsWith('{')) return true
      return bindings
        .slice(1, bindings.lastIndexOf('}'))
        .split(',')
        .map((binding) => binding.trim())
        .filter((binding) => binding.length > 0)
        .some((binding) => !binding.startsWith('type '))
    })
    .map((match) => match[3] as string)

  return specifiers
    .map((specifier) => {
      const base = resolve(dirname(file), specifier)
      // `./referral` is `./referral/index.ts`; `./plan-pricing` is a file.
      for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
        try {
          if (statSync(candidate).isFile()) return candidate
        } catch {
          // Not this shape; try the next.
        }
      }
      return null
    })
    .filter((resolved): resolved is string => resolved !== null)
}

/** Every cycle in the graph, as readable paths. */
function findCycles(files: string[]): string[][] {
  const graph = new Map(files.map((file) => [file, importsOf(file)]))
  const cycles: string[][] = []
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []

  const visit = (file: string) => {
    const seen = state.get(file)
    if (seen === 'done') return
    if (seen === 'visiting') {
      const from = stack.indexOf(file)
      if (from !== -1) cycles.push([...stack.slice(from), file])
      return
    }

    state.set(file, 'visiting')
    stack.push(file)
    for (const next of graph.get(file) ?? []) visit(next)
    stack.pop()
    state.set(file, 'done')
  }

  for (const file of files) visit(file)
  return cycles
}

describe('backend/src/services', () => {
  it('⚠️ has no import cycle', () => {
    const cycles = findCycles(walk(SERVICES)).map((cycle) =>
      cycle.map((file) => relative(SERVICES, file).replace(/\\/g, '/')).join(' → '),
    )

    expect(cycles).toEqual([])
  })

  it('the price constants import nothing, so they cannot join one', () => {
    // The specific fix. A shared constant reached through a service is how the
    // cycle formed in the first place.
    expect(importsOf(join(SERVICES, 'plan-pricing.ts'))).toEqual([])
  })

  it('the Referral Core does not import the billing service', () => {
    const service = readFileSync(join(SERVICES, 'referral', 'referral.service.ts'), 'utf8')
    expect(service).not.toMatch(/from\s+'\.\.\/billing\.service'/)
    expect(service).toContain("from '../plan-pricing'")
  })
})
