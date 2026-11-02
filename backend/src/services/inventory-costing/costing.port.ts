// ============================================
// backend/src/services/inventory-costing/costing.port.ts
//
// What sales, purchasing and manufacturing may ask of the costing core.
//
// They say "these goods arrived" or "these goods left" and are told what it
// cost. They never read a layer, never pick which one to consume, and never
// price anything themselves — which is exactly what invoice.service used to
// do when it multiplied a quantity by the product's current buy price.
// ============================================

import type { TenancyContext } from '../tenancy.service'

export type CostingSourceType = 'invoice' | 'purchase_order' | 'adjustment' | 'opening' | 'transfer'

export interface ReceiptRequest {
  productId: string
  warehouseId?: string | null
  quantity: number
  unitCost: number
  currency?: string
  /** The day the goods arrived — the FIFO position, not today. */
  entryDate: string
  sourceType: CostingSourceType
  sourceId: string
  /** Distinguishes two lines of the same document for the same product. */
  sourceLine?: string
}

export interface IssueRequest {
  productId: string
  warehouseId?: string | null
  quantity: number
  entryDate: string
  consumerType: CostingSourceType
  consumerId: string
  consumerLine?: string
}

export interface IssueResult {
  status: 'consumed' | 'already_consumed'
  quantity: number
  /** What the goods actually cost. This is the COGS figure, and only this. */
  totalCost: number
  /** Quantity no real layer covered; > 0 means the cost is partly a guess. */
  shortfall: number
}

export interface ValuationRow {
  productId: string
  productName: string
  onHand: number
  value: number
  averageCost: number
}

export interface CostingPort {
  /** Goods came in. Idempotent per (sourceType, sourceId, sourceLine). */
  recordReceipt(ctx: TenancyContext, request: ReceiptRequest): Promise<{ layerId: string }>

  /** Goods went out. Idempotent per (consumerType, consumerId, consumerLine). */
  recordIssue(ctx: TenancyContext, request: IssueRequest): Promise<IssueResult>

  /** Undo a document's consumption, returning quantities to their own layers. */
  releaseDocument(
    ctx: TenancyContext,
    consumerType: CostingSourceType,
    consumerId: string,
  ): Promise<{ quantity: number; totalCost: number }>

  /**
   * Refuse (ConflictError PURCHASE_LAYER_CONSUMED) when any cost layer of this receipt was already drawn from. Reads only;
   * called BEFORE a cancel changes anything, so a refusal leaves the document exactly as it was.
   */
  assertReceiptUntouched(
    ctx: TenancyContext,
    sourceType: CostingSourceType,
    sourceId: string,
  ): Promise<void>

  /**
   * Take a cancelled receipt's layers out of the valuation (remaining 0, rows kept). Atomic and re-checked in the database;
   * a retry is a no-op. Returns false when the database function is not applied yet — the caller then behaves as before.
   */
  voidReceipt(
    ctx: TenancyContext,
    sourceType: CostingSourceType,
    sourceId: string,
  ): Promise<boolean>

  /** Σ(remaining × unit cost). What the stock account must agree with. */
  getValuation(ctx: TenancyContext, productId?: string): Promise<ValuationRow[]>
}
