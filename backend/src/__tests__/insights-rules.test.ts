// ============================================
// The figures a copilot is allowed to talk about.
//
// The property under test throughout: every number is derived, reproducible,
// and carries what it came from. A model phrases these; it never produces
// them, and it must never be handed a confident number that was a guess.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  buildExplanation,
  compare,
  detectAnomalies,
  explainChange,
  grossMargin,
  grossProfit,
  type LineForReview,
  type PeriodTotals,
} from '../services/insights'

const totals = (revenue: number, cost: number): PeriodTotals => ({
  from: '2026-01-01',
  to: '2026-01-31',
  revenue,
  costOfGoodsSold: cost,
  invoiceCount: 10,
})

describe('profit and margin', () => {
  it('is revenue less the cost that was actually consumed', () => {
    expect(grossProfit(totals(1000, 600))).toBe(400)
  })

  it('reports margin as a percentage', () => {
    expect(grossMargin(totals(1000, 600))).toBe(40)
  })

  it('HAS NO MARGIN on zero revenue, rather than a margin of zero', () => {
    // A shop that sold nothing did not have a 0% margin month; it had no
    // margin at all, and showing 0% invites the wrong conclusion.
    expect(grossMargin(totals(0, 0))).toBeNull()
  })

  it('reports a negative margin when goods were sold below cost', () => {
    expect(grossMargin(totals(1000, 1200))).toBe(-20)
  })
})

describe('comparing two periods', () => {
  it('reports the absolute and percentage change', () => {
    const change = compare('profit', 400, 500)
    expect(change.absolute).toBe(100)
    expect(change.percent).toBe(25)
    expect(change.direction).toBe('up')
  })

  it('REFUSES to express growth from zero as a percentage', () => {
    // A jump from 0 to 50 is not "infinite growth" and must not be rendered
    // as a percentage at all.
    expect(compare('profit', 0, 50).percent).toBeNull()
  })

  it('reports a fall as down', () => {
    expect(compare('profit', 500, 400).direction).toBe('down')
  })

  it('reports no movement as flat', () => {
    expect(compare('profit', 500, 500).direction).toBe('flat')
  })
})

describe('explaining a change', () => {
  const previous = [
    { key: 'p1', label: 'A35', value: 300 },
    { key: 'p2', label: 'Cable', value: 200 },
  ]
  const current = [
    { key: 'p1', label: 'A35', value: 100 },
    { key: 'p2', label: 'Cable', value: 250 },
  ]

  it('names the items that account for the change, largest first', () => {
    // Not an adjective — the products whose margin fell, and by how much.
    const { contributors } = explainChange(previous, current)
    expect(contributors[0]!.key).toBe('p1')
    expect(contributors[0]!.delta).toBe(-200)
  })

  it('KEEPS an item that moved against the overall direction', () => {
    // Hiding it would make the remaining shares sum to more than the change
    // and quietly overstate every cause.
    const { contributors } = explainChange(previous, current)
    expect(contributors.map((c) => c.key)).toContain('p2')
    expect(contributors.find((c) => c.key === 'p2')!.delta).toBe(50)
  })

  it('reports the total change alongside the parts', () => {
    expect(explainChange(previous, current).total.absolute).toBe(-150)
  })

  it('handles an item that appeared or disappeared entirely', () => {
    const { contributors } = explainChange(
      [{ key: 'gone', label: 'Old', value: 100 }],
      [{ key: 'new', label: 'New', value: 100 }],
    )
    expect(contributors).toHaveLength(2)
  })

  it('ignores items that did not move', () => {
    const flat = [{ key: 'p1', label: 'A35', value: 100 }]
    expect(explainChange(flat, flat).contributors).toEqual([])
  })
})

describe('anomalies are found by arithmetic, not by hunch', () => {
  const line = (over: Partial<LineForReview>): LineForReview => ({
    invoiceId: 'i1',
    invoiceNumber: 'INV-1',
    productId: 'p1',
    productLabel: 'A35',
    revenue: 1000,
    cost: 600,
    ...over,
  })

  it('flags a sale below cost as high severity', () => {
    const found = detectAnomalies([line({ revenue: 500, cost: 800 })])
    expect(found[0]!.kind).toBe('sold_below_cost')
    expect(found[0]!.severity).toBe('high')
    expect(found[0]!.evidence.loss).toBe(300)
  })

  it('carries the numbers behind every finding', () => {
    // "This sale lost money" is only useful next to what it sold for and what
    // it cost.
    const found = detectAnomalies([line({ revenue: 500, cost: 800 })])
    expect(found[0]!.evidence).toMatchObject({ revenue: 500, cost: 800 })
  })

  it('flags a collapsed margin', () => {
    const found = detectAnomalies([line({ revenue: 1000, cost: 980 })])
    expect(found.some((a) => a.kind === 'margin_collapse')).toBe(true)
  })

  it('FLAGS A COST THE COSTING CORE HAD TO GUESS', () => {
    // The profit on this line is a guess too, and saying so is more useful
    // than a confident wrong number.
    const found = detectAnomalies([line({ costIsEstimated: true })])
    expect(found.some((a) => a.kind === 'estimated_cost')).toBe(true)
  })

  it('flags an unusual discount', () => {
    const found = detectAnomalies([line({ discountPercent: 60 })])
    expect(found.some((a) => a.kind === 'unusual_discount')).toBe(true)
  })

  it('says nothing about an ordinary healthy sale', () => {
    expect(detectAnomalies([line({})])).toEqual([])
  })

  it('puts the most severe first', () => {
    const found = detectAnomalies([
      line({ invoiceId: 'i2', discountPercent: 60 }),
      line({ invoiceId: 'i3', revenue: 100, cost: 500 }),
    ])
    expect(found[0]!.severity).toBe('high')
  })

  it('honours a workspace threshold', () => {
    const found = detectAnomalies([line({ revenue: 1000, cost: 900 })], { marginFloorPercent: 5 })
    expect(found).toEqual([])
  })
})

describe('what a model is handed', () => {
  it('carries the figures the claim rests on', () => {
    const explanation = buildExplanation({
      headlineKey: 'insights.profit.down',
      figures: { currentProfit: 400, previousProfit: 900 },
    })
    expect(explanation.figures.currentProfit).toBe(400)
    expect(explanation.headlineKey).toBe('insights.profit.down')
  })

  it('uses a KEY rather than a sentence, so it can be translated', () => {
    const explanation = buildExplanation({ headlineKey: 'insights.profit.up', figures: {} })
    expect(explanation.headlineKey).toMatch(/^[a-z][a-z.]+$/)
  })

  it('SAYS SO when an input was estimated rather than measured', () => {
    // An explanation built on a guessed cost that presents itself as fact is
    // the failure this whole core exists to prevent.
    const explanation = buildExplanation({
      headlineKey: 'insights.profit.down',
      figures: {},
      anomalies: [
        {
          kind: 'estimated_cost',
          subjectId: 'i1',
          subjectLabel: 'INV-1',
          evidence: { cost: 100 },
          severity: 'medium',
        },
      ],
    })
    expect(explanation.hasEstimatedInputs).toBe(true)
  })

  it('is clean when every input was measured', () => {
    expect(buildExplanation({ headlineKey: 'x', figures: {} }).hasEstimatedInputs).toBe(false)
  })
})
