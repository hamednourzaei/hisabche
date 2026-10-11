// ============================================
// backend/src/services/inventory-costing/costing.repository.ts
//
// The only file in the costing core that knows Supabase and column names.
//
// The consumption itself is a Postgres function, not a sequence of calls from
// here: picking layers in Node means reading them, deciding, and writing back,
// and two sales of the last unit both read "1 available" before either writes.
// ============================================

import { baseCurrencyOf } from '../base-currency'
import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import type { TenancyContext } from '../tenancy.service'

import type { CostLayer, CostingMethod, NegativeStockPolicy } from './costing.domain'
import type { IssueRequest, IssueResult, ReceiptRequest, ValuationRow } from './costing.port'
import type { StockPosition } from './unvalued-stock.domain'

export interface InventorySettings {
  costingMethod: CostingMethod
  negativeStock: NegativeStockPolicy
}

export interface ConsumptionRow {
  id: string
  layerId: string | null
  productId: string
  quantity: number
  unitCost: number
  amount: number
  isEstimated: boolean
  consumerType: string
  consumerId: string | null
  consumerLine: string | null
  entryDate: string
}

/** A domain refusal raised by our own RAISE EXCEPTION, not a driver failure. */
export function domainErrorCode(error: unknown): string | null {
  const message = (error as { message?: string } | null)?.message ?? ''
  return /\b([A-Z][A-Z_]{6,})\b/.exec(message)?.[1] ?? null
}

function mapLayer(raw: Record<string, any>): CostLayer {
  return {
    id: raw.id,
    productId: raw.product_id,
    warehouseId: raw.warehouse_id ?? null,
    remainingQty: Number(raw.remaining_qty) || 0,
    unitCost: Number(raw.unit_cost) || 0,
    entryDate: String(raw.entry_date ?? '').slice(0, 10),
    createdAt: raw.created_at ?? '',
  }
}

export class CostingRepository {
  async getSettings(workspaceId: string): Promise<InventorySettings> {
    const { data, error } = await supabase
      .from('inventory_settings')
      .select('costing_method, negative_stock')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to read inventory settings', error)

    // A workspace that never chose gets FIFO and refuses to sell what it does
    // not have. Both defaults are the conservative answer: FIFO keeps the
    // per-purchase trail, and blocking surfaces a stock error at the till
    // instead of inventing a cost for it.
    return {
      costingMethod: (data?.costing_method as CostingMethod) ?? 'fifo',
      negativeStock: (data?.negative_stock as NegativeStockPolicy) ?? 'block',
    }
  }

  async setSettings(
    ctx: TenancyContext,
    settings: {
      costingMethod?: InventorySettings['costingMethod'] | undefined
      negativeStock?: InventorySettings['negativeStock'] | undefined
    },
  ): Promise<InventorySettings> {
    const current = await this.getSettings(ctx.workspaceId)
    // Spreading the patch directly would let an explicit `undefined` on an
    // omitted field overwrite the stored value with nothing.
    const next: InventorySettings = {
      costingMethod: settings.costingMethod ?? current.costingMethod,
      negativeStock: settings.negativeStock ?? current.negativeStock,
    }

    const { error } = await supabase.from('inventory_settings').upsert(
      {
        workspace_id: ctx.workspaceId,
        costing_method: next.costingMethod,
        negative_stock: next.negativeStock,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id' },
    )

    if (error) throw new DatabaseError('Failed to save inventory settings', error)
    return next
  }

  /** The open layers for one product, oldest arrival first. */
  async openLayers(
    workspaceId: string,
    productId: string,
    warehouseId?: string | null,
  ): Promise<CostLayer[]> {
    let query = supabase
      .from('cost_layers')
      .select('id, product_id, warehouse_id, remaining_qty, unit_cost, entry_date, created_at')
      .eq('workspace_id', workspaceId)
      .eq('product_id', productId)
      .gt('remaining_qty', 0)
      .order('entry_date', { ascending: true })
      .order('created_at', { ascending: true })

    if (warehouseId) query = query.eq('warehouse_id', warehouseId)

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to read cost layers', error)
    return (data ?? []).map(mapLayer)
  }

  async receiveLayer(ctx: TenancyContext, request: ReceiptRequest): Promise<string> {
    const { data, error } = await supabase.rpc('inventory_receive_layer', {
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
      p_payload: {
        product_id: request.productId,
        warehouse_id: request.warehouseId ?? null,
        quantity: request.quantity,
        unit_cost: request.unitCost,
        currency: request.currency ?? (await baseCurrencyOf(ctx.workspaceId)),
        entry_date: request.entryDate,
        source_type: request.sourceType,
        source_id: request.sourceId,
        source_line: request.sourceLine ?? null,
      },
    })

    if (error) throw error
    return data as string
  }

  async consumeLayers(ctx: TenancyContext, request: IssueRequest): Promise<IssueResult> {
    const { data, error } = await supabase.rpc('inventory_consume_layers', {
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
      p_payload: {
        product_id: request.productId,
        warehouse_id: request.warehouseId ?? null,
        quantity: request.quantity,
        entry_date: request.entryDate,
        consumer_type: request.consumerType,
        consumer_id: request.consumerId,
        consumer_line: request.consumerLine ?? null,
      },
    })

    if (error) throw error

    const result = (data ?? {}) as Record<string, unknown>
    return {
      status: (result.status as IssueResult['status']) ?? 'consumed',
      quantity: Number(result.quantity) || 0,
      totalCost: Number(result.total_cost) || 0,
      shortfall: Number(result.shortfall) || 0,
    }
  }

  async releaseConsumption(
    ctx: TenancyContext,
    consumerType: string,
    consumerId: string,
  ): Promise<{ quantity: number; totalCost: number }> {
    const { data, error } = await supabase.rpc('inventory_release_consumption', {
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
      p_consumer_type: consumerType,
      p_consumer_id: consumerId,
    })

    if (error) throw error

    const result = (data ?? {}) as Record<string, unknown>
    return { quantity: Number(result.quantity) || 0, totalCost: Number(result.total_cost) || 0 }
  }

  async valuation(workspaceId: string, productId?: string): Promise<ValuationRow[]> {
    const { data, error } = await supabase.rpc('inventory_valuation', {
      p_workspace_id: workspaceId,
      p_product_id: productId ?? null,
    })

    if (error) throw new DatabaseError('Failed to value inventory', error)

    return (data ?? []).map((row: Record<string, any>) => ({
      productId: row.product_id,
      productName: row.product_name,
      onHand: Number(row.on_hand) || 0,
      value: Number(row.value) || 0,
      averageCost: Number(row.average_cost) || 0,
    }))
  }

  /**
   * Every product that holds stock, beside what its open layers hold. Every
   * row is read (pages of 1000): a capped read would report the products past
   * the cap as fully valued.
   */
  async stockPositions(workspaceId: string): Promise<StockPosition[]> {
    const [products, layers] = await Promise.all([
      selectAllPages((lo, hi) =>
        supabase
          .from('products')
          .select('id, name, quantity, buy_price')
          .eq('workspace_id', workspaceId)
          .gt('quantity', 0)
          .order('id', { ascending: true })
          .range(lo, hi),
      ),
      selectAllPages((lo, hi) =>
        supabase
          .from('cost_layers')
          .select('id, product_id, remaining_qty')
          .eq('workspace_id', workspaceId)
          .gt('remaining_qty', 0)
          .order('id', { ascending: true })
          .range(lo, hi),
      ),
    ])
    if (products.error) throw new DatabaseError('Failed to read product stock', products.error)
    if (layers.error) throw new DatabaseError('Failed to read cost layers', layers.error)

    const layered = new Map<string, number>()
    for (const row of (layers.data ?? []) as Array<Record<string, unknown>>) {
      const id = String(row.product_id)
      layered.set(id, (layered.get(id) ?? 0) + (Number(row.remaining_qty) || 0))
    }
    return ((products.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      productId: String(row.id),
      name: String(row.name ?? ''),
      quantity: Number(row.quantity) || 0,
      buyPrice: Number(row.buy_price) || 0,
      layeredQuantity: layered.get(String(row.id)) ?? 0,
    }))
  }

  /** One product's stock beside its open layers; null when it is not this business's. */
  async stockPosition(workspaceId: string, productId: string): Promise<StockPosition | null> {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, quantity, buy_price')
      .eq('workspace_id', workspaceId)
      .eq('id', productId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read product stock', error)
    if (!data) return null

    const layers = await this.openLayers(workspaceId, productId)
    const row = data as Record<string, unknown>
    return {
      productId: String(row.id),
      name: String(row.name ?? ''),
      quantity: Number(row.quantity) || 0,
      buyPrice: Number(row.buy_price) || 0,
      layeredQuantity: layers.reduce((sum, layer) => sum + layer.remainingQty, 0),
    }
  }

  /** The trail: which layers paid for this document, and at what price. */
  async consumptionsFor(
    workspaceId: string,
    consumerType: string,
    consumerId: string,
  ): Promise<ConsumptionRow[]> {
    const { data, error } = await supabase
      .from('cost_consumptions')
      .select(
        'id, layer_id, product_id, quantity, unit_cost, amount, is_estimated, consumer_type, consumer_id, consumer_line, entry_date',
      )
      .eq('workspace_id', workspaceId)
      .eq('consumer_type', consumerType)
      .eq('consumer_id', consumerId)
      .order('created_at', { ascending: true })

    if (error) throw new DatabaseError('Failed to read the cost trail', error)

    return (data ?? []).map((row) => ({
      id: row.id,
      layerId: row.layer_id ?? null,
      productId: row.product_id,
      quantity: Number(row.quantity) || 0,
      unitCost: Number(row.unit_cost) || 0,
      amount: Number(row.amount) || 0,
      isEstimated: row.is_estimated === true,
      consumerType: row.consumer_type,
      consumerId: row.consumer_id ?? null,
      consumerLine: row.consumer_line ?? null,
      entryDate: String(row.entry_date ?? '').slice(0, 10),
    }))
  }
}
