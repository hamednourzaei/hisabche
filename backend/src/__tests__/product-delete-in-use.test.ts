// BUG-001 — a product with sales or stock history must not be deletable, and a
// failed "is it in use?" read must never count as "not in use".
// invoice_items.product_id and stock_movements.product_id carry NO foreign key
// (docs/base-schema-migration.sql), so this check is the only guard there is.
import { beforeEach, describe, expect, it, vi } from 'vitest'

type R = { data?: unknown; count?: number | null; error: { code: string; message: string } | null }
let usage: Record<string, R> = {}
const deletes: string[] = []

vi.mock('../db', () => {
  const builder = (table: string) => {
    let op = 'select'
    const q: any = {
      select: () => q,
      delete: () => ((op = 'delete'), q),
      eq: () => q,
      limit: () => q,
      maybeSingle: async () =>
        table === 'products'
          ? { data: { id: 'p1' }, error: null }
          : (usage[table] ?? { data: null, error: null }),
      then: (resolve: (v: R) => unknown) => {
        if (op === 'delete') {
          deletes.push(table)
          return resolve({ error: null })
        }
        return resolve(usage[table] ?? { count: 0, data: null, error: null })
      },
    }
    return q
  }
  const supabase = { from: (t: string) => builder(t) }
  return { supabase, default: supabase }
})
vi.mock('../services/authorization/scope.service', () => ({
  scopes: { assertMay: async () => undefined },
}))

const ctx = { workspaceId: 'ws', userId: 'u', role: 'owner' } as any

beforeEach(() => {
  usage = {}
  deletes.length = 0
})

describe('ProductService.delete', () => {
  it('⚠️ a FAILED usage read refuses the delete (was: null count → deleted)', async () => {
    const { ProductService } = await import('../services/product.service')
    usage.invoice_items = { data: null, count: null, error: { code: '57014', message: 'timeout' } }
    await expect(new ProductService().delete('p1', ctx)).rejects.toThrow()
    expect(deletes).toEqual([])
  })

  it('a product with sales is refused as a conflict, not a 500', async () => {
    const { ProductService } = await import('../services/product.service')
    const { ConflictError } = await import('../errors/database.error')
    usage.invoice_items = { data: { id: 'line-1' }, count: 1, error: null }
    await expect(new ProductService().delete('p1', ctx)).rejects.toBeInstanceOf(ConflictError)
    expect(deletes).toEqual([])
  })

  it('a product with stock history is refused', async () => {
    const { ProductService } = await import('../services/product.service')
    usage.stock_movements = { data: { id: 'm-1' }, count: 1, error: null }
    await expect(new ProductService().delete('p1', ctx)).rejects.toThrow()
    expect(deletes).toEqual([])
  })

  it('an unused product is deleted', async () => {
    const { ProductService } = await import('../services/product.service')
    await new ProductService().delete('p1', ctx)
    expect(deletes).toEqual(['products'])
  })
})
