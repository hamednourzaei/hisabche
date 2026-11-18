// ============================================
// WP-13 gap A — the ONE money rule for an offline order draft line.
//
// The device may write a draft without signal, but it must not grow its own
// rounding: a draft showing 375,001 while the server confirms 375,000 is a
// reconciliation nobody can explain. So the line total is derived HERE, in the
// shared core, from integer minor units — the server and the device call the
// same function.
//
// ⚠️ UNKNOWN IS NOT ZERO. A non-finite quantity or a non-integer price is a
// refusal (`null`), never a silently rounded line.
// ============================================

/**
 * Line total in integer minor units, or `null` when the operands cannot be
 * represented exactly enough to show a buyer a trustworthy number.
 */
export function draftLineTotalMinor(quantity: number, unitPriceMinor: number): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null
  if (!Number.isSafeInteger(unitPriceMinor) || unitPriceMinor < 0) return null
  const total = Math.round(quantity * unitPriceMinor)
  return Number.isSafeInteger(total) && total >= 0 ? total : null
}

/** Sum of draft lines. `null` when ANY line is unknown — never a partial total. */
export function draftTotalMinor(lines: readonly (number | null)[]): number | null {
  if (lines.length === 0 || lines.some((line) => line === null)) return null
  const total = (lines as readonly number[]).reduce((sum, line) => sum + line, 0)
  return Number.isSafeInteger(total) ? total : null
}
