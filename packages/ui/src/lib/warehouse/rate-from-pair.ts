// «[amount] [currency] = [amount] [currency]» → the rate the warehouse stores:
// AFN per one unit of a currency (Currency.afnPerUnit).
//
// The owner types a rate the way people say it — «۳٬۰۰۰ افغانی = ۱٬۰۰۰٬۰۰۰
// تومان», «۱ دالر = ۶۰ افغانی», «۱ گرم طلا = ۲۴٬۰۰۰٬۰۰۰ تومان» — instead of
// the old fixed «۱ X = … افغانی». Whichever side is not afghani is the
// currency being set. When neither side is afghani, the other side must
// already have a rate; it is the bridge.

export const BASE_CODE = 'AFN'

export type RatePairResult =
  | { ok: true; code: string; afnPerUnit: number }
  | { ok: false; reason: 'same' | 'amount' | 'unknownBridge' }

export function rateFromPair(
  left: { amount: number; code: string },
  right: { amount: number; code: string },
  afnPerUnitOf: (code: string) => number | null,
  /** The unit rates are kept in — afghani for the warehouse, the books' currency on the dashboard. */
  base: string = BASE_CODE,
): RatePairResult {
  if (left.code === right.code) return { ok: false, reason: 'same' }
  if (!(left.amount > 0) || !(right.amount > 0)) return { ok: false, reason: 'amount' }

  if (left.code === base)
    return { ok: true, code: right.code, afnPerUnit: left.amount / right.amount }
  if (right.code === base)
    return { ok: true, code: left.code, afnPerUnit: right.amount / left.amount }

  // Neither is afghani: bridge through whichever already has a rate. The side
  // WITHOUT a rate is the one being set; if both have one, the left is updated.
  const rightRate = afnPerUnitOf(right.code)
  if (rightRate !== null && rightRate > 0) {
    return { ok: true, code: left.code, afnPerUnit: (right.amount * rightRate) / left.amount }
  }
  const leftRate = afnPerUnitOf(left.code)
  if (leftRate !== null && leftRate > 0) {
    return { ok: true, code: right.code, afnPerUnit: (left.amount * leftRate) / right.amount }
  }
  return { ok: false, reason: 'unknownBridge' }
}
