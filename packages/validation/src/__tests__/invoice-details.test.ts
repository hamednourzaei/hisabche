// ============================================
// Unified sale/purchase + nested item details.
//
// The load-bearing assertion in this file is BACKWARD COMPATIBILITY: an
// invoice item written before this change must still validate, and must still
// produce the same total. `details` defaults to [] and `detailsArePriced`
// defaults to false precisely so that is true.
// ============================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  computeItemTotal,
  invoiceItemDetailSchema,
  invoiceItemSchema,
  settlementDate,
  unitSchema,
} from '../index'

const legacyItem = {
  productName: 'گردنبند',
  quantity: 1,
  unitPrice: 50000,
  totalPrice: 50000,
}

describe('BACKWARD COMPATIBILITY: items written before this change', () => {
  it('an item with no details still validates', () => {
    const parsed = invoiceItemSchema.parse(legacyItem)
    expect(parsed.details).toEqual([])
    expect(parsed.unit).toBe('piece')
  })

  it('its total is unchanged — details cannot silently re-price it', () => {
    expect(computeItemTotal(legacyItem)).toBe(50000)
  })

  it('a simple sale is never forced to fill details', () => {
    expect(invoiceItemSchema.safeParse(legacyItem).success).toBe(true)
  })

  it('every previously valid unit is still valid', () => {
    for (const unit of ['piece', 'kg', 'meter', 'liter', 'box', 'pack']) {
      expect(unitSchema.safeParse(unit).success).toBe(true)
    }
  })
})

describe('nested details', () => {
  const necklace = {
    productName: 'گردنبند',
    quantity: 1,
    unitPrice: 50000,
    totalPrice: 50000,
    details: [
      { title: 'زنجیر', quantity: 1, amount: 40000, sortOrder: 0 },
      { title: 'سنگ', quantity: 2, amount: 2500, sortOrder: 1 },
      { title: 'اجرت', quantity: 1, amount: 5000, sortOrder: 2 },
    ],
  }

  it('accepts an unlimited number of details', () => {
    const many = {
      ...legacyItem,
      details: Array.from({ length: 50 }, (_, i) => ({
        title: `جزء ${i}`,
        quantity: 1,
        amount: 100,
        sortOrder: i,
      })),
    }
    expect(invoiceItemSchema.parse(many).details).toHaveLength(50)
  })

  it('preserves the order the user typed', () => {
    const parsed = invoiceItemSchema.parse(necklace)
    expect(parsed.details.map((d) => d.title)).toEqual(['زنجیر', 'سنگ', 'اجرت'])
    expect(parsed.details.map((d) => d.sortOrder)).toEqual([0, 1, 2])
  })

  it('THE RULE: components ADD to the base — قند ۲٬۰۰۰ + سنگ ۱٬۰۰۰ = ۳٬۰۰۰', () => {
    expect(
      computeItemTotal({
        quantity: 1,
        unitPrice: 2000,
        details: [{ quantity: 1, amount: 1000 }],
      }),
    ).toBe(3000)
  })

  it('an item with no price of its own is just the sum of its parts', () => {
    // زنجیر 1×40000 + سنگ 2×2500 + اجرت 1×5000 = 50000
    expect(computeItemTotal({ ...necklace, unitPrice: 0 })).toBe(50000)
  })

  it('base plus components when both are present', () => {
    // 1×50000 base + 50000 of components
    expect(computeItemTotal(necklace)).toBe(100000)
  })

  it('applies the line discount to the combined total', () => {
    expect(computeItemTotal({ ...necklace, unitPrice: 0, discount: 10 })).toBe(45000)
  })

  it('the deprecated detailsArePriced flag no longer changes anything', () => {
    const withFlag = { ...necklace, detailsArePriced: true }
    expect(computeItemTotal(withFlag)).toBe(computeItemTotal(necklace))
  })
})

describe('detail validation', () => {
  it('requires a title', () => {
    expect(invoiceItemDetailSchema.safeParse({ title: '', quantity: 1, amount: 10 }).success).toBe(
      false,
    )
  })

  it('rejects a negative amount and a zero quantity', () => {
    expect(invoiceItemDetailSchema.safeParse({ title: 'x', quantity: 1, amount: -1 }).success).toBe(
      false,
    )
    expect(invoiceItemDetailSchema.safeParse({ title: 'x', quantity: 0, amount: 1 }).success).toBe(
      false,
    )
  })

  it('defaults quantity, amount, unit and sortOrder', () => {
    const parsed = invoiceItemDetailSchema.parse({ title: 'اجرت' })
    expect(parsed).toMatchObject({ quantity: 1, amount: 0, unit: 'piece', sortOrder: 0 })
  })
})

describe('CONTRACT: the unit enum must not drift from the `units` table', () => {
  /**
   * ⚠️ THIS CONTRACT USED TO POINT AT A HARDCODED UI ARRAY.
   *
   * It mirrored nine literals with the note «packages/ui cannot import this
   * package, so it mirrors the union». Both halves have since stopped being
   * true: packages/ui depends on this package, and — since T2 — it has no unit
   * list of its own at all. It renders whatever `GET /api/units` returns.
   *
   * So the thing worth pinning moved. The authority is now the `units` table
   * created and seeded by `phase-l-01`, and the failure this guards is the one
   * the owner actually hit: fifteen units were seeded, the enum listed nine,
   * and a tonne could not be saved.
   */
  const seededCodes = (): string[] => {
    const sql = readFileSync(
      resolve(__dirname, '../../../..', 'docs/phase-l-01-units-migration.sql'),
      'utf8',
    )
    const insert = /INSERT INTO units \([^)]*\) VALUES([\s\S]*?)ON CONFLICT/.exec(sql)?.[1]
    expect(insert, 'the seed INSERT was not found').toBeDefined()
    // Comments stripped first: the seed block discusses units in prose, and
    // matching that prose instead of the rows is a mistake made before.
    return [...insert!.replace(/--[^\n]*/g, '').matchAll(/\(\s*'([a-z]+)'/g)].map((m) => m[1]!)
  }

  it('every seeded unit is accepted by the schema', () => {
    for (const unit of seededCodes()) {
      expect(unitSchema.safeParse(unit).success, `${unit} is seeded but rejected`).toBe(true)
    }
  })

  it('the schema adds nothing beyond the table except `custom`', () => {
    // `custom` has no row on purpose: it means «the user typed their own
    // word», it has no dimension and no conversion factor, and giving it one
    // would let the converter use it.
    const extra = unitSchema.options.filter((code) => !seededCodes().includes(code))
    expect(extra).toEqual(['custom'])
  })

  it('the tonne — the unit this whole change was asked for', () => {
    expect(unitSchema.safeParse('ton').success).toBe(true)
  })
})

describe('custom unit', () => {
  it("'custom' is a valid unit so users can name their own", () => {
    expect(unitSchema.safeParse('custom').success).toBe(true)
  })

  it('carries a free-text label alongside it', () => {
    const item = invoiceItemSchema.parse({
      productName: 'طلا',
      quantity: 3,
      unit: 'custom',
      unitLabel: 'مثقال',
      unitPrice: 100000,
      totalPrice: 300000,
    })
    expect(item.unit).toBe('custom')
    expect(item.unitLabel).toBe('مثقال')
  })

  it('rejects an empty label', () => {
    expect(
      invoiceItemSchema.safeParse({
        productName: 'x',
        quantity: 1,
        unit: 'custom',
        unitLabel: '   ',
        unitPrice: 1,
        totalPrice: 1,
      }).success,
    ).toBe(false)
  })

  it('a detail can carry a custom unit too', () => {
    const detail = invoiceItemDetailSchema.parse({
      title: 'نگین',
      unit: 'custom',
      unitLabel: 'قیراط',
    })
    expect(detail.unitLabel).toBe('قیراط')
  })

  it('unitLabel stays optional for the standard units', () => {
    expect(invoiceItemSchema.parse(legacyItem).unitLabel).toBeUndefined()
  })
})

describe('units and weight — the gold case', () => {
  it('gram is a supported unit', () => {
    expect(unitSchema.safeParse('gram').success).toBe(true)
    expect(unitSchema.safeParse('carton').success).toBe(true)
  })

  it('10 grams of gold: quantity carries the grams, unit says so', () => {
    const gold = invoiceItemSchema.parse({
      productName: 'طلا',
      quantity: 10,
      unit: 'gram',
      unitPrice: 5000,
      totalPrice: 50000,
    })
    expect(gold.unit).toBe('gram')
    expect(computeItemTotal(gold)).toBe(50000)
  })

  it('WEIGHT IS NOT QUANTITY: one necklace weighing 12.5 g', () => {
    const item = invoiceItemSchema.parse({
      productName: 'گردنبند',
      quantity: 1,
      unit: 'piece',
      weightGrams: 12.5,
      unitPrice: 50000,
      totalPrice: 50000,
    })
    expect(item.quantity).toBe(1)
    expect(item.weightGrams).toBe(12.5)
    expect(item.quantity).not.toBe(item.weightGrams)
  })

  it('a detail can carry its own weight', () => {
    const stone = invoiceItemDetailSchema.parse({
      title: 'سنگ',
      quantity: 1,
      amount: 300,
      weightGrams: 2.4,
    })
    expect(stone.weightGrams).toBe(2.4)
  })
})

// ============================================
// Settlement date.
//
// The «تاریخ تسویه» column on web and the settled line on the mobile card read
// this one helper. These pin the rule so one platform cannot start dating a
// settlement that has not happened.
// ============================================

describe('settlementDate', () => {
  it('returns the completion timestamp for a completed invoice', () => {
    expect(settlementDate({ status: 'completed', updatedAt: '2026-08-10T09:00:00Z' })).toBe(
      '2026-08-10T09:00:00Z',
    )
  })

  it('returns null for every status that is not completed', () => {
    for (const status of ['pending', 'paid', 'partial', 'overdue', 'cancelled']) {
      expect(settlementDate({ status, updatedAt: '2026-08-10T09:00:00Z' })).toBeNull()
    }
  })

  it('returns null when a completed invoice carries no timestamp', () => {
    expect(settlementDate({ status: 'completed' })).toBeNull()
    expect(settlementDate({ status: 'completed', updatedAt: null })).toBeNull()
  })

  it('treats a missing status as unsettled rather than defaulting to settled', () => {
    expect(settlementDate({ updatedAt: '2026-08-10T09:00:00Z' })).toBeNull()
  })
})
