// ============================================
// backend/src/services/commerce/promotion.service.ts
//
// Capabilities #114–#117 — promotions.
//
// A promotion lowers the SUGGESTED unit price of a sale line when a product is
// picked on an invoice. The arithmetic is the shared engine's (`quotePrice`,
// @hisabche/validation) — the invoice builder prices a picked product with the
// same function, so the screen and the server cannot disagree.
//
// ⚠️ A PROMOTION IS RETIRED, NEVER DELETED (`is_active = false`): the price on
// an old invoice must stay explainable.
//
// ⚠️ IDS IN A SCOPE ARE CHECKED AGAINST THE WORKSPACE. A promotion «for these
// products» that names a product of another workspace is refused, not stored.
//
// ⚠️ A unit price on an invoice is still what the person confirms; nothing here
// rewrites an invoice. `quote` answers «what would this line cost today?».
// ============================================

import {
  priceListPricing,
  promotionInputSchema,
  promotionsFor,
  quotePrice,
  type PriceQuote,
  type PromotionInput,
  type SavedPromotion,
} from '@hisabche/validation'

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import type { TenancyContext } from '../tenancy.service'
import { PriceListsNotConfiguredError, priceListService } from './price-list.service'

const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])
const COLUMNS =
  'id, name, kind, value, currency, stacking, product_ids, customer_ids, valid_from, valid_to, is_active, created_at'

export class PromotionsNotConfiguredError extends BaseError {
  constructor() {
    super('PROMOTIONS_MIGRATION_PENDING', 503)
    this.name = 'PromotionsNotConfiguredError'
  }
}

interface PromotionRow {
  id: string
  name: string
  kind: 'percentage' | 'fixed_amount'
  value: number | string
  currency: string | null
  stacking: 'exclusive' | 'stacking'
  product_ids: string[] | null
  customer_ids: string[] | null
  valid_from: string | null
  valid_to: string | null
  is_active: boolean
  created_at: string
}

const toSaved = (row: PromotionRow): SavedPromotion => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  value: Number(row.value),
  currency: row.currency,
  stacking: row.stacking,
  productIds: row.product_ids,
  customerIds: row.customer_ids,
  validFrom: row.valid_from ? String(row.valid_from).slice(0, 10) : null,
  validTo: row.valid_to ? String(row.valid_to).slice(0, 10) : null,
  isActive: row.is_active,
  createdAt: row.created_at,
})

const toRow = (input: PromotionInput) => ({
  name: input.name,
  kind: input.kind,
  value: input.value,
  // A percentage has no currency, whatever was sent with it.
  currency: input.kind === 'fixed_amount' ? input.currency : null,
  stacking: input.stacking,
  product_ids: input.productIds,
  customer_ids: input.customerIds,
  valid_from: input.validFrom,
  valid_to: input.validTo,
})

function fail(error: { code?: string; message: string }, what: string): never {
  if (MISSING_SCHEMA.has(error.code ?? '')) throw new PromotionsNotConfiguredError()
  throw new DatabaseError(what, error)
}

export class PromotionService {
  /** Every promotion of the workspace; `activeOnly` for pricing a line. */
  async list(
    ctx: TenancyContext,
    options: { activeOnly?: boolean } = {},
  ): Promise<SavedPromotion[]> {
    const { data, error } = await selectAllPages<PromotionRow, { message: string; code?: string }>(
      (from, to) => {
        let query = supabase.from('promotions').select(COLUMNS).eq('workspace_id', ctx.workspaceId)
        if (options.activeOnly) query = query.eq('is_active', true)
        return query
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)
      },
    )
    if (error) fail(error, 'Failed to read promotions')
    return (data ?? []).map(toSaved)
  }

  async create(ctx: TenancyContext, raw: unknown): Promise<SavedPromotion> {
    const input = promotionInputSchema.parse(raw)
    await this.assertOwned(ctx, input)
    const { data, error } = await supabase
      .from('promotions')
      .insert({ ...toRow(input), workspace_id: ctx.workspaceId, created_by: ctx.userId })
      .select(COLUMNS)
      .single()
    if (error) fail(error, 'Failed to save the promotion')
    return toSaved(data as PromotionRow)
  }

  /** Retire or bring back. Never a delete. */
  async setActive(ctx: TenancyContext, id: string, isActive: boolean): Promise<SavedPromotion> {
    const { data, error } = await supabase
      .from('promotions')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle()
    if (error) fail(error, 'Failed to update the promotion')
    if (!data) throw new NotFoundError('Promotion')
    return toSaved(data as PromotionRow)
  }

  /**
   * What one sale line would cost today: the price on the customer's price list
   * when one applies (else the product's own sell price), less the promotions
   * that are live, cover it, and can be applied in `currency`.
   */
  async quote(
    ctx: TenancyContext,
    input: { productId: string; customerId: string | null; quantity: number; currency: string },
  ): Promise<PriceQuote & { currency: string }> {
    const { data: product, error } = await supabase
      .from('products')
      .select('id, sell_price')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', input.productId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read the product', error)
    if (!product) throw new NotFoundError('Product')

    const promotions = promotionsFor(await this.list(ctx, { activeOnly: true }), input.currency)
    const today = new Date().toISOString().slice(0, 10)
    const onList = priceListPricing(
      await this.customerPriceList(ctx, input.customerId),
      input.productId,
      input.currency,
      today,
    )
    const quote = quotePrice(
      {
        productId: input.productId,
        kind: 'sale',
        customerId: input.customerId,
        priceListId: onList.priceListId,
        quantity: input.quantity,
      },
      // No floor is passed: the shop has configured none, and absent means none.
      {
        productId: input.productId,
        baseUnitPrice: Number((product as { sell_price: unknown }).sell_price),
        listPrices: onList.listPrices,
      },
      promotions,
      today,
    )
    return { ...quote, currency: input.currency }
  }

  /**
   * The list the customer buys on. A walk-in has none, and before the price-list
   * migration nobody has one — both are «no list», which is true. Any other
   * failure is a failure: a quote is not made on a list that could not be read.
   */
  private async customerPriceList(ctx: TenancyContext, customerId: string | null) {
    if (!customerId) return null
    try {
      return await priceListService.forCustomer(ctx, customerId)
    } catch (error) {
      if (error instanceof PriceListsNotConfiguredError) return null
      throw error
    }
  }

  /** Every product and customer a promotion names must belong to this workspace. */
  private async assertOwned(ctx: TenancyContext, input: PromotionInput) {
    const check = async (table: 'products' | 'customers', ids: string[] | null, code: string) => {
      if (!ids) return
      const unique = [...new Set(ids)]
      let found = 0
      const CHUNK = 200
      for (let index = 0; index < unique.length; index += CHUNK) {
        const { data, error } = await supabase
          .from(table)
          .select('id')
          .eq('workspace_id', ctx.workspaceId)
          .in('id', unique.slice(index, index + CHUNK))
        if (error) throw new DatabaseError(`Failed to check ${table}`, error)
        found += (data ?? []).length
      }
      if (found !== unique.length) throw new ValidationError(code)
    }
    await check('products', input.productIds, 'PROMOTION_PRODUCT_NOT_FOUND')
    await check('customers', input.customerIds, 'PROMOTION_CUSTOMER_NOT_FOUND')
  }
}

export const promotionService = new PromotionService()
