// ============================================
// backend/src/services/inventory-costing/costing.service.ts
//
// The Inventory Costing Core's orchestration, and the implementation of
// CostingPort.
//
// The rule this core exists to enforce: the cost of goods sold is the cost of
// the goods that were actually sold. Not the product's current buy price, not
// an average of everything ever bought, not sale price minus purchase price.
// ============================================

import { ConflictError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'

import {
  averageUnitCost,
  grossProfit,
  onHand,
  planConsumption,
  roundMoney,
  stockValue,
  type CostLayer,
  type ConsumptionPlan,
} from './costing.domain'
import { CostingRepository, domainErrorCode, type InventorySettings } from './costing.repository'
import type {
  CostingPort,
  CostingSourceType,
  IssueRequest,
  IssueResult,
  ReceiptRequest,
  ValuationRow,
} from './costing.port'

export class CostingService implements CostingPort {
  private readonly repo: CostingRepository

  constructor(repo: CostingRepository = new CostingRepository()) {
    this.repo = repo
  }

  private async invalidate(workspaceId: string) {
    await memoryCache.invalidate(`costing:${workspaceId}`)
  }

  /**
   * Turn a Postgres refusal back into the domain error it was raised as.
   *
   * The consume function refuses inside the transaction — that is the only
   * check that cannot be raced — and it says why with a code. Losing that code
   * would turn "you have 3 of these, not 5" into a 500.
   */
  private rethrow(error: unknown): never {
    const code = domainErrorCode(error)
    if (code === 'INVENTORY_INSUFFICIENT_STOCK') throw new ConflictError(code)
    if (code && code.startsWith('INVENTORY_')) throw new ValidationError(code)
    throw error
  }

  // ─── Settings ─────────────────────────────────────────────────────────────

  async getSettings(ctx: TenancyContext): Promise<InventorySettings> {
    return this.repo.getSettings(ctx.workspaceId)
  }

  /**
   * Changing the costing method is an owner's decision: it changes what every
   * future sale is reported to have cost, and therefore the reported profit.
   */
  async setSettings(
    ctx: TenancyContext,
    settings: {
      costingMethod?: InventorySettings['costingMethod'] | undefined
      negativeStock?: InventorySettings['negativeStock'] | undefined
    },
  ): Promise<InventorySettings> {
    if (ctx.role !== 'owner' && ctx.role !== 'manager') {
      throw new ConflictError('INVENTORY_SETTINGS_FORBIDDEN')
    }
    const saved = await this.repo.setSettings(ctx, settings)
    await this.invalidate(ctx.workspaceId)
    return saved
  }

  // ─── CostingPort ──────────────────────────────────────────────────────────

  async recordReceipt(ctx: TenancyContext, request: ReceiptRequest): Promise<{ layerId: string }> {
    if (request.quantity <= 0) throw new ValidationError('INVENTORY_RECEIPT_QUANTITY_INVALID')
    if (request.unitCost < 0) throw new ValidationError('INVENTORY_RECEIPT_COST_INVALID')

    try {
      const layerId = await this.repo.receiveLayer(ctx, request)
      await this.invalidate(ctx.workspaceId)
      return { layerId }
    } catch (error) {
      this.rethrow(error)
    }
  }

  async recordIssue(ctx: TenancyContext, request: IssueRequest): Promise<IssueResult> {
    if (request.quantity <= 0) throw new ValidationError('INVENTORY_ISSUE_QUANTITY_INVALID')

    try {
      const result = await this.repo.consumeLayers(ctx, request)
      await this.invalidate(ctx.workspaceId)

      if (result.shortfall > 0) {
        // The issue was allowed by policy, but part of its cost is a guess.
        // Said out loud here because a silently estimated cost is a silently
        // wrong profit figure.
        console.warn(
          `[Costing] ${request.consumerType} ${request.consumerId}: ${result.shortfall} of ` +
            `product ${request.productId} issued with no stock behind it; cost is estimated`,
        )
      }

      return result
    } catch (error) {
      this.rethrow(error)
    }
  }

  async releaseDocument(
    ctx: TenancyContext,
    consumerType: CostingSourceType,
    consumerId: string,
  ): Promise<{ quantity: number; totalCost: number }> {
    try {
      const result = await this.repo.releaseConsumption(ctx, consumerType, consumerId)
      await this.invalidate(ctx.workspaceId)
      return result
    } catch (error) {
      this.rethrow(error)
    }
  }

  async getValuation(ctx: TenancyContext, productId?: string): Promise<ValuationRow[]> {
    const cacheKey = `costing:${ctx.workspaceId}:valuation:${productId ?? 'all'}`

    const cached = await memoryCache.get<ValuationRow[]>(cacheKey)
    if (cached) return cached

    const rows = await this.repo.valuation(ctx.workspaceId, productId)
    await memoryCache.set(cacheKey, rows, 60)
    return rows
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  async getLayers(
    ctx: TenancyContext,
    productId: string,
    warehouseId?: string | null,
  ): Promise<{ layers: CostLayer[]; onHand: number; value: number; averageCost: number }> {
    const layers = await this.repo.openLayers(ctx.workspaceId, productId, warehouseId)
    return {
      layers,
      onHand: onHand(layers),
      value: stockValue(layers),
      averageCost: roundMoney(averageUnitCost(layers)),
    }
  }

  /**
   * What a document's goods cost, and which purchases paid for them.
   *
   * This is the answer to "why is my profit on this invoice what it is" — a
   * question the system could not answer at all before cost layers existed.
   */
  async explainDocumentCost(
    ctx: TenancyContext,
    consumerType: CostingSourceType,
    consumerId: string,
    revenue?: number,
  ) {
    const rows = await this.repo.consumptionsFor(ctx.workspaceId, consumerType, consumerId)

    const totalCost = roundMoney(rows.reduce((sum, r) => sum + r.amount, 0))
    const estimated = rows.filter((r) => r.isEstimated)

    return {
      consumerType,
      consumerId,
      lines: rows,
      totalCost,
      /** True when part of this cost was never backed by real stock. */
      hasEstimatedCost: estimated.length > 0,
      estimatedAmount: roundMoney(estimated.reduce((sum, r) => sum + r.amount, 0)),
      ...(revenue === undefined
        ? {}
        : { revenue: roundMoney(revenue), grossProfit: grossProfit(revenue, totalCost) }),
    }
  }

  /**
   * What an issue WOULD cost, without consuming anything.
   *
   * Read-only, and computed with the same pure planner the database mirrors —
   * so a quote and the invoice it becomes agree, as long as no stock moved in
   * between. It must never be used to record a cost: only the locked
   * consumption inside Postgres may do that.
   */
  async previewIssueCost(
    ctx: TenancyContext,
    productId: string,
    quantity: number,
    warehouseId?: string | null,
  ): Promise<ConsumptionPlan> {
    const [layers, settings] = await Promise.all([
      this.repo.openLayers(ctx.workspaceId, productId, warehouseId),
      this.repo.getSettings(ctx.workspaceId),
    ])

    return planConsumption(layers, quantity, { method: settings.costingMethod })
  }
}
