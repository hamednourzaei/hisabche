// ============================================
// The evidence chain behind a profit figure.
//
// The one property that matters most: the explanation can never disagree
// with the number it explains. Its totals must equal invoiceMargins() — the
// till's margin and the profit report's formula — for every shape of invoice.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  explainInvoiceProfit,
  productJourney,
  type EvidenceConsumption,
} from '../services/accounting/evidence.domain'
import { invoiceMargins, type ProfitLine } from '../services/accounting/profit-report.domain'

const invoice = { id: 'inv1', currency: 'AFN', subtotal: 1000, discountTotal: 100 }
const lines: ProfitLine[] = [
  { invoiceId: 'inv1', productId: 'tea', productName: 'چای', quantity: 2, totalPrice: 600 },
  { invoiceId: 'inv1', productId: 'rice', productName: 'برنج', quantity: 1, totalPrice: 400 },
]
const layer = (sourceType: string, unitCost: number) => ({
  sourceType,
  sourceId: 'doc-1',
  unitCost,
  entryDate: '2026-09-01',
})
const consumptions: EvidenceConsumption[] = [
  {
    invoiceId: 'inv1',
    productId: 'tea',
    quantity: 2,
    unitCost: 150,
    amount: 300,
    isEstimated: false,
    layer: layer('purchase', 150),
  },
  {
    invoiceId: 'inv1',
    productId: 'rice',
    quantity: 1,
    unitCost: 250,
    amount: 250,
    isEstimated: false,
    layer: layer('opening', 250),
  },
]

describe('explaining an invoice’s profit', () => {
  const evidence = explainInvoiceProfit({
    invoice,
    lines,
    consumptions,
    ledger: [{ id: 'je1', entryNumber: 'JE-1', status: 'posted' }],
    payments: [{ paymentId: 'p1', amount: 500 }],
  })

  it('its totals are the till’s and the report’s — to the cent', () => {
    const margin = invoiceMargins([invoice], lines, consumptions).get('inv1')!
    expect(evidence.netSales).toBe(margin.revenue)
    expect(evidence.cost).toBe(margin.cost)
    expect(evidence.marginPercent).toBe(margin.marginPercent)
  })

  it('walks gross → discount → net → cost → profit', () => {
    expect(evidence).toMatchObject({
      grossSales: 1000,
      discount: 100,
      netSales: 900,
      cost: 550,
      grossProfit: 350,
    })
  })

  it('shares the invoice discount across lines by value, and the lines add up', () => {
    const tea = evidence.lines.find((l) => l.productId === 'tea')!
    expect(tea.netRevenue).toBe(540)
    expect(evidence.lines.reduce((s, l) => s + l.netRevenue, 0)).toBe(evidence.netSales)
    expect(evidence.lines.reduce((s, l) => s + l.cost, 0)).toBe(evidence.cost)
  })

  it('each cost names the layer and the document it came from', () => {
    const rice = evidence.lines.find((l) => l.productId === 'rice')!
    expect(rice.sources).toEqual([
      { quantity: 1, unitCost: 250, amount: 250, isEstimated: false, layer: layer('opening', 250) },
    ])
  })

  it('carries the ledger entry and the posted payments', () => {
    expect(evidence.ledger).toEqual([{ id: 'je1', entryNumber: 'JE-1', status: 'posted' }])
    expect(evidence.paidTotal).toBe(500)
    expect(evidence.warnings).toEqual([])
  })

  it('says so when a cost is missing or estimated, or nothing was posted', () => {
    const shaky = explainInvoiceProfit({
      invoice,
      lines,
      consumptions: [{ ...consumptions[0]!, isEstimated: true, layer: null }],
      ledger: [],
      payments: [],
    })
    expect(shaky.warnings.sort()).toEqual(['COST_ESTIMATED', 'COST_MISSING', 'NOT_POSTED'])
    // …and still agrees with the till.
    const margin = invoiceMargins([invoice], lines, [
      { ...consumptions[0]!, isEstimated: true },
    ]).get('inv1')!
    expect(shaky.cost).toBe(margin.cost)
  })

  it('a product on two lines shares one cost pool by quantity', () => {
    const split = explainInvoiceProfit({
      invoice: { id: 'inv1', currency: 'AFN', subtotal: 0, discountTotal: 0 },
      lines: [
        { invoiceId: 'inv1', productId: 'tea', productName: 'چای', quantity: 1, totalPrice: 300 },
        { invoiceId: 'inv1', productId: 'tea', productName: 'چای', quantity: 3, totalPrice: 900 },
      ],
      consumptions: [{ ...consumptions[0]!, quantity: 4, amount: 400 }],
      ledger: [],
      payments: [],
    })
    expect(split.lines.map((l) => l.cost)).toEqual([100, 300])
  })
})

describe('a product’s money journey', () => {
  it('bought, sold and on hand add up; other currencies are not mixed in', () => {
    const journey = productJourney({
      productId: 'tea',
      currency: 'AFN',
      layers: [
        {
          sourceType: 'purchase',
          receivedQty: 10,
          remainingQty: 4,
          unitCost: 100,
          currency: 'AFN',
        },
        { sourceType: 'opening', receivedQty: 5, remainingQty: 5, unitCost: 90, currency: 'AFN' },
        { sourceType: 'purchase', receivedQty: 99, remainingQty: 99, unitCost: 1, currency: 'USD' },
      ],
      consumptions: [
        { consumerType: 'invoice', quantity: 6, amount: 600 },
        { consumerType: 'adjustment', quantity: 0, amount: 0 },
      ],
      revenue: 900,
      profit: 300,
    })
    expect(journey.bought).toMatchObject({ quantity: 15, amount: 1450 })
    expect(journey.onHand).toEqual({ quantity: 9, value: 850 })
    expect(journey.sold).toMatchObject({ quantity: 6, cost: 600 })
    // What left + what remains = what came in, at cost.
    expect(journey.sold.cost + journey.onHand.value).toBe(journey.bought.amount)
    expect(journey.profit).toBe(300)
  })
})

describe('wiring', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const read = (...p: string[]) => strip(readFileSync(join(__dirname, '..', ...p), 'utf8'))

  it('the evidence totals come from buildProfitReport — one formula', () => {
    expect(read('services', 'accounting', 'evidence.domain.ts')).toContain(
      'const report = buildProfitReport({',
    )
  })

  it('both routes need report.financial.read, like every profit figure', () => {
    const routes = read('routes', 'accounting.routes.ts')
    for (const path of ["'/evidence/invoices/:id'", "'/evidence/products/:id'"]) {
      const at = routes.indexOf(path)
      expect(at).toBeGreaterThan(0)
      expect(routes.slice(at, at + 300)).toContain("requireCapability('report.financial.read')")
    }
  })

  it('only posted payments count as settling the invoice', () => {
    const repo = read('services', 'accounting', 'accounting.repository.ts')
    const at = repo.indexOf('async invoiceEvidenceSources')
    expect(repo.slice(at, at + 4000)).toContain(".eq('status', 'posted')")
  })
})
