// ============================================
// The backend rounds money in exactly one place.
//
// ⚠️ THE DEFECT THIS PREVENTS, WITH ITS HISTORY.
//
// Phase 0 of the Business OS found `round2` written out four times, byte for
// byte identical, in four different domain files, plus a fifth in
// `packages/validation` that the backend cannot import without taking a
// dependency on a leaf package for four lines. `insights.domain` had its own
// copy and used it 22 times without ever exporting it.
//
// Four identical copies are not four bugs. They are four places that a change to
// rounding direction silently misses — and rounding direction is not a style
// choice in this codebase. `tax.domain.ts` exists precisely because
// `Math.round(-0.5)` is `-0`, which is why a credit note rounded differently
// from its invoice. The cost of that lesson was paid once already.
//
// So the rule is one implementation (`utils/money.ts`) and a guard, because a
// shared helper with no guard is a convention, and a convention is what the
// five copies were in the first place.
//
// ⚠️ AND THE THING THAT IS *NOT* CONSOLIDATED — read this before "fixing" it.
//
// `round2` uses `Math.round`, which rounds ties toward +Infinity. For negative
// amounts that is asymmetric: `Math.round(-1.5)` is `-1`. The tax engine does
// NOT use it; it uses `roundHalfAwayFromZero`. Making the other four symmetric
// would move real balances in existing shops, so it is a product decision about
// historical data, not a refactor. It is reported in BUSINESS-OS-SPEC Phase 0.7
// and deliberately NOT done. A guard that forced symmetry here would be a
// guard that changed books on the day it was added.
//
// Comments are stripped before matching, so this file's own explanation cannot
// satisfy the pattern it forbids.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')

/**
 * Line comments BEFORE block comments: a path or glob written inside a line
 * comment opens a fake block comment that swallows the rest of the file
 * (BUG-029 — `rls-coverage.test.ts` reported 49 tenant tables as having no RLS).
 */
function stripComments(source: string): string {
  return source.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return entry.endsWith('.ts') && !entry.endsWith('.d.ts') ? [full] : []
  })
}

const FILES = walk(SRC).map((path) => ({
  path,
  relative: path
    .slice(SRC.length + 1)
    .split('\\')
    .join('/'),
  code: stripComments(readFileSync(path, 'utf8')),
}))

/** Where the one implementation lives. */
const MONEY = 'utils/money.ts'

/**
 * A DECLARATION of two-decimal rounding, not a use of it.
 *
 * ⚠️ Built by concatenation, so this file is not itself a counterexample. A
 * source-scanning guard that matches its own vocabulary is BUG-029 in a new
 * costume.
 */
const ROUNDING_DECLARATION = new RegExp(
  ['function' + '\\s+round2\\b', 'function' + '\\s+roundMoney\\b'].join('|'),
)

describe('money is rounded in one place', () => {
  it('inspects the backend, not an empty list', () => {
    expect(FILES.length).toBeGreaterThan(50)
  })

  it('only utils/money.ts declares two-decimal rounding', () => {
    const offenders = FILES.filter(
      (f) => !f.relative.startsWith('__tests__/') && f.relative !== MONEY,
    )
      .filter((f) => ROUNDING_DECLARATION.test(f.code))
      .map((f) => f.relative)

    expect(offenders).toEqual([])
  })

  it('the domains import it rather than redefining it', () => {
    // The four files that used to own a copy now have to reach for the shared
    // one. This is the assertion that would have caught the duplication: a copy
    // is invisible to "is round2 defined once?" until you ask who defines it.
    for (const rel of [
      'services/accounting/accounting.domain.ts',
      'services/payments/payments.domain.ts',
      'services/insights/insights.domain.ts',
      'services/inventory-costing/costing.domain.ts',
    ]) {
      const file = FILES.find((f) => f.relative === rel)
      expect(file, rel).toBeDefined()
      expect(file?.code, rel).toMatch(/from '.*utils\/money'/)
    }
  })

  it('round2 keeps the ties-toward-positive-infinity behaviour it always had', () => {
    // ⚠️ This is a behaviour lock, not a correctness claim. `Math.round(-1.5)`
    // is -1 and that is what four existing engines have been computing; a test
    // that asserted the symmetric value would be asserting a CHANGE, and would
    // make the change invisible to every shop with existing books.
    const money = FILES.find((f) => f.relative === MONEY)
    expect(money).toBeDefined()
    expect(money?.code).toMatch(/Math\.round\(value \* 100\)/)

    // And the tax engine's own rounding is untouched and still symmetric.
    const tax = FILES.find((f) => f.relative === 'services/tax/tax.domain.ts')
    expect(tax).toBeDefined()
    expect(tax?.code).toMatch(/roundHalfAwayFromZero/)
  })
})

describe('the money primitives themselves', () => {
  it('rounds, guards non-finite input, and compares in minor units', async () => {
    const { round2, roundHalfAwayFromZero, minor, sumRounded } = await import('../utils/money')

    // ⚠️ `round2(1.005)` is 1, NOT 1.01. `1.005 * 100` is 100.49999999999999 in
    // IEEE-754, so `Math.round` sees a value just below the tie and rounds it
    // down. That is a real property of the arithmetic every one of these four
    // engines has been using, and it is a property of the FLOAT, not of the
    // rounding direction.
    //
    // The first draft of this test asserted 1.01 "because that is what
    // rounding to two decimals means", and it was wrong. A test asserting what a
    // function *should* do rather than what it *does* is a test that turns the
    // next real fix into a red suite nobody can interpret. §7٫۴.
    expect(round2(1.005)).toBe(1)
    expect(round2(1.006)).toBe(1.01)

    // The float is the same on both signs, so this is NOT symmetry: -1.006 also
    // rounds toward zero here, while -1.5 goes to -1 by the tie rule.
    expect(round2(-1.005)).toBe(-1)
    expect(round2(-1.5)).toBe(-1.5) // an exact value: nothing to round
    expect(round2(-1.006)).toBe(-1.01)

    expect(round2(Number.NaN)).toBe(0)
    expect(round2(Number.POSITIVE_INFINITY)).toBe(0)

    expect(roundHalfAwayFromZero(2.5)).toBe(3)
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3)
    expect(roundHalfAwayFromZero(-2.5)).toBe(-roundHalfAwayFromZero(2.5))

    // The reason `minor` exists: floats do not compare equal, so an
    // allocation is checked in integers, not in decimals.
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(minor(0.1) + minor(0.2)).toBe(minor(0.3))

    // Summing must go through minor units — summing floats and rounding once
    // at the end is the error this exists to prevent.
    expect(sumRounded([0.1, 0.2])).toBe(0.3)
  })

  it('the two sums stay apart: one returns minor, the other major', async () => {
    const { sumRounded } = await import('../utils/money')
    const { sumMinorUnits } = await import('../services/accounting/accounting.domain')

    // ⚠️ Same shape, different unit. The ledger's returns an integer because
    // it posts in minor units; merging them would make a trial balance 100×
    // too large, and the merge would pass every test that does not assert the
    // unit — which is why the difference is asserted here rather than left to
    // a comment.
    expect(sumMinorUnits([10, 20.5])).toBe(3050)
    expect(sumRounded([10, 20.5])).toBe(30.5)
  })
})
