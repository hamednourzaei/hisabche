// ============================================
// A new invoice line names its variant when the product has them (V53 P2, legacy NULL).
// `assertVariantBindings` is driven with a database that answers what the test says.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

import { InvoiceService } from '../services/invoice.service'

const WS = 'ws-1'
const assertBindings = (lines: Array<Record<string, unknown>>) =>
  (new InvoiceService() as any).assertVariantBindings(WS, lines) as Promise<void>
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

describe('assertVariantBindings', () => {
  it('a plain product (no variants) passes with no variant — historical behaviour', async () => {
    await expect(assertBindings([{ productId: 'p-1' }])).resolves.toBeUndefined()
  })

  it('a free-text line (no product) passes', async () => {
    await expect(assertBindings([{ productId: null }])).resolves.toBeUndefined()
  })

  it('a product with variants refuses the parent alone', async () => {
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

  it('one bad line fails the whole document, before anything is written', async () => {
    variantRows = [variant()]
    await expect(
      assertBindings([{ productId: 'p-1', variantId: 'v-1' }, { productId: 'p-1' }]),
    ).rejects.toThrow('VARIANT_REQUIRED')
  })

  it('a database without the variants table has none to require, but cannot honour a named one', async () => {
    tableError = { code: '42P01' }
    await expect(assertBindings([{ productId: 'p-1' }])).resolves.toBeUndefined()
    await expect(assertBindings([{ productId: 'p-1', variantId: 'v-1' }])).rejects.toThrow(
      'VARIANT_NOT_FOUND',
    )
  })

  it('any other read failure is an error, not "no variants"', async () => {
    tableError = { code: '57014' }
    await expect(assertBindings([{ productId: 'p-1' }])).rejects.toThrow()
  })
})

describe('wiring', () => {
  const flat = (file: string) => readFileSync(join(__dirname, file), 'utf8').split(/\s+/).join(' ')
  const service = flat('../services/invoice.service.ts')
  const route = flat('../routes/invoice.routes.ts')

  it('the check runs before a number is used', () => {
    expect(service.indexOf('await this.assertVariantBindings(')).toBeLessThan(
      service.indexOf('await this.generateInvoiceNumber()'),
    )
  })

  it('the variant is written to the line only when the line has one', () => {
    expect(service).toContain('...(item.variantId ? { variant_id: item.variantId } : {})')
  })

  it('the route maps the field (a hand-written mapping drops anything it does not name)', () => {
    expect(route).toContain('variantId: item.variantId ?? item.variant_id')
  })
})
