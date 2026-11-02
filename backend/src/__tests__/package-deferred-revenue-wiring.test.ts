// ============================================
// backend/src/__tests__/package-deferred-revenue-wiring.test.ts
//
// M5 - the server side of deferred revenue: what the GRANT remembers, what the sale credits, and what may not be undone.
// The rules themselves are tested in packages/validation (golden vectors) and on real SQL (the PGlite scenarios of
// backend/src/__tests__/helpers/package-deferred-revenue-01-scenarios.ts); this file proves the service hands them
// the right numbers.
// ============================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { InvoiceService } from '../services/invoice.service'
import type { TenancyContext } from '../services/tenancy.service'

const ctx: TenancyContext = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  role: 'owner',
}
const PACKAGE = '55555555-5555-4555-8555-555555555555'
const GOODS = '66666666-6666-4666-8666-666666666666'

type Service = {
  buildPackageGrantRows: (...args: unknown[]) => Promise<Array<Record<string, unknown>>>
  findPackageProductIds: (...args: unknown[]) => Promise<Set<string>>
  findPackageTerms: (...args: unknown[]) => Promise<Map<string, number | null>>
  assertPackageInvoiceUnused: (ctx: TenancyContext, invoiceId: string) => Promise<void>
}

/** A supabase-js query builder that answers every chain with the queued result. */
function queryStub(results: Array<{ data: unknown; error: unknown }>) {
  let call = 0
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'in', 'is', 'gte', 'order']) {
    builder[method] = () => builder
  }
  builder.then = (resolve: (value: unknown) => void) =>
    resolve(results[Math.min(call++, results.length - 1)])
  return builder
}

afterEach(() => {
  delete process.env.PACKAGE_DEFERRED_REVENUE
  vi.restoreAllMocks()
})

describe('M5 GRANT rows carry their own deferred amount and term', () => {
  const itemRows = [
    { id: 'line-goods', product_id: GOODS, quantity: 2, unit: 'piece' },
    { id: 'line-package', product_id: PACKAGE, quantity: 10, unit: 'session' },
  ]
  const lines = [{ totalPrice: 40 }, { totalPrice: 10000 }]

  function service(): Service {
    const s = new InvoiceService() as unknown as Service
    vi.spyOn(s, 'findPackageProductIds').mockResolvedValue(new Set([PACKAGE]))
    vi.spyOn(s, 'findPackageTerms').mockResolvedValue(new Map([[PACKAGE, 6]]))
    return s
  }

  it('deferral ON: the package line records its net books-currency amount and the 6-month term', async () => {
    process.env.PACKAGE_DEFERRED_REVENUE = 'on'
    const rows = await service().buildPackageGrantRows(
      ctx,
      'inv-1',
      'cust-1',
      lines,
      itemRows,
      '2026-11-02',
      1.5,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      source_line_id: 'line-package',
      quantity: 10,
      deferred_amount: 15000, // 10 000 at the invoice's frozen rate 1.5
      term_months: 6,
      idempotency_key: 'invoice:inv-1:line-package',
    })
  })

  it('deferral OFF (the default): the row is exactly what it was before M5 - no new column is named', async () => {
    const rows = await service().buildPackageGrantRows(
      ctx,
      'inv-1',
      'cust-1',
      lines,
      itemRows,
      '2026-11-02',
      1.5,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).not.toHaveProperty('deferred_amount')
    expect(rows[0]).not.toHaveProperty('term_months')
  })

  it('goods lines never get a GRANT', async () => {
    process.env.PACKAGE_DEFERRED_REVENUE = 'on'
    const rows = await service().buildPackageGrantRows(
      ctx,
      'inv-1',
      'cust-1',
      lines,
      itemRows,
      '2026-11-02',
    )
    expect(rows.map((r) => r.source_line_id)).toEqual(['line-package'])
  })
})

describe('M5 a used package invoice cannot be undone (fail closed)', () => {
  async function run(consumption: Array<{ entry_type: string; quantity: number }>) {
    const { supabase } = await import('../db')
    const original = supabase.from
    const answers = [
      {
        data: [{ customer_id: 'c', package_product_id: 'p', effective_date: '2026-10-01' }],
        error: null,
      },
      { data: consumption, error: null },
    ]
    let call = 0
    supabase.from = (() => queryStub([answers[Math.min(call++, 1)]!])) as never
    try {
      const s = new InvoiceService() as unknown as Service
      await s.assertPackageInvoiceUnused(ctx, 'inv-1')
    } finally {
      supabase.from = original
    }
  }

  it('refuses when a session consumed credit', async () => {
    await expect(run([{ entry_type: 'CONSUME', quantity: 1 }])).rejects.toThrow(
      'PACKAGE_INVOICE_PARTLY_CONSUMED',
    )
  })

  it('allows it when every consumption was reversed (a cancelled session)', async () => {
    await expect(
      run([
        { entry_type: 'CONSUME', quantity: 1 },
        { entry_type: 'REVERSAL', quantity: 1 },
      ]),
    ).resolves.toBeUndefined()
  })

  it('allows it when nothing was consumed', async () => {
    await expect(run([])).resolves.toBeUndefined()
  })
})

describe('M5 a consume the allocation trigger refuses is a 409 with ITS OWN code', () => {
  async function consumeRefusedWith(message: string) {
    const { supabase } = await import('../db')
    const { PackageCreditsService } =
      await import('../services/package-credits/package-credits.service')
    const original = supabase.rpc
    supabase.rpc = (() =>
      Promise.resolve({ data: null, error: { code: 'P0001', message } })) as never
    try {
      await new PackageCreditsService().consume(ctx, {
        customerId: 'c',
        packageProductId: 'p',
        quantity: 1,
      } as never)
    } finally {
      supabase.rpc = original
    }
  }

  for (const code of [
    'INSUFFICIENT_ELIGIBLE_PACKAGE_CREDIT',
    'PACKAGE_INVOICE_NOT_BOOKED',
    'DEFERRED_REVENUE_ACCOUNT_MISSING',
    'ACCOUNTING_PERIOD_LOCKED',
  ]) {
    it(`${code} is reported as itself, not as «not enough credit»`, async () => {
      const failure = await consumeRefusedWith(`${code}: detail`).then(
        () => null,
        (error: Error & { statusCode?: number }) => error,
      )
      expect(failure?.message).toBe(code)
      expect(failure?.statusCode).toBe(409)
    })
  }
})
