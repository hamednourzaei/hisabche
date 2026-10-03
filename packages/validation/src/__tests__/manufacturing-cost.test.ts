// ============================================
// The production cost of ANY product.
//
// The fixtures are three unrelated trades on purpose — an assembled device, a
// repaired mechanical part, a dish made by weight — run through the SAME
// function with no option that says which is which. If one of them needed a
// branch, the model would be wrong; the last test reads the source to make
// sure no trade ever gets a name in it.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  COLUMN,
  computeProductionCost,
  laborCost,
  produceSchema,
  productionColumns,
  productionMoneyContext,
  rowTotal,
  type InvoiceColumn,
  type InvoiceGridRow,
} from '../index'

const columns = productionColumns('AFN')

function row(id: string, values: Record<string, string>, productId?: string): InvoiceGridRow {
  return { id, values, ...(productId ? { productId } : {}) }
}

const part = (id: string, name: string, quantity: string, unitCost: string, unit?: string) =>
  row(id, {
    [COLUMN.description]: name,
    [COLUMN.quantity]: quantity,
    [COLUMN.unitPrice]: unitCost,
    ...(unit ? { [COLUMN.unit]: unit } : {}),
  })

describe('computeProductionCost', () => {
  it('a line is quantity × unit cost, and the components are their sum', () => {
    const cost = computeProductionCost({
      currency: 'AFN',
      columns,
      rows: [
        part('1', 'screen', '1', '4200'),
        part('2', 'board', '1', '6100'),
        part('3', 'socket', '3', '150'),
      ],
      quantity: 1,
    })
    expect(cost.lines.map((line) => line.lineTotal)).toEqual([4200, 6100, 450])
    expect(cost.componentsCost).toBe(10750)
    expect(cost.unitCost).toBe(10750)
    expect(cost.total).toBe(10750)
  })

  it('uses the invoice grid’s own row total — one arithmetic, not a copy of it', () => {
    const rows = [part('1', 'gear', '2.5', '199.99')]
    const cost = computeProductionCost({
      currency: 'USD',
      columns: productionColumns('USD'),
      rows,
      quantity: 1,
    })
    expect(cost.lines[0]!.lineTotal).toBe(
      rowTotal(rows[0]!, productionColumns('USD'), productionMoneyContext('USD')),
    )
    expect(cost.lines[0]!.lineTotal).toBe(499.975)
  })

  // ⚠️ The invoice rounds a unit price to the currency's decimals. A cost may
  // not: AFN has none, and ten grams at 0.06 would cost NOTHING — every recipe
  // made by weight would be free, and a free product is a believable number.
  it('a cost below one unit of a no-decimal currency is not rounded away', () => {
    const cost = computeProductionCost({
      currency: 'AFN',
      columns,
      rows: [part('1', 'by weight', '10', '0.06', 'gram')],
      quantity: 100,
    })
    expect(cost.lines[0]!.unitCost).toBe(0.06)
    expect(cost.componentsCost).toBe(0.6)
    expect(cost.calculatedTotal).toBe(60)
    expect(cost.effectiveUnitCost).toBe(0.6)
  })

  it('a column the user added and marked as money is part of the line', () => {
    const withFitting: InvoiceColumn[] = [
      ...columns,
      {
        id: 'fitting',
        label: 'هزینه‌ی نصب',
        type: 'currency',
        system: false,
        visible: true,
        aggregate: true,
        includeInTotal: true,
        currency: 'AFN',
        precision: 0,
      },
    ]
    const cost = computeProductionCost({
      currency: 'AFN',
      columns: withFitting,
      rows: [
        row('1', {
          [COLUMN.description]: 'turbine',
          [COLUMN.quantity]: '1',
          [COLUMN.unitPrice]: '900',
          fitting: '100',
        }),
      ],
      quantity: 1,
    })
    expect(cost.componentsCost).toBe(1000)
    // …and the typed value survives in the cells, to be shown again.
    expect(cost.lines[0]!.cells.fitting).toBe('100')
  })

  it('a numeric column that is not money never changes the cost', () => {
    const withWeight: InvoiceColumn[] = [
      ...columns,
      {
        id: 'grams',
        label: 'گرم',
        type: 'decimal',
        system: false,
        visible: true,
        aggregate: true,
        precision: 1,
      },
    ]
    const cost = computeProductionCost({
      currency: 'AFN',
      columns: withWeight,
      rows: [
        row('1', {
          [COLUMN.description]: 'dough',
          [COLUMN.quantity]: '1',
          [COLUMN.unitPrice]: '30',
          grams: '250',
        }),
      ],
      quantity: 1,
    })
    expect(cost.componentsCost).toBe(30)
  })

  it('labour and other costs stay visible beside the components', () => {
    const cost = computeProductionCost({
      currency: 'AFN',
      columns,
      rows: [part('1', 'pepperoni', '10', '4', 'gram'), part('2', 'dough', '20', '1.5', 'gram')],
      otherCosts: [
        { label: 'box', amount: 12 },
        { label: 'gas', amount: 8 },
      ],
      labor: { workers: 2, minutes: 15, hourlyRate: 120 },
      quantity: 1,
    })
    expect(cost.componentsCost).toBe(70)
    expect(cost.otherCost).toBe(20)
    expect(cost.laborCost).toBe(60) // 2 × 0.25 h × 120
    expect(cost.unitCost).toBe(150)
    expect(cost.lines.filter((line) => line.kind === 'cost').map((line) => line.label)).toEqual([
      'box',
      'gas',
    ])
  })

  it('the run is the unit cost × quantity, and the unit comes back out of it', () => {
    const cost = computeProductionCost({
      currency: 'AFN',
      columns,
      rows: [part('1', 'a', '3', '10')],
      labor: { cost: 6 },
      quantity: 10,
    })
    expect(cost.unitCost).toBe(36)
    expect(cost.calculatedTotal).toBe(360)
    expect(cost.total).toBe(360)
    expect(cost.effectiveUnitCost).toBe(36)
  })

  it('an override is kept BESIDE the calculated total, never instead of it', () => {
    const cost = computeProductionCost({
      currency: 'AFN',
      columns,
      rows: [part('1', 'a', '3', '10')],
      quantity: 4,
      overrideTotal: 100,
    })
    expect(cost.calculatedTotal).toBe(120)
    expect(cost.overrideTotal).toBe(100)
    expect(cost.total).toBe(100)
    expect(cost.effectiveUnitCost).toBe(25)
  })

  it('an override of zero is an override; «none» is null', () => {
    const base = {
      currency: 'AFN' as const,
      columns,
      rows: [part('1', 'a', '1', '10')],
      quantity: 1,
    }
    expect(computeProductionCost({ ...base, overrideTotal: 0 }).total).toBe(0)
    expect(computeProductionCost({ ...base, overrideTotal: null }).total).toBe(10)
    expect(computeProductionCost(base).overrideTotal).toBeNull()
  })

  it('a row nobody typed in is not a component; a row with a cost but no name still counts', () => {
    const cost = computeProductionCost({
      currency: 'AFN',
      columns,
      rows: [
        row('empty', {}),
        row('nameless', { [COLUMN.quantity]: '2', [COLUMN.unitPrice]: '5' }),
      ],
      quantity: 1,
    })
    expect(cost.lines).toHaveLength(1)
    expect(cost.componentsCost).toBe(10)
  })

  it('keeps which product a component is, and its unit', () => {
    const cost = computeProductionCost({
      currency: 'AFN',
      columns,
      rows: [
        row(
          '1',
          {
            [COLUMN.description]: 'flour',
            [COLUMN.quantity]: '500',
            [COLUMN.unitPrice]: '0.06',
            [COLUMN.unit]: 'gram',
          },
          '6f1c2a34-0000-4000-8000-000000000001',
        ),
        part('2', 'typed by hand', '1', '5'),
      ],
      quantity: 1,
    })
    expect(cost.lines[0]).toMatchObject({
      productId: '6f1c2a34-0000-4000-8000-000000000001',
      unit: 'gram',
      quantity: 500,
    })
    expect(cost.lines[1]!.productId).toBeNull()
    expect(cost.componentsCost).toBe(35)
  })

  it('a job with no components at all — only labour — has a cost', () => {
    const cost = computeProductionCost({
      currency: 'AFN',
      columns,
      rows: [],
      labor: { cost: 250 },
      quantity: 3,
    })
    expect(cost.lines).toEqual([])
    expect(cost.total).toBe(750)
  })

  it('does not drift: a thousand lines of 0.1 are exactly 100', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => part(String(i), 'x', '1', '0.1'))
    const cost = computeProductionCost({
      currency: 'USD',
      columns: productionColumns('USD'),
      rows,
      quantity: 1,
    })
    expect(cost.componentsCost).toBe(100)
  })

  it('a non-positive quantity is no run: the totals are zero, not NaN or Infinity', () => {
    const cost = computeProductionCost({
      currency: 'AFN',
      columns,
      rows: [part('1', 'a', '1', '10')],
      quantity: 0,
    })
    expect(cost.calculatedTotal).toBe(0)
    expect(cost.effectiveUnitCost).toBe(0)
  })
})

describe('laborCost', () => {
  it('an explicit cost wins over the rate', () => {
    expect(laborCost({ workers: 3, minutes: 240, hourlyRate: 100, cost: 900 }, 0)).toBe(900)
  })
  it('workers × hours × rate when no cost is given', () => {
    expect(laborCost({ workers: 3, minutes: 240, hourlyRate: 100 }, 0)).toBe(1200)
  })
  it('time and head-count without a rate are recorded, not priced', () => {
    expect(laborCost({ workers: 3, minutes: 240 }, 0)).toBe(0)
  })
  it('an explicit zero is zero, not «derive it»', () => {
    expect(laborCost({ workers: 3, minutes: 240, hourlyRate: 100, cost: 0 }, 0)).toBe(0)
  })
})

describe('produceSchema', () => {
  const valid = {
    productId: '6f1c2a34-0000-4000-8000-000000000001',
    currency: 'AFN',
    columns,
    rows: [part('1', 'a', '1', '10')],
    quantity: 2,
    idempotencyKey: 'press-0001',
  }

  it('defaults: no inventory, consume with inventory, keep the definition', () => {
    const parsed = produceSchema.parse(valid)
    expect(parsed.addToInventory).toBe(false)
    expect(parsed.consumeComponents).toBe(true)
    expect(parsed.saveDefinition).toBe(true)
    expect(parsed.otherCosts).toEqual([])
  })

  it('an override needs a reason, and says which field', () => {
    const result = produceSchema.safeParse({ ...valid, overrideTotal: 5 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.errors[0]!.path).toEqual(['overrideReason'])
    expect(
      produceSchema.safeParse({ ...valid, overrideTotal: 5, overrideReason: 'agreed' }).success,
    ).toBe(true)
  })

  it('refuses a non-positive quantity and a missing key', () => {
    expect(produceSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false)
    expect(produceSchema.safeParse({ ...valid, idempotencyKey: '' }).success).toBe(false)
  })

  it('a column field the grid adds later is not stripped on the way in', () => {
    const parsed = produceSchema.parse({
      ...valid,
      columns: [
        ...columns,
        {
          id: 'x',
          label: 'x',
          type: 'currency',
          system: false,
          visible: true,
          aggregate: true,
          precision: 0,
          includeInTotal: true,
          typeLabel: 'اجرت',
        },
      ],
    })
    expect(parsed.columns.at(-1)).toMatchObject({ includeInTotal: true, typeLabel: 'اجرت' })
  })
})

describe('the core names no trade', () => {
  it('no industry word appears in the cost model, the service or the migration', () => {
    const root = join(__dirname, '..', '..', '..', '..')
    const strip = (source: string) =>
      source
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|\/\*|--)/.test(line))
        .join('\n')
    const files = [
      join(__dirname, '..', 'schemas', 'manufacturing-cost.ts'),
      join(root, 'backend', 'src', 'services', 'manufacturing.service.ts'),
      join(root, 'docs', 'manufacturing-01-migration.sql'),
    ]
    const trade = /\b(lcd|cpu|motherboard|gearbox|turbine|pepperoni|pizza|phone|camera)\b/i
    for (const file of files) {
      const hit = trade.exec(strip(readFileSync(file, 'utf8')))
      expect(hit?.[0] ?? null, file).toBeNull()
    }
  })
})
