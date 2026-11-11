import { describe, expect, it } from 'vitest'
import {
  buildCostObjectProfitReport,
  type CostObjectInvoiceInput,
} from '../services/accounting/profit-report.domain'

describe('V60 Slice 8: profit-by-cost-object across currencies & unknown cost', () => {
  it('computes per-currency cost-object profit via the ONE formula, keeps unknown cost as null, and refuses invented overhead', () => {
    const invoices: CostObjectInvoiceInput[] = [
      {
        id: 'inv-proj-afn',
        currency: 'AFN',
        subtotal: 1000,
        discountTotal: 0,
        costObjectId: 'proj-1',
        costObjectType: 'project',
        costObjectLabel: 'Herat Solar Install',
      },
      {
        id: 'inv-wo-afn',
        currency: 'AFN',
        subtotal: 800,
        discountTotal: 0,
        costObjectId: 'wo-1',
        costObjectType: 'work_order',
        costObjectLabel: 'Custom Gate #12',
      },
      {
        id: 'inv-proj-usd',
        currency: 'USD',
        subtotal: 500,
        discountTotal: 50,
        costObjectId: 'proj-1',
        costObjectType: 'project',
        costObjectLabel: 'Herat Solar Install',
      },
    ]

    const lines = [
      {
        invoiceId: 'inv-proj-afn',
        productId: 'p1',
        productName: 'Panel',
        quantity: 2,
        totalPrice: 1000,
      },
      {
        invoiceId: 'inv-wo-afn',
        productId: 'p2',
        productName: 'Steel Frame',
        quantity: 1,
        totalPrice: 800,
      },
      {
        invoiceId: 'inv-proj-usd',
        productId: 'p3',
        productName: 'Inverter',
        quantity: 1,
        totalPrice: 450,
      },
    ]

    // Notice `inv-wo-afn` intentionally has NO consumption -> unknown cost -> profit MUST be null!
    const consumptions = [
      { invoiceId: 'inv-proj-afn', productId: 'p1', amount: 650, isEstimated: false, quantity: 2 },
      { invoiceId: 'inv-proj-usd', productId: 'p3', amount: 300, isEstimated: false, quantity: 1 },
    ]

    const afn = buildCostObjectProfitReport({
      from: '2026-11-01',
      to: '2026-11-30',
      currency: 'AFN',
      invoices,
      lines,
      consumptions,
    })

    expect(afn.overheadPolicyStatus).toBe('not_allocated')
    expect(afn.overheadNotice).toBe('overhead not allocated')

    const projAfn = afn.rows.find((r) => r.costObjectId === 'proj-1')!
    expect(projAfn.revenue).toBe(1000)
    expect(projAfn.cost).toBe(650)
    expect(projAfn.grossProfit).toBe(350)
    expect(projAfn.overheadStatus).toBe('not_allocated')
    expect(projAfn.netProfit).toBe(350)

    const woAfn = afn.rows.find((r) => r.costObjectId === 'wo-1')!
    expect(woAfn.revenue).toBe(800)
    expect(woAfn.costStatus).toBe('unknown')
    expect(woAfn.grossProfit).toBeNull()
    expect(woAfn.netProfit).toBeNull()
    expect(woAfn.marginPercent).toBeNull()

    // Separate currency report never converts or mixes with AFN
    const usd = buildCostObjectProfitReport({
      from: '2026-11-01',
      to: '2026-11-30',
      currency: 'USD',
      invoices,
      lines,
      consumptions,
      overheadPolicy: {
        policyKey: 'equal-split',
        allocatedByCostObjectId: { 'proj-1': 50 },
      },
    })
    expect(usd.overheadPolicyStatus).toBe('allocated')
    expect(usd.rows).toHaveLength(1)
    expect(usd.rows[0]!.revenue).toBe(450)
    expect(usd.rows[0]!.cost).toBe(300)
    expect(usd.rows[0]!.grossProfit).toBe(150)
    expect(usd.rows[0]!.overhead).toBe(50)
    expect(usd.rows[0]!.netProfit).toBe(100)
  })
})
