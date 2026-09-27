// Activity feed summaries (production log, 27 Sep 2026): /api/v1/activities took
// 4.6 s — one query per activity group — and every payment logged «Payment not
// found» because payments were read from `transactions`, not `payments`.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({
  tables: [] as string[],
  rows: {} as Record<string, Array<Record<string, unknown>>>,
}))

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => {
      calls.tables.push(table)
      const ids: unknown[] = []
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: (_c: string, values: unknown[]) => {
          ids.push(...values)
          return Promise.resolve({
            data: (calls.rows[table] ?? []).filter((r) => ids.includes(r.id)),
            error: null,
          })
        },
      }
      return chain
    },
  },
}))
vi.mock('../utils/pagination', () => ({
  memoryCache: { get: vi.fn(), set: vi.fn(), invalidate: vi.fn() },
}))

const { ActivityService } = await import('../services/activity.service')
const service = new ActivityService()
const WS = 'ws-1'

beforeEach(() => {
  calls.tables = []
  calls.rows = {
    payments: [{ id: 'pay-1', amount: 500, currency: 'AFN', reference: 'RCPT-9', notes: 'نقد' }],
    invoices: Array.from({ length: 20 }, (_, i) => ({
      id: `inv-${i}`,
      invoice_number: `${i}`,
      total: 10,
      currency: 'AFN',
      status: 'paid',
      type: 'sale',
      customer: null,
    })),
  }
})

describe('activity summaries', () => {
  it('thirty groups cost one query per type, not one per group', async () => {
    const pairs: Array<[string, string]> = [
      ...Array.from({ length: 20 }, (_, i) => ['invoice', `inv-${i}`] as [string, string]),
      ...Array.from(
        { length: 10 },
        (_, i) => ['payment', i === 0 ? 'pay-1' : `pay-gone-${i}`] as [string, string],
      ),
    ]
    const out = await service['getEntitySummaries'](WS, pairs)
    expect(calls.tables.sort()).toEqual(['invoices', 'payments'])
    expect(out.get('invoice:inv-3')).toMatchObject({ label: 'INV-3', amount: 10 })
  })

  it('⚠️ a payment is read from `payments` (it used to be `transactions`)', async () => {
    const summary = await service.getEntitySummary('payment', 'pay-1', WS)
    expect(calls.tables).toEqual(['payments'])
    expect(summary).toMatchObject({ label: 'RCPT-9', amount: 500, subtitle: 'نقد' })
  })

  it('a deleted document is simply absent — no warning per row', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const out = await service['getEntitySummaries'](WS, [['payment', 'pay-gone']])
    expect(out.get('payment:pay-gone')).toBeNull()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
