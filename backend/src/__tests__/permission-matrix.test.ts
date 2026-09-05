// ============================================
// G3 — the Permission Matrix's module map.
//
// The matrix is a screen built on `PERMISSION_MODULES`, and two properties of
// that map decide whether the screen can be trusted:
//
//   COVERAGE   every enforced capability lives in some module. A capability in
//              none of them is one no administrator can ever grant, and it
//              would be invisible rather than merely absent.
//
//   DISJOINT   no capability lives in two modules. One in two would let one
//              cell silently undo another's — set module A to `none` and
//              module B's grant of the same capability keeps it alive, so the
//              screen shows a permission removed that is still in force.
//
// Both are the kind of thing that stays true right up until someone adds a
// capability, which is exactly when it matters.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  CAPABILITIES,
  PERMISSION_MODULES,
  capabilitiesForLevel,
  capabilitiesOf,
  levelOfCapabilities,
} from '../services/authorization'

const allOf = (module: (typeof PERMISSION_MODULES)[number]) => [
  ...module.read,
  ...module.write,
  ...module.full,
]

describe('the module map', () => {
  it('covers every enforced capability', () => {
    const covered = new Set(PERMISSION_MODULES.flatMap(allOf))
    const uncovered = CAPABILITIES.filter((c) => !covered.has(c))

    expect(uncovered, 'a capability in no module can never be granted').toEqual([])
  })

  it('puts every capability in exactly one module', () => {
    const seen = new Map<string, string[]>()

    for (const module of PERMISSION_MODULES) {
      for (const capability of allOf(module)) {
        seen.set(capability, [...(seen.get(capability) ?? []), module.key])
      }
    }

    const duplicated = [...seen.entries()].filter(([, modules]) => modules.length > 1)

    expect(duplicated, 'one cell would silently undo another').toEqual([])
  })

  it('names no capability the app does not enforce', () => {
    const enforced = new Set<string>(CAPABILITIES)
    const invented = PERMISSION_MODULES.flatMap(allOf).filter((c) => !enforced.has(c))

    expect(invented, 'a cell granting this would do nothing').toEqual([])
  })
})

describe('the access ladder', () => {
  it('is cumulative — write includes read, full includes both', () => {
    for (const module of PERMISSION_MODULES) {
      const read = capabilitiesForLevel(module, 'read')
      const write = capabilitiesForLevel(module, 'write')
      const full = capabilitiesForLevel(module, 'full')

      for (const capability of read) expect(write).toContain(capability)
      for (const capability of write) expect(full).toContain(capability)
    }
  })

  it('round-trips: the level of a level is that level', () => {
    // Building a capability set from a rung and reading it back must return
    // the same rung. If it did not, the matrix would show a value the user
    // did not choose immediately after they chose it.
    for (const module of PERMISSION_MODULES) {
      for (const level of ['read', 'write', 'full'] as const) {
        // Only the rungs this module OFFERS. `costing` has a read rung and
        // nothing above it, so asking for its 'write' correctly returns read's
        // capabilities — and reading that back gives 'read', not 'write'.
        // That is the domain being honest, not a round-trip failure; the UI
        // never offers a rung the module does not have (see `levelsOf`).
        if (module[level].length === 0) continue

        const codes = capabilitiesForLevel(module, level)
        expect(levelOfCapabilities(module, new Set(codes)), `${module.key} @ ${level}`).toBe(level)
      }
    }
  })

  it('does not round a partial rung up', () => {
    // Holding SOME of write's capabilities is not write. Reporting it as write
    // would tell an administrator someone can update invoices when they can
    // only create them.
    const invoices = PERMISSION_MODULES.find((m) => m.key === 'invoices')!
    const partial = new Set([...invoices.read, invoices.write[0]!])

    expect(levelOfCapabilities(invoices, partial)).toBe('read')
  })

  it('reports none for an empty set', () => {
    for (const module of PERMISSION_MODULES) {
      expect(levelOfCapabilities(module, new Set())).toBe('none')
    }
  })
})

describe('the enforced roles, as the matrix will draw them', () => {
  it('gives the owner the top rung of every module', () => {
    const owner = new Set<string>(capabilitiesOf('owner'))

    for (const module of PERMISSION_MODULES) {
      const top = module.full.length > 0 ? 'full' : module.write.length > 0 ? 'write' : 'read'
      expect(levelOfCapabilities(module, owner), module.key).toBe(top)
    }
  })

  it('does not give a seller the cost of stock', () => {
    // The margin. A seller sells at the sell price and has no reason to know
    // what it was bought for — the reason `costing` is its own module rather
    // than a rung under inventory.
    const seller = new Set<string>(capabilitiesOf('seller'))
    const costing = PERMISSION_MODULES.find((m) => m.key === 'costing')!

    expect(levelOfCapabilities(costing, seller)).toBe('none')
  })

  it('does not give a seller the ledger', () => {
    const seller = new Set<string>(capabilitiesOf('seller'))
    const accounting = PERMISSION_MODULES.find((m) => m.key === 'accounting')!

    expect(levelOfCapabilities(accounting, seller)).toBe('none')
  })
})
