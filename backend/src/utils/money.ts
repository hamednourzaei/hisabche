// ============================================
// Money primitives for the backend.
//
// ⚠️ WHY THIS FILE EXISTS — and why the five copies were not simply merged
// blindly.
//
// Phase 0 found `round2` written out four times, byte for byte identical:
//
//   accounting.domain.ts   payments.domain.ts
//   insights.domain.ts     costing.domain.ts   (named roundMoney)
//
// and a fifth in `packages/validation`, which the backend cannot import without
// taking a dependency on a leaf package for four lines. Three of them are
// imported by other modules, so they could not be deleted; `insights` uses its
// own 22 times and never exports it.
//
// The same arithmetic in five places is not five bugs — it is five places a
// change to rounding direction silently misses four others. And rounding
// direction is not a style choice here: `tax.domain` exists because
// `Math.round(-0.5)` is `-0`, which is why it carries its own
// `roundHalfAwayFromZero`. The lesson that produced THAT function ("کالای
// تاریخ‌دار") is the same lesson.
//
// ⚠️ A LEAF: this file imports nothing. Shared constants live in modules that
// import nothing, because a shared constant reached from two sides closes a
// module cycle — which is what took `GET /api/referrals` down on the live site
// with 2202 green tests (BUG-018, and `no-service-import-cycles.test.ts`).
//
// ⚠️ COMPARISON IS IN MINOR UNITS, not here. `minor()` below exists because
// `0.1 + 0.2 !== 0.3` decides whether an allocation is legal. A function that
// rounds is for DISPLAY and STORAGE; a function that COMPARES money uses
// `minor`, and the callers already do.
// ============================================

/**
 * Round to two decimals.
 *
 * ⚠️ `Number.isFinite` first. `Math.round(NaN * 100) / 100` is `NaN`, and one
 * NaN in a sum makes a whole report NaN — so a single missing field renders
 * "—" on a financial statement instead of a wrong-looking number.
 *
 * ⚠️ DELIBERATELY `Math.round`, i.e. ties toward +Infinity — this is what all
 * four copies did, and changing it is not a refactor. `Math.round(-0.5)` is
 * `-0` and `Math.round(-1.5)` is `-1`, so for negative amounts this is NOT
 * symmetric. The tax engine therefore does not use it: it carries
 * `roundHalfAwayFromZero` below, and `tax-engine-rules.test.ts` pins both
 * directions. Making the other four copies symmetric would move real balances,
 * so that is REPORTED (§۱۳), not done here. Whether the ledger should be
 * symmetric is a product question about existing books, and it is Phase 0.7.
 */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

/**
 * The rounding the tax engine requires, and the one a reversal needs.
 *
 * `Math.round` rounds toward +Infinity on a tie, so `Math.round(-0.5)` is `-0`
 * and `Math.round(-1.5)` is `-1`. Both are wrong for money: a reversal must
 * cancel its original EXACTLY, or the books drift a half-unit per entry until
 * the trial balance stops footing.
 *
 * ⚠️ Unchanged from `tax.domain.ts` — moved here, not rewritten. The tax tests
 * import it from there today and must keep passing with the same values.
 */
export function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value)
}

/** The unit money is compared in. Floats do not compare equal. */
export function minor(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100)
}

/**
 * Sum a MAJOR-unit figure and return a MAJOR-unit figure, rounding once.
 *
 * ⚠️ Named `sumRounded` rather than `sumMinorUnits` on purpose. The ledger has
 * a `sumMinorUnits` that returns an INTEGER, and it must keep doing so: the
 * ledger compares and posts in minor units, and a sum that came back in major
 * units would be off by 100×. Two functions with one name returning different
 * units is exactly what let four identical `round2` copies sit unnoticed, so
 * the names are kept apart deliberately.
 */
export function sumRounded(values: readonly number[]): number {
  return round2(values.reduce((total, value) => total + minor(value), 0) / 100)
}
