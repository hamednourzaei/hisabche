// Profit per currency (owner's request, 26 Sep 2026): the business sells in
// AFN, IRT and USD, and the report counted only the onboarding currency.
import { describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({ supabase: {} }))
vi.mock('../utils/pagination', () => ({
  memoryCache: { get: vi.fn(), set: vi.fn(), invalidate: vi.fn() },
}))

const { AccountingService } = await import('../services/accounting/accounting.service')

const sources = {
  invoices: [
    { id: 'a', currency: 'AFN', subtotal: 1000, discountTotal: 0 },
    { id: 'b', currency: 'IRT', subtotal: 500000, discountTotal: 0 },
    { id: 'c', currency: 'USD', subtotal: 50, discountTotal: 0 },
  ],
  lines: [
    { invoiceId: 'a', productId: 'p', productName: 'P', quantity: 1, totalPrice: 1000 },
    { invoiceId: 'b', productId: 'p', productName: 'P', quantity: 1, totalPrice: 500000 },
    { invoiceId: 'c', productId: 'p', productName: 'P', quantity: 1, totalPrice: 50 },
  ],
  consumptions: [],
  payrolls: [{ currency: 'AFN', baseSalary: 200, bonuses: 0, overtimeAmount: 0 }],
}

const repo = { profitSources: vi.fn(async () => sources) }
const service = new AccountingService(repo as never)
const ctx = { workspaceId: 'ws', userId: 'u', role: 'owner' as const }

describe('getProfitReportsByCurrency', () => {
  it('one report per currency present, each counting only its own documents — never summed', async () => {
    const reports = await service.getProfitReportsByCurrency(ctx, '2026-09-01', '2026-09-30', 'AFN')
    expect(reports.map((r) => r.currency)).toEqual(['AFN', 'IRT', 'USD'])
    const byCode = Object.fromEntries(reports.map((r) => [r.currency, r.totals]))
    expect(byCode.AFN).toMatchObject({ revenue: 1000, salaries: 200, invoiceCount: 1 })
    expect(byCode.IRT).toMatchObject({ revenue: 500000, salaries: 0, invoiceCount: 1 })
    expect(byCode.USD).toMatchObject({ revenue: 50, invoiceCount: 1 })
  })

  it('the primary currency is included even with no documents (e.g. grams of gold)', async () => {
    const reports = await service.getProfitReportsByCurrency(ctx, '2026-09-01', '2026-09-30', 'XAU')
    expect(reports[0]).toMatchObject({ currency: 'XAU', totals: { invoiceCount: 0 } })
    expect(reports).toHaveLength(4)
  })

  it('a reversed range is refused', async () => {
    await expect(
      service.getProfitReportsByCurrency(ctx, '2026-09-30', '2026-09-01', 'AFN'),
    ).rejects.toThrow(/PROFIT_REPORT_RANGE_INVALID/)
  })
})
