// ============================================
// Unit labels are shown next to every invoice quantity. A missing one renders
// a bare number — "10" instead of "10 گرم" — which on a gold invoice is a
// materially different claim. These tests pin coverage across all locales and
// keep the mobile bundle aligned with the canonical `unitSchema` enum.
// ============================================

import { unitSchema } from '@hisabche/validation'

import { mobileStrings } from '../mobile-strings'

const LOCALES = ['fa-IR', 'fa-AF', 'en'] as const
const UNITS = unitSchema.options

describe('mobile unit labels', () => {
  it('covers every unit in the canonical schema', () => {
    // Adding a unit to `unitSchema` without a label here should fail loudly
    // rather than ship a blank label. Collecting the gaps first means the
    // failure names every missing label, not just the first one.
    const missing = LOCALES.flatMap((locale) =>
      UNITS.filter((unit) => !mobileStrings[locale].units[unit]).map((unit) => `${locale}.${unit}`),
    )

    expect(missing).toEqual([])
  })

  it('defines no labels beyond the schema', () => {
    for (const locale of LOCALES) {
      expect(Object.keys(mobileStrings[locale].units).sort()).toEqual([...UNITS].sort())
    }
  })

  it('distinguishes weight units from count units', () => {
    // `gram` and `piece` back the two separate concepts the invoice model
    // keeps apart: "10 grams of gold" vs "1 necklace weighing 12.5 g".
    for (const locale of LOCALES) {
      const labels = mobileStrings[locale].units
      expect(labels.gram).not.toBe(labels.piece)
      expect(labels.kg).not.toBe(labels.gram)
    }
  })

  it('translates units for English rather than falling back to Persian', () => {
    expect(mobileStrings.en.units.gram).toBe('g')
    expect(mobileStrings.en.units.piece).toBe('pcs')
    expect(mobileStrings.en.units.gram).not.toBe(mobileStrings['fa-IR'].units.gram)
  })

  it('keeps Dari unit labels present', () => {
    for (const unit of UNITS) {
      expect(mobileStrings['fa-AF'].units[unit]).toBeTruthy()
    }
  })
})

describe('mobile transaction terminology', () => {
  it.each(LOCALES)('%s names sale and purchase distinctly', (locale) => {
    const sales = mobileStrings[locale].sales
    expect(sales.sale).toBeTruthy()
    expect(sales.purchase).toBeTruthy()
    expect(sales.sale).not.toBe(sales.purchase)
  })

  it.each(LOCALES)('%s names the counterparty differently per direction', (locale) => {
    // A sale has a buyer (`customer`); a purchase has a seller (`supplier`).
    const sales = mobileStrings[locale].sales
    expect(sales.customer).toBeTruthy()
    expect(sales.supplier).toBeTruthy()
    expect(sales.customer).not.toBe(sales.supplier)
  })

  it.each(LOCALES)('%s labels weight and details for invoice items', (locale) => {
    const sales = mobileStrings[locale].sales
    expect(sales.weightGrams).toBeTruthy()
    expect(sales.details).toBeTruthy()
  })
})
