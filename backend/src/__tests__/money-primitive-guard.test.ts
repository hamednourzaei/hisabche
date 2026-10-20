// ============================================
// The repository rounds money in exactly one place.
//
// ⚠️ THE DEFECT THIS PREVENTS, WITH ITS HISTORY.
//
// Phase 0 of the Business OS found `round2` written out four times, byte for
// byte identical, in four different domain files, plus a fifth in
// `packages/validation`. `insights.domain` had its own copy and used it 22
// times without ever exporting it.
//
// Four identical copies are not four bugs. They are four places that a change
// to rounding direction silently misses — and rounding direction is not a style
// choice in this codebase. `tax.domain.ts` exists precisely because
// `Math.round(-0.5)` is `-0`, which is why a credit note rounded differently
// from its invoice. The cost of that lesson was paid once already.
//
// ⚠️ AND THEN PHASE 2 OF THE OFFLINE EDITION MOVED IT.
//
// The one implementation used to live in `backend/src/utils/money.ts`. The
// device has to round the same way with no server to ask, so the body moved to
// `packages/validation/src/schemas/money.ts` and the backend file re-exports
// it. The guard therefore scans BOTH trees now, and its assertion got stronger,
// not weaker: there is exactly ONE declaration in the repository, and it is the
// shared one.
//
// ⚠️ AND THEN IT TURNED OUT THE GUARD HAD ONLY EVER SEEN ONE OF THE TWO FORMS.
//
// The assertion above was true and the claim behind it was false. The pattern
// looked for `function round2`, so a copy written as an arrow constant —
// `const round2 = (value) => Math.round(value * 100) / 100` — was invisible to
// it. Six such copies were still in the repository on 19 Oct 2026:
//
//   packages/validation/src/schemas/profit-report.domain.ts  (inside the rule
//       itself, with a comment saying it hid from this guard — the worst one)
//   backend  accounting/evidence.domain.ts · ai/pipeline/pipeline.domain.ts
//            analytics/break-even.domain.ts · analytics/cohort.domain.ts
//            crm/crm.domain.ts · financing/working-capital.domain.ts
//
// A guard that matches one spelling of the thing it forbids is a guard that
// reports a clean tree the day a second implementation is written. Both forms
// are now matched, and the arrow form was added to a copy as a proof that the
// guard goes red and NAMES the file.
//
// ⚠️ AND ONE OF THOSE COPIES DID NOT ROUND LIKE THE OTHERS: the AI pipeline's
// added `Number.EPSILON`, so one unit at 1.005 came to 1.01 there and 1.00
// everywhere else. Merging them changed that value by one cent in a PROPOSAL
// (the person's approval screen and the «expected total» checked against the
// server's answer), not in a stored figure — the server derives the real totals
// from the lines. It is named here rather than left to be discovered.
//
// ⚠️ AND THE THING THAT IS *NOT* CONSOLIDATED — read this before "fixing" it.
//
// `round2` uses `Math.round`, which rounds ties toward +Infinity. For negative
// amounts that is asymmetric: `Math.round(-1.5)` is `-1`. The tax engine does
// NOT use it; it uses `roundHalfAwayFromZero`. Making the other four symmetric
// would move real balances in existing shops, so it is a product decision about
// historical data, not a refactor. It is reported in BUSINESS-OS-SPEC Phase 0.7
// and deliberately NOT done. A guard that forced symmetry here would be a guard
// that changed books on the day it was added.
//
// ⚠️ AN ALIAS IS NOT A SECOND IMPLEMENTATION — and the pattern says so.
//
// `costing.domain.ts` writes `const roundMoney = round2` and exports it: one
// arithmetic under the name that file's callers have always used. The
// `roundMoney` form below therefore matches a `function` or a function
// expression (`= (`), never an identifier on the right-hand side. A pattern
// broad enough to flag that alias is a pattern that fails on the day it is
// added, and a guard nobody can keep green gets deleted.
//
// Comments are stripped before matching, so this file's own explanation cannot
// satisfy the pattern it forbids.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const BACKEND_SRC = join(__dirname, '..')
const REPO = join(__dirname, '..', '..', '..')
const SHARED_SRC = join(REPO, 'packages', 'validation', 'src')

/**
 * Line comments BEFORE block comments: a path or glob written inside a line
 * comment opens a fake block comment that swallows the rest of the file
 * (BUG-029 — `rls-coverage.test.ts` reported 49 tenant tables as having no RLS).
 *
 * ⚠️ `//` TOO, and that was learned the hard way. This function used to strip
 * only SQL's `--` and C-style block comments, so a TypeScript file whose HEADER
 * COMMENT
 * mentioned the forbidden declaration — «the regex looks for `function round2`»
 * — was reported as a second implementation. The guard's own docstring promised
 * that «comments are stripped before matching», and for `//` it was not true.
 * A guard whose comment describes behaviour the code does not have is BUG-029
 * wearing a different hat.
 *
 * Known limit: a string literal containing `//` (a URL) loses the rest of its
 * line. That can only ever hide a declaration, never invent one — and the same
 * limit already existed for `--`.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\/.*$/gm, '')
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return entry.endsWith('.ts') && !entry.endsWith('.d.ts') ? [full] : []
  })
}

function collect(root: string, label: string) {
  return walk(root).map((path) => ({
    path,
    relative: `${label}/${path
      .slice(root.length + 1)
      .split('\\')
      .join('/')}`,
    code: stripComments(readFileSync(path, 'utf8')),
  }))
}

const FILES = [
  ...collect(BACKEND_SRC, 'backend/src'),
  ...collect(SHARED_SRC, 'packages/validation/src'),
]

/** Where the one implementation lives. */
const MONEY = 'packages/validation/src/schemas/money.ts'

/**
 * A DECLARATION of two-decimal rounding, not a use of it.
 *
 * ⚠️ BOTH FORMS OF THE NAME, and that is the whole of this fix. A copy written
 * as an arrow constant (`const round2 = (value) => …`) is a second rounding just
 * as surely as `function round2` is, and the pattern used to match only the
 * second — which is how six copies lived in this repository while a green test
 * said there was one. See the header for the full account, including the one
 * that rounded differently.
 *
 * ⚠️ Built by concatenation, so this file is not itself a counterexample. A
 * source-scanning guard that matches its own vocabulary is BUG-029 in a new
 * costume.
 */
const ROUNDING_DECLARATION = new RegExp(
  [
    'function' + '\\s+round2\\b',
    'function' + '\\s+roundMoney\\b',
    // The assigned form. `[^=]`, not `\\s*`: it must not read `round2 === …`
    // (a comparison) as an assignment.
    '\\bround2[ \\t]*=[^=]',
    // The `roundMoney` alias in `costing.domain.ts` is `= round2` — an
    // identifier, i.e. the one arithmetic under another name. Only a function
    // expression is a second implementation.
    '\\broundMoney[ \\t]*=[ \\t]*\\(',
    '\\broundMoney[ \\t]*=[ \\t]*function',
  ].join('|'),
)

const isTest = (relative: string) => relative.includes('__tests__/')

describe('money is rounded in one place', () => {
  it('inspects both trees, not an empty list', () => {
    expect(FILES.length).toBeGreaterThan(50)
    expect(FILES.some((f) => f.relative === MONEY)).toBe(true)
  })

  it('declares two-decimal rounding in exactly one file in the repository', () => {
    const offenders = FILES.filter((f) => !isTest(f.relative))
      .filter((f) => ROUNDING_DECLARATION.test(f.code))
      .map((f) => f.relative)

    // ⚠️ toEqual, not toContain: a second declaration anywhere — backend or
    // shared — is the defect, and it must be named in the failure message.
    expect(offenders).toEqual([MONEY])
  })

  it('the backend never declares one, it re-exports the shared file', () => {
    const money = FILES.find((f) => f.relative === 'backend/src/utils/money.ts')
    expect(money, 'backend/src/utils/money.ts').toBeDefined()
    expect(money?.code).toMatch(/from '@hisabche\/validation'/)
    expect(ROUNDING_DECLARATION.test(money?.code ?? '')).toBe(false)
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
    const tax = FILES.find((f) => f.relative === 'backend/src/services/tax/tax.domain.ts')
    expect(tax).toBeDefined()
    expect(tax?.code).toMatch(/roundHalfAwayFromZero/)
  })

  it('documents and tests the EPSILON rounding difference from the removed pipeline copy', () => {
    // The AI pipeline's removed copy computed: Math.round((value + Number.EPSILON) * 100) / 100
    // At 1.005:
    // (1.005 + Number.EPSILON) * 100 is > 100.5, rounding up to 1.01.
    // The shared round2(1.005) computes Math.round(1.005 * 100) / 100 which is 1 (in IEEE-754).
    const epsilonRound = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100
    const sharedRound = (v: number) => Math.round(v * 100) / 100

    expect(epsilonRound(1.005)).toBe(1.01)
    expect(sharedRound(1.005)).toBe(1)
  })

  it('injection test: adding a local copy triggers a red failure and names the file', () => {
    const rogueFile = {
      relative: 'backend/src/services/ai/pipeline/pipeline.domain.ts',
      code: 'const round2 = (value: number) => Math.round(value * 100) / 100',
    }
    const testList = [...FILES, rogueFile]
    const offenders = testList
      .filter((f) => !isTest(f.relative))
      .filter((f) => ROUNDING_DECLARATION.test(f.code))
      .map((f) => f.relative)

    expect(offenders).toContain(rogueFile.relative)
    expect(offenders).not.toEqual([MONEY])
  })

  it('injection test: regex catches function declaration, arrow assignment, and expression forms', () => {
    expect(ROUNDING_DECLARATION.test('function round2(x: number) { return x }')).toBe(true)
    expect(ROUNDING_DECLARATION.test('const round2 = (x: number) => x')).toBe(true)
    expect(ROUNDING_DECLARATION.test('let round2 = function(x: number) { return x }')).toBe(true)
    expect(ROUNDING_DECLARATION.test('round2 = (x) => x')).toBe(true)
    // Comparisons should NOT match:
    expect(ROUNDING_DECLARATION.test('if (round2 === 0) {}')).toBe(false)
    expect(ROUNDING_DECLARATION.test('if (round2 == 0) {}')).toBe(false)
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
