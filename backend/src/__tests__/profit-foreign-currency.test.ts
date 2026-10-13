// ============================================
// The profit of a sale made in another currency.
//
// What the owner saw (13 Oct 2026): «IRR · 1 فاکتور — قابل محاسبه نیست». The
// sale was in toman, its cost in afghani, and the report — rightly — would not
// subtract one from the other. With the rate frozen on the invoice it can: the
// revenue is restated in the books currency and meets its cost there.
//
// Figures are worked by hand in the comments, so a wrong formula cannot be
// locked in by copying its own output.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildProfitReport, restateAtRates } from '../services/accounting/profit-report.domain'

const period = { from: '2026-10-01', to: '2026-10-13' }

// Fifteen bottles sold for 450,000 toman. One toman = 0.0016 afghani that day,
// so the sale is 450,000 × 0.0016 = 720 afghani. They cost 30 afghani each to
// buy: 15 × 30 = 450. Profit 720 − 450 = 270 afghani; 270 / 720 = 37.5%.
const tomanSale = { id: 'inv-toman', currency: 'IRR', subtotal: 450_000, discountTotal: 0 }
const tomanLine = {
  invoiceId: 'inv-toman',
  productId: 'bottle',
  productName: 'شیشه بطری',
  quantity: 15,
  totalPrice: 450_000,
}
const bottleCost = {
  invoiceId: 'inv-toman',
  productId: 'bottle',
  amount: 450,
  isEstimated: false,
  quantity: 15,
}
const afghaniSale = { id: 'inv-afn', currency: 'AFN', subtotal: 1_000, discountTotal: 0 }
const afghaniLine = {
  invoiceId: 'inv-afn',
  productId: 'gold',
  productName: 'طلا',
  quantity: 1,
  totalPrice: 1_000,
}
const goldCost = {
  invoiceId: 'inv-afn',
  productId: 'gold',
  amount: 800,
  isEstimated: false,
  quantity: 1,
}

const report = (rates: Map<string, number>) => {
  const { invoices, lines } = restateAtRates(
    [tomanSale, afghaniSale],
    [tomanLine, afghaniLine],
    rates,
    'AFN',
  )
  return buildProfitReport({
    ...period,
    currency: 'AFN',
    invoices,
    lines,
    consumptions: [bottleCost, goldCost],
    payrolls: [],
  })
}

describe('a foreign-currency sale WITH its rate', () => {
  const out = report(new Map([['inv-toman', 0.0016]]))

  it('⚠️ is counted in the books currency, at its own rate — with a profit and a percentage', () => {
    const bottle = out.products.find((row) => row.productId === 'bottle')
    expect(bottle).toMatchObject({ revenue: 720, cost: 450, profit: 270 })
    // 270 / 720, by hand.
    expect(bottle!.marginPercent).toBeCloseTo(37.5, 6)
  })

  it('the totals are one currency’s totals: 720 + 1,000 sold, 450 + 800 cost, 470 profit', () => {
    expect(out.totals).toMatchObject({
      revenue: 1_720,
      cost: 1_250,
      costStatus: 'known',
      knownGrossProfit: 470,
    })
    // Nothing is left over under «another currency».
    expect(out.otherCurrencies).toEqual([])
  })

  it('scale: a toman figure never enters the afghani total as itself', () => {
    expect(out.totals.revenue).toBeLessThan(10_000)
  })
})

describe('a foreign-currency sale WITHOUT a rate (made before rates were kept)', () => {
  const out = report(new Map())

  it('⚠️ is NOT converted at 1 = 1: it stays out of the books-currency figures, and is counted as other', () => {
    expect(out.totals).toMatchObject({ revenue: 1_000, cost: 800, knownGrossProfit: 200 })
    expect(out.otherCurrencies).toEqual([{ currency: 'IRR', invoices: 1, payrolls: 0 }])
    expect(out.products.some((row) => row.productId === 'bottle')).toBe(false)
  })
})

describe('restateAtRates', () => {
  it('leaves an invoice of the books currency alone, whatever rate is passed for it', () => {
    const { invoices, lines } = restateAtRates(
      [afghaniSale],
      [afghaniLine],
      new Map([['inv-afn', 75]]),
      'AFN',
    )
    expect(invoices).toEqual([afghaniSale])
    expect(lines).toEqual([afghaniLine])
  })

  it('a rate that is not a positive number is no rate', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { invoices } = restateAtRates(
        [tomanSale],
        [tomanLine],
        new Map([['inv-toman', bad]]),
        'AFN',
      )
      expect(invoices[0], String(bad)).toEqual(tomanSale)
    }
  })

  it('the discount is restated with the subtotal, and only the lines of that invoice', () => {
    const { invoices, lines } = restateAtRates(
      [{ ...tomanSale, discountTotal: 50_000 }, afghaniSale],
      [tomanLine, afghaniLine],
      new Map([['inv-toman', 0.0016]]),
      'AFN',
    )
    // 50,000 × 0.0016 = 80.
    expect(invoices[0]).toMatchObject({ currency: 'AFN', subtotal: 720, discountTotal: 80 })
    expect(lines.map((line) => line.totalPrice)).toEqual([720, 1_000])
  })

  it('works whichever currency the books are in: a dollar business selling in afghani', () => {
    // 70,000 afghani at 1 afghani = 0.0143 dollars → 1,001 dollars.
    const { invoices } = restateAtRates(
      [{ id: 'x', currency: 'AFN', subtotal: 70_000, discountTotal: 0 }],
      [],
      new Map([['x', 0.0143]]),
      'USD',
    )
    expect(invoices[0]).toMatchObject({ currency: 'USD', subtotal: 1_001 })
  })
})

describe('where it is applied', () => {
  const repo = readFileSync(
    join(__dirname, '../services/accounting/accounting.repository.ts'),
    'utf8',
  )
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')

  it('both reads the profit report is built from restate their invoices — the period and the single invoice', () => {
    expect(
      repo.split('await this.restateInBooksCurrency(workspaceId, read, details.lines)').length - 1,
    ).toBe(2)
  })

  it('⚠️ only invoices that HAVE a rate are read, inside the workspace; no column = nothing restated', () => {
    expect(repo).toContain(".not('exchange_rate', 'is', null)")
    expect(repo).toContain(
      "if (['42703', 'PGRST204'].includes(error.code ?? '')) return { invoices, lines }",
    )
    const helper = repo.slice(repo.indexOf('private async restateInBooksCurrency'))
    expect(helper.slice(0, 900)).toContain(".eq('workspace_id', workspaceId)")
  })
})
