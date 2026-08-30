// ============================================
// backend/src/services/traceability/lot.domain.ts
//
// Which physical goods left the shop: batches, serial numbers, and expiry.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A SEPARATE CORE FROM COSTING
//
// The costing core answers "what did these goods cost". This one answers
// "WHICH goods were they". They are different questions and a shop can need
// one without the other — a hardware store needs cost layers and no batches;
// a pharmacy needs both.
//
// They meet at exactly one point: a batch or a serial names the cost layer it
// came in on, so the profit on a specific bottle is the cost of the specific
// carton it arrived in, not an average.
//
// ---------------------------------------------------------------------------
// FEFO, NOT FIFO, WHEN THINGS EXPIRE
//
// FIFO consumes the OLDEST RECEIVED. For anything with an expiry date that is
// the wrong rule: goods received later can expire sooner, and shipping the
// older carton leaves the sooner-expiring one on the shelf to be written off.
//
// So expiry-tracked items default to FEFO — first EXPIRY, first out — which is
// what a pharmacist actually does by hand. ERPNext and Odoo both support
// picking a batch; neither makes the expiry-correct choice the default.
//
// ---------------------------------------------------------------------------
// EXPIRY IS A REFUSAL, NOT A WARNING
//
// An expired batch cannot be issued. Not "flagged", not "warned about" —
// refused, because the downstream cost of selling expired medicine is not
// something a dismissible banner can carry.
// ============================================

export type TrackingMode =
  /** No unit-level identity. The default, and right for most goods. */
  | 'none'
  /** Goods move in identifiable groups with a shared expiry. */
  | 'batch'
  /** Every single unit is individually identified. */
  | 'serial'

export type AllocationStrategy =
  /** Oldest received first. Correct when nothing expires. */
  | 'fifo'
  /** Soonest to expire first. Correct whenever anything does. */
  | 'fefo'
  /** The operator named the batches. Their choice is respected. */
  | 'manual'

export interface StockBatch {
  id: string
  productId: string
  batchNumber: string
  /** ISO date, or null when this batch does not expire. */
  expiryDate: string | null
  manufacturedDate?: string | null
  receivedQty: number
  remainingQty: number
  /** The cost layer these goods arrived on. What ties identity to money. */
  costLayerId: string | null
  warehouseId?: string | null
  /** When the goods arrived. The FIFO tiebreak. */
  receivedOn: string
}

export type SerialStatus = 'in_stock' | 'sold' | 'returned' | 'scrapped'

export interface SerialUnit {
  id: string
  productId: string
  serialNumber: string
  status: SerialStatus
  batchId?: string | null
  costLayerId: string | null
  /** What this exact unit cost. Not an average — the layer it arrived on. */
  unitCostMinor: number
  warehouseId?: string | null
  receivedOn: string
}

// ─── Expiry ──────────────────────────────────────────────────────────────────

export type ExpiryState = 'no_expiry' | 'fresh' | 'near_expiry' | 'expired'

/** Whole days from `asOf` to the expiry date. Negative means already past. */
export function daysUntilExpiry(expiryDate: string | null, asOf: string): number | null {
  if (!expiryDate) return null

  const expiry = Date.parse(`${expiryDate.slice(0, 10)}T00:00:00Z`)
  const now = Date.parse(`${asOf.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(expiry) || Number.isNaN(now)) return null

  return Math.round((expiry - now) / 86_400_000)
}

/**
 * How a batch stands relative to its expiry.
 *
 * A batch expiring TODAY is expired, not fresh: the last day is the last day
 * it may be sold, and treating "0 days left" as usable is how expired stock
 * reaches a customer.
 */
export function expiryState(
  expiryDate: string | null,
  asOf: string,
  nearExpiryDays = 30,
): ExpiryState {
  const days = daysUntilExpiry(expiryDate, asOf)
  if (days === null) return 'no_expiry'
  if (days <= 0) return 'expired'
  if (days <= nearExpiryDays) return 'near_expiry'
  return 'fresh'
}

export function isIssuable(batch: StockBatch, asOf: string): boolean {
  return batch.remainingQty > 0 && expiryState(batch.expiryDate, asOf) !== 'expired'
}

// ─── Allocation ──────────────────────────────────────────────────────────────

export interface BatchAllocation {
  batchId: string
  batchNumber: string
  quantity: number
  expiryDate: string | null
  costLayerId: string | null
}

export interface AllocationPlan {
  allocations: BatchAllocation[]
  /** What no usable batch could cover. */
  shortfall: number
  strategy: AllocationStrategy
  /** Batches skipped because they had expired, and how much they held. */
  blockedByExpiry: Array<{ batchId: string; batchNumber: string; quantity: number }>
}

/**
 * Order the batches a strategy would draw from.
 *
 * FEFO puts non-expiring batches LAST, not first. A batch with no expiry is
 * not "infinitely fresh and therefore urgent" — it is the one thing that can
 * safely wait, so everything perishable should go before it.
 */
export function orderBatches(batches: StockBatch[], strategy: AllocationStrategy): StockBatch[] {
  const open = batches.filter((b) => b.remainingQty > 0)

  if (strategy === 'fifo' || strategy === 'manual') {
    return [...open].sort((a, b) =>
      a.receivedOn === b.receivedOn ? compareId(a, b) : a.receivedOn < b.receivedOn ? -1 : 1,
    )
  }

  return [...open].sort((a, b) => {
    if (a.expiryDate && b.expiryDate) {
      if (a.expiryDate !== b.expiryDate) return a.expiryDate < b.expiryDate ? -1 : 1
      return compareId(a, b)
    }
    // Exactly one has an expiry: that one goes first.
    if (a.expiryDate) return -1
    if (b.expiryDate) return 1
    // Neither expires — fall back to arrival order.
    return a.receivedOn === b.receivedOn ? compareId(a, b) : a.receivedOn < b.receivedOn ? -1 : 1
  })
}

/** Stable tiebreak so two runs never order the same batches differently. */
function compareId(a: StockBatch, b: StockBatch): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Which batches cover this issue.
 *
 * Expired batches are EXCLUDED and reported separately. They are still on the
 * shelf and still worth money; what they are not is sellable, and a plan that
 * quietly skipped them would leave the operator wondering why the quantity
 * does not add up.
 */
export function planAllocation(
  batches: StockBatch[],
  quantity: number,
  options: { strategy?: AllocationStrategy; asOf: string; manual?: BatchAllocation[] } = {
    asOf: new Date().toISOString().slice(0, 10),
  },
): AllocationPlan {
  const strategy = options.strategy ?? 'fefo'

  if (strategy === 'manual' && options.manual) {
    // The operator chose. Their choice stands — but an expired batch is still
    // refused, because that refusal is not a preference.
    const byId = new Map(batches.map((b) => [b.id, b]))
    const allocations: BatchAllocation[] = []
    const blocked: AllocationPlan['blockedByExpiry'] = []
    let covered = 0

    for (const choice of options.manual) {
      const batch = byId.get(choice.batchId)
      if (!batch) continue

      if (expiryState(batch.expiryDate, options.asOf) === 'expired') {
        blocked.push({
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          quantity: choice.quantity,
        })
        continue
      }

      const take = Math.min(choice.quantity, batch.remainingQty)
      if (take <= 0) continue

      allocations.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantity: take,
        expiryDate: batch.expiryDate,
        costLayerId: batch.costLayerId,
      })
      covered += take
    }

    return {
      allocations,
      shortfall: Math.max(0, quantity - covered),
      strategy,
      blockedByExpiry: blocked,
    }
  }

  const ordered = orderBatches(batches, strategy)
  const allocations: BatchAllocation[] = []
  const blockedByExpiry: AllocationPlan['blockedByExpiry'] = []

  let remaining = quantity

  for (const batch of ordered) {
    if (expiryState(batch.expiryDate, options.asOf) === 'expired') {
      blockedByExpiry.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantity: batch.remainingQty,
      })
      continue
    }

    if (remaining <= 0) break

    const take = Math.min(batch.remainingQty, remaining)
    if (take <= 0) continue

    allocations.push({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      quantity: take,
      expiryDate: batch.expiryDate,
      costLayerId: batch.costLayerId,
    })
    remaining -= take
  }

  return { allocations, shortfall: Math.max(0, remaining), strategy, blockedByExpiry }
}

// ─── Serial numbers ──────────────────────────────────────────────────────────

export type SerialRuleCode =
  | 'SERIAL_NOT_IN_STOCK'
  | 'SERIAL_UNKNOWN'
  | 'SERIAL_DUPLICATE'
  | 'SERIAL_COUNT_MISMATCH'
  | 'SERIAL_WRONG_PRODUCT'

/**
 * Whether these exact units may be issued.
 *
 * A serial-tracked line must name exactly as many units as it sells. "Sell 3"
 * with two serials is not a partially-valid line — it is a line where nobody
 * knows which third unit left the building.
 */
export function validateSerialIssue(
  requested: string[],
  available: SerialUnit[],
  expected: { productId: string; quantity: number },
): SerialRuleCode[] {
  const problems: SerialRuleCode[] = []

  if (requested.length !== expected.quantity) problems.push('SERIAL_COUNT_MISMATCH')
  if (new Set(requested).size !== requested.length) problems.push('SERIAL_DUPLICATE')

  const byNumber = new Map(available.map((unit) => [unit.serialNumber, unit]))

  for (const serial of requested) {
    const unit = byNumber.get(serial)

    if (!unit) {
      problems.push('SERIAL_UNKNOWN')
      continue
    }
    if (unit.productId !== expected.productId) problems.push('SERIAL_WRONG_PRODUCT')
    if (unit.status !== 'in_stock') problems.push('SERIAL_NOT_IN_STOCK')
  }

  return [...new Set(problems)]
}

/**
 * What these specific units cost.
 *
 * The sum of each unit's OWN layer cost. This is the point of serial tracking:
 * the profit on the phone with this IMEI is exact, not the average of every
 * phone of that model the shop ever bought.
 */
export function serialCostMinor(requested: string[], available: SerialUnit[]): number {
  const byNumber = new Map(available.map((unit) => [unit.serialNumber, unit]))
  return requested.reduce((sum, serial) => sum + (byNumber.get(serial)?.unitCostMinor ?? 0), 0)
}

// ─── Reporting ───────────────────────────────────────────────────────────────

export interface ExpiryBucket {
  state: ExpiryState
  batches: Array<{
    batchId: string
    batchNumber: string
    productId: string
    quantity: number
    expiryDate: string | null
    daysRemaining: number | null
  }>
  totalQuantity: number
}

/**
 * What is expiring, grouped so a shopkeeper can act on it.
 *
 * Expired first: it is the only group with a deadline that has already passed.
 */
export function bucketByExpiry(
  batches: StockBatch[],
  asOf: string,
  nearExpiryDays = 30,
): ExpiryBucket[] {
  const buckets = new Map<ExpiryState, ExpiryBucket>()

  for (const batch of batches) {
    if (batch.remainingQty <= 0) continue

    const state = expiryState(batch.expiryDate, asOf, nearExpiryDays)
    const bucket = buckets.get(state) ?? { state, batches: [], totalQuantity: 0 }

    bucket.batches.push({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      productId: batch.productId,
      quantity: batch.remainingQty,
      expiryDate: batch.expiryDate,
      daysRemaining: daysUntilExpiry(batch.expiryDate, asOf),
    })
    bucket.totalQuantity += batch.remainingQty

    buckets.set(state, bucket)
  }

  const order: ExpiryState[] = ['expired', 'near_expiry', 'fresh', 'no_expiry']

  return order
    .map((state) => buckets.get(state))
    .filter((bucket): bucket is ExpiryBucket => Boolean(bucket))
    .map((bucket) => ({
      ...bucket,
      batches: bucket.batches.sort((a, b) => (a.daysRemaining ?? 1e9) - (b.daysRemaining ?? 1e9)),
    }))
}

/**
 * The value sitting in expired stock.
 *
 * Worth stating on its own: it is inventory the balance sheet still counts and
 * the shop can no longer sell, and the gap between those two facts is exactly
 * what a write-off decision needs.
 */
export function expiredValueMinor(
  batches: StockBatch[],
  unitCostByLayer: Map<string, number>,
  asOf: string,
): number {
  return batches
    .filter((b) => b.remainingQty > 0 && expiryState(b.expiryDate, asOf) === 'expired')
    .reduce((sum, b) => sum + b.remainingQty * (unitCostByLayer.get(b.costLayerId ?? '') ?? 0), 0)
}
