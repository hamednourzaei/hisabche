// ============================================
// POST /api/invoices with Idempotency-Key: a replayed request returns the
// invoice it already created and writes nothing else.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Result = { data: unknown; error: { code: string; message?: string } | null }
const calls: Array<{ table: string; op: string }> = []
let lookup: Result = { data: null, error: null }
let insert: Result = { data: null, error: null }
let lookupAfterConflict: Result = { data: null, error: null }
let lookups = 0

vi.mock('../db', () => {
  const builder = (table: string) => {
    let op = 'select'
    const q: any = {
      select: () => q,
      insert: () => ((op = 'insert'), calls.push({ table, op }), q),
      update: () => ((op = 'update'), calls.push({ table, op }), q),
      eq: () => q,
      in: () => q,
      is: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: async () => {
        calls.push({ table, op: 'lookup' })
        lookups++
        return lookups === 1 ? lookup : lookupAfterConflict
      },
      single: async () => (op === 'insert' ? insert : { data: null, error: null }),
      then: (r: (v: Result) => unknown) => r({ data: [], error: null }),
    }
    return q
  }
  const supabase = {
    from: (table: string) => builder(table),
    rpc: async (name: string) => (
      calls.push({ table: `rpc:${name}`, op: 'rpc' }),
      { data: 'INV-000001', error: null }
    ),
  }
  return { supabase, default: supabase }
})

const ctx = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  role: 'owner',
} as any
const draft = {
  type: 'sale',
  items: [{ productId: null, productName: 'x', quantity: 1, unitPrice: 100, totalPrice: 100 }],
} as any
const EXISTING = {
  id: '33333333-3333-4333-8333-333333333333',
  invoice_number: 'INV-000051',
  total: 100,
}

beforeEach(() => {
  calls.length = 0
  lookups = 0
  lookup = { data: null, error: null }
  insert = { data: null, error: null }
  lookupAfterConflict = { data: null, error: null }
})

describe('InvoiceService.create with a client request id', () => {
  it('a replay returns the existing invoice and writes nothing — no number, no insert', async () => {
    const { InvoiceService } = await import('../services/invoice.service')
    lookup = { data: EXISTING, error: null }
    const out = await new InvoiceService().create(ctx, draft, null, {
      clientRequestId: 'inv_abc_12345678',
    })
    expect(out).toMatchObject({ ...EXISTING, idempotentReplay: true })
    expect(calls.filter((c) => c.op === 'insert' || c.op === 'update' || c.op === 'rpc')).toEqual(
      [],
    )
  })

  it('a concurrent duplicate (23505) answers with the winner before any item/stock write', async () => {
    const { InvoiceService } = await import('../services/invoice.service')
    insert = { data: null, error: { code: '23505' } }
    lookupAfterConflict = { data: EXISTING, error: null }
    const out = await new InvoiceService().create(ctx, draft, null, {
      clientRequestId: 'inv_abc_12345678',
    })
    expect(out).toMatchObject({ id: EXISTING.id, idempotentReplay: true })
    const writes = calls.filter((c) => c.op === 'insert' || c.op === 'update')
    expect(writes).toEqual([{ table: 'invoices', op: 'insert' }])
  })

  it('without the migration a keyed request is refused (never an unkeyed copy)', async () => {
    const { InvoiceService } = await import('../services/invoice.service')
    const { IdempotencyUnavailableError } = await import('../utils/client-request')
    lookup = { data: null, error: { code: '42703' } }
    await expect(
      new InvoiceService().create(ctx, draft, null, { clientRequestId: 'inv_abc_12345678' }),
    ).rejects.toBeInstanceOf(IdempotencyUnavailableError)
    expect(calls.filter((c) => c.op === 'insert')).toEqual([])
  })
})

describe('route contract', () => {
  const src = readFileSync(join(__dirname, '../routes/invoice.routes.ts'), 'utf8').replace(
    /\/\/.*$/gm,
    '',
  )
  it('reads Idempotency-Key and passes it to the service', () => {
    expect(src).toContain('readClientRequestId(request)')
    expect(src).toContain('clientRequestId,')
  })
  it('a replay answers 200 with a marker; migration missing answers 503 (retryable)', () => {
    expect(src).toContain('sendCreated(reply, invoice)')
    expect(src).toContain('reply.code(503)')
  })
})
