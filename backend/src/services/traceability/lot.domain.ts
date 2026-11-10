// ============================================
// backend/src/services/traceability/lot.domain.ts
//
// Which physical goods left the shop: batches, serial numbers, and expiry.
//
// ---------------------------------------------------------------------------
// ONE ALLOCATION CORE, TWO RUNTIMES (V55 final completion)
//
// The pure batch-allocation core below — FEFO ordering, expiry states, and
// `planAllocation` — now lives in
// `packages/validation/src/schemas/universal-core/lot-allocation.domain.ts`
// so the offline local engine runs the SAME algorithm the server runs, with
// no second FEFO implementation to drift. Everything this file re-exports is
// byte-for-byte the implementation that always lived here; every existing
// import keeps compiling unchanged.
//
// This file keeps the parts that are genuinely the server's unit-level
// vocabulary: the serial rules, the expiry REPORTING (which groups batches
// for a screen), and the expired-value figure.
// ============================================

import { daysUntilExpiry, expiryState } from '@hisabche/validation'
import type { ExpiryState, StockBatch } from '@hisabche/validation'

export {
  daysUntilExpiry,
  expiryState,
  isIssuable,
  orderBatches,
  planAllocation,
} from '@hisabche/validation'
export type {
  AllocationPlan,
  AllocationStrategy,
  BatchAllocation,
  ExpiryState,
  StockBatch,
} from '@hisabche/validation'

export type TrackingMode =
  /** No unit-level identity. The default, and right for most goods. */
  | 'none'
  /** Goods move in identifiable groups with a shared expiry. */
  | 'batch'
  /** Every single unit is individually identified. */
  | 'serial'

// ─── Serial numbers ──────────────────────────────────────────────────────────

/** «reserved» = held for one customer (retail-ops-01); it is not sellable to anyone else. */
export type SerialStatus = 'in_stock' | 'reserved' | 'sold' | 'returned' | 'scrapped'

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
  /** The invoice that sold it; null while in stock. */
  invoiceId?: string | null
  soldOn?: string | null
}

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
