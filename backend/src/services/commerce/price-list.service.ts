// ============================================
// backend/src/services/commerce/price-list.service.ts
//
// Capability #19 — price lists.
//
// A price list is a named set of product prices in one currency; a customer
// can be put on one. It changes the price a product is SUGGESTED at when it is
// picked on a sale invoice — through the shared engine (`quotePrice`), which
// takes it as the base price before promotions.
//
// ⚠️ ONE READER OF «WHAT LIST IS THIS CUSTOMER ON»: `forCustomer`. The quote
// (promotion.service) and the invoice builder (GET …/for-customer/:id) both get
// the list from it, and both decide whether it applies with `priceListApplies`.
//
// ⚠️ NOTHING HERE REWRITES AN INVOICE. A line keeps the unit price it was
// issued with; changing a list changes what the next line is suggested at.
//
// ⚠️ A LIST AND A PRICE ARE RETIRED, NEVER DELETED (`is_active = false`).
//
// ⚠️ ONE RULE, TWO RUNTIMES. The shape of a saved list, the detail, the
// hundredths conversion and the change set of `setItems` are
// `@hisabche/validation` (price-list-view) — the device builds the same
// answers from its own rows. This file reads and writes Postgres.
// ============================================

import {
  buildCustomerPriceList,
  buildPriceListDetail,
  planPriceListChanges,
  priceListInputSchema,
  priceListItemsSchema,
  toSavedPriceList as toSaved,
  type CustomerPriceList,
  type PriceListDetail,
  type PriceListItemRow as ItemRow,
  type PriceListRow as ListRow,
  type SavedPriceList,
} from '@hisabche/validation'

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import type { TenancyContext } from '../tenancy.service'

export type { PriceListDetail }

const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])
const COLUMNS = 'id, name, currency, valid_from, valid_to, is_active, created_at'
const CHUNK = 200

export class PriceListsNotConfiguredError extends BaseError {
  constructor() {
    super('PRICE_LISTS_MIGRATION_PENDING', 503)
    this.name = 'PriceListsNotConfiguredError'
  }
}

type DbError = { code?: string; message: string }

function fail(error: DbError, what: string): never {
  if (MISSING_SCHEMA.has(error.code ?? '')) throw new PriceListsNotConfiguredError()
  // The one-active-list-per-name index.
  if (error.code === '23505') throw new ValidationError('PRICE_LIST_NAME_TAKEN')
  throw new DatabaseError(what, error)
}

export class PriceListService {
  async list(ctx: TenancyContext): Promise<SavedPriceList[]> {
    const lists = await selectAllPages<ListRow, DbError>((from, to) =>
      supabase
        .from('price_lists')
        .select(COLUMNS)
        .eq('workspace_id', ctx.workspaceId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to),
    )
    if (lists.error) fail(lists.error, 'Failed to read price lists')

    const items = await this.activeItems(ctx, null)
    const customers = await this.customersOnLists(ctx, null)
    const count = (rows: readonly { price_list_id: string | null }[], id: string) =>
      rows.filter((row) => row.price_list_id === id).length

    return (lists.data ?? []).map((row) =>
      toSaved(row, count(items, row.id), count(customers, row.id)),
    )
  }

  async create(ctx: TenancyContext, raw: unknown): Promise<SavedPriceList> {
    const input = priceListInputSchema.parse(raw)
    const { data, error } = await supabase
      .from('price_lists')
      .insert({
        workspace_id: ctx.workspaceId,
        created_by: ctx.userId,
        name: input.name,
        currency: input.currency.toUpperCase(),
        valid_from: input.validFrom,
        valid_to: input.validTo,
      })
      .select(COLUMNS)
      .single()
    if (error) fail(error, 'Failed to save the price list')
    return toSaved(data as ListRow, 0, 0)
  }

  /** Retire or bring back. Never a delete. */
  async setActive(ctx: TenancyContext, id: string, isActive: boolean): Promise<SavedPriceList> {
    const { data, error } = await supabase
      .from('price_lists')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle()
    if (error) fail(error, 'Failed to update the price list')
    if (!data) throw new NotFoundError('Price list')
    const [items, customers] = [
      await this.activeItems(ctx, id),
      await this.customersOnLists(ctx, id),
    ]
    return toSaved(data as ListRow, items.length, customers.length)
  }

  /** The list, every product priced on it (beside its own price), and who buys on it. */
  async detail(ctx: TenancyContext, id: string): Promise<PriceListDetail> {
    const list = await this.row(ctx, id)
    const items = await this.activeItems(ctx, id)
    const customers = await this.customersOnLists(ctx, id)

    const products = new Map<string, { name: string; unit: string | null; sell_price: unknown }>()
    const ids = items.map((item) => item.product_id)
    for (let index = 0; index < ids.length; index += CHUNK) {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, unit, sell_price')
        .eq('workspace_id', ctx.workspaceId)
        .in('id', ids.slice(index, index + CHUNK))
      if (error) throw new DatabaseError('Failed to read the products', error)
      for (const product of data ?? []) {
        products.set(String(product.id), {
          name: String(product.name ?? ''),
          unit: (product.unit as string | null) ?? null,
          sell_price: product.sell_price,
        })
      }
    }

    return buildPriceListDetail({ list, items, products, customers })
  }

  /**
   * Set or remove prices. `unitPrice: null` takes a product off the list (the
   * row is kept, retired). One statement: the whole change lands or none of it.
   */
  async setItems(ctx: TenancyContext, id: string, raw: unknown): Promise<PriceListDetail> {
    const { items } = priceListItemsSchema.parse(raw)
    await this.row(ctx, id)

    const ids = [...new Set(items.map((item) => item.productId))]
    if (ids.length !== items.length) throw new ValidationError('PRICE_LIST_PRODUCT_TWICE')

    let owned = 0
    for (let index = 0; index < ids.length; index += CHUNK) {
      const { data, error } = await supabase
        .from('products')
        .select('id')
        .eq('workspace_id', ctx.workspaceId)
        .in('id', ids.slice(index, index + CHUNK))
      if (error) throw new DatabaseError('Failed to check the products', error)
      owned += (data ?? []).length
    }
    if (owned !== ids.length) throw new ValidationError('PRICE_LIST_PRODUCT_NOT_FOUND')

    const existing = new Map(
      (await this.items(ctx, id)).map((item) => [item.product_id, Number(item.unit_price_minor)]),
    )
    const change = planPriceListChanges(items, existing)
    if ('refusal' in change) throw new ValidationError(change.refusal)

    const now = new Date().toISOString()
    if (change.rows.length > 0) {
      const { error } = await supabase.from('price_list_items').upsert(
        change.rows.map((row) => ({
          ...row,
          price_list_id: id,
          workspace_id: ctx.workspaceId,
          updated_by: ctx.userId,
          updated_at: now,
        })),
        { onConflict: 'price_list_id,product_id' },
      )
      if (error) fail(error, 'Failed to save the prices')
    }
    return this.detail(ctx, id)
  }

  /** Put a customer on a list, or (`null`) on none. */
  async assignCustomer(
    ctx: TenancyContext,
    customerId: string,
    priceListId: string | null,
  ): Promise<{ customerId: string; priceListId: string | null }> {
    if (priceListId) {
      const list = await this.row(ctx, priceListId)
      if (!list.is_active) throw new ValidationError('PRICE_LIST_RETIRED')
    }
    const { data, error } = await supabase
      .from('customers')
      .update({ price_list_id: priceListId })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', customerId)
      .select('id')
      .maybeSingle()
    if (error) fail(error, 'Failed to set the customer price list')
    if (!data) throw new NotFoundError('Customer')
    return { customerId, priceListId }
  }

  /**
   * The list a customer is on, with its prices — or null when they are on none.
   * Whether it APPLIES to a given invoice is `priceListApplies`' decision, made
   * by the caller with the invoice's currency and day.
   */
  async forCustomer(ctx: TenancyContext, customerId: string): Promise<CustomerPriceList | null> {
    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, price_list_id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', customerId)
      .maybeSingle()
    if (error) fail(error, 'Failed to read the customer')
    if (!customer) throw new NotFoundError('Customer')
    const listId = (customer as { price_list_id: string | null }).price_list_id
    if (!listId) return null

    return buildCustomerPriceList(await this.row(ctx, listId), await this.activeItems(ctx, listId))
  }

  private async row(ctx: TenancyContext, id: string): Promise<ListRow> {
    const { data, error } = await supabase
      .from('price_lists')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .maybeSingle()
    if (error) fail(error, 'Failed to read the price list')
    if (!data) throw new NotFoundError('Price list')
    return data as ListRow
  }

  /** Every item row of one list, retired ones included. */
  private async items(ctx: TenancyContext, listId: string): Promise<ItemRow[]> {
    const { data, error } = await selectAllPages<ItemRow, DbError>((from, to) =>
      supabase
        .from('price_list_items')
        .select('price_list_id, product_id, unit_price_minor, is_active')
        .eq('workspace_id', ctx.workspaceId)
        .eq('price_list_id', listId)
        .order('product_id', { ascending: true })
        .range(from, to),
    )
    if (error) fail(error, 'Failed to read the prices')
    return data ?? []
  }

  /** Live prices of one list, or (`null`) of every list of the workspace. */
  private async activeItems(ctx: TenancyContext, listId: string | null): Promise<ItemRow[]> {
    const { data, error } = await selectAllPages<ItemRow, DbError>((from, to) => {
      let query = supabase
        .from('price_list_items')
        .select('price_list_id, product_id, unit_price_minor, is_active')
        .eq('workspace_id', ctx.workspaceId)
        .eq('is_active', true)
      if (listId) query = query.eq('price_list_id', listId)
      return query
        .order('price_list_id', { ascending: true })
        .order('product_id', { ascending: true })
        .range(from, to)
    })
    if (error) fail(error, 'Failed to read the prices')
    return data ?? []
  }

  /** Customers on one list, or (`null`) on any list. */
  private async customersOnLists(ctx: TenancyContext, listId: string | null) {
    type Row = { id: string; full_name: string; price_list_id: string | null }
    const { data, error } = await selectAllPages<Row, DbError>((from, to) => {
      let query = supabase
        .from('customers')
        .select('id, full_name, price_list_id')
        .eq('workspace_id', ctx.workspaceId)
      query = listId ? query.eq('price_list_id', listId) : query.not('price_list_id', 'is', null)
      return query.order('id', { ascending: true }).range(from, to)
    })
    if (error) fail(error, 'Failed to read the customers of the price list')
    return data ?? []
  }
}

export const priceListService = new PriceListService()
