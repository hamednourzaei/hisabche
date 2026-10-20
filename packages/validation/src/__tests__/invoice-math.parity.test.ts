// ═══════════════════════════════════════════════════════════════════════════
// THE RULE THE DEVICE WILL RUN MUST PRODUCE THE SERVER'S NUMBER.
//
// This is the Gate-2 test the owner asked for: the grid's `summarize` (what a
// person approves on screen, and what the offline device will total with no
// network) and the server's `computeInvoiceMoney` (what `invoices.total` is)
// must agree TO THE SMALLEST UNIT OF THE CURRENCY — not «within a tolerance».
//
// ⚠️ F2-01 — DECIDED 19 OCT 2026. The server used to sum the exact line
// fractions and round once, so a few sub-cent lines produced a total that did
// not foot to the printed lines. It now rounds each line in the currency's
// minor unit first, the same rule the grid uses, and the 0.335 fixture in the
// table below (AFN and USD) is the case that used to differ by one unit.
//
// ⚠️ TWO CURRENCIES IN EVERY FIXTURE, AND THE TWO ARE DELIBERATELY DIFFERENT:
//   AFN — 0 minor units. A half-afghani does not exist, so rounding a line at
//         the currency's precision and rounding the sum at two decimals can
//         produce two different whole numbers.
//   USD — 2 minor units. A quantity with three decimals (grams) creates a
//         fraction of a cent per line, which is where per-line rounding and
//         sum-then-round drift apart by cents.
// A fixture that only used USD would pass while AFN was wrong, and vice versa.
//
// ⚠️ THE COMPARISON IS IN MINOR UNITS. Comparing the major-unit floats would
// hide the exact defect this file exists to catch: 3601.5 stored against 3602
// displayed is a one-afghani difference that `Math.abs(a - b) < 1` calls equal.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'

import { FRACTION_DIGITS } from '@hisabche/formatting'

import { computeInvoiceMoney, computeItemTotalRounded } from '../schemas/invoice-math'
import {
  COLUMN,
  currencyPrecision,
  defaultColumns,
  emptyRow,
  rowToInvoiceItem,
  summarize,
  type GridMoneyContext,
  type InvoiceGridRow,
} from '../schemas/invoice-grid'

type TestCurrency = 'AFN' | 'USD'

/** The amount the books carry, as an integer in the currency's smallest unit. */
function minorUnits(amount: number, currency: TestCurrency): number {
  return Math.round(amount * 10 ** FRACTION_DIGITS[currency])
}

interface RowSpec {
  description: string
  quantity: string
  unitPrice: string
  discount?: string
  tax?: string
}

interface Fixture {
  name: string
  /** Why this fixture exists — the failure it is shaped to catch. */
  why: string
  rows: Record<TestCurrency, RowSpec[]>
  discountValue: number
  discountType: 'fixed' | 'percentage'
  taxRate: number
}

const FIXTURES: Fixture[] = [
  {
    name: 'two whole-priced lines, a fixed discount and 5% tax',
    why: 'the ordinary sale; nothing rounds and the two sides must be identical',
    rows: {
      AFN: [
        { description: 'قند', quantity: '2', unitPrice: '1200' },
        { description: 'چای', quantity: '3', unitPrice: '75' },
      ],
      USD: [
        { description: 'Sugar', quantity: '2', unitPrice: '100.25' },
        { description: 'Tea', quantity: '3', unitPrice: '50.1' },
      ],
    },
    discountValue: 10,
    discountType: 'fixed',
    taxRate: 5,
  },
  {
    name: 'a percentage discount on one line',
    why: 'the line discount is a percentage in the grid and money on the server',
    rows: {
      AFN: [{ description: 'برنج', quantity: '1', unitPrice: '4500', discount: '12' }],
      USD: [{ description: 'Rice', quantity: '1', unitPrice: '42.75', discount: '12' }],
    },
    discountValue: 0,
    discountType: 'fixed',
    taxRate: 0,
  },
  {
    name: 'a quantity in grams: 0.333 kg',
    why: 'a fraction of a cent per line; per-line rounding and sum-then-round differ here',
    rows: {
      AFN: [{ description: 'زعفران', quantity: '0.333', unitPrice: '250' }],
      USD: [{ description: 'Saffron', quantity: '0.333', unitPrice: '250.75' }],
    },
    discountValue: 0,
    discountType: 'fixed',
    taxRate: 0,
  },
  {
    name: 'a price half a unit above a whole number',
    why: 'AFN has no half unit; a line rounded to 0 decimals can differ from the stored sum by 1',
    rows: {
      AFN: [
        { description: 'روغن', quantity: '3', unitPrice: '1200.5' },
        { description: 'صابون', quantity: '2', unitPrice: '75.25' },
      ],
      USD: [
        { description: 'Oil', quantity: '3', unitPrice: '12.005' },
        { description: 'Soap', quantity: '2', unitPrice: '0.7525' },
      ],
    },
    discountValue: 0,
    discountType: 'fixed',
    taxRate: 10,
  },
  {
    name: 'three sub-cent quantities: 0.335 each',
    // F2-01, decided by the owner on 19 Oct 2026: the total is the sum of the
    // printed lines. AFN has no minor unit (0.335 × 250 = 83.75 → 84 a line),
    // USD has two (0.335 × 1.00 = 0.335 → 0.34 a line). Sum-then-round gives
    // 251 and 1.01; the invoice must foot, so it is 252 and 1.02.
    why: 'the defect this file was written for: per-line rounding vs sum-then-round',
    rows: {
      AFN: [
        { description: 'خط ۱', quantity: '0.335', unitPrice: '250' },
        { description: 'خط ۲', quantity: '0.335', unitPrice: '250' },
        { description: 'خط ۳', quantity: '0.335', unitPrice: '250' },
      ],
      USD: [
        { description: 'line 1', quantity: '0.335', unitPrice: '1' },
        { description: 'line 2', quantity: '0.335', unitPrice: '1' },
        { description: 'line 3', quantity: '0.335', unitPrice: '1' },
      ],
    },
    discountValue: 0,
    discountType: 'fixed',
    taxRate: 0,
  },
]

function gridFor(currency: TestCurrency, specs: RowSpec[]) {
  const columns = defaultColumns(currency)
  const ctx: GridMoneyContext = {
    currency,
    precision: currencyPrecision(currency),
    rates: {},
  }
  const rows: InvoiceGridRow[] = specs.map((spec, index) => {
    const row = emptyRow(`row-${index + 1}`, columns)
    return {
      id: row.id,
      values: {
        ...row.values,
        [COLUMN.description]: spec.description,
        [COLUMN.quantity]: spec.quantity,
        [COLUMN.unitPrice]: spec.unitPrice,
        ...(spec.discount ? { [COLUMN.discount]: spec.discount } : {}),
        ...(spec.tax ? { [COLUMN.tax]: spec.tax } : {}),
      },
    }
  })
  return { columns, ctx, rows }
}

describe('invoice money — the device and the server produce one number', () => {
  for (const fixture of FIXTURES) {
    for (const currency of ['AFN', 'USD'] as const) {
      it(`${currency}: ${fixture.name}`, () => {
        const { columns, ctx, rows } = gridFor(currency, fixture.rows[currency])

        // 1. What the person sees and approves on the grid today — and what the
        //    offline device will compute with no server to ask.
        const onScreen = summarize({
          rows,
          columns,
          ctx,
          discountValue: fixture.discountValue,
          discountType: fixture.discountType,
          taxRate: fixture.taxRate,
        })

        // 2. Exactly what the client sends: the grid rows mapped to the API
        //    item shape, and the settled discount the grid computed.
        const items = rows
          .map((row) => rowToInvoiceItem(row, columns, ctx))
          .filter((item): item is NonNullable<typeof item> => item !== null)
        const onServer = computeInvoiceMoney({
          items,
          discountTotal: onScreen.discountTotal,
          taxRate: fixture.taxRate,
          currency,
        })

        // 3. The comparison the owner asked for: the smallest unit, not a
        //    tolerance. A one-unit difference is a defect, not rounding.
        expect({
          subtotal: minorUnits(onServer.subtotal, currency),
          discount: minorUnits(onServer.discountTotal, currency),
          tax: minorUnits(onServer.taxTotal, currency),
          total: minorUnits(onServer.total, currency),
        }).toEqual({
          subtotal: minorUnits(onScreen.subtotal, currency),
          discount: minorUnits(onScreen.discountTotal, currency),
          tax: minorUnits(onScreen.taxTotal, currency),
          total: minorUnits(onScreen.total, currency),
        })
      })
    }
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ THE STORED LINE, NOT ONLY THE HEADER (rule 3, found 19 Oct 2026).
//
// Everything above is about the invoice HEADER. `invoice_items.total_price` was
// still written from the request body, so the one line-level money figure — the
// one the profit report shares an invoice's net sales by, and that a purchase's
// cost layer divides to get a unit cost — was the client's own. The server now
// derives it with `computeItemTotalRounded`, the very call `computeInvoiceMoney`
// totals with, so the two must agree PER LINE, and Σ stored lines must be the
// stored subtotal exactly (an invoice that does not foot is the defect F2-01
// exists for).
// ─────────────────────────────────────────────────────────────────────────────
describe('the stored line total is the printed line — and it foots', () => {
  for (const fixture of FIXTURES) {
    for (const currency of ['AFN', 'USD'] as const) {
      it(`${currency}: ${fixture.name}`, () => {
        const { columns, ctx, rows } = gridFor(currency, fixture.rows[currency])
        const items = rows
          .map((row) => rowToInvoiceItem(row, columns, ctx))
          .filter((item): item is NonNullable<typeof item> => item !== null)

        // What the server stores on each line…
        const storedPerLine = items.map((item) =>
          minorUnits(computeItemTotalRounded(item, currency), currency),
        )
        // …against what the grid printed on each line.
        const printedPerLine = items.map((item) => minorUnits(Number(item.totalPrice), currency))
        expect(storedPerLine).toEqual(printedPerLine)

        // And the invoice foots: the lines add up to the header's subtotal,
        // rounded once per line in the currency's smallest unit.
        const onServer = computeInvoiceMoney({ items, currency })
        const sumOfLines = storedPerLine.reduce((total, amount) => total + amount, 0)
        expect(sumOfLines).toBe(minorUnits(onServer.subtotal, currency))
      })
    }
  }

  it('⚠️ a line total the request invented changes nothing — line or header', () => {
    // A client could send any plausible number here. 3 × 0.335 is 1.005, and the
    // rule rounds a line in the currency's smallest unit first: 1.01 in USD.
    const claimed = { quantity: 3, unitPrice: 0.335, discount: 0, details: [], totalPrice: 9.99 }
    expect(computeItemTotalRounded(claimed, 'USD')).toBe(1.01)
    expect(computeInvoiceMoney({ items: [claimed], currency: 'USD' })).toEqual({
      subtotal: 1.01,
      discountTotal: 0,
      taxTotal: 0,
      total: 1.01,
    })
  })

  it('⚠️ IQD has three minor units: 3 × 0.0005 is 0.002, not the claimed 0.001', () => {
    const claimed = { quantity: 3, unitPrice: 0.0005, discount: 0, details: [], totalPrice: 0.001 }
    expect(computeItemTotalRounded(claimed, 'IQD')).toBe(0.002)
    expect(computeInvoiceMoney({ items: [claimed], currency: 'IQD' }).subtotal).toBe(0.002)
  })

  it('a component adds to the line, and the request cannot replace the sum', () => {
    // «قند ۲٬۰۰۰ + سنگ امیتیس ۱٬۰۰۰» totals 3,000 — with a totalPrice of «1» on
    // the request, which the rule ignores.
    const claimed = {
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      details: [
        { quantity: 1, amount: 2000 },
        { quantity: 2, amount: 500 },
      ],
      totalPrice: 1,
    }
    expect(computeItemTotalRounded(claimed, 'USD')).toBe(3000)
  })
})
