// ============================================
// backend/src/services/product/variant.service.ts
//
// Product Variants Service (G-05 / Option 11)
// Manages template products and variant rows with attributes and pricing overrides.
// Enforces workspace_id tenancy boundary on every query.
//
// 10 Nov 2026 (variant-stock-01, clothing): the size × colour grid, stock per
// variant, and what each variant sold. A variant's stock is the sum of the
// stock movements that name it — the same source of truth as the product's.
// ============================================

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  checkVariantStockMove,
  expandVariantMatrix,
  summarizeVariantStock,
  type VariantAttribute,
  type VariantMatrixInput,
  type VariantStockMoveInput,
  type VariantStockRow,
} from '@hisabche/validation'
import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import type { TenancyContext } from '../tenancy.service'
import { ProductService } from '../product.service'

interface VariantRow {
  id: string
  sku: string
  barcode: string | null
  attributes: VariantAttribute[] | null
  price_override_minor: number | null
  is_active: boolean
}

/** `product_variant_stock` or the column it reads is not there yet. */
function isStockNotReady(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    ((error.code === '42703' || error.code === 'PGRST204') &&
      (error.message ?? '').includes('variant_id'))
  )
}

export class VariantService {
  constructor(
    private readonly db: SupabaseClient = supabase,
    private readonly products: ProductService = new ProductService(),
  ) {}

  async getVariants(workspaceId: string, templateProductId: string) {
    const { data, error } = await this.db
      .from('product_variants')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('template_product_id', templateProductId)
      .eq('is_active', true)

    if (error) throw error
    return data ?? []
  }

  async createVariant(
    workspaceId: string,
    input: {
      templateProductId: string
      sku: string
      barcode?: string | undefined
      attributes: Array<{ name: string; value: string }>
      priceOverrideMinor?: number | undefined
      costOverrideMinor?: number | undefined
    },
  ) {
    const { data, error } = await this.db
      .from('product_variants')
      .insert({
        workspace_id: workspaceId,
        template_product_id: input.templateProductId,
        sku: input.sku,
        barcode: input.barcode ?? null,
        attributes: input.attributes,
        price_override_minor: input.priceOverrideMinor ?? null,
        cost_override_minor: input.costOverrideMinor ?? null,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /** The product, read in this workspace, or 404. Goods only: a service has no sizes on a shelf. */
  private async assertProduct(workspaceId: string, productId: string): Promise<void> {
    const { data, error } = await this.db
      .from('products')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('id', productId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read the product', error)
    if (!data) throw new NotFoundError('Product')
  }

  private async activeVariants(workspaceId: string, productId: string): Promise<VariantRow[]> {
    const { data, error } = await this.db
      .from('product_variants')
      .select('id, sku, barcode, attributes, price_override_minor, is_active')
      .eq('workspace_id', workspaceId)
      .eq('template_product_id', productId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    if (error) throw new DatabaseError('Failed to read the variants', error)
    return (data ?? []) as VariantRow[]
  }

  /**
   * «S M L XL × black, white» in one go. Cells the product already has are
   * skipped, so the grid can be run again after a new colour arrives.
   * One insert statement: every cell is created, or none.
   */
  async createMatrix(workspaceId: string, productId: string, input: VariantMatrixInput) {
    await this.assertProduct(workspaceId, productId)
    const existing = await this.activeVariants(workspaceId, productId)
    const plan = expandVariantMatrix(
      input,
      existing.map((v) => ({ sku: v.sku, attributes: v.attributes ?? [] })),
    )
    if (!plan.ok) throw new ValidationError(plan.code)
    if (plan.cells.length === 0) return { created: [], skipped: plan.skipped }

    const { data, error } = await this.db
      .from('product_variants')
      .insert(
        plan.cells.map((cell) => ({
          workspace_id: workspaceId,
          template_product_id: productId,
          sku: cell.sku,
          attributes: cell.attributes,
        })),
      )
      .select('id, sku, attributes')
    if (error) throw new DatabaseError('Failed to create the variants', error)
    return { created: data ?? [], skipped: plan.skipped }
  }

  /** Per variant and warehouse, from the movements that name a variant. */
  private async stockRows(
    workspaceId: string,
    productId: string,
  ): Promise<{ ready: boolean; rows: VariantStockRow[] }> {
    const { data, error } = await this.db.rpc('product_variant_stock', {
      p_workspace_id: workspaceId,
      p_product_id: productId,
    })
    if (isStockNotReady(error)) return { ready: false, rows: [] }
    if (error) throw new DatabaseError('Failed to read the variant stock', error)
    const rows = (data ?? []) as Array<{
      variant_id: string
      warehouse_id: string | null
      quantity: number | string
    }>
    return {
      ready: true,
      rows: rows.map((row) => ({
        variantId: row.variant_id,
        warehouseId: row.warehouse_id,
        quantity: Number(row.quantity) || 0,
      })),
    }
  }

  /** What each variant sold, from the invoice movements that name it (net of returns given back). */
  private async soldByVariant(
    workspaceId: string,
    productId: string,
  ): Promise<Map<string, number>> {
    const { data, error } = await selectAllPages<
      { variant_id: string; quantity: number | string },
      { message: string; code?: string }
    >((from, to) =>
      this.db
        .from('stock_movements')
        .select('variant_id, quantity')
        .eq('workspace_id', workspaceId)
        .eq('product_id', productId)
        .eq('reference_type', 'invoice')
        .not('variant_id', 'is', null)
        .lt('quantity', 0)
        .order('id', { ascending: true })
        .range(from, to)
        .returns<Array<{ variant_id: string; quantity: number | string }>>(),
    )
    if (isStockNotReady(error)) return new Map()
    if (error) throw new DatabaseError('Failed to read the variant sales', error)
    const sold = new Map<string, number>()
    for (const row of data ?? []) {
      sold.set(row.variant_id, (sold.get(row.variant_id) ?? 0) - (Number(row.quantity) || 0))
    }
    return sold
  }

  /**
   * Every variant with its stock, its stock per warehouse, and what it sold;
   * plus the product's own total and what of it is on no variant.
   * `ready: false` = variant-stock-01 has not been run: the screen says so
   * instead of showing zeros (§7.6).
   */
  async stock(workspaceId: string, productId: string) {
    await this.assertProduct(workspaceId, productId)
    const [variants, stock, sold, product, activeHolds] = await Promise.all([
      this.activeVariants(workspaceId, productId),
      this.stockRows(workspaceId, productId),
      this.soldByVariant(workspaceId, productId),
      this.db
        .from('products')
        .select('quantity')
        .eq('workspace_id', workspaceId)
        .eq('id', productId)
        .maybeSingle(),
      this.activeReservations(workspaceId, productId),
    ])
    if (product.error) throw new DatabaseError('Failed to read the product', product.error)
    const lines = summarizeVariantStock(
      variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        barcode: v.barcode,
        attributes: v.attributes ?? [],
      })),
      stock.rows,
      sold,
    )
    const productOnHand = Number((product.data as { quantity?: unknown } | null)?.quantity) || 0
    const onVariants = lines.reduce((sum, line) => sum + line.onHand, 0)
    return {
      ready: stock.ready,
      productOnHand,
      unassigned: Math.round((productOnHand - onVariants) * 10_000) / 10_000,
      variants: lines,
      reservations: activeHolds,
    }
  }

  private async activeReservations(
    workspaceId: string,
    productId: string,
  ): Promise<
    Array<{
      variantId: string
      warehouseId: string
      quantity: number
      status: 'active' | 'settled' | 'released' | 'expired'
    }>
  > {
    const nowIso = new Date().toISOString()
    const { data, error } = await this.db
      .from('stock_reservations')
      .select('variant_id, warehouse_id, quantity, status, expires_at')
      .eq('workspace_id', workspaceId)
      .eq('product_id', productId)
      .eq('status', 'active')
    if (error) {
      if (isStockNotReady(error) || error.code === '42P01' || error.code === 'PGRST205') {
        return []
      }
      throw new DatabaseError('Failed to read active variant reservations', error)
    }
    return ((data ?? []) as Array<Record<string, unknown>>)
      .filter((r) => Boolean(r.variant_id) && (!r.expires_at || String(r.expires_at) > nowIso))
      .map((r) => ({
        variantId: String(r.variant_id),
        warehouseId: String(r.warehouse_id ?? 'default'),
        quantity: Number(r.quantity) || 0,
        status: 'active' as const,
      }))
  }

  /**
   * Put stock on a variant (assign / receive) or take it off (remove).
   *
   * `assign` writes two movements in ONE insert: + on the variant, − on the
   * product with no variant — the product's total and the warehouse's do not
   * change. `receive` and `remove` are one movement each.
   */
  async moveStock(
    ctx: TenancyContext,
    productId: string,
    variantId: string,
    input: VariantStockMoveInput,
  ) {
    const { workspaceId } = ctx
    await this.assertProduct(workspaceId, productId)
    const variants = await this.activeVariants(workspaceId, productId)
    if (!variants.some((v) => v.id === variantId)) throw new NotFoundError('Variant')

    const warehouseId = await this.products.stockWarehouse(workspaceId, input.warehouseId, 'edit')
    const stock = await this.stockRows(workspaceId, productId)
    if (!stock.ready) throw new ValidationError('VARIANT_STOCK_NOT_READY')

    const inPlace = stock.rows.filter((row) =>
      warehouseId ? row.warehouseId === warehouseId : true,
    )
    const productOnHand = warehouseId
      ? await this.products.warehouseQuantity(productId, warehouseId)
      : (await this.stock(workspaceId, productId)).productOnHand
    const refusal = checkVariantStockMove({
      mode: input.mode,
      quantity: input.quantity,
      productOnHand,
      variantsOnHand: inPlace.reduce((sum, row) => sum + row.quantity, 0),
      variantOnHand: inPlace
        .filter((row) => row.variantId === variantId)
        .reduce((sum, row) => sum + row.quantity, 0),
    })
    if (refusal) throw new ValidationError(refusal)

    const base = {
      product_id: productId,
      type: 'adjustment',
      reference_type: 'variant_stock',
      reference_id: variantId,
      workspace_id: workspaceId,
      user_id: ctx.userId,
      notes: input.note ? `variant:${input.mode} — ${input.note}` : `variant:${input.mode}`,
      ...(warehouseId ? { to_warehouse_id: warehouseId } : {}),
    }
    const signed = input.mode === 'remove' ? -input.quantity : input.quantity
    const rows: Array<Record<string, unknown>> = [
      { ...base, variant_id: variantId, quantity: signed },
    ]
    if (input.mode === 'assign') rows.push({ ...base, quantity: -input.quantity })

    const { error } = await this.db.from('stock_movements').insert(rows)
    if (isStockNotReady(error)) throw new ValidationError('VARIANT_STOCK_NOT_READY')
    if (error) throw new DatabaseError('Failed to move the variant stock', error)
    return { variantId, mode: input.mode, quantity: input.quantity, warehouseId }
  }
}
