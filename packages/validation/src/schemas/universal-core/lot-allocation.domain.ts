// ============================================
// packages/validation/src/schemas/universal-core/lot-allocation.domain.ts
//
// FEFO BATCH ALLOCATION — the ONE allocation core (V55 final completion).
//
// This is the pure allocation core of the pharmacy/expiry workflow, moved
// here from `backend/src/services/traceability/lot.domain.ts` so that the
// server AND the offline local engine run the SAME algorithm — a second FEFO
// implementation in `packages/local-engine` would be exactly the drift this
// repository forbids. The backend file re-exports everything it needs; its
// public API is unchanged.
//
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
