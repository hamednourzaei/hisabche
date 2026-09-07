// ============================================
// T2 — the units table, the fallback and the zod enum must agree.
//
// THE DEFECT THIS PINS: `phase-l-01` seeded fourteen units including the
// tonne. `unitSchema` listed nine and rejected the rest. The migration ran,
// the rows existed, and a metals trader still could not record a tonne —
// because the filter was the enum, not the database.
//
// Three lists now describe the same set, and each can drift independently:
//
//   docs/phase-l-01-units-migration.sql   the seed — the source of truth
//   units.service.ts SEEDED_UNITS         the fallback when the table is absent
//   validation unitSchema                 what a write is allowed to carry
//
// A code in one but not another is the regression. A unit that validates but
// has no row cannot be converted; a unit with a row that fails validation
// cannot be saved.
// ============================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { unitSchema } from '@hisabche/validation'
import { SEEDED_UNITS } from '../services/inventory/units.service'

const repo = resolve(__dirname, '../../..')

/** The codes in the migration's own INSERT — parsed, not retyped. */
function migrationCodes(): string[] {
  const sql = readFileSync(resolve(repo, 'docs/phase-l-01-units-migration.sql'), 'utf8')
  const insert = /INSERT INTO units \([^)]*\) VALUES([\s\S]*?)ON CONFLICT/.exec(sql)?.[1]
  expect(insert, 'the seed INSERT was not found — did the migration get renamed?').toBeDefined()

  // Comments are stripped first: the seed block explains itself in prose that
  // names units ("a factor of 12 on «dozen»"), and matching those comments
  // instead of the rows is a mistake this suite has made before.
  const rows = insert!.replace(/--[^\n]*/g, '')
  return [...rows.matchAll(/\(\s*'([a-z]+)'/g)].map((m) => m[1]!)
}

const enumCodes = unitSchema.options as readonly string[]
const seed = migrationCodes()
const fallback = SEEDED_UNITS.map((u) => u.code)

describe('the migration seed and the service fallback are the same list', () => {
  it('parses a plausible seed', () => {
    expect(seed.length).toBeGreaterThanOrEqual(14)
    expect(seed).toContain('ton')
  })

  it('every seeded code is in the fallback', () => {
    for (const code of seed) expect(fallback, `${code} missing from SEEDED_UNITS`).toContain(code)
  })

  it('the fallback invents nothing the migration does not seed', () => {
    for (const code of fallback) expect(seed, `${code} is not in the migration`).toContain(code)
  })
})

describe('every real unit passes validation', () => {
  it.each(SEEDED_UNITS.map((u) => u.code))('%s is accepted by unitSchema', (code) => {
    expect(unitSchema.safeParse(code).success, `${code} has a row but cannot be saved`).toBe(true)
  })

  it('the tonne specifically — the unit L0.2 was asked for', () => {
    expect(unitSchema.safeParse('ton').success).toBe(true)
  })
})

describe('every validating unit is convertible', () => {
  it('the only code with no row is `custom`', () => {
    // `custom` means «the user typed their own word». It has no dimension and
    // no conversion factor on purpose — giving it one would let L1 convert by
    // an arbitrary factor of 1.
    const withoutRow = enumCodes.filter((code) => !fallback.includes(code))
    expect(withoutRow).toEqual(['custom'])
  })
})

describe('conversion factors are the ones that make totals right', () => {
  const factor = (code: string) => SEEDED_UNITS.find((u) => u.code === code)!.conversionFactor

  it('weight is based on the gram, to the tonne', () => {
    expect(factor('gram')).toBe(1)
    expect(factor('kg')).toBe(1000)
    expect(factor('ton')).toBe(1_000_000)
    expect(factor('mg')).toBe(0.001)
  })

  it('exactly one base per dimension', () => {
    for (const dimension of ['weight', 'length', 'volume', 'count'] as const) {
      const bases = SEEDED_UNITS.filter((u) => u.dimension === dimension && u.isBase)
      expect(bases, `${dimension} must have exactly one base`).toHaveLength(1)
      expect(bases[0]!.conversionFactor).toBe(1)
    }
  })

  it('count units all carry factor 1 — a box holds what the PRODUCT says', () => {
    // The real number lives in `product_units` per product. A factor of 12 on
    // «dozen» would be right for eggs and wrong for everything else.
    for (const u of SEEDED_UNITS.filter((u) => u.dimension === 'count')) {
      expect(u.conversionFactor, `${u.code} must not carry a universal factor`).toBe(1)
    }
  })
})
