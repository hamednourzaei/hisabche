// ============================================
// A purchase line names its variant when the product has them (V55 P2).
// `assertPurchaseVariantBindings` keeps the SAME rule an invoice line keeps;
// this drives it with a database that answers what the test says.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

let variantRows: Array<Record<string, unknown>> = []
let tableError: { code: string } | null = null

vi.mock('../db', () => {
  const q: any = {
    select: () => q,
    eq: () => q,
    in: () => q,
    then: (resolve: (value: unknown) => unknown) =>
      resolve(tableError ? { data: null, error: tableError } : { data: variantRows, error: null }),
  }
  const supabase = { from: () => q, rpc: async () => ({ data: null, error: null }) }
  return { supabase, default: supabase }
})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PurchasingService } from '../services/purchasing.service'

const WS = 'ws-1'
const assertBindings = (lines: Array<Record<string, unknown>>) =>
  (new PurchasingService() as any).assertPurchaseVariantBindings(WS, lines) as Promise<void>
const variant = (over: Record<string, unknown> = {}) => ({
  id: 'v-1',
  workspace_id: WS,
  template_product_id: 'p-1',
  is_active: true,
  ...over,
})

beforeEach(() => {
  variantRows = []
  tableError = null
})

describe('assertPurchaseVariantBindings', () => {
  it('a plain product (no variants) passes with no variant — historical behaviour', async () => {
    await expect(assertBindings([{ productId: 'p-1' }])).resolves.toBeUndefined()
  })

  it('a product with variants refuses the parent alone (never bought twice)', async () => {
    variantRows = [variant()]
    await expect(assertBindings([{ productId: 'p-1' }])).rejects.toThrow('VARIANT_REQUIRED')
  })

  it('the named variant passes', async () => {
    variantRows = [variant()]
    await expect(assertBindings([{ productId: 'p-1', variantId: 'v-1' }])).resolves.toBeUndefined()
  })

  it('a variant belonging to another product is refused', async () => {
    variantRows = [variant(), variant({ id: 'v-2', template_product_id: 'p-2' })]
    await expect(assertBindings([{ productId: 'p-1', variantId: 'v-2' }])).rejects.toThrow(
      'VARIANT_NOT_FOUND',
    )
  })

  it('an inactive variant is refused', async () => {
    variantRows = [variant({ is_active: false })]
    await expect(assertBindings([{ productId: 'p-1', variantId: 'v-1' }])).rejects.toThrow(
      'VARIANT_INACTIVE',
    )
  })

  it('a database without the variants table has none to require, but cannot honour a named one', async () => {
    tableError = { code: '42P01' }
    await expect(assertBindings([{ productId: 'p-1' }])).resolves.toBeUndefined()
    await expect(assertBindings([{ productId: 'p-1', variantId: 'v-1' }])).rejects.toThrow(
      'VARIANT_NOT_FOUND',
    )
  })
})

describe('wiring', () => {
  const flat = (file: string) => readFileSync(join(__dirname, file), 'utf8').split(/\s+/).join(' ')
  const service = flat('../services/purchasing.service.ts')

  it('the check runs before the order is written', () => {
    expect(service.indexOf('await this.assertPurchaseVariantBindings(')).toBeLessThan(
      service.indexOf('await this.writeOrder('),
    )
  })

  it('the variant is written to the line only when the line has one', () => {
    expect(service).toContain('...(item.variantId ? { variant_id: item.variantId } : {})')
  })

  it('the receipt movement carries the variant only when the line has one', () => {
    expect(service).toContain('...(item.variant_id ? { variant_id: item.variant_id } : {})')
  })

  it('the order lines are read back with their variant', () => {
    expect(service).toContain(
      "'id, purchase_order_id, product_id, variant_id, quantity, unit_price, total_price'",
    )
    expect(service).toContain(
      'items:purchase_order_items(id, product_id, variant_id, quantity, unit_price, total_price)',
    )
  })
})
