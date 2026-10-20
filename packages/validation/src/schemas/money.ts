// ============================================
// packages/validation/src/schemas/money.ts
//
// The money primitives: round, compare, sum. ONE implementation, shared by the
// server and the device.
//
// ⚠️ THIS FILE IS A RULE, NOT A SERVER CAPABILITY.
//
// It moved out of `backend/src/utils/money.ts` in Phase 2 of the offline
// edition: every rule that follows (invoice money, payments, costing, the
// ledger, the profit report) is written in terms of these four functions, and
// the device has to run them with no server to ask. The backend file
// re-exports them, so its five existing importers are unchanged.
//
// ⚠️ A LEAF: this file imports nothing. That is deliberate — a shared constant
// reached from two sides closes a module cycle, which is what took
// `GET /api/referrals` down on the live site with 2202 green tests (BUG-018).
//
// ⚠️ `round2` IS NOT CURRENCY-AWARE, AND THAT IS NOT AN OVERSIGHT TO FIX HERE.
//
// It is two decimals because four existing engines have always computed two
// decimals, and moving a real balance is a product decision about existing
// books, not a refactor (BUSINESS-OS-SPEC Phase 0.7). Currency-aware money goes
// through `invoice-math.ts` (`FRACTION_DIGITS`). Changing this function changes
// stored balances, so the arithmetic is locked by
// `backend/src/__tests__/money-primitive-guard.test.ts`.
// ============================================

/**
 * Round to two decimals.
 *
 * ⚠️ `Number.isFinite` first. `Math.round(NaN * 100) / 100` is `NaN`, and one
 * NaN in a sum makes a whole report NaN — so a single missing field renders
 * "—" on a financial statement instead of a wrong-looking number.
 *
 * ⚠️ DELIBERATELY `Math.round`, i.e. ties toward +Infinity. `Math.round(-0.5)`
 * is `-0` and `Math.round(-1.5)` is `-1`, so for negative amounts this is NOT
 * symmetric. The tax engine does not use it: it carries
 * `roundHalfAwayFromZero` below. Making these symmetric would move real
 * balances, so that is REPORTED, not done.
 *
 * ⚠️ `round2(1.005)` is `1`, not `1.01`: `1.005 * 100` is `100.49999999999999`
 * in IEEE-754. That is a property of the float, not of the rounding direction.
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
