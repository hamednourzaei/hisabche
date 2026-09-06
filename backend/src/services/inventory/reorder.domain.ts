// ============================================
// backend/src/services/inventory/reorder.domain.ts
//
// L3 — the reorder POINT, which is the half `suggestReorders` never had.
//
// ---------------------------------------------------------------------------
// ⚠️ G2 — `suggestReorders` ALREADY EXISTS AND IS NOT REPLACED
//
// `inventory-costing/transfer.domain.ts` already decides WHAT needs buying:
// it compares PROJECTED stock (on-hand + on-order + in-transit) against
// `products.min_stock_level`, refuses to suggest for a product that was never
// given a level, and ranks the result worst-first. That logic stays.
//
// What it does not do is COMPUTE the level. It takes `reorderLevel` as an
// input, and today that input is `products.min_stock_level` — a number
// somebody typed once and never revisited. A shop whose sales tripled is still
// reordering at the level it set last year.
//
// This module computes that level from what actually sold. Its output feeds
// the existing function; nothing about the suggestion logic is duplicated.
//
// ---------------------------------------------------------------------------
// THE FORMULA (L3, verbatim from the spec)
//
//   safety_stock  = avg_daily_sales × lead_time_days × 0.20
//   reorder_point = avg_daily_sales × lead_time_days + safety_stock
//
// The 20% is a buffer against demand being lumpier than its average — which it
// always is. Without it a reorder point is a coin flip: half the time the goods
// arrive after the shelf is empty.
// ============================================

/**
 * Days between placing an order and receiving it.
 *
 * ⚠️ SEVEN, AND DELIBERATELY NOT A SETTING.
 *
 * Neither `products` nor `suppliers` carries a lead time — there is no column
 * anywhere in the schema. The spec is explicit: use a conservative default and
 * do NOT create a setting for a policy the product has not defined (G4).
 *
 * Seven days is conservative for a local supplier and optimistic for an
 * import, which is the right direction to be wrong in: it suggests reordering
 * sooner rather than later.
 */
export const DEFAULT_LEAD_TIME_DAYS = 7

/** The window `avg_daily_sales` is measured over. */
export const DEMAND_WINDOW_DAYS = 30

/**
 * How much of the lead-time consumption to hold as a buffer.
 *
 * A pure multiplier, not a policy setting — see `DEFAULT_LEAD_TIME_DAYS`.
 */
const SAFETY_FACTOR = 0.2

export interface DemandInput {
  productId: string
  /** Units SOLD in the window. Not movements — sales. */
  unitsSoldInWindow: number
  /** Days actually observed. May be < 30 for a product added recently. */
  windowDays?: number | undefined
  leadTimeDays?: number | undefined
}

export interface ReorderPoint {
  productId: string
  avgDailySales: number
  leadTimeDays: number
  safetyStock: number
  reorderPoint: number
}

/**
 * Average units sold per day.
 *
 * ⚠️ DIVIDED BY THE OBSERVED WINDOW, NOT ALWAYS BY 30.
 *
 * A product added six days ago that sold 12 units sells 2/day, not 0.4/day.
 * Dividing by the full window would make every new product look dormant and
 * keep it permanently below its reorder point — the shop would never restock
 * the things that are selling fastest.
 */
export function averageDailySales(input: DemandInput): number {
  const days = Math.max(1, input.windowDays ?? DEMAND_WINDOW_DAYS)
  return input.unitsSoldInWindow / days
}

/** The L3 formula. */
export function reorderPointFor(input: DemandInput): ReorderPoint {
  const avgDailySales = averageDailySales(input)
  const leadTimeDays = input.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS

  const leadTimeConsumption = avgDailySales * leadTimeDays
  const safetyStock = leadTimeConsumption * SAFETY_FACTOR

  return {
    productId: input.productId,
    avgDailySales: round(avgDailySales),
    leadTimeDays,
    safetyStock: round(safetyStock),
    reorderPoint: round(leadTimeConsumption + safetyStock),
  }
}

/**
 * `available_position` from the spec.
 *
 * ⚠️ `reservedQuantity` IS ALWAYS ZERO AND THAT IS DOCUMENTED, NOT HIDDEN.
 *
 * The spec says: «if `open_purchase_order_quantity` or `reserved_quantity`
 * have no concept in the system, take that part as 0 and explain in a comment
 * — do not build a fake model».
 *
 * There is no reservation anywhere in this schema: no `reserved_quantity`
 * column, no allocation table, no held-stock concept. Inventing one would put
 * a number into a reorder decision that nothing maintains, and it would drift
 * from reality immediately.
 *
 * `inTransit` and `onOrder` ARE real — K3's `stock_in_transit` view and open
 * purchase orders respectively.
 */
export function availablePosition(input: {
  onHand: number
  inTransit: number
  onOrder: number
}): number {
  // reservedQuantity omitted entirely rather than subtracted as a literal 0 —
  // a `- 0` in the expression would read as «reservations are handled» to the
  // next person.
  return round(input.onHand + input.inTransit + input.onOrder)
}

export function suggestedOrderQuantity(availablePos: number, reorderPoint: number): number {
  if (availablePos >= reorderPoint) return 0
  return round(reorderPoint - availablePos)
}

// ---------------------------------------------------------------------------
// L4 — DEAD STOCK
// ---------------------------------------------------------------------------

/**
 * Days without a sale before stock counts as dead.
 *
 * ⚠️ A QUERY PARAMETER, NOT A SETTING. The spec is explicit. A shop selling
 * fresh produce and one selling machine parts mean completely different things
 * by «dead», and neither has told the product which it is.
 */
export const DEAD_STOCK_DEFAULT_DAYS = 90

export interface DeadStockInput {
  productId: string
  onHand: number
  /** The most recent SALE. `null` means it has never sold. */
  lastSoldAt: string | null
}

export interface DeadStockLine {
  productId: string
  onHand: number
  lastSoldAt: string | null
  /** `null` when it has never sold — which is not «zero days idle». */
  daysSinceSale: number | null
  neverSold: boolean
}

/**
 * Stock sitting on a shelf that nobody is buying.
 *
 * The condition is the spec's: `on_hand > 0 AND no SALE movement in N days`.
 *
 * ⚠️ TWO THINGS THIS IS CAREFUL ABOUT
 *
 * 1. `onHand > 0`, strictly. A product with zero or negative stock is not dead
 *    stock — it is out of stock, which is the opposite problem and belongs on
 *    the reorder list.
 *
 * 2. NEVER SOLD is reported as `neverSold`, not as «idle for ∞ days». A
 *    product added last week that has not sold yet is not dead; one added two
 *    years ago that never sold is the deadest thing in the warehouse. The
 *    caller has the created date and can tell them apart; this function
 *    refuses to guess by collapsing both into a number.
 */
export function findDeadStock(
  items: readonly DeadStockInput[],
  asOf: Date,
  thresholdDays: number = DEAD_STOCK_DEFAULT_DAYS,
): DeadStockLine[] {
  const lines: DeadStockLine[] = []

  for (const item of items) {
    if (!(item.onHand > 0)) continue

    if (item.lastSoldAt === null) {
      lines.push({
        productId: item.productId,
        onHand: item.onHand,
        lastSoldAt: null,
        daysSinceSale: null,
        neverSold: true,
      })
      continue
    }

    const days = daysBetween(new Date(item.lastSoldAt), asOf)
    if (days < thresholdDays) continue

    lines.push({
      productId: item.productId,
      onHand: item.onHand,
      lastSoldAt: item.lastSoldAt,
      daysSinceSale: days,
      neverSold: false,
    })
  }

  // Longest idle first: the list is read from the top, and the thing that has
  // not moved in two years is the money that has been stuck longest.
  return lines.sort((a, b) => (b.daysSinceSale ?? Infinity) - (a.daysSinceSale ?? Infinity))
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.floor(ms / 86_400_000)
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000
}
